import { randomUUID } from 'node:crypto';
import { ApiError } from '@/lib/api';
import { query, withTransaction } from '@/lib/db';
import { assertSafeNodeDestination, normalizeNodeUrl } from '@/lib/network';
import { decryptSecret, encryptSecret } from '@/lib/secrets';
import { parseEKuiperJsonObject } from '@/lib/ekuiper/wire';
import {
  discoverEngineProfile,
  type DiscoverEngineInput,
} from '@/lib/engines/discovery';
import type {
  AuthorizationState,
  ConnectionState,
  DeploymentRole,
  EngineFamily,
  EnginePreference,
  OperationMode,
  OperationModeOverride,
} from '@/lib/engines/types';

export const NODE_COOKIE = 'ekuiper_manager_node';
export const PROBE_FRESHNESS_MS = 60_000;

export interface ManagedNode {
  id: string;
  name: string;
  baseUrl: string;
  description: string | null;
  hasAuthorization: boolean;
  isDefault: boolean;
  status: 'UNKNOWN' | 'ONLINE' | 'OFFLINE' | 'INCOMPATIBLE';
  version: string | null;
  capabilities: Record<string, boolean>;
  enginePreference?: EnginePreference;
  detectedFamily?: EngineFamily | null;
  profileId?: string | null;
  profileRevision?: number;
  operationMode?: OperationMode;
  operationModeOverride?: OperationModeOverride | null;
  deploymentRole?: DeploymentRole;
  connectionState?: ConnectionState;
  authorizationState?: AuthorizationState;
  identityEvidence?: Record<string, unknown>;
  profileCheckedAt?: Date | null;
  lastCheckedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface NodeRow {
  id: string;
  name: string;
  base_url: string;
  description: string | null;
  authorization_encrypted: string | null;
  is_default: boolean;
  status: ManagedNode['status'];
  version: string | null;
  capabilities: Record<string, boolean>;
  engine_preference: EnginePreference;
  detected_family: EngineFamily | null;
  profile_id: string | null;
  profile_revision: number;
  operation_mode: OperationMode;
  operation_mode_override: OperationModeOverride | null;
  deployment_role: DeploymentRole;
  connection_state: ConnectionState;
  authorization_state: AuthorizationState;
  identity_evidence: Record<string, unknown>;
  profile_checked_at: Date | null;
  last_checked_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

const nodeColumns = `id, name, base_url, description, authorization_encrypted, is_default,
  status, version, capabilities, engine_preference, detected_family, profile_id,
  profile_revision, operation_mode, operation_mode_override, deployment_role,
  connection_state, authorization_state, identity_evidence, profile_checked_at,
  last_checked_at, last_error, created_at, updated_at`;

function mapNode(row: NodeRow): ManagedNode {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    description: row.description,
    hasAuthorization: Boolean(row.authorization_encrypted),
    isDefault: row.is_default,
    status: row.status,
    version: row.version,
    capabilities: row.capabilities ?? {},
    enginePreference: row.engine_preference ?? 'auto',
    detectedFamily: row.detected_family ?? null,
    profileId: row.profile_id ?? null,
    profileRevision: row.profile_revision ?? 0,
    operationMode: row.operation_mode ?? 'unknown',
    operationModeOverride: row.operation_mode_override ?? null,
    deploymentRole: row.deployment_role ?? 'unknown',
    connectionState: row.connection_state ?? 'unknown',
    authorizationState: row.authorization_state ?? 'unknown',
    identityEvidence: row.identity_evidence ?? {},
    profileCheckedAt: row.profile_checked_at ?? null,
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 80) {
    throw new ApiError(400, 'Node name must be 2-80 characters', 'INVALID_NODE_NAME');
  }
  return value.trim();
}

function normalizeAuthorization(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ApiError(400, 'Authorization must be a string', 'INVALID_AUTHORIZATION');
  }
  const authorization = value.trim();
  if (!authorization) return null;
  if (authorization.length > 8_192 || /[\r\n]/.test(authorization)) {
    throw new ApiError(400, 'Authorization value is invalid', 'INVALID_AUTHORIZATION');
  }
  return authorization;
}

