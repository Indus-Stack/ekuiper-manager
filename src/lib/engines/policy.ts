import ledger from './contracts/rekuiper-operation-ledger.json';
import type { EngineFamily, OperationMode } from './types';

export type SideEffect = 'read' | 'write' | 'destructive' | 'stream';

export interface OperationPolicyDecision {
  allowed: boolean;
  status?: number;
  code?: string;
  reason?: string;
  sideEffect: SideEffect;
  normalizedPath: string;
}

const EKUIPER_ALLOWED_ROOTS = new Set([
  '',
  'async',
  'batch',
  'config',
  'configs',
  'connections',
  'data',
  'metadata',
  'metrics',
  'ping',
  'plugins',
  'rules',
  'ruleset',
  'ruletest',
  'schemas',
  'scripts',
  'services',
  'stop',
  'streamdetails',
  'streams',
  'tabledetails',
  'tables',
  'trace',
  'tracer',
  'udf',
  'v2',
]);

interface LedgerEntry {
  method: string;
  path: string;
  disposition: string;
  sideEffect: SideEffect;
  declarativeAllowed: boolean;
  notes?: string;
}

function matchPathPattern(pattern: string, actualPath: string): boolean {
  if (pattern === actualPath) return true;
  const pSegs = pattern.split('/').filter(Boolean);
  const aSegs = actualPath.split('/').filter(Boolean);
  for (let i = 0; i < pSegs.length; i += 1) {
    const pSeg = pSegs[i];
    if (pSeg.startsWith('*')) {
      return aSegs.length >= i;
    }
    if (i >= aSegs.length) return false;
    if (!pSeg.startsWith(':') && !pSeg.startsWith('{') && pSeg !== aSegs[i]) {
      return false;
    }
  }
  return pSegs.length === aSegs.length;
}

function findLedgerEntry(method: string, actualPath: string): LedgerEntry | undefined {
  const upper = method.toUpperCase();
  const entries = ledger.operations as LedgerEntry[];
  return (
    entries.find((e) => e.method === upper && matchPathPattern(e.path, actualPath)) ??
    entries.find((e) => e.method === 'ANY' && matchPathPattern(e.path, actualPath))
  );
}

export function validateProxyParts(parts: string[]): string {
  if (parts.some((part) => !part || part === '.' || part === '..' || part.includes('/') || part.includes('\\'))) {
    throw new Error('INVALID_PROXY_PATH');
  }
  return parts.map(encodeURIComponent).join('/');
}

export function evaluateEngineOperationPolicy(input: {
  family: EngineFamily;
  operationMode: OperationMode;
  method: string;
  parts: string[];
}): OperationPolicyDecision {
  const method = input.method.toUpperCase();
  const encoded = validateProxyParts(input.parts);
  const actualPath = encoded ? `/${input.parts.join('/')}` : '/';

  if (input.family === 'ekuiper') {
    const root = input.parts[0] ?? '';
    if (!EKUIPER_ALLOWED_ROOTS.has(root)) {
      return {
        allowed: false,
        status: 404,
        code: 'PROXY_PATH_NOT_ALLOWED',
        reason: 'That eKuiper API path is not exposed',
        sideEffect: method === 'GET' ? 'read' : 'write',
        normalizedPath: encoded,
      };
    }
    const sideEffect: SideEffect =
      actualPath === '/stop' ? 'destructive' : method === 'DELETE' ? 'destructive' : method === 'GET' ? 'read' : 'write';
    return { allowed: true, sideEffect, normalizedPath: encoded };
  }

  // reKuiper policy backed by EA-01 ledger
  const entry = findLedgerEntry(method, actualPath);
  if (!entry) {
    return {
      allowed: false,
      status: 404,
      code: 'PROXY_PATH_NOT_ALLOWED',
      reason: `Operation ${method} ${actualPath} is not in the qualified reKuiper ledger`,
      sideEffect: method === 'GET' ? 'read' : 'write',
      normalizedPath: encoded,
    };
  }

  if (entry.disposition === 'engine-internal') {
    return {
      allowed: false,
      status: 404,
      code: 'ENGINE_OPERATION_INTERNAL',
      reason: entry.notes ?? 'Operation is engine-internal',
      sideEffect: entry.sideEffect,
      normalizedPath: encoded,
    };
  }

  if (entry.disposition === 'unavailable') {
    return {
      allowed: false,
      status: 501,
      code: 'ENGINE_OPERATION_UNAVAILABLE',
      reason: entry.notes ?? 'Operation is unavailable in this reKuiper build',
      sideEffect: entry.sideEffect,
      normalizedPath: encoded,
    };
  }

  if (input.operationMode === 'declarative' && !entry.declarativeAllowed) {
    return {
      allowed: false,
      status: 403,
      code: 'DECLARATIVE_MODE_ACTIVE',
      reason: `Operation ${method} ${actualPath} is blocked in declarative mode`,
      sideEffect: entry.sideEffect,
      normalizedPath: encoded,
    };
  }

  return {
    allowed: true,
    sideEffect: entry.sideEffect,
    normalizedPath: encoded,
  };
}

