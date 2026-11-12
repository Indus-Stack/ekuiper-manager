import { parseEKuiperJsonObject } from '@/lib/ekuiper/wire';
import { resolveTargetFeatures } from '@/lib/flows/capabilities/resolve-capabilities';
import type {
  AuthorizationState,
  CapabilityDetail,
  ConnectionState,
  DeploymentRole,
  EngineDiscoveryResult,
  EngineFamily,
  EnginePreference,
  IdentitySource,
  OperationMode,
  OperationModeOverride,
} from './types';

export type FetchLike = (input: URL | string, init?: RequestInit) => Promise<Response>;

export interface DiscoverEngineInput {
  baseUrl: string;
  authorization: string | null;
  enginePreference: EnginePreference;
  operationModeOverride: OperationModeOverride | null;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

function versionAtLeast(version: string, expected: [number, number, number]): boolean {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return false;
  const current = match.slice(1, 4).map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (current[index] > expected[index]) return true;
    if (current[index] < expected[index]) return false;
  }
  return true;
}

function parseOptionalJson(text: string): Record<string, unknown> | null {
  try {
    return parseEKuiperJsonObject(text);
  } catch {
    return null;
  }
}

function isReKuiperPalettePayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const record = payload as Record<string, unknown>;
  return (
    Array.isArray(record.sources) ||
    Array.isArray(record.sinks) ||
    Array.isArray(record.operators) ||
    Array.isArray(record.nodes)
  );
}

function isReKuiperAuthStatusPayload(payload: Record<string, unknown> | null): boolean {
  if (!payload) return false;
  return (
    typeof payload.authEnabled === 'boolean' ||
    typeof payload.auth_enabled === 'boolean' ||
    typeof payload.authenticated === 'boolean'
  );
}

function buildCapabilities(
  family: EngineFamily | null,
  version: string | null,
  authorized: boolean,
  operationMode: OperationMode,
): {
  booleanMap: Record<string, boolean>;
  details: Record<string, CapabilityDetail>;
} {
  if (!family) {
    return { booleanMap: {}, details: {} };
  }

  if (family === 'ekuiper') {
    const features = resolveTargetFeatures(version);
    const core = Boolean(version && versionAtLeast(version, [2, 4, 1]));
    const booleanMap: Record<string, boolean> = {
      core,
      bulkRuleControl: Boolean(version && versionAtLeast(version, [2, 4, 0])),
      schemaUpload: core,
      sqlFunctions242: features.supportsSqlFunctions242,
      preview25: features.supportsScanTables,
    };
    const details: Record<string, CapabilityDetail> = {
      'rules.sql': { status: core ? 'supported' : 'unsupported', provenance: 'ekuiper-version' },
      'rules.graph': { status: core ? 'supported' : 'unsupported', provenance: 'ekuiper-version' },
      'rules.bulkControl': {
        status: booleanMap.bulkRuleControl ? 'supported' : 'unsupported',
        provenance: 'ekuiper-version',
      },
      'diagnostics.wireTap': { status: 'unsupported', reason: 'Not available on eKuiper', provenance: 'ekuiper-contract' },
      'fleet.rollouts': { status: 'unsupported', reason: 'Not available on eKuiper', provenance: 'ekuiper-contract' },
    };
    return { booleanMap, details };
  }

  // reKuiper pinned main (24848c8f)
  const isDeclarative = operationMode === 'declarative';
  const booleanMap: Record<string, boolean> = {
    core: true,
    bulkRuleControl: true,
    schemaUpload: true,
    sqlFunctions242: true,
    preview25: true,
    multiPortGraph: true,
    wireTap: !isDeclarative,
    dlq: true,
    sqlTrialSse: !isDeclarative,
    wasmExtensions: true,
    jsUdf: true,
    portablePluginMutation: false,
    fleet: true,
  };
  const details: Record<string, CapabilityDetail> = {
    'rules.sql': { status: 'supported', provenance: 'rekuiper-main-24848c8' },
    'rules.graph': { status: 'supported', provenance: 'rekuiper-main-24848c8' },
    'graph.multiPort': { status: 'supported', provenance: 'rekuiper-main-24848c8' },
    'diagnostics.wireTap': {
      status: isDeclarative ? 'unavailable' : authorized ? 'supported' : 'unknown',
      reason: isDeclarative ? 'Blocked by declarative_mutation_guard' : undefined,
      provenance: 'rekuiper-main-24848c8',
    },
    'diagnostics.dlqRead': { status: 'supported', provenance: 'rekuiper-main-24848c8' },
    'diagnostics.dlqClear': { status: 'supported', provenance: 'rekuiper-main-24848c8' },
    'test.sqlSse': {
      status: isDeclarative ? 'unavailable' : 'supported',
      reason: isDeclarative ? 'Disabled in declarative mode (DELETE cleanup blocked)' : undefined,
      provenance: 'rekuiper-main-24848c8',
    },
    'extensions.portableMutation': {
      status: 'unsupported',
      reason: 'Returns 501 Not Implemented in pinned reKuiper build',
      provenance: 'rekuiper-main-24848c8',
    },
    'extensions.wasm': { status: 'supported', provenance: 'rekuiper-main-24848c8' },
    'extensions.javascript': { status: 'supported', provenance: 'rekuiper-main-24848c8' },
    'declarative.reload': {
      status: operationMode === 'imperative' ? 'unavailable' : 'supported',
      provenance: 'rekuiper-main-24848c8',
    },
    'fleet.rollouts': { status: 'supported', provenance: 'rekuiper-main-24848c8' },
  };
  return { booleanMap, details };
}