function getFallbackEnvNode(): ManagedNode | null {
  const envUrl = process.env.EKUIPER_URL || process.env.DEFAULT_EKUIPER_URL || process.env.NEXT_PUBLIC_EKUIPER_URL;
  if (!envUrl) return null;
  return {
    id: 'env-ekuiper',
    name: 'eKuiper (Target)',
    baseUrl: envUrl.trim(),
    description: 'Active configured eKuiper instance',
    hasAuthorization: false,
    isDefault: true,
    status: 'ONLINE',
    version: null,
    capabilities: {},
    enginePreference: 'auto',
    detectedFamily: null,
    profileId: null,
    profileRevision: 0,
    operationMode: 'unknown',
    operationModeOverride: null,
    deploymentRole: 'unknown',
    connectionState: 'unknown',
    authorizationState: 'unknown',
    identityEvidence: {},
    profileCheckedAt: null,
    lastCheckedAt: new Date(),
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function normalizeEnginePreference(value: unknown): EnginePreference {
  if (value === undefined || value === null || value === '') return 'auto';
  if (value === 'auto' || value === 'ekuiper' || value === 'rekuiper') return value;
  throw new ApiError(400, 'Invalid enginePreference', 'INVALID_ENGINE_PREFERENCE');
}

function normalizeOperationModeOverride(value: unknown): OperationModeOverride | null {
  if (value === undefined || value === null || value === '') return null;
  if (value === 'imperative' || value === 'declarative') return value;
  throw new ApiError(400, 'Invalid operationModeOverride', 'INVALID_OPERATION_MODE');
}

export async function listNodes(): Promise<ManagedNode[]> {
  try {
    const result = await query<NodeRow>(
      `SELECT ${nodeColumns} FROM managed_nodes ORDER BY is_default DESC, name ASC`,
    );
    if (result.rows.length > 0) {
      return result.rows.map(mapNode);
    }
  } catch {
    // Fall through to environment fallback if DB is uninitialized
  }
  const fallback = getFallbackEnvNode();
  return fallback ? [fallback] : [];
}

export async function getNode(id: string): Promise<ManagedNode | null> {
  try {
    const result = await query<NodeRow>(
      `SELECT ${nodeColumns} FROM managed_nodes WHERE id = $1`,
      [id],
    );
    if (result.rows[0]) return mapNode(result.rows[0]);
  } catch {
    // Fall through
  }
  const fallback = getFallbackEnvNode();
  if (fallback && id === fallback.id) return fallback;
  return null;
}

export async function getNodeWithAuthorization(
  id: string | undefined,
): Promise<{ node: ManagedNode; authorization: string | null }> {
  try {
    const result = await query<NodeRow>(
      id
        ? `SELECT ${nodeColumns} FROM managed_nodes WHERE id = $1`
        : `SELECT ${nodeColumns} FROM managed_nodes ORDER BY is_default DESC, created_at ASC LIMIT 1`,
      id ? [id] : [],
    );
    const row = result.rows[0];
    if (row) {
      return { node: mapNode(row), authorization: decryptSecret(row.authorization_encrypted) };
    }
  } catch {
    // Fall through
  }

  const fallback = getFallbackEnvNode();
  if (fallback && (!id || id === fallback.id)) {
    return { node: fallback, authorization: null };
  }

  throw new ApiError(409, 'Add an eKuiper node first', 'NODE_REQUIRED');
}

export async function createNode(input: {
  name: unknown;
  baseUrl: unknown;
  description?: unknown;
  authorization?: unknown;
  enginePreference?: unknown;
  operationModeOverride?: unknown;
}): Promise<ManagedNode> {
  const name = validateName(input.name);
  const baseUrl = normalizeNodeUrl(input.baseUrl);
  await assertSafeNodeDestination(new URL(baseUrl));
  const description =
    typeof input.description === 'string' && input.description.trim()
      ? input.description.trim().slice(0, 500)
      : null;
  const rawAuthorization = normalizeAuthorization(input.authorization ?? null);
  const authorization = rawAuthorization ? encryptSecret(rawAuthorization) : null;
  const enginePreference = normalizeEnginePreference(input.enginePreference);
  const operationModeOverride = normalizeOperationModeOverride(input.operationModeOverride);
  const id = randomUUID();

  try {
    await withTransaction(async (client) => {
      await client.query('LOCK TABLE managed_nodes IN SHARE ROW EXCLUSIVE MODE');
      const count = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM managed_nodes',
      );
      await client.query(
        `INSERT INTO managed_nodes
           (id, name, base_url, description, authorization_encrypted, is_default,
            engine_preference, operation_mode_override)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          name,
          baseUrl,
          description,
          authorization,
          Number(count.rows[0].count) === 0,
          enginePreference,
          operationModeOverride,
        ],
      );
    });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new ApiError(409, 'A node with that name or URL already exists', 'NODE_EXISTS');
    }
    throw error;
  }
  return (await getNode(id))!;
}

export async function updateNode(
  id: string,
  input: Record<string, unknown>,
): Promise<ManagedNode> {
  const current = await getNodeWithAuthorization(id);
  const name = input.name === undefined ? current.node.name : validateName(input.name);
  const baseUrl =
    input.baseUrl === undefined ? current.node.baseUrl : normalizeNodeUrl(input.baseUrl);
  await assertSafeNodeDestination(new URL(baseUrl));
  const description =
    input.description === undefined
      ? current.node.description
      : typeof input.description === 'string' && input.description.trim()
        ? input.description.trim().slice(0, 500)
        : null;
  const changesAuthorization = Object.prototype.hasOwnProperty.call(input, 'authorization');
  const rawAuthorization = changesAuthorization ? normalizeAuthorization(input.authorization) : null;
  const authorization = rawAuthorization ? encryptSecret(rawAuthorization) : null;
  const enginePreference =
    input.enginePreference === undefined
      ? (current.node.enginePreference ?? 'auto')
      : normalizeEnginePreference(input.enginePreference);
  const operationModeOverride =
    input.operationModeOverride === undefined
      ? (current.node.operationModeOverride ?? null)
      : normalizeOperationModeOverride(input.operationModeOverride);

  let result;
  try {
    result = await query(
      `UPDATE managed_nodes
          SET name = $1, base_url = $2, description = $3,
              authorization_encrypted = CASE WHEN $4::boolean THEN $5 ELSE authorization_encrypted END,
              engine_preference = $6,
              operation_mode_override = $7,
              updated_at = now()
        WHERE id = $8`,
      [
        name,
        baseUrl,
        description,
        changesAuthorization,
        authorization,
        enginePreference,
        operationModeOverride,
        id,
      ],
    );
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new ApiError(409, 'A node with that name or URL already exists', 'NODE_EXISTS');
    }
    throw error;
  }
  if (!result.rowCount) throw new ApiError(404, 'Node not found', 'NODE_NOT_FOUND');
  invalidateNodeProbeCache(id);
  return (await getNode(id))!;
}

export async function deleteNode(id: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('LOCK TABLE managed_nodes IN SHARE ROW EXCLUSIVE MODE');
    const target = await client.query<{ is_default: boolean }>(
      'SELECT is_default FROM managed_nodes WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!target.rows[0]) throw new ApiError(404, 'Node not found', 'NODE_NOT_FOUND');
    await client.query('DELETE FROM managed_nodes WHERE id = $1', [id]);
    if (target.rows[0].is_default) {
      await client.query(
        `UPDATE managed_nodes SET is_default = true, updated_at = now()
          WHERE id = (SELECT id FROM managed_nodes ORDER BY created_at ASC LIMIT 1)`,
      );
    }
  });
  invalidateNodeProbeCache(id);
}

export async function makeDefaultNode(id: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('LOCK TABLE managed_nodes IN SHARE ROW EXCLUSIVE MODE');
    const target = await client.query('SELECT 1 FROM managed_nodes WHERE id = $1 FOR UPDATE', [id]);
    if (!target.rowCount) throw new ApiError(404, 'Node not found', 'NODE_NOT_FOUND');
    await client.query('UPDATE managed_nodes SET is_default = false WHERE is_default = true');
    await client.query(
      'UPDATE managed_nodes SET is_default = true, updated_at = now() WHERE id = $1',
      [id],
    );
  });
  invalidateNodeProbeCache(id);
}

const inflightProbes = new Map<string, Promise<ManagedNode>>();
const probeTimestamps = new Map<string, number>();

export function invalidateNodeProbeCache(id?: string): void {
  if (id) {
    probeTimestamps.delete(id);
  } else {
    probeTimestamps.clear();
  }
}

export async function probeNode(
  id: string,
  options: { force?: boolean; fetchImpl?: DiscoverEngineInput['fetchImpl'] } = {},
): Promise<ManagedNode> {
  const force = options.force ?? true;
  if (!force) {
    const lastProbe = probeTimestamps.get(id);
    if (lastProbe && Date.now() - lastProbe < PROBE_FRESHNESS_MS) {
      const cached = await getNode(id);
      if (cached) return cached;
    }
  }

  const inflight = inflightProbes.get(id);
  if (inflight) return inflight;

  const task = (async () => {
    const { node, authorization } = await getNodeWithAuthorization(id);
    const target = new URL('/', node.baseUrl);
    await assertSafeNodeDestination(target);

    const discovery = await discoverEngineProfile({
      baseUrl: node.baseUrl,
      authorization,
      enginePreference: node.enginePreference ?? 'auto',
      operationModeOverride: node.operationModeOverride ?? null,
      fetchImpl: options.fetchImpl,
    });

    if (discovery.connectionState === 'offline') {
      // Preserve last successful profile for offline inspection; mark offline.
      await query(
        `UPDATE managed_nodes
            SET status = 'OFFLINE',
                connection_state = 'offline',
                authorization_state = 'unknown',
                identity_evidence = $1::jsonb,
                last_checked_at = now(),
                last_error = $2,
                updated_at = now()
          WHERE id = $3`,
        [
          JSON.stringify(discovery.evidence),
          (discovery.errorMessage ?? 'Connection failed').slice(0, 300),
          id,
        ],
      );
    } else {
      const nextStatus: ManagedNode['status'] =
        discovery.authorizationState === 'auth_required' ||
        discovery.authorizationState === 'forbidden'
          ? 'UNKNOWN'
          : discovery.compatible
            ? 'ONLINE'
            : 'INCOMPATIBLE';

      const profileChanged =
        node.detectedFamily !== discovery.detectedFamily ||
        node.profileId !== discovery.profileId ||
        node.version !== discovery.runtimeVersion ||
        node.operationMode !== discovery.operationMode;

      await query(
        `UPDATE managed_nodes
            SET status = $1,
                version = $2,
                capabilities = $3::jsonb,
                detected_family = $4,
                profile_id = $5,
                profile_revision = CASE WHEN $6::boolean THEN profile_revision + 1 ELSE profile_revision END,
                operation_mode = $7,
                deployment_role = $8,
                connection_state = $9,
                authorization_state = $10,
                identity_evidence = $11::jsonb,
                profile_checked_at = now(),
                last_checked_at = now(),
                last_error = $12,
                updated_at = now()
          WHERE id = $13`,
        [
          nextStatus,
          discovery.runtimeVersion,
          JSON.stringify(discovery.capabilities),
          discovery.detectedFamily,
          discovery.profileId,
          profileChanged,
          discovery.operationMode,
          discovery.deploymentRole,
          discovery.connectionState,
          discovery.authorizationState,
          JSON.stringify(discovery.evidence),
          discovery.errorMessage ? discovery.errorMessage.slice(0, 300) : null,
          id,
        ],
      );
      probeTimestamps.set(id, Date.now());
    }
    return (await getNode(id))!;
  })();

  inflightProbes.set(id, task);
  try {
    return await task;
  } finally {
    inflightProbes.delete(id);
  }
}
