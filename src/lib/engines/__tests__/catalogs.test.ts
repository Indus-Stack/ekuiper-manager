import {
  getConnectorPropertiesForTarget,
  getFunctionsForTarget,
} from '../catalogs';

describe('EA-06 target-aware catalogs', () => {
  it('filters 2.4.2+ functions on eKuiper 2.4.1 but includes them on 2.4.2', () => {
    const fns241 = getFunctionsForTarget({
      engineFamily: 'ekuiper',
      version: '2.4.1',
      query: 'array_avg',
    });
    expect(fns241.some((fn) => fn.name === 'array_avg')).toBe(false);

    const fns242 = getFunctionsForTarget({
      engineFamily: 'ekuiper',
      version: '2.4.2',
      query: 'array_avg',
    });
    expect(fns242.some((fn) => fn.name === 'array_avg')).toBe(true);
  });

  it('does not misfilter SQL functions on reKuiper 1.0.0-rc5 and merges live runtime UDFs', () => {
    const fns = getFunctionsForTarget({
      engineFamily: 'rekuiper',
      version: '1.0.0-rc5',
      runtimeFunctions: [
        { name: 'custom_rekuiper_udf', signature: 'custom_rekuiper_udf(x)', description: 'Native UDF' },
        { name: 'array_avg', description: 'Duplicate should not duplicate' },
      ],
    });
    expect(fns.some((fn) => fn.name === 'array_avg')).toBe(true);
    expect(fns.filter((fn) => fn.name === 'array_avg')).toHaveLength(1);
    expect(fns.some((fn) => fn.name === 'custom_rekuiper_udf')).toBe(true);
  });

  it('prefers live target metadata properties over static built-in defaults', () => {
    const live = [{ name: 'broker', type: 'string', control: 'text', default: 'tcp://live:1883' }];
    expect(
      getConnectorPropertiesForTarget({
        category: 'sources',
        connectorType: 'mqtt',
        liveProperties: live,
      }),
    ).toEqual(live);

    const fallback = getConnectorPropertiesForTarget({
      category: 'sources',
      connectorType: 'mqtt',
      liveProperties: [],
    });
    expect(fallback.length).toBeGreaterThan(0);
  });
});
