import { buildAssistantEngineContext, isAssistantContextStale } from '@/lib/assistant/engine-context';
import {
  compileReKuiperGraph,
  importReKuiperGraph,
} from '@/lib/flows/compiler/rekuiper/compile-graph';
import { evaluateCrossEngineCopy } from '@/lib/flows/compiler/rekuiper/convert';
import { canExecuteInMode, validateDeclarativeManifest } from '../declarative';
import { normalizeDlqResponse } from '../diagnostics';
import { getExtensionSurfacePolicy } from '../extensions';
import { detectDuplicateDirectRegistration } from '../fleet';
import { executeStagedPipelineDeploy, filterRecipesForTarget } from '../recipes';
import { buildStreamDdlPreview, inferSchemaFromSampleJson } from '../schema-inference';
import {
  acquireTapLease,
  BoundedSampleBuffer,
  releaseTapLease,
  resetTapLeasesForTest,
} from '../tap-leases';

describe('EA-07 through EA-14 engine-aware features', () => {
  beforeEach(() => {
    resetTapLeasesForTest();
  });

  it('infers typed fields from sample JSON and builds target DDL', () => {
    const fields = inferSchemaFromSampleJson({
      deviceId: 'dev-1',
      count: 10,
      temp: 36.5,
      active: true,
      tags: ['a'],
      meta: { site: 'b' },
    });
    expect(fields.map((f) => `${f.name}:${f.type}`)).toEqual([
      'deviceId:string',
      'count:bigint',
      'temp:float',
      'active:boolean',
      'tags:array',
      'meta:struct',
    ]);
    const ddl = buildStreamDdlPreview({
      engineFamily: 'rekuiper',
      kind: 'stream',
      name: 'telemetry',
      fields,
      sourceType: 'mqtt',
      datasource: 'sensors/#',
    });
    expect(ddl).toContain('CREATE STREAM telemetry');
    expect(ddl).toContain('TYPE="mqtt"');
  });

  it('filters recipes by engine and reports partial staged deploy outcomes', async () => {
    const ekRecipes = filterRecipesForTarget({ engineFamily: 'ekuiper', capabilities: { 'rules.sql': true } });
    expect(ekRecipes.some((r) => r.id === 'simulator-window-agg')).toBe(false);

    const rkRecipes = filterRecipesForTarget({ engineFamily: 'rekuiper', capabilities: { 'rules.sql': true } });
    expect(rkRecipes.some((r) => r.id === 'simulator-window-agg')).toBe(true);

    const res = await executeStagedPipelineDeploy([
      { kind: 'stream', name: 's1', execute: async () => undefined },
      {
        kind: 'rule',
        name: 'r1',
        execute: async () => {
          throw new Error('syntax error');
        },
      },
    ]);
    expect(res.success).toBe(false);
    expect(res.created).toEqual([{ kind: 'stream', name: 's1' }]);
    expect(res.failed).toEqual({ kind: 'rule', name: 'r1', error: 'syntax error' });
  });

  it('round-trips reKuiper multi-port graphs with empty leading ports and blocks incompatible cross-engine copy', () => {
    const compiled = compileReKuiperGraph({
      id: 'switch-rule',
      nodes: [
        { id: 'src', type: 'source', nodeType: 'mqtt', props: { datasource: 'in/#' }, isSource: true },
        { id: 'sw', type: 'operator', nodeType: 'switch', props: { cases: ['a', 'b'] } },
        { id: 'sink2', type: 'sink', nodeType: 'log', props: {}, opaque: { customFlag: 42 } },
      ],
      edges: [
        { source: 'src', target: 'sw', sourcePort: 0 },
        { source: 'sw', target: 'sink2', sourcePort: 1 }, // port 0 intentionally empty
      ],
    });
    expect(compiled.graph.topo.edges.sw).toEqual([[], ['sink2']]);

    const imported = importReKuiperGraph(compiled);
    expect(imported.edges).toEqual([
      { source: 'src', target: 'sw', sourcePort: 0 },
      { source: 'sw', target: 'sink2', sourcePort: 1 },
    ]);
    expect(imported.nodes.find((n) => n.id === 'sink2')?.opaque).toEqual({ customFlag: 42 });

    const copyReport = evaluateCrossEngineCopy({
      sourceEngine: 'rekuiper',
      targetEngine: 'ekuiper',
      nodes: imported.nodes,
      edges: imported.edges,
    });
    expect(copyReport.compatible).toBe(false);
    expect(copyReport.blockers[0]).toContain('Multi-port edge routing');
  });

  it('enforces tap lease limits, external tap preservation, and 500-sample buffer caps', () => {
    const ext = acquireTapLease({
      userId: 'u1',
      nodeId: 'n1',
      ruleId: 'r1',
      tapNodeId: 'src',
      externallyEnabled: true,
    });
    expect(ext.ok).toBe(true);
    if (ext.ok) {
      expect(ext.shouldEnableUpstream).toBe(false);
      expect(releaseTapLease(ext.lease.leaseId).shouldDisableUpstream).toBe(false);
    }

    for (let i = 0; i < 5; i += 1) {
      expect(acquireTapLease({ userId: 'u2', nodeId: 'n1', ruleId: `r${i}`, tapNodeId: 'n' }).ok).toBe(true);
    }
    const sixth = acquireTapLease({ userId: 'u2', nodeId: 'n1', ruleId: 'r6', tapNodeId: 'n' });
    expect(sixth.ok).toBe(false);

    const buf = new BoundedSampleBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);
    expect(buf.snapshot()).toEqual({ samples: [2, 3, 4], dropped: 1 });
  });

  it('normalizes DLQ stages, extension/declarative policies, fleet duplicates, and assistant staleness', () => {
    const dlq = normalizeDlqResponse('r1', [{ stage: 'sink', error: 'timeout' }, { stage: 'codec', error: 'bad json' }]);
    expect(dlq.stageCounts.sink).toBe(1);
    expect(dlq.stageCounts.codec).toBe(1);
    expect(dlq.replaySupported).toBe(false);

    expect(getExtensionSurfacePolicy('rekuiper').portablePluginsMutable).toBe(false);
    expect(canExecuteInMode('declarative', false).allowed).toBe(false);
    expect(validateDeclarativeManifest({ rules: {} }).valid).toBe(true);
    expect(detectDuplicateDirectRegistration('http://10.0.0.5:9081/', [{ id: 'n1', baseUrl: 'http://10.0.0.5:9081' }])).toBe('n1');

    const ctx1 = buildAssistantEngineContext({ nodeId: 'n1', engineFamily: 'ekuiper', profileRevision: 1 });
    const ctx2 = buildAssistantEngineContext({ nodeId: 'n2', engineFamily: 'rekuiper', profileRevision: 1 });
    expect(isAssistantContextStale(ctx1, ctx2)).toBe(true);
    expect(ctx2.allowedToolCategories).toContain('dlq');
  });
});

