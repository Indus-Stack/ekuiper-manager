import type { EngineFamily, OperationMode } from '@/lib/engines/types';

export interface AssistantEngineContext {
  nodeId: string | null;
  nodeName: string | null;
  engineFamily: EngineFamily | null;
  version: string | null;
  operationMode: OperationMode;
  profileRevision: number;
  allowedToolCategories: string[];
  systemSummary: string;
}

export function buildAssistantEngineContext(input: {
  nodeId: string | null;
  nodeName?: string | null;
  engineFamily?: EngineFamily | null;
  version?: string | null;
  operationMode?: OperationMode;
  profileRevision?: number;
  capabilities?: Record<string, boolean>;
}): AssistantEngineContext {
  const family = input.engineFamily ?? null;
  const mode = input.operationMode ?? 'unknown';
  const categories = ['streams', 'tables', 'rules', 'connections', 'schemas'];

  if (family === 'rekuiper') {
    categories.push('dlq', 'telemetry');
    if (mode !== 'declarative') categories.push('ruletest', 'taps');
    if (input.capabilities?.fleet !== false) categories.push('fleet');
  }

  const targetDesc = input.nodeId
    ? `${input.nodeName ?? input.nodeId} (${family ?? 'unknown'} ${input.version ?? 'unknown'}, mode=${mode}, rev=${input.profileRevision ?? 0})`
    : 'No active target selected';

  return {
    nodeId: input.nodeId,
    nodeName: input.nodeName ?? null,
    engineFamily: family,
    version: input.version ?? null,
    operationMode: mode,
    profileRevision: input.profileRevision ?? 0,
    allowedToolCategories: categories,
    systemSummary: `Active target: ${targetDesc}. Bind all actions to this target and require review before applying mutations.`,
  };
}

export function isAssistantContextStale(
  prev: Pick<AssistantEngineContext, 'nodeId' | 'profileRevision'>,
  next: Pick<AssistantEngineContext, 'nodeId' | 'profileRevision'>,
): boolean {
  return prev.nodeId !== next.nodeId || prev.profileRevision !== next.profileRevision;
}

