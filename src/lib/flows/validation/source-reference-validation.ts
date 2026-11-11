import { resolveTargetFeatures } from '../capabilities/resolve-capabilities';
import type { TargetCapabilityProfile } from '../capabilities/types';
import {
  FLOW_SOURCENAME_DECODE_WARNING,
  type FlowDiagnostic,
} from '../model/diagnostic';
import type { FlowDocument } from '../model/flow-document';

/**
 * Warn when a Flow graph references a saved stream or table (`stream-source`
 * or `table-source`, compiled via `sourceName`) against an eKuiper target
 * below 2.5.
 *
 * Upstream PR #4213 fixed empty `{}` tuple output when decoding graph sources
 * configured via `sourceName`, and that fix is absent from both `v2.4.2` and
 * unreleased `master-2.4`. Non-blocking (`severity: 'warning'`), so existing
 * workflows remain inspectable and deployable when appropriate.
 */
export function validateFlowSourceReferences(
  document: FlowDocument,
  capabilityProfile: TargetCapabilityProfile,
): FlowDiagnostic[] {
  if (!capabilityProfile.graphRules) return [];
  const features = resolveTargetFeatures(capabilityProfile.ekuiperVersion);
  if (features.supportsSafeSourceNameGraphs) return [];

  const versionLabel = capabilityProfile.ekuiperVersion ?? '2.4.x';
  const diagnostics: FlowDiagnostic[] = [];
  for (const node of document.spec.nodes) {
    if (node.type !== 'stream-source' && node.type !== 'table-source') {
      continue;
    }
    const kind = node.type === 'table-source' ? 'table' : 'stream';
    const propertyPath = node.type === 'table-source' ? 'table' : 'stream';
    diagnostics.push({
      code: FLOW_SOURCENAME_DECODE_WARNING,
      severity: 'warning',
      nodeId: node.id,
      propertyPath,
      message: `eKuiper ${versionLabel} graphs referencing a saved ${kind} via sourceName can emit empty {} payloads without upstream fix PR #4213; prefer SQL rules or explicit memory/mqtt source nodes until upgraded to eKuiper 2.5+.`,
    });
  }
  return diagnostics;
}

