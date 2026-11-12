import { getBuiltinConnectorProperties } from '@/lib/ekuiper/connector-catalog';

export type ConnectorCategory = Parameters<typeof getBuiltinConnectorProperties>[0];
import {
  getAllFunctions,
  getAllFunctionsForVersion,
  type EKuiperFunction,
} from '@/lib/ekuiper/functions';
import type { MetadataProperty } from '@/lib/ekuiper/types';
import type { EngineFamily } from './types';

export interface RuntimeFunctionRecord {
  name?: string;
  id?: string;
  signature?: string;
  description?: string;
  category?: string;
}

function normalizeRuntimeFunctions(raw: unknown): EKuiperFunction[] {
  if (!Array.isArray(raw)) return [];
  const normalized: EKuiperFunction[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const name = item.trim();
      if (name) {
        normalized.push({
          name,
          signature: `${name}(...)`,
          description: 'Registered engine function',
          examples: [`${name}()`],
        });
      }
      continue;
    }
    if (item && typeof item === 'object') {
      const rec = item as RuntimeFunctionRecord;
      const name = (rec.name ?? rec.id ?? '').trim();
      if (!name) continue;
      normalized.push({
        name,
        signature: rec.signature?.trim() || `${name}(...)`,
        description: rec.description?.trim() || 'Registered engine function',
        examples: [`${name}()`],
      });
    }
  }
  return normalized;
}

/**
 * Resolve SQL functions for the active engine profile, merging live engine
 * metadata (including UDF/service functions) with the engine-appropriate
 * built-in catalog.
 */
export function getFunctionsForTarget(input: {
  engineFamily?: EngineFamily | null;
  version?: string | null;
  runtimeFunctions?: unknown;
  query?: string;
}): EKuiperFunction[] {
  const baseFunctions =
    input.engineFamily === 'rekuiper'
      ? getAllFunctions()
      : getAllFunctionsForVersion(input.version);

  const merged = new Map<string, EKuiperFunction>();
  for (const fn of baseFunctions) {
    if (!merged.has(fn.name)) merged.set(fn.name, fn);
  }
  for (const fn of normalizeRuntimeFunctions(input.runtimeFunctions)) {
    if (!merged.has(fn.name)) merged.set(fn.name, fn);
  }

  const lowerQuery = (input.query ?? '').trim().toLowerCase();
  return [...merged.values()].filter(
    (fn) =>
      !lowerQuery ||
      fn.name.toLowerCase().includes(lowerQuery) ||
      fn.signature.toLowerCase().includes(lowerQuery) ||
      fn.description.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Resolve connector properties preferring live engine metadata over static
 * built-in defaults.
 */
export function getConnectorPropertiesForTarget(input: {
  category: ConnectorCategory;
  connectorType: string;
  liveProperties?: MetadataProperty[] | null;
}): MetadataProperty[] {
  if (Array.isArray(input.liveProperties) && input.liveProperties.length > 0) {
    return input.liveProperties;
  }
  return getBuiltinConnectorProperties(input.category, input.connectorType);
}
