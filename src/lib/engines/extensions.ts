import type { EngineFamily } from './types';

export interface ExtensionSurfacePolicy {
  nativePluginsSupported: boolean;
  portablePluginsMutable: boolean;
  portableMutationReason?: string;
  wasmSupported: boolean;
  jsUdfSupported: boolean;
  jsUdfEngineTestAvailable: boolean;
  jsUdfPreviewLabel: string;
}

export function getExtensionSurfacePolicy(family: EngineFamily | null): ExtensionSurfacePolicy {
  if (family === 'rekuiper') {
    return {
      nativePluginsSupported: true,
      portablePluginsMutable: false,
      portableMutationReason: 'Portable-plugin create/update/delete return 501 Not Implemented in pinned reKuiper.',
      wasmSupported: true,
      jsUdfSupported: true,
      jsUdfEngineTestAvailable: false,
      jsUdfPreviewLabel: 'Local browser preview only (not executed in reKuiper Boa JS runtime)',
    };
  }
  return {
    nativePluginsSupported: true,
    portablePluginsMutable: true,
    wasmSupported: false,
    jsUdfSupported: true,
    jsUdfEngineTestAvailable: false,
    jsUdfPreviewLabel: 'Local browser preview only',
  };
}

export interface NodeArtifactReference {
  nodeId: string;
  enginePath: string;
  kind: 'tls' | 'protobuf' | 'wasm' | 'upload';
}

export function buildNodeArtifactRef(
  nodeId: string,
  enginePath: string,
  kind: NodeArtifactReference['kind'],
): NodeArtifactReference {
  return {
    nodeId,
    enginePath: enginePath.trim(),
    kind,
  };
}

