import { create } from 'zustand';
import type {
  AuthorizationState,
  ConnectionState,
  EngineFamily,
  EnginePreference,
  OperationMode,
} from '@/lib/engines/types';

export type ServerStatus = 'connected' | 'disconnected' | 'error' | 'unknown';
export type StorageMode = 'database';

export interface ServerConnection {
  id: string;
  name: string;
  url: string;
  description?: string;
  status: ServerStatus;
  version?: string;
  engineFamily?: EngineFamily | null;
  enginePreference?: EnginePreference;
  profileId?: string | null;
  profileRevision?: number;
  operationMode?: OperationMode;
  connectionState?: ConnectionState;
  authorizationState?: AuthorizationState;
  capabilities?: Record<string, boolean>;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

interface NodePayload {
  id: string;
  name: string;
  baseUrl: string;
  description: string | null;
  status: 'UNKNOWN' | 'ONLINE' | 'OFFLINE' | 'INCOMPATIBLE';
  version: string | null;
  capabilities?: Record<string, boolean>;
  enginePreference?: EnginePreference;
  detectedFamily?: EngineFamily | null;
  profileId?: string | null;
  profileRevision?: number;
  operationMode?: OperationMode;
  connectionState?: ConnectionState;
  authorizationState?: AuthorizationState;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NodeListPayload {
  nodes: NodePayload[];
  selectedNodeId: string | null;
}

export function buildTargetCacheKey(
  nodeId: string | null,
  profileRevision: number | null | undefined,
  ...parts: readonly unknown[]
): readonly unknown[] {
  return ['target', nodeId ?? 'none', profileRevision ?? 0, ...parts];
}

interface ServerState {
  storageMode: StorageMode;
  servers: ServerConnection[];
  savedBrowserServers: ServerConnection[];
  activeServerId: string | null;
  switchEpoch: number;
  draftsByTarget: Record<string, Record<string, unknown>>;
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;
  setStorageMode: (_mode: StorageMode) => void;
  fetchServers: () => Promise<void>;
  addServer: (server: {
    name: string;
    url: string;
    description?: string;
    authorization?: string;
    enginePreference?: EnginePreference;
  }) => Promise<void>;
  updateServer: (id: string, updates: Partial<ServerConnection>) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  setActiveServer: (id: string | null) => void;
  getActiveServer: () => ServerConnection | null;
  saveTargetDraft: (targetId: string, draftKey: string, value: unknown) => void;
  getTargetDraft: <T = unknown>(targetId: string, draftKey: string) => T | undefined;
  clearTargetDraft: (targetId: string, draftKey: string) => void;
  setHasHydrated: (state: boolean) => void;
}

function mapNode(node: NodePayload): ServerConnection {
  const status: ServerStatus =
    node.status === 'ONLINE'
      ? 'connected'
      : node.status === 'OFFLINE'
        ? 'disconnected'
        : node.status === 'INCOMPATIBLE'
          ? 'error'
          : 'unknown';
  const engineFamily: EngineFamily | null =
    node.enginePreference && node.enginePreference !== 'auto'
      ? node.enginePreference
      : node.detectedFamily ?? null;
  return {
    id: node.id,
    name: node.name,
    url: node.baseUrl,
    description: node.description ?? undefined,
    status,
    version: node.version ?? undefined,
    engineFamily,
    enginePreference: node.enginePreference ?? 'auto',
    profileId: node.profileId ?? null,
    profileRevision: node.profileRevision ?? 0,
    operationMode: node.operationMode ?? 'unknown',
    connectionState: node.connectionState ?? 'unknown',
    authorizationState: node.authorizationState ?? 'unknown',
    capabilities: node.capabilities ?? {},
    isDefault: node.isDefault,
    createdAt: new Date(node.createdAt),
    updatedAt: new Date(node.updatedAt),
  };
}

async function responseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  return payload?.error?.message ?? `Request failed (${response.status})`;
}

export const useServerStore = create<ServerState>((set, get) => ({
  storageMode: 'database',
  servers: [],
  savedBrowserServers: [],
  activeServerId: null,
  switchEpoch: 0,
  draftsByTarget: {},
  isLoading: false,
  error: null,
  _hasHydrated: true,
  setStorageMode: () => undefined,
  setHasHydrated: (state) => set({ _hasHydrated: state }),

  fetchServers: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/nodes', { cache: 'no-store' });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = (await response.json()) as NodeListPayload;
      const servers = payload.nodes.map(mapNode);
      const activeServerId =
        servers.find((node) => node.id === payload.selectedNodeId)?.id ??
        servers.find((node) => node.isDefault)?.id ??
        servers[0]?.id ??
        null;
      set({ servers, activeServerId, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load eKuiper nodes',
        isLoading: false,
      });
    }
  },

  addServer: async (server) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: server.name,
          baseUrl: server.url,
          description: server.description,
          authorization: server.authorization,
          enginePreference: server.enginePreference,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      await get().fetchServers();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add eKuiper node',
        isLoading: false,
      });
      throw error;
    }
  },

  updateServer: async (id, updates) => {
    const response = await fetch(`/api/nodes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: updates.name,
        baseUrl: updates.url,
        description: updates.description,
      }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    await get().fetchServers();
  },

  removeServer: async (id) => {
    const response = await fetch(`/api/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(await responseError(response));
    await get().fetchServers();
  },

  setActiveServer: (id) => {
    set((state) => ({
      activeServerId: id,
      switchEpoch: state.switchEpoch + 1,
      error: null,
    }));
    if (!id || typeof window === 'undefined') return;
    void fetch(`/api/nodes/${encodeURIComponent(id)}/select`, {
      method: 'POST',
      headers: { Origin: window.location.origin },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
      })
      .catch((error) => {
        set({ error: error instanceof Error ? error.message : 'Failed to select node' });
      });
  },

  saveTargetDraft: (targetId, draftKey, value) => {
    set((state) => ({
      draftsByTarget: {
        ...state.draftsByTarget,
        [targetId]: {
          ...(state.draftsByTarget[targetId] ?? {}),
          [draftKey]: value,
        },
      },
    }));
  },

  getTargetDraft: <T = unknown>(targetId: string, draftKey: string): T | undefined => {
    return get().draftsByTarget[targetId]?.[draftKey] as T | undefined;
  },

  clearTargetDraft: (targetId, draftKey) => {
    set((state) => {
      const targetDrafts = { ...(state.draftsByTarget[targetId] ?? {}) };
      delete targetDrafts[draftKey];
      return {
        draftsByTarget: {
          ...state.draftsByTarget,
          [targetId]: targetDrafts,
        },
      };
    });
  },

  getActiveServer: () => {
    const state = get();
    return state.servers.find((server) => server.id === state.activeServerId) ?? null;
  },
}));
