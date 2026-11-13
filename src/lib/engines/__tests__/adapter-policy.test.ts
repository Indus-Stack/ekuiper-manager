import {
  assertProfileRevisionMatch,
  formatUpstreamAuthorization,
} from '../adapter';
import { evaluateEngineOperationPolicy } from '../policy';
import type { ManagedNode } from '@/lib/nodes';

function makeNode(overrides: Partial<ManagedNode> = {}): ManagedNode {
  return {
    id: 'node-1',
    name: 'Test Node',
    baseUrl: 'http://127.0.0.1:9081',
    description: null,
    hasAuthorization: false,
    isDefault: true,
    status: 'ONLINE',
    version: '1.0.0-rc5',
    capabilities: {},
    profileRevision: 3,
    lastCheckedAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('EA-04 engine adapter and operation policy', () => {
  it('classifies GET /stop as destructive and blocks internal/unavailable reKuiper operations', () => {
    const stopDecision = evaluateEngineOperationPolicy({
      family: 'rekuiper',
      operationMode: 'imperative',
      method: 'GET',
      parts: ['stop'],
    });
    expect(stopDecision.allowed).toBe(true);
    expect(stopDecision.sideEffect).toBe('destructive');

    const uiDecision = evaluateEngineOperationPolicy({
      family: 'rekuiper',
      operationMode: 'imperative',
      method: 'GET',
      parts: ['ui'],
    });
    expect(uiDecision.allowed).toBe(false);
    expect(uiDecision.status).toBe(404);
    expect(uiDecision.code).toBe('ENGINE_OPERATION_INTERNAL');

    const portableDecision = evaluateEngineOperationPolicy({
      family: 'rekuiper',
      operationMode: 'imperative',
      method: 'POST',
      parts: ['plugins', 'portables'],
    });
    expect(portableDecision.allowed).toBe(false);
    expect(portableDecision.status).toBe(501);
    expect(portableDecision.code).toBe('ENGINE_OPERATION_UNAVAILABLE');
  });

  it('enforces declarative-mode guards accurately for reKuiper', () => {
    const validateBlocked = evaluateEngineOperationPolicy({
      family: 'rekuiper',
      operationMode: 'declarative',
      method: 'POST',
      parts: ['rules', 'validate'],
    });
    expect(validateBlocked.allowed).toBe(false);
    expect(validateBlocked.status).toBe(403);
    expect(validateBlocked.code).toBe('DECLARATIVE_MODE_ACTIVE');

    const testDeleteBlocked = evaluateEngineOperationPolicy({
      family: 'rekuiper',
      operationMode: 'declarative',
      method: 'DELETE',
      parts: ['ruletest', 't1'],
    });
    expect(testDeleteBlocked.allowed).toBe(false);
    expect(testDeleteBlocked.status).toBe(403);

    const reloadAllowed = evaluateEngineOperationPolicy({
      family: 'rekuiper',
      operationMode: 'declarative',
      method: 'POST',
      parts: ['declarative', 'reload'],
    });
    expect(reloadAllowed.allowed).toBe(true);

    const dlqClearAllowed = evaluateEngineOperationPolicy({
      family: 'rekuiper',
      operationMode: 'declarative',
      method: 'DELETE',
      parts: ['rules', 'r1', 'dlq'],
    });
    expect(dlqClearAllowed.allowed).toBe(true);
  });

  it('rejects path traversal and stale profile revisions', () => {
    expect(() =>
      evaluateEngineOperationPolicy({
        family: 'ekuiper',
        operationMode: 'unknown',
        method: 'GET',
        parts: ['..', 'etc', 'passwd'],
      }),
    ).toThrow('INVALID_PROXY_PATH');

    const node = makeNode({ profileRevision: 3 });
    expect(() => assertProfileRevisionMatch(node, '3')).not.toThrow();
    expect(() => assertProfileRevisionMatch(node, '2')).toThrow(/revalidated|revision/i);
  });

  it('strips Bearer prefix for 3-part JWTs on reKuiper while keeping shared tokens intact', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.sig123';
    expect(formatUpstreamAuthorization('rekuiper', `Bearer ${jwt}`)).toBe(jwt);
    expect(formatUpstreamAuthorization('rekuiper', 'Bearer shared-fleet-token')).toBe(
      'Bearer shared-fleet-token',
    );
    expect(formatUpstreamAuthorization('ekuiper', `Bearer ${jwt}`)).toBe(`Bearer ${jwt}`);
  });
});

