import type { OperationMode } from './types';

export interface DeclarativeReloadOutcome {
  ok: boolean;
  targetNodeId: string;
  checkedAt: string;
  error?: string;
  details?: string;
}

export function validateDeclarativeManifest(manifest: unknown): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['Manifest must be a JSON/YAML object'], warnings };
  }
  const obj = manifest as Record<string, unknown>;
  const hasAnySection = ['streams', 'tables', 'rules', 'connections', 'schemas'].some(
    (key) => key in obj,
  );
  if (!hasAnySection) {
    warnings.push('Manifest contains no streams, tables, rules, connections, or schemas.');
  }
  const serialized = JSON.stringify(obj);
  if (/("password"|"token"|"secret"|"authorization")\s*:\s*"[^"]+"/i.test(serialized)) {
    warnings.push('Manifest appears to contain inline secret values; prefer environment/secret references.');
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function canExecuteInMode(
  mode: OperationMode,
  declarativeAllowed: boolean,
): { allowed: boolean; reason?: string } {
  if (mode === 'declarative' && !declarativeAllowed) {
    return {
      allowed: false,
      reason: 'Blocked in declarative mode; update the engine manifest and reload instead.',
    };
  }
  return { allowed: true };
}

