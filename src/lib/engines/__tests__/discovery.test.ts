import { discoverEngineProfile } from '../discovery';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('EA-03 engine identity and profile discovery', () => {
  it('identifies eKuiper 2.4.1 and 2.4.2 independently', async () => {
    const fetch241 = async (input: URL | string) => {
      const p = new URL(String(input)).pathname;
      if (p === '/') return jsonResponse({ version: '2.4.1', os: 'linux', arch: 'amd64' });
      if (p === '/rules') return jsonResponse([]);
      return jsonResponse({ error: 404, message: 'not found' }, 404);
    };
    const res241 = await discoverEngineProfile({
      baseUrl: 'http://ekuiper.local:9081',
      authorization: null,
      enginePreference: 'auto',
      operationModeOverride: null,
      fetchImpl: fetch241,
    });
    expect(res241.detectedFamily).toBe('ekuiper');
    expect(res241.profileId).toBe('ekuiper-2.4.1');
    expect(res241.compatible).toBe(true);
    expect(res241.capabilities.sqlFunctions242).toBe(false);

    const fetch242 = async (input: URL | string) => {
      const p = new URL(String(input)).pathname;
      if (p === '/') return jsonResponse({ version: '2.4.2-slim', os: 'linux', arch: 'amd64' });
      if (p === '/rules') return jsonResponse([]);
      return jsonResponse({}, 404);
    };
    const res242 = await discoverEngineProfile({
      baseUrl: 'http://ekuiper.local:9081',
      authorization: null,
      enginePreference: 'auto',
      operationModeOverride: null,
      fetchImpl: fetch242,
    });
    expect(res242.detectedFamily).toBe('ekuiper');
    expect(res242.profileId).toBe('ekuiper-2.4.2');
    expect(res242.capabilities.sqlFunctions242).toBe(true);
  });

  it('identifies reKuiper 1.0.0-rc5 via palette signature without misclassifying version', async () => {
    const fetchReKuiper = async (input: URL | string) => {
      const p = new URL(String(input)).pathname;
      if (p === '/') return jsonResponse({ version: '1.0.0-rc5', os: 'linux', arch: 'x86_64' });
      if (p === '/rules') return jsonResponse([]);
      if (p === '/metadata/palette') return jsonResponse({ sources: [], operators: [], sinks: [] });
      return jsonResponse({}, 404);
    };
    const res = await discoverEngineProfile({
      baseUrl: 'http://rekuiper.local:9081',
      authorization: null,
      enginePreference: 'auto',
      operationModeOverride: null,
      fetchImpl: fetchReKuiper,
    });
    expect(res.detectedFamily).toBe('rekuiper');
    expect(res.profileId).toBe('rekuiper-main-24848c8');
    expect(res.compatible).toBe(true);
    expect(res.operationMode).toBe('unknown');
    expect(res.capabilityDetails['extensions.portableMutation']?.status).toBe('unsupported');
  });

  it('separates public-root reachability from 401 auth_required on resource API', async () => {
    const fetchAuthRequired = async (input: URL | string) => {
      const p = new URL(String(input)).pathname;
      if (p === '/') return jsonResponse({ version: '1.0.0-rc5' });
      if (p === '/rules') return jsonResponse({ error: 'unauthorized' }, 401);
      if (p === '/api/ui/auth-status') return jsonResponse({ authEnabled: true });
      return jsonResponse({}, 401);
    };
    const res = await discoverEngineProfile({
      baseUrl: 'http://rekuiper.local:9081',
      authorization: null,
      enginePreference: 'auto',
      operationModeOverride: null,
      fetchImpl: fetchAuthRequired,
    });
    expect(res.connectionState).toBe('reachable');
    expect(res.authorizationState).toBe('auth_required');
    expect(res.compatible).toBe(false);
    expect(res.errorMessage).toContain('401');
  });

  it('returns offline state on network error and respects configured preference contradictions', async () => {
    const offline = await discoverEngineProfile({
      baseUrl: 'http://offline.local:9081',
      authorization: null,
      enginePreference: 'rekuiper',
      operationModeOverride: 'declarative',
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    expect(offline.connectionState).toBe('offline');
    expect(offline.effectiveFamily).toBe('rekuiper');
    expect(offline.operationMode).toBe('declarative');

    const contradicted = await discoverEngineProfile({
      baseUrl: 'http://ekuiper.local:9081',
      authorization: null,
      enginePreference: 'rekuiper',
      operationModeOverride: 'declarative',
      fetchImpl: async (input) => {
        const p = new URL(String(input)).pathname;
        if (p === '/') return jsonResponse({ version: '2.4.2' });
        if (p === '/rules') return jsonResponse([]);
        return jsonResponse({}, 404);
      },
    });
    expect(contradicted.detectedFamily).toBe('ekuiper');
    expect(contradicted.effectiveFamily).toBe('rekuiper');
    expect(contradicted.identitySource).toBe('configured_preference');
    expect(contradicted.evidence.contradiction).toEqual({
      configured: 'rekuiper',
      detected: 'ekuiper',
    });
    expect(contradicted.capabilities.wireTap).toBe(false);
    expect(contradicted.capabilities.sqlTrialSse).toBe(false);
  });
});

