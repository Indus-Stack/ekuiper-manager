export type EngineFamily = 'ekuiper' | 'rekuiper';
export type EnginePreference = 'auto' | EngineFamily;
export type OperationMode = 'imperative' | 'declarative' | 'unknown';
export type OperationModeOverride = 'imperative' | 'declarative';
export type DeploymentRole = 'standalone' | 'fleet_hub' | 'fleet_device' | 'unknown';
export type ConnectionState = 'unknown' | 'reachable' | 'offline';
export type AuthorizationState = 'unknown' | 'authorized' | 'auth_required' | 'forbidden';
export type IdentitySource =
  | 'explicit_descriptor'
  | 'signature_probe'
  | 'configured_preference'
  | 'unknown';

export type CapabilityStatus = 'supported' | 'unsupported' | 'unknown' | 'unavailable';

export interface CapabilityDetail {
  status: CapabilityStatus;
  reason?: string;
  provenance?: string;
}

export interface EngineDiscoveryResult {
  detectedFamily: EngineFamily | null;
  effectiveFamily: EngineFamily | null;
  runtimeVersion: string | null;
  profileId: string | null;
  identitySource: IdentitySource;
  connectionState: ConnectionState;
  authorizationState: AuthorizationState;
  operationMode: OperationMode;
  deploymentRole: DeploymentRole;
  compatible: boolean;
  capabilities: Record<string, boolean>;
  capabilityDetails: Record<string, CapabilityDetail>;
  evidence: Record<string, unknown>;
  errorMessage: string | null;
}

