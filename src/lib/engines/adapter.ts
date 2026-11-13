import { ApiError } from '@/lib/api';
import type { ManagedNode } from '@/lib/nodes';
import type { EngineFamily, OperationMode } from './types';

export function resolveEffectiveEngineFamily(node: ManagedNode): EngineFamily {
  if (node.enginePreference && node.enginePreference !== 'auto') {
    return node.enginePreference;
  }
  return node.detectedFamily ?? 'ekuiper';
}

export function resolveEffectiveOperationMode(node: ManagedNode): OperationMode {
  return node.operationModeOverride ?? node.operationMode ?? 'unknown';
}

/**
 * Format stored node credentials for the target engine's auth middleware.
 * reKuiper's inspected JWT middleware expects a raw token without `Bearer `
 * when the credential is a 3-segment JWT, while shared tokens use `Bearer `.
 */
export function formatUpstreamAuthorization(
  family: EngineFamily,
  rawAuthorization: string | null,
): string | null {
  if (!rawAuthorization) return null;
  const trimmed = rawAuthorization.trim();
  if (!trimmed) return null;

  if (family === 'rekuiper') {
    const bearerMatch = /^Bearer\s+(.+)$/i.exec(trimmed);
    if (bearerMatch) {
      const token = bearerMatch[1].trim();
      if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
        return token;
      }
    }
  }
  return trimmed;
}

export function assertProfileRevisionMatch(
  node: ManagedNode,
  expectedRevisionHeader: string | null,
): void {
  if (expectedRevisionHeader === null || expectedRevisionHeader === '') return;
  const parsed = Number(expectedRevisionHeader);
  const current = node.profileRevision ?? 0;
  if (!Number.isInteger(parsed) || parsed !== current) {
    throw new ApiError(
      409,
      `Target profile changed (expected revision ${expectedRevisionHeader}, current ${current}). Revalidate before retrying.`,
      'STALE_PROFILE_REVISION',
    );
  }
}

