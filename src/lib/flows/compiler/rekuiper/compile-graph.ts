export const REKUIPER_COMPILER_VERSION = '1.0.0-rekuiper-v1';

export interface ReKuiperGraphNode {
  id: string;
  type: string;
  nodeType: string;
  props: Record<string, unknown>;
}

/**
 * reKuiper accepts port-indexed `string[][]` edges (e.g. `[[], ["sink1"]]`
 * where port 0 is empty and port 1 connects to `sink1`) as well as flat `string[]`.
 */
export type ReKuiperEdgeTarget = string[] | string[][];

export interface ReKuiperGraphPayload {
  id: string;
  name?: string;
  triggered?: boolean;
  graph: {
    nodes: Record<string, ReKuiperGraphNode>;
    topo: {
      sources: string[];
      edges: Record<string, ReKuiperEdgeTarget>;
    };
  };
  options?: Record<string, unknown>;
  /** Opaque round-trip metadata for unrecognized native fields. */
  [extraKey: string]: unknown;
}

export interface FlowGraphEdgeInput {
  source: string;
  target: string;
  sourcePort?: number;
}

export interface FlowGraphNodeInput {
  id: string;
  type: string;
  nodeType: string;
  props: Record<string, unknown>;
  isSource?: boolean;
  opaque?: Record<string, unknown>;
}

/**
 * Compile nodes and port-indexed edges into a deterministic reKuiper graph payload.
 * Preserves empty leading ports (e.g. port 0 unconnected, port 1 -> target).
 */
export function compileReKuiperGraph(input: {
  id: string;
  name?: string;
  nodes: FlowGraphNodeInput[];
  edges: FlowGraphEdgeInput[];
  options?: Record<string, unknown>;
}): ReKuiperGraphPayload {
  const nodesMap: Record<string, ReKuiperGraphNode> = {};
  const sources: string[] = [];

  for (const node of [...input.nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    nodesMap[node.id] = {
      ...(node.opaque ?? {}),
      id: node.id,
      type: node.type,
      nodeType: node.nodeType,
      props: { ...node.props },
    };
    if (node.isSource || node.type === 'source') {
      sources.push(node.id);
    }
  }

  const edgesBySource = new Map<string, FlowGraphEdgeInput[]>();
  for (const edge of input.edges) {
    const list = edgesBySource.get(edge.source) ?? [];
    list.push(edge);
    edgesBySource.set(edge.source, list);
  }

  const edges: Record<string, ReKuiperEdgeTarget> = {};
  for (const [sourceId, list] of [...edgesBySource.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const hasExplicitPorts = list.some((e) => typeof e.sourcePort === 'number' && e.sourcePort > 0);
    if (!hasExplicitPorts) {
      edges[sourceId] = list.map((e) => e.target);
      continue;
    }
    const maxPort = Math.max(...list.map((e) => e.sourcePort ?? 0));
    const ports: string[][] = Array.from({ length: maxPort + 1 }, () => []);
    for (const edge of list) {
      const port = edge.sourcePort ?? 0;
      ports[port].push(edge.target);
    }
    edges[sourceId] = ports;
  }

  return {
    id: input.id,
    ...(input.name ? { name: input.name } : {}),
    graph: {
      nodes: nodesMap,
      topo: {
        sources,
        edges,
      },
    },
    ...(input.options ? { options: input.options } : {}),
  };
}

/**
 * Losslessly import a native reKuiper graph payload, preserving port indices,
 * empty ports, and unrecognized node/rule properties.
 */
export function importReKuiperGraph(payload: ReKuiperGraphPayload): {
  nodes: FlowGraphNodeInput[];
  edges: FlowGraphEdgeInput[];
  unsupportedNodeIds: string[];
} {
  const supportedNativeTypes = new Set([
    'mqtt', 'memory', 'httppush', 'simulator', 'file', 'sql', 'redis', 'kafka',
    'filter', 'pick', 'window', 'aggfunc', 'groupby', 'orderby', 'join', 'switch',
    'function', 'rate_limiter', 'watchdog', 'log', 'rest',
  ]);
  const sourcesSet = new Set(payload.graph.topo.sources ?? []);
  const unsupportedNodeIds: string[] = [];

  const nodes: FlowGraphNodeInput[] = Object.entries(payload.graph.nodes ?? {}).map(([id, raw]) => {
    const { id: _id, type, nodeType, props, ...opaque } = raw;
    if (!supportedNativeTypes.has(nodeType)) {
      unsupportedNodeIds.push(id);
    }
    return {
      id,
      type,
      nodeType,
      props: props ?? {},
      isSource: sourcesSet.has(id) || type === 'source',
      ...(Object.keys(opaque).length > 0 ? { opaque } : {}),
    };
  });

  const edges: FlowGraphEdgeInput[] = [];
  for (const [source, targetEntry] of Object.entries(payload.graph.topo.edges ?? {})) {
    if (Array.isArray(targetEntry) && targetEntry.every((item) => typeof item === 'string')) {
      for (const target of targetEntry as string[]) {
        edges.push({ source, target, sourcePort: 0 });
      }
    } else if (Array.isArray(targetEntry)) {
      (targetEntry as string[][]).forEach((targets, portIndex) => {
        if (!Array.isArray(targets)) return;
        for (const target of targets) {
          edges.push({ source, target, sourcePort: portIndex });
        }
      });
    }
  }

  return { nodes, edges, unsupportedNodeIds };
}

