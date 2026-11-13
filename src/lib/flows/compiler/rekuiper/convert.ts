import type { EngineFamily } from '@/lib/engines/types';
import type { FlowGraphEdgeInput, FlowGraphNodeInput } from './compile-graph';

export interface CrossEngineCompatibilityReport {
  sourceEngine: EngineFamily;
  targetEngine: EngineFamily;
  compatible: boolean;
  blockers: string[];
  warnings: string[];
}

const REKUIPER_ONLY_NODES = new Set(['rate_limiter', 'watchdog', 'simulator']);

/**
 * Evaluate whether a flow draft can be explicitly copied to another engine family.
 * Never mutates the original draft; returns a report blocking incompatible
 * multi-port or engine-specific operators.
 */
export function evaluateCrossEngineCopy(input: {
  sourceEngine: EngineFamily;
  targetEngine: EngineFamily;
  nodes: FlowGraphNodeInput[];
  edges: FlowGraphEdgeInput[];
}): CrossEngineCompatibilityReport {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.sourceEngine === input.targetEngine) {
    return {
      sourceEngine: input.sourceEngine,
      targetEngine: input.targetEngine,
      compatible: true,
      blockers,
      warnings,
    };
  }

  if (input.targetEngine === 'ekuiper') {
    const hasMultiPort = input.edges.some((e) => (e.sourcePort ?? 0) > 0);
    if (hasMultiPort) {
      blockers.push('Multi-port edge routing (sourcePort > 0) is not supported in the eKuiper graph contract.');
    }
    for (const node of input.nodes) {
      if (REKUIPER_ONLY_NODES.has(node.nodeType)) {
        blockers.push(`Node "${node.id}" uses reKuiper-native type "${node.nodeType}", which has no verified eKuiper equivalent.`);
      }
    }
  }

  if (blockers.length === 0) {
    warnings.push(`Copied draft from ${input.sourceEngine} to ${input.targetEngine}; revalidate against the target before deploying.`);
  }

  return {
    sourceEngine: input.sourceEngine,
    targetEngine: input.targetEngine,
    compatible: blockers.length === 0,
    blockers,
    warnings,
  };
}

