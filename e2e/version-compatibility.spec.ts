import { test, expect, type Page } from '@playwright/test';
import { captureUnexpectedErrors, ensureSignedIn, openFlowStudioPanels } from './helpers';

test.describe.configure({ mode: 'serial' });

interface ProbedNode {
  id: string;
  name: string;
  status: string;
  version: string | null;
}

function parseSemver(version?: string | null): [number, number, number] | null {
  if (!version) return null;
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isAtLeastVersion(version: string | null | undefined, target: [number, number, number]): boolean {
  const parsed = parseSemver(version);
  if (!parsed) return false;
  for (let i = 0; i < 3; i += 1) {
    if (parsed[i] > target[i]) return true;
    if (parsed[i] < target[i]) return false;
  }
  return true;
}

async function apiJson<T>(page: Page, url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const result = await page.evaluate(
    async ({ targetUrl, method, body }) => {
      const response = await fetch(targetUrl, {
        method: method ?? 'GET',
        cache: 'no-store',
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      return { ok: response.ok, status: response.status, json };
    },
    { targetUrl: url, method: init?.method, body: init?.body },
  );

  if (!result.ok) {
    throw new Error(`Request ${init?.method ?? 'GET'} ${url} failed (${result.status}): ${JSON.stringify(result.json)}`);
  }
  return result.json as T;
}

function getSourceRecordsInTotal(status: Record<string, unknown>, streamName: string): number {
  const direct = status[`source_${streamName}_0_records_in_total`];
  if (typeof direct === 'number' || typeof direct === 'string') {
    return Number(direct);
  }
  const match = Object.entries(status).find(
    ([key]) => key.startsWith('source_') && key.endsWith('_records_in_total'),
  );
  return Number(match?.[1] ?? 0);
}

async function getActiveTargetNode(page: Page): Promise<ProbedNode> {
  const list = await apiJson<{ nodes: ProbedNode[]; selectedNodeId: string | null }>(page, '/api/nodes');
  const candidate =
    list.nodes.find((n) => n.id === list.selectedNodeId) ??
    list.nodes.find((n) => n.id === 'bundled-ekuiper') ??
    list.nodes[0];

  if (!candidate) {
    throw new Error('No registered eKuiper node available for E2E verification');
  }

  const probed = await apiJson<{ node: ProbedNode }>(
    page,
    `/api/nodes/${encodeURIComponent(candidate.id)}/probe`,
    { method: 'POST' },
  );
  expect(probed.node.status).toBe('ONLINE');
  expect(probed.node.version).toBeTruthy();
  return probed.node;
}

async function createAndSaveStreamSourceFlow(
  page: Page,
  input: {
    name: string;
    targetNodeId: string;
    savedStream: string;
    connector: 'memory' | 'file';
    outputTopic: string;
  },
): Promise<string> {
  const created = await apiJson<{ flow: { id: string } }>(page, '/api/flows', {
    method: 'POST',
    body: {
      name: input.name,
      targetNodeId: input.targetNodeId,
    },
  });
  const flowId = created.flow.id;

  await apiJson(page, `/api/flows/${encodeURIComponent(flowId)}/draft`, {
    method: 'PUT',
    body: {
      spec: {
        nodes: [
          {
            id: 'src-1',
            type: 'stream-source',
            typeVersion: 1,
            name: 'Stream Source',
            config: {
              stream: input.savedStream,
              connector: input.connector,
            },
          },
          {
            id: 'sink-1',
            type: 'memory-sink',
            typeVersion: 1,
            name: 'Memory Sink',
            config: {
              topic: input.outputTopic,
            },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            sourceNodeId: 'src-1',
            sourcePortId: 'out',
            targetNodeId: 'sink-1',
            targetPortId: 'in',
          },
        ],
      },
      layout: {
        nodes: {
          'src-1': { x: 140, y: 140 },
          'sink-1': { x: 460, y: 140 },
        },
      },
    },
  });

  return flowId;
}

async function cleanupResources(
  page: Page,
  resources: { flowIds?: string[]; ruleIds?: string[]; streamNames?: string[]; connIds?: string[] },
): Promise<void> {
  if (page.isClosed()) return;
  try {
    await page.evaluate(async ({ flowIds, ruleIds, streamNames, connIds }) => {
      for (const id of flowIds ?? []) {
        try {
          await fetch(`/api/flows/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch {
          // best-effort cleanup
        }
      }
      for (const id of ruleIds ?? []) {
        try {
          await fetch(`/api/ekuiper/rules/${encodeURIComponent(id)}/stop`, { method: 'POST' });
        } catch {
          // ignore
        }
        try {
          await fetch(`/api/ekuiper/rules/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch {
          // ignore
        }
      }
      for (const name of streamNames ?? []) {
        try {
          await fetch(`/api/ekuiper/streams/${encodeURIComponent(name)}`, { method: 'DELETE' });
        } catch {
          // ignore
        }
      }
      for (const id of connIds ?? []) {
        try {
          await fetch(`/api/ekuiper/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch {
          // ignore
        }
      }
    }, resources);
  } catch {
    // ignore context-closed teardown errors
  }
}

test('flow studio sourceName graphs warn on <2.5 targets and verify runtime output (#4213)', async ({ page }) => {
  test.setTimeout(180_000);
  await ensureSignedIn(page);
  const errors = captureUnexpectedErrors(page);
  const target = await getActiveTargetNode(page);
  const safeSourceNameGraphs = isAtLeastVersion(target.version, [2, 5, 0]);

  const ts = Date.now();
  const simStream = `e2e_sn_sim_${ts}`;
  const feederFileRule = `e2e_sn_fdr_file_${ts}`;
  const feederMemRule = `e2e_sn_fdr_mem_${ts}`;
  const jsonFileName = `e2e_sn_${ts}.json`;

  const typedMemStream = `e2e_sn_tmem_${ts}`;
  const schemalessMemStream = `e2e_sn_smem_${ts}`;
  const typedFileStream = `e2e_sn_tfile_${ts}`;
  const schemalessFileStream = `e2e_sn_sfile_${ts}`;

  const inTypedMemTopic = `e2e/sn/in/tmem/${ts}`;
  const inSchemalessMemTopic = `e2e/sn/in/smem/${ts}`;
  const outTypedMemTopic = `e2e/sn/out/tmem/${ts}`;
  const outSchemalessMemTopic = `e2e/sn/out/smem/${ts}`;
  const outTypedFileTopic = `e2e/sn/out/tfile/${ts}`;
  const outSchemalessFileTopic = `e2e/sn/out/sfile/${ts}`;

  const chkTypedMemStream = `e2e_chk_tmem_${ts}`;
  const chkSchemalessMemStream = `e2e_chk_smem_${ts}`;
  const chkTypedFileStream = `e2e_chk_tfile_${ts}`;
  const chkSchemalessFileStream = `e2e_chk_sfile_${ts}`;

  const chkTmemAll = { id: `e2e_chk_tmem_all_${ts}`, stream: chkTypedMemStream, filter: false };
  const chkTmemFld = { id: `e2e_chk_tmem_fld_${ts}`, stream: chkTypedMemStream, filter: true };
  const chkSmemAll = { id: `e2e_chk_smem_all_${ts}`, stream: chkSchemalessMemStream, filter: false };
  const chkSmemFld = { id: `e2e_chk_smem_fld_${ts}`, stream: chkSchemalessMemStream, filter: true };
  const chkTfileAll = { id: `e2e_chk_tfile_all_${ts}`, stream: chkTypedFileStream, filter: false };
  const chkTfileFld = { id: `e2e_chk_tfile_fld_${ts}`, stream: chkTypedFileStream, filter: true };
  const chkSfileAll = { id: `e2e_chk_sfile_all_${ts}`, stream: chkSchemalessFileStream, filter: false };
  const chkSfileFld = { id: `e2e_chk_sfile_fld_${ts}`, stream: chkSchemalessFileStream, filter: true };

  const checkers = [
    chkTmemAll,
    chkTmemFld,
    chkSmemAll,
    chkSmemFld,
    chkTfileAll,
    chkTfileFld,
    chkSfileAll,
    chkSfileFld,
  ];

  const createdStreams = [
    simStream,
    typedMemStream,
    schemalessMemStream,
    typedFileStream,
    schemalessFileStream,
    chkTypedMemStream,
    chkSchemalessMemStream,
    chkTypedFileStream,
    chkSchemalessFileStream,
  ];
  const createdRules = [feederFileRule, feederMemRule, ...checkers.map((c) => c.id)];
  const createdFlows: string[] = [];

  try {
    // 1. Seed a single deterministic JSON object into /kuiper/data/<file> via simulator -> file sink.
    await apiJson(page, '/api/ekuiper/streams', {
      method: 'POST',
      body: {
        sql: `CREATE STREAM ${simStream} () WITH (TYPE="simulator", FORMAT="json")`,
      },
    });

    await apiJson(page, '/api/ekuiper/rules', {
      method: 'POST',
      body: {
        id: feederFileRule,
        triggered: true,
        sql: `SELECT "dev-1" AS deviceId, 25.0 AS temperature FROM ${simStream}`,
        actions: [
          {
            file: {
              path: `/kuiper/data/${jsonFileName}`,
              fileType: 'lines',
              rollingCount: 1,
              sendSingle: true,
            },
          },
        ],
      },
    });

    await expect
      .poll(
        async () => {
          const status = await apiJson<Record<string, unknown>>(
            page,
            `/api/ekuiper/v2/rules/${encodeURIComponent(feederFileRule)}/status`,
          );
          return Number(status.sink_file_0_0_records_out_total ?? 0);
        },
        { timeout: 25_000 },
      )
      .toBeGreaterThanOrEqual(1);

    await apiJson(page, `/api/ekuiper/rules/${encodeURIComponent(feederFileRule)}/stop`, {
      method: 'POST',
    });

    // 2. Create typed & schemaless saved streams (memory + file) and downstream checker streams.
    const streamDdls = [
      `CREATE STREAM ${typedMemStream} (deviceId STRING, temperature FLOAT) WITH (TYPE="memory", DATASOURCE="${inTypedMemTopic}", FORMAT="json")`,
      `CREATE STREAM ${schemalessMemStream} () WITH (TYPE="memory", DATASOURCE="${inSchemalessMemTopic}", FORMAT="json")`,
      `CREATE STREAM ${typedFileStream} (deviceId STRING, temperature FLOAT) WITH (TYPE="file", DATASOURCE="${jsonFileName}", FORMAT="json")`,
      `CREATE STREAM ${schemalessFileStream} () WITH (TYPE="file", DATASOURCE="${jsonFileName}", FORMAT="json")`,
      `CREATE STREAM ${chkTypedMemStream} () WITH (TYPE="memory", DATASOURCE="${outTypedMemTopic}", FORMAT="json")`,
      `CREATE STREAM ${chkSchemalessMemStream} () WITH (TYPE="memory", DATASOURCE="${outSchemalessMemTopic}", FORMAT="json")`,
      `CREATE STREAM ${chkTypedFileStream} () WITH (TYPE="memory", DATASOURCE="${outTypedFileTopic}", FORMAT="json")`,
      `CREATE STREAM ${chkSchemalessFileStream} () WITH (TYPE="memory", DATASOURCE="${outSchemalessFileTopic}", FORMAT="json")`,
    ];

    for (const sql of streamDdls) {
      await apiJson(page, '/api/ekuiper/streams', { method: 'POST', body: { sql } });
    }

    // 3. Start downstream SQL checker rules BEFORE deploying file flows so single-shot reads are captured.
    for (const chk of checkers) {
      const whereClause = chk.filter ? ` WHERE deviceId = 'dev-1' AND temperature > 10` : '';
      await apiJson(page, '/api/ekuiper/rules', {
        method: 'POST',
        body: {
          id: chk.id,
          triggered: true,
          sql: `SELECT * FROM ${chk.stream}${whereClause}`,
          actions: [{ log: {} }],
        },
      });
    }

    // 4. Create the 4 Flow Studio graphs (stream-source -> memory-sink).
    const typedFileFlowId = await createAndSaveStreamSourceFlow(page, {
      name: `e2e-sn-typed-file-${ts}`,
      targetNodeId: target.id,
      savedStream: typedFileStream,
      connector: 'file',
      outputTopic: outTypedFileTopic,
    });
    createdFlows.push(typedFileFlowId);

    const schemalessFileFlowId = await createAndSaveStreamSourceFlow(page, {
      name: `e2e-sn-schemaless-file-${ts}`,
      targetNodeId: target.id,
      savedStream: schemalessFileStream,
      connector: 'file',
      outputTopic: outSchemalessFileTopic,
    });
    createdFlows.push(schemalessFileFlowId);

    const typedMemFlowId = await createAndSaveStreamSourceFlow(page, {
      name: `e2e-sn-typed-mem-${ts}`,
      targetNodeId: target.id,
      savedStream: typedMemStream,
      connector: 'memory',
      outputTopic: outTypedMemTopic,
    });
    createdFlows.push(typedMemFlowId);

    const schemalessMemFlowId = await createAndSaveStreamSourceFlow(page, {
      name: `e2e-sn-schemaless-mem-${ts}`,
      targetNodeId: target.id,
      savedStream: schemalessMemStream,
      connector: 'memory',
      outputTopic: outSchemalessMemTopic,
    });
    createdFlows.push(schemalessMemFlowId);

    // 5. Open typedFileFlow in Flow Studio UI to verify client/inspector/server/deploy diagnostics & deploy.
    await page.goto(`/flows/${encodeURIComponent(typedFileFlowId)}`);
    await expect(page.getByTestId('flow-studio-shell')).toBeVisible();
    await openFlowStudioPanels(page);
    await expect(page.locator('[data-save-status="saved"]')).toBeVisible({ timeout: 30_000 });

    const clientWarning = page.getByTestId('flow-validation-client-diagnostic').filter({
      hasText: 'FLOW_SOURCENAME_DECODE_WARNING',
    });
    if (!safeSourceNameGraphs) {
      await expect(clientWarning).toHaveCount(1);
      await expect(clientWarning).toHaveAttribute('data-severity', 'warning');
    } else {
      await expect(clientWarning).toHaveCount(0);
    }

    await page.locator('.react-flow__node').filter({ hasText: 'Stream Source' }).click();
    if (!safeSourceNameGraphs) {
      await expect(page.getByTestId('node-inspector-diagnostics')).toContainText(
        'FLOW_SOURCENAME_DECODE_WARNING',
      );
    }

    await page.getByTestId('flow-validation-server-button').click();
    await expect(page.getByTestId('flow-validation-server-summary')).toContainText('Server: valid', {
      timeout: 30_000,
    });
    const serverWarning = page.getByTestId('flow-validation-server-diagnostic').filter({
      hasText: 'FLOW_SOURCENAME_DECODE_WARNING',
    });
    if (!safeSourceNameGraphs) {
      await expect(serverWarning).toHaveCount(1);
      await expect(serverWarning).toHaveAttribute('data-severity', 'warning');
    } else {
      await expect(serverWarning).toHaveCount(0);
    }

    const deployButton = page.getByRole('button', { name: 'Deploy flow' });
    await expect(deployButton).toBeEnabled({ timeout: 15_000 });
    await deployButton.click();

    const deployDialog = page.getByTestId('flow-deploy-dialog');
    await expect(deployDialog).toBeVisible();
    await expect(page.getByTestId('flow-deploy-validation-summary')).toContainText('can be deployed', {
      timeout: 30_000,
    });
    if (!safeSourceNameGraphs) {
      await expect(
        page.getByTestId('flow-deploy-validation-diagnostic').filter({
          hasText: 'FLOW_SOURCENAME_DECODE_WARNING',
        }),
      ).toHaveCount(1);
    }

    await page.getByTestId('flow-deploy-confirm').click();
    await expect(page.getByTestId('flow-deploy-success')).toBeVisible({ timeout: 45_000 });
    await page.getByTestId('flow-deploy-cancel').click();
    await expect(deployDialog).toBeHidden();
    await expect(page.getByTestId('flow-deployment-status')).toContainText('Deployed', { timeout: 20_000 });

    // 6. Deploy the remaining 3 flows and verify compiled sourceType/sourceName on the engine.
    for (const id of [schemalessFileFlowId, typedMemFlowId, schemalessMemFlowId]) {
      const res = await apiJson<{ ok: boolean }>(page, `/api/flows/${encodeURIComponent(id)}/deploy`, {
        method: 'POST',
      });
      expect(res.ok).toBe(true);
    }

    const expectedStreamsByFlow: Array<[string, string]> = [
      [typedFileFlowId, typedFileStream],
      [schemalessFileFlowId, schemalessFileStream],
      [typedMemFlowId, typedMemStream],
      [schemalessMemFlowId, schemalessMemStream],
    ];
    for (const [flowId, expectedStream] of expectedStreamsByFlow) {
      const deployment = await apiJson<{ deployment: { ruleId: string } | null }>(
        page,
        `/api/flows/${encodeURIComponent(flowId)}/deployment`,
      );
      expect(deployment.deployment?.ruleId).toBeTruthy();
      const rule = await apiJson<{
        graph?: { nodes?: Record<string, { props?: Record<string, unknown> }> };
      }>(page, `/api/ekuiper/rules/${encodeURIComponent(deployment.deployment!.ruleId)}`);
      const nodes = Object.values(rule.graph?.nodes ?? {});
      expect(
        nodes.some(
          (n) => n.props?.sourceType === 'stream' && n.props?.sourceName === expectedStream,
        ),
      ).toBe(true);
    }

    // 7. Start the memory feeder after memory flows are deployed.
    await apiJson(page, '/api/ekuiper/rules', {
      method: 'POST',
      body: {
        id: feederMemRule,
        triggered: true,
        sql: `SELECT "dev-1" AS deviceId, 25.0 AS temperature FROM ${simStream}`,
        actions: [
          { memory: { topic: inTypedMemTopic } },
          { memory: { topic: inSchemalessMemTopic } },
        ],
      },
    });

    // 8. Verify downstream sink counts for typed/schemaless memory & file saved streams.
    await expect
      .poll(
        async () => {
          const [tmemAll, tmemFld, smemAll, smemFld] = await Promise.all([
            apiJson<Record<string, unknown>>(page, `/api/ekuiper/v2/rules/${chkTmemAll.id}/status`),
            apiJson<Record<string, unknown>>(page, `/api/ekuiper/v2/rules/${chkTmemFld.id}/status`),
            apiJson<Record<string, unknown>>(page, `/api/ekuiper/v2/rules/${chkSmemAll.id}/status`),
            apiJson<Record<string, unknown>>(page, `/api/ekuiper/v2/rules/${chkSmemFld.id}/status`),
          ]);
          return (
            Number(tmemAll.sink_log_0_0_records_out_total ?? 0) >= 1 &&
            Number(tmemFld.sink_log_0_0_records_out_total ?? 0) >= 1 &&
            Number(smemAll.sink_log_0_0_records_out_total ?? 0) >= 1 &&
            Number(smemFld.sink_log_0_0_records_out_total ?? 0) >= 1
          );
        },
        { timeout: 30_000 },
      )
      .toBe(true);

    await expect
      .poll(
        async () => {
          const [tfileAll, sfileAll, tfileFld, sfileFld] = await Promise.all([
            apiJson<Record<string, unknown>>(page, `/api/ekuiper/v2/rules/${chkTfileAll.id}/status`),
            apiJson<Record<string, unknown>>(page, `/api/ekuiper/v2/rules/${chkSfileAll.id}/status`),
            apiJson<Record<string, unknown>>(page, `/api/ekuiper/v2/rules/${chkTfileFld.id}/status`),
            apiJson<Record<string, unknown>>(page, `/api/ekuiper/v2/rules/${chkSfileFld.id}/status`),
          ]);
          const allEmitted =
            Number(tfileAll.sink_log_0_0_records_out_total ?? 0) >= 1 &&
            Number(sfileAll.sink_log_0_0_records_out_total ?? 0) >= 1;
          const fieldsArrived =
            getSourceRecordsInTotal(tfileFld, chkTfileFld.stream) >= 1 &&
            getSourceRecordsInTotal(sfileFld, chkSfileFld.stream) >= 1;
          return allEmitted && fieldsArrived;
        },
        { timeout: 30_000 },
      )
      .toBe(true);

    const [tfileFldFinal, sfileFldFinal] = await Promise.all([
      apiJson<Record<string, unknown>>(page, `/api/ekuiper/v2/rules/${chkTfileFld.id}/status`),
      apiJson<Record<string, unknown>>(page, `/api/ekuiper/v2/rules/${chkSfileFld.id}/status`),
    ]);
    if (!safeSourceNameGraphs) {
      // Upstream PR #4213 is absent on <2.5 targets: byte-decoded file saved streams emit {} so field filters stay at 0.
      expect(Number(tfileFldFinal.sink_log_0_0_records_out_total ?? 0)).toBe(0);
      expect(Number(sfileFldFinal.sink_log_0_0_records_out_total ?? 0)).toBe(0);
    } else {
      expect(Number(tfileFldFinal.sink_log_0_0_records_out_total ?? 0)).toBeGreaterThanOrEqual(1);
      expect(Number(sfileFldFinal.sink_log_0_0_records_out_total ?? 0)).toBeGreaterThanOrEqual(1);
    }

    expect(errors).toEqual([]);
  } finally {
    await cleanupResources(page, {
      flowIds: createdFlows,
      ruleIds: createdRules,
      streamNames: createdStreams,
    });
  }
});

test('rule designer filters 2.4.2 SQL functions by target version and validates on 2.4.2', async ({ page }) => {
  test.setTimeout(90_000);
  await ensureSignedIn(page);
  const errors = captureUnexpectedErrors(page);
  const target = await getActiveTargetNode(page);
  const has242 = isAtLeastVersion(target.version, [2, 4, 2]);

  const ts = Date.now();
  const streamName = `e2e_ver_fn_${ts}`;
  const ruleId = `e2e_fn_rule_${ts}`;

  try {
    await apiJson(page, '/api/ekuiper/streams', {
      method: 'POST',
      body: {
        sql: `CREATE STREAM ${streamName} (deviceId STRING, temperature FLOAT, arr ARRAY(FLOAT)) WITH (TYPE="memory", DATASOURCE="e2e/ver/fn/${ts}", FORMAT="json")`,
      },
    });

    await page.goto('/rules/new');
    await expect(page.getByTestId('rule-function-helper')).toBeVisible();
    await expect(page.getByTestId('sql-fn-meta_topic')).toBeHidden();

    if (has242) {
      await expect(page.getByTestId('sql-fn-array_avg')).toBeVisible();
      await expect(page.getByTestId('sql-fn-acc_max_by')).toBeVisible();
      await expect(page.getByTestId('sql-fn-acc_min_by')).toBeVisible();
      await expect(page.getByTestId('sql-fn-acc_map_agg')).toBeVisible();

      await page.locator('#rule-id').fill(ruleId);
      await page.getByRole('button').filter({ hasText: streamName }).click();
      await page.getByTestId('rule-function-search').fill('array_avg');
      await page.getByTestId('sql-fn-array_avg').click();
      await expect(page.locator('#query-fields')).toHaveValue(/array_avg\(arr\)/);

      await page.getByRole('button', { name: 'Validate', exact: true }).click();
      await expect(
        page.locator('[role="status"]').filter({ hasText: 'The engine accepted this rule definition.' }),
      ).toBeVisible({ timeout: 20_000 });

      for (const expr of [
        'acc_max_by(deviceId, temperature)',
        'acc_min_by(deviceId, temperature)',
        'acc_map_agg(deviceId, temperature)',
      ]) {
        const res = await apiJson<{ valid: boolean; error?: string }>(
          page,
          '/api/ekuiper/rules/validate',
          {
            method: 'POST',
            body: {
              id: `${ruleId}_chk`,
              sql: `SELECT ${expr} FROM ${streamName}`,
              actions: [{ log: {} }],
            },
          },
        );
        expect(res.valid, `Expected eKuiper 2.4.2+ to accept ${expr}: ${res.error ?? ''}`).toBe(true);
      }
    } else {
      await expect(page.getByTestId('sql-fn-array_avg')).toBeHidden();
      await expect(page.getByTestId('sql-fn-acc_max_by')).toBeHidden();
      await expect(page.getByTestId('sql-fn-acc_min_by')).toBeHidden();
      await expect(page.getByTestId('sql-fn-acc_map_agg')).toBeHidden();
    }

    expect(errors).toEqual([]);
  } finally {
    await cleanupResources(page, { streamNames: [streamName] });
  }
});

test('named sql connection CRUD and recovery status reflection on connections page (#4128)', async ({ page }) => {
  test.setTimeout(90_000);
  await ensureSignedIn(page);
  const errors = captureUnexpectedErrors(page);

  const ts = Date.now();
  const connId = `e2e_sql_conn_${ts}`;
  const mockConnId = `e2e_mock_recovery_${ts}`;

  try {
    await apiJson(page, '/api/ekuiper/connections', {
      method: 'POST',
      body: {
        id: connId,
        typ: 'sql',
        props: { dburl: 'sqlite:///tmp/e2e_recovery.db' },
      },
    });

    const listed = await apiJson<Array<{ id: string; typ: string }>>(page, '/api/ekuiper/connections');
    expect(listed.some((item) => item.id === connId && item.typ === 'sql')).toBe(true);

    await page.goto('/connections');
    await expect(page.getByText(connId, { exact: true })).toBeVisible({ timeout: 15_000 });

    await apiJson(page, `/api/ekuiper/connections/${encodeURIComponent(connId)}`, { method: 'DELETE' });

    let phase: 'failed' | 'connected' = 'failed';
    await page.route('**/api/ekuiper/connections', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: [
          {
            id: mockConnId,
            typ: 'sql',
            props: { dburl: 'postgres://db:5432/app' },
            status: phase,
            ...(phase === 'failed'
              ? { err: 'dial tcp 127.0.0.1:5432: connect: connection refused' }
              : {}),
          },
        ],
      });
    });

    await page.goto('/connections');
    await expect(page.getByText(mockConnId, { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('failed', { exact: true })).toBeVisible();
    await expect(
      page.getByText('dial tcp 127.0.0.1:5432: connect: connection refused'),
    ).toBeVisible();

    phase = 'connected';
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByText('connected', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('dial tcp 127.0.0.1:5432: connect: connection refused'),
    ).toBeHidden();

    await page.unroute('**/api/ekuiper/connections');
    expect(errors).toEqual([]);
  } finally {
    await cleanupResources(page, { connIds: [connId] });
  }
});

test('api-docs GA/preview switcher and 2.5 preview UI version gates', async ({ page }) => {
  test.setTimeout(90_000);
  await ensureSignedIn(page);
  const errors = captureUnexpectedErrors(page);
  const target = await getActiveTargetNode(page);
  const targetIs25 = isAtLeastVersion(target.version, [2, 5, 0]);

  const ts = Date.now();
  const streamName = `e2e_p25_stream_${ts}`;
  const ruleId = `e2e_p25_rule_${ts}`;

  try {
    // 1. Verify /api-docs contract switcher and OpenAPI JSON payloads.
    await page.goto('/api-docs');
    await expect(page.getByTestId('api-docs-version-badge')).toContainText('2.4.2 · OpenAPI 3.0');
    const iframe = page.locator('iframe');
    await expect(iframe).toHaveAttribute('src', '/api-docs/index.html');

    const gaSpec = await apiJson<{ info: { version: string }; paths: Record<string, unknown> }>(
      page,
      '/ekuiper-openapi.json',
    );
    expect(gaSpec.info.version).toContain('2.4.2');
    expect(Object.keys(gaSpec.paths)).toHaveLength(98);

    await page.getByTestId('api-docs-spec-preview').click();
    await expect(page.getByTestId('api-docs-version-badge')).toContainText(
      '2.5.0-alpha.5 Preview · OpenAPI 3.0',
    );
    await expect(iframe).toHaveAttribute('src', '/api-docs/index.html?spec=2.5-preview');

    const previewSpec = await apiJson<{ info: { version: string }; paths: Record<string, unknown> }>(
      page,
      '/ekuiper-openapi-2.5-preview.json',
    );
    expect(previewSpec.info.version).toContain('2.5.0-alpha.5');
    expect(Object.keys(previewSpec.paths)).toHaveLength(99);
    expect(previewSpec.paths).toHaveProperty('/rules/{name}/scantables');

    // 2. Create a temporary stream + stopped rule and assert <2.5 UI gates.
    await apiJson(page, '/api/ekuiper/streams', {
      method: 'POST',
      body: {
        sql: `CREATE STREAM ${streamName} (id STRING) WITH (TYPE="memory", DATASOURCE="e2e/p25/${ts}", FORMAT="json")`,
      },
    });
    await apiJson(page, '/api/ekuiper/rules', {
      method: 'POST',
      body: {
        id: ruleId,
        triggered: false,
        sql: `SELECT * FROM ${streamName}`,
        actions: [{ log: {} }],
      },
    });

    if (!targetIs25) {
      await page.goto(`/rules/${encodeURIComponent(ruleId)}`);
      await expect(page.getByTestId('rule-tab-definition')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('rule-tab-scantables')).toBeHidden();

      await page.goto('/streams/new');
      await expect(page.locator('#res-buffer-full-policy')).toBeHidden();
      await page.locator('#res-format').click();
      await expect(page.getByRole('option', { name: 'JSON Lines (jsonl)' })).toBeHidden();
      await page.keyboard.press('Escape');

      await page.goto('/rules/new');
      await page.getByRole('button', { name: 'Continue to outputs' }).click();
      await page.locator('#sink-format').click();
      await expect(page.getByRole('option', { name: 'JSON Lines (jsonl)' })).toBeHidden();
      await page.keyboard.press('Escape');
    }

    // 3. Intercept /api/nodes -> 2.5.0-alpha.5 and /scantables -> [] to verify 2.5 UI gates.
    await page.route('**/api/nodes', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const payload = (await response.json()) as {
        nodes: Array<Record<string, unknown>>;
        selectedNodeId: string | null;
      };
      const patchedNodes = payload.nodes.map((node) =>
        node.id === target.id ? { ...node, version: '2.5.0-alpha.5', status: 'ONLINE' } : node,
      );
      await route.fulfill({
        response,
        json: { ...payload, nodes: patchedNodes },
      });
    });

    await page.route('**/api/ekuiper/rules/*/scantables', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', json: [] });
    });

    await page.goto(`/rules/${encodeURIComponent(ruleId)}?tab=scantables`);
    await expect(page.getByTestId('rule-tab-scantables')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('rule-tab-scantables')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('scan-tables-empty')).toBeVisible({ timeout: 15_000 });

    await page.goto('/streams/new');
    await expect(page.locator('#res-buffer-full-policy')).toBeVisible({ timeout: 15_000 });
    await page.locator('#res-format').click();
    await expect(page.getByRole('option', { name: 'JSON Lines (jsonl)' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.goto('/rules/new');
    await expect(page.getByTestId('sql-fn-meta_topic')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Continue to outputs' }).click();
    await page.locator('#sink-format').click();
    await expect(page.getByRole('option', { name: 'JSON Lines (jsonl)' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.unroute('**/api/ekuiper/rules/*/scantables');
    await page.unroute('**/api/nodes');
    expect(errors).toEqual([]);
  } finally {
    await cleanupResources(page, { ruleIds: [ruleId], streamNames: [streamName] });
  }
});
