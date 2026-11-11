import {
  getAllFunctionsForVersion,
  getFunctionsForVersion,
  isFunctionSupportedForVersion,
} from '@/lib/ekuiper/functions';

describe('eKuiper version-aware function catalog', () => {
  it('excludes 2.4.2 and 2.5.0 gated helpers on 2.4.1 and unknown versions', () => {
    for (const version of ['2.4.1', null, undefined]) {
      const names = new Set(getAllFunctionsForVersion(version).map((fn) => fn.name));
      expect(names.has('avg')).toBe(true);
      expect(names.has('meta')).toBe(true);
      expect(names.has('array_avg')).toBe(false);
      expect(names.has('acc_max_by')).toBe(false);
      expect(names.has('acc_min_by')).toBe(false);
      expect(names.has('acc_map_agg')).toBe(false);
      expect(names.has('meta_topic')).toBe(false);
      expect(names.has('meta_partition')).toBe(false);
    }
  });

  it('includes array_avg and analytic acc_* helpers on 2.4.2 while holding back 2.5.0 helpers', () => {
    const names = new Set(getAllFunctionsForVersion('2.4.2').map((fn) => fn.name));
    expect(names.has('array_avg')).toBe(true);
    expect(names.has('acc_max_by')).toBe(true);
    expect(names.has('acc_min_by')).toBe(true);
    expect(names.has('acc_map_agg')).toBe(true);
    expect(names.has('meta_topic')).toBe(false);
    expect(names.has('meta_headers')).toBe(false);
  });

  it('unlocks Kafka record metadata helpers on 2.5.0-alpha.5 and filters by query', () => {
    const names = new Set(getAllFunctionsForVersion('2.5.0-alpha.5').map((fn) => fn.name));
    expect(names.has('array_avg')).toBe(true);
    expect(names.has('meta_topic')).toBe(true);
    expect(names.has('meta_partition')).toBe(true);
    expect(names.has('meta_offset')).toBe(true);
    expect(names.has('meta_key')).toBe(true);
    expect(names.has('meta_headers')).toBe(true);

    const partitionMatch = getFunctionsForVersion('2.5.0-alpha.5', 'partition');
    expect(partitionMatch.map((fn) => fn.signature)).toContain('meta(`partition`)');
    expect(isFunctionSupportedForVersion({ name: 'x', signature: 'x()', description: 'x', minVersion: '2.5.0' }, '2.4.2')).toBe(false);
  });
});

