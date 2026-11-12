import { buildTargetCacheKey, useServerStore } from '@/stores/server-store';

describe('EA-05 switching coordinator and target-scoped drafts/caches', () => {
  beforeEach(() => {
    useServerStore.setState({
      servers: [
        {
          id: 'ek-1',
          name: 'eKuiper Node',
          url: 'http://ekuiper:9081',
          status: 'connected',
          engineFamily: 'ekuiper',
          profileRevision: 1,
          createdAt: new Date(),
        },
        {
          id: 'rk-1',
          name: 'reKuiper Node',
          url: 'http://rekuiper:9081',
          status: 'connected',
          engineFamily: 'rekuiper',
          profileRevision: 2,
          createdAt: new Date(),
        },
      ],
      activeServerId: 'ek-1',
      switchEpoch: 0,
      draftsByTarget: {},
    });
  });

  it('preserves dirty drafts independently per target across eKuiper -> reKuiper -> eKuiper switches', () => {
    const store = useServerStore.getState();
    store.saveTargetDraft('ek-1', 'rule-sql', 'SELECT * FROM ekStream');

    store.setActiveServer('rk-1');
    expect(useServerStore.getState().activeServerId).toBe('rk-1');
    expect(useServerStore.getState().switchEpoch).toBe(1);
    expect(useServerStore.getState().getTargetDraft('rk-1', 'rule-sql')).toBeUndefined();

    useServerStore.getState().saveTargetDraft('rk-1', 'rule-sql', 'SELECT * FROM rkStream');

    useServerStore.getState().setActiveServer('ek-1');
    expect(useServerStore.getState().switchEpoch).toBe(2);
    expect(useServerStore.getState().getTargetDraft('ek-1', 'rule-sql')).toBe('SELECT * FROM ekStream');
    expect(useServerStore.getState().getTargetDraft('rk-1', 'rule-sql')).toBe('SELECT * FROM rkStream');
  });

  it('scopes cache keys by nodeId and profileRevision', () => {
    const k1 = buildTargetCacheKey('ek-1', 1, 'rules');
    const k2 = buildTargetCacheKey('rk-1', 2, 'rules');
    const k3 = buildTargetCacheKey('ek-1', 2, 'rules');
    expect(k1).not.toEqual(k2);
    expect(k1).not.toEqual(k3);
  });
});

