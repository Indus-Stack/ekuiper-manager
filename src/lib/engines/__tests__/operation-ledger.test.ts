import buildMatrix from '../contracts/build-matrix.json';
import ledger from '../contracts/rekuiper-operation-ledger.json';

describe('EA-01 build matrix and reKuiper operation ledger', () => {
  it('pins eKuiper stable/preview profiles and reKuiper latest main distinct from v1.0.0-rc5', () => {
    const families = new Set(buildMatrix.engines.map((entry) => entry.family));
    expect(families).toEqual(new Set(['ekuiper', 'rekuiper']));

    const rekuiperMain = buildMatrix.engines.find((entry) => entry.family === 'rekuiper');
    expect(rekuiperMain).toBeDefined();
    expect(rekuiperMain?.refType).toBe('branch');
    expect(rekuiperMain?.ref).toBe('main');
    expect(rekuiperMain?.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(rekuiperMain?.distinguishedFromTag?.tag).toBe('v1.0.0-rc5');
    expect(rekuiperMain?.distinguishedFromTag?.commit).not.toBe(rekuiperMain?.commit);
  });

  it('records all 205 registered reKuiper operations with unique method/path and valid dispositions', () => {
    expect(ledger.pinnedCommit).toBe('24848c8f88363bfe0004cc88c7db73302657aa0c');
    expect(ledger.operations).toHaveLength(ledger.summary.registeredOperations);
    expect(ledger.summary.upstreamOpenApiOperations + ledger.summary.omittedFromUpstreamOpenApi).toBe(
      ledger.summary.registeredOperations,
    );

    const seen = new Set<string>();
    const validDispositions = new Set(['implement', 'engine-internal', 'unavailable', 'blocked-in-declarative']);
    const validSideEffects = new Set(['read', 'write', 'destructive', 'stream']);

    for (const op of ledger.operations) {
      const key = `${op.method} ${op.path}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(validDispositions.has(op.disposition)).toBe(true);
      expect(validSideEffects.has(op.sideEffect)).toBe(true);
      expect(op.family.length).toBeGreaterThan(0);
      expect(op.fixtureRequirement.length).toBeGreaterThan(0);
    }
  });

  it('marks GET /stop as destructive and portable-plugin mutations as unavailable', () => {
    const getStop = ledger.operations.find((op) => op.method === 'GET' && op.path === '/stop');
    expect(getStop?.sideEffect).toBe('destructive');

    const portableCreate = ledger.operations.find(
      (op) => op.method === 'POST' && op.path === '/plugins/portables',
    );
    expect(portableCreate?.disposition).toBe('unavailable');

    const fleetWs = ledger.operations.find((op) => op.path === '/fleet/ws');
    expect(fleetWs?.disposition).toBe('engine-internal');
  });
});

