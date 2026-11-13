export interface FleetTargetRef {
  hubNodeId: string;
  deviceId: string;
}

export interface FleetDevice {
  id: string;
  name?: string;
  status?: string;
  lastHeartbeatAt?: string;
  version?: string;
  groupId?: string;
  directNodeId?: string | null;
}

export interface FleetGroup {
  id: string;
  name: string;
  deviceCount?: number;
}

export interface FleetSnapshot {
  id: string;
  name?: string;
  createdAt?: string;
  checksum?: string;
}

export interface FleetRollout {
  id: string;
  snapshotId: string;
  stage?: string;
  status?: string;
  affectedDevices?: Array<{ deviceId: string; status: string; error?: string }>;
}

/**
 * Detect if a fleet device URL is also directly registered as a standalone
 * Manager node so UI/audit keep their identities and credentials separate.
 */
export function detectDuplicateDirectRegistration(
  deviceUrl: string | undefined,
  registeredNodes: Array<{ id: string; baseUrl: string }>,
): string | null {
  if (!deviceUrl) return null;
  const normalized = deviceUrl.trim().replace(/\/+$/, '').toLowerCase();
  const match = registeredNodes.find(
    (n) => n.baseUrl.trim().replace(/\/+$/, '').toLowerCase() === normalized,
  );
  return match?.id ?? null;
}

export function buildFleetEndpoint(hubNodeId: string, fleetPath: string): string {
  const clean = fleetPath.startsWith('/') ? fleetPath : `/${fleetPath}`;
  return `/api/nodes/${encodeURIComponent(hubNodeId)}/engine/api/v1/fleet${clean}`;
}

export function buildFleetDeviceProxyEndpoint(
  hubNodeId: string,
  deviceId: string,
  downstreamPath: string,
): string {
  const clean = downstreamPath.replace(/^\/+/, '');
  return `/api/nodes/${encodeURIComponent(hubNodeId)}/engine/api/v1/fleet/devices/${encodeURIComponent(deviceId)}/proxy/${clean}`;
}