export async function discoverEngineProfile(
  input: DiscoverEngineInput,
): Promise<EngineDiscoveryResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? Number(process.env.EKUIPER_API_TIMEOUT ?? 10_000);
  const headers = new Headers({ Accept: 'application/json' });
  if (input.authorization) headers.set('Authorization', input.authorization);

  const boundedGet = async (path: string): Promise<Response> => {
    const target = new URL(path, input.baseUrl);
    return fetchImpl(target, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
  };

  let rootResponse: Response;
  try {
    rootResponse = await boundedGet('/');
  } catch (error) {
    return {
      detectedFamily: null,
      effectiveFamily: input.enginePreference === 'auto' ? null : input.enginePreference,
      runtimeVersion: null,
      profileId: null,
      identitySource: input.enginePreference === 'auto' ? 'unknown' : 'configured_preference',
      connectionState: 'offline',
      authorizationState: 'unknown',
      operationMode: input.operationModeOverride ?? 'unknown',
      deploymentRole: 'unknown',
      compatible: false,
      capabilities: {},
      capabilityDetails: {},
      evidence: { error: error instanceof Error ? error.message : 'Connection failed' },
      errorMessage: error instanceof Error ? error.message : 'Connection failed',
    };
  }

  const connectionState: ConnectionState = 'reachable';
  const rootText = await rootResponse.text();
  const rootJson = parseOptionalJson(rootText);
  const runtimeVersion = typeof rootJson?.version === 'string' ? rootJson.version : null;

  // Bounded authenticated read to separate public-root reachability from usable credentials.
  let authorizationState: AuthorizationState = 'unknown';
  let authProbeStatus: number | null = null;
  if (rootResponse.status === 401) {
    authorizationState = 'auth_required';
  } else if (rootResponse.status === 403) {
    authorizationState = 'forbidden';
  } else if (rootResponse.ok) {
    try {
      const authProbe = await boundedGet('/rules');
      authProbeStatus = authProbe.status;
      if (authProbe.status === 401) authorizationState = 'auth_required';
      else if (authProbe.status === 403) authorizationState = 'forbidden';
      else if (authProbe.ok) authorizationState = 'authorized';
    } catch {
      authorizationState = 'unknown';
    }
  }

  let detectedFamily: EngineFamily | null = null;
  let identitySource: IdentitySource = 'unknown';
  const evidence: Record<string, unknown> = {
    rootStatus: rootResponse.status,
    authProbeStatus,
    runtimeVersion,
  };

  // 1. Explicit descriptor if provided by a future build
  const explicitProduct =
    typeof rootJson?.product === 'string'
      ? rootJson.product.toLowerCase()
      : typeof rootJson?.engine === 'string'
        ? rootJson.engine.toLowerCase()
        : null;
  if (explicitProduct === 'rekuiper' || explicitProduct === 'ekuiper') {
    detectedFamily = explicitProduct;
    identitySource = 'explicit_descriptor';
    evidence.explicitProduct = explicitProduct;
  }

  // 2. Signature probes (bounded GETs)
  if (!detectedFamily) {
    try {
      const paletteRes = await boundedGet('/metadata/palette');
      evidence.paletteStatus = paletteRes.status;
      if (paletteRes.ok) {
        const paletteJson = parseOptionalJson(await paletteRes.text());
        if (isReKuiperPalettePayload(paletteJson)) {
          detectedFamily = 'rekuiper';
          identitySource = 'signature_probe';
        }
      }
    } catch {
      // Ignore probe failure and continue
    }
  }

  if (!detectedFamily) {
    try {
      const uiAuthRes = await boundedGet('/api/ui/auth-status');
      evidence.uiAuthStatus = uiAuthRes.status;
      if (uiAuthRes.ok) {
        const uiAuthJson = parseOptionalJson(await uiAuthRes.text());
        if (isReKuiperAuthStatusPayload(uiAuthJson)) {
          detectedFamily = 'rekuiper';
          identitySource = 'signature_probe';
        }
      }
    } catch {
      // Ignore probe failure
    }
  }

  if (!detectedFamily && runtimeVersion && versionAtLeast(runtimeVersion, [2, 4, 1])) {
    detectedFamily = 'ekuiper';
    identitySource = 'signature_probe';
  }

  // Apply administrator preference when configured
  let effectiveFamily: EngineFamily | null = detectedFamily;
  if (input.enginePreference !== 'auto') {
    if (detectedFamily && detectedFamily !== input.enginePreference) {
      evidence.contradiction = {
        configured: input.enginePreference,
        detected: detectedFamily,
      };
    }
    effectiveFamily = input.enginePreference;
    identitySource = 'configured_preference';
  }

  let profileId: string | null = null;
  let compatible = false;
  if (effectiveFamily === 'rekuiper') {
    profileId = 'rekuiper-main-24848c8';
    compatible = true;
  } else if (effectiveFamily === 'ekuiper') {
    if (runtimeVersion && versionAtLeast(runtimeVersion, [2, 5, 0])) {
      profileId = 'ekuiper-2.5.0-alpha.5';
      compatible = true;
    } else if (runtimeVersion && versionAtLeast(runtimeVersion, [2, 4, 2])) {
      profileId = 'ekuiper-2.4.2';
      compatible = true;
    } else if (runtimeVersion && versionAtLeast(runtimeVersion, [2, 4, 1])) {
      profileId = 'ekuiper-2.4.1';
      compatible = true;
    } else {
      compatible = false;
    }
  }

  const operationMode: OperationMode = input.operationModeOverride ?? 'unknown';
  const deploymentRole: DeploymentRole =
    effectiveFamily === 'ekuiper' ? 'standalone' : 'unknown';

  const { booleanMap, details } = buildCapabilities(
    effectiveFamily,
    runtimeVersion,
    authorizationState === 'authorized',
    operationMode,
  );

  let errorMessage: string | null = null;
  if (authorizationState === 'auth_required') {
    errorMessage = 'Authentication required (HTTP 401)';
  } else if (authorizationState === 'forbidden') {
    errorMessage = 'Authorization forbidden (HTTP 403)';
  } else if (!rootResponse.ok) {
    errorMessage = `Target returned HTTP ${rootResponse.status}`;
  } else if (!effectiveFamily) {
    errorMessage = 'Unable to identify engine family from target response';
  } else if (!compatible) {
    errorMessage = runtimeVersion
      ? `Unsupported ${effectiveFamily} version ${runtimeVersion}`
      : 'Version was not reported';
  }

  return {
    detectedFamily,
    effectiveFamily,
    runtimeVersion,
    profileId,
    identitySource,
    connectionState,
    authorizationState,
    operationMode,
    deploymentRole,
    compatible: compatible && authorizationState === 'authorized',
    capabilities: booleanMap,
    capabilityDetails: details,
    evidence,
    errorMessage,
  };
}
