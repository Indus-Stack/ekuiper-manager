import {
  BASELINE_CAPABILITY_OPERATORS,
  BASELINE_CAPABILITY_SINKS,
  BASELINE_CAPABILITY_SOURCES,
} from '@/lib/flows/capabilities/types';
import {
  resolveAuthoringCapabilities,
  resolveTargetCapabilities,
  resolveTargetFeatures,
} from '@/lib/flows/capabilities/resolve-capabilities';

describe('flow target capabilities', () => {
  it('resolves the audited 2.4.1 baseline', () => {
    const profile = resolveTargetCapabilities({
      version: '2.4.1',
      reachable: true,
    });

    expect(profile.ekuiperVersion).toBe('2.4.1');
    expect(profile.reachable).toBe(true);
    expect(profile.graphRules).toBe(true);
    expect(profile.sources).toEqual([...BASELINE_CAPABILITY_SOURCES]);
    expect(profile.operators).toEqual([...BASELINE_CAPABILITY_OPERATORS]);
    expect(profile.sinks).toEqual([...BASELINE_CAPABILITY_SINKS]);
    expect(profile.sources).toContain('memory');
    expect(profile.sources).toContain('mqtt');
    expect(profile.operators).toEqual(
      expect.arrayContaining([
        'filter',
        'pick',
        'window',
        'aggfunc',
        // AC-D007: the `func` node compiles to `function`. Omitting it from the baseline
        // made every flow containing that node undeployable on every target.
        'function',
        'groupby',
        'switch',
        'orderby',
        'join',
      ]),
    );
    expect(profile.sinks).toEqual(
      expect.arrayContaining(['memory', 'mqtt', 'rest', 'log']),
    );
    // FS-0106: rule-test transport cannot be safely supported yet.
    expect(profile.ruleTest).toBe(false);
    expect(profile.ruleTestSse).toBe(false);
  });

  it('accepts newer versions while staying deterministic', () => {
    const first = resolveTargetCapabilities({
      version: '2.5.0',
      reachable: true,
    });
    const second = resolveTargetCapabilities({
      version: '2.5.0',
      reachable: true,
    });

    expect(first.graphRules).toBe(true);
    expect(first).toEqual(second);
    expect(first.sources).toEqual([...first.sources].sort());
    expect(first.operators).toEqual([...first.operators].sort());
    expect(first.sinks).toEqual([...first.sinks].sort());
    // FS-0106: rule-test stays disabled even on newer versions.
    expect(first.ruleTest).toBe(false);
    expect(first.ruleTestSse).toBe(false);
  });

  it('does not enable capabilities for unknown versions', () => {
    for (const input of [
      {},
      { version: null, reachable: true },
      { version: '', reachable: true },
      { version: 'not-a-version', reachable: true },
      { version: '2.4.1', reachable: false },
      { version: '2.4.1' },
    ]) {
      const profile = resolveTargetCapabilities(input);
      expect(profile.graphRules).toBe(false);
      expect(profile.sources).toEqual([]);
      expect(profile.operators).toEqual([]);
      expect(profile.sinks).toEqual([]);
      // FS-0106: rule-test false when transport cannot be safely supported.
      expect(profile.ruleTest).toBe(false);
      expect(profile.ruleTestSse).toBe(false);
    }
  });

  it('does not enable capabilities below the audited baseline', () => {
    const profile = resolveTargetCapabilities({
      version: '2.3.0',
      reachable: true,
    });

    expect(profile.graphRules).toBe(false);
    expect(profile.sources).toEqual([]);
    expect(profile.operators).toEqual([]);
    expect(profile.sinks).toEqual([]);
    // FS-0106: rule-test false below the audited baseline.
    expect(profile.ruleTest).toBe(false);
    expect(profile.ruleTestSse).toBe(false);
  });

  it('narrows the baseline when metadata cannot prove support', () => {
    const profile = resolveTargetCapabilities({
      version: '2.4.1',
      reachable: true,
      sourceNames: ['memory'],
      sinkNames: ['memory', 'unknown-sink'],
    });

    expect(profile.graphRules).toBe(true);
    expect(profile.sources).toEqual(['memory']);
    expect(profile.sinks).toEqual(['memory']);
    expect(profile.operators).toEqual([...BASELINE_CAPABILITY_OPERATORS]);
    // FS-0106: metadata narrowing never enables rule-test.
    expect(profile.ruleTest).toBe(false);
    expect(profile.ruleTestSse).toBe(false);
  });
});

describe('resolveTargetFeatures', () => {
  it('keeps all optional feature flags off when version is absent, unparsable, or <= 2.4.1', () => {
    for (const version of [undefined, null, '', 'invalid', '2.3.0', '2.4.1']) {
      expect(resolveTargetFeatures(version)).toEqual({
        supportsSqlFunctions242: false,
        supportsSafeSourceNameGraphs: false,
        supportsScanTables: false,
        supportsJsonl: false,
        supportsStreamBufferPolicy: false,
        supportsKafkaRecordMetadata: false,
      });
    }
  });

  it('unlocks 2.4.2 SQL functions while keeping 2.5 preview flags and safe sourceName off on 2.4.2', () => {
    expect(resolveTargetFeatures('2.4.2')).toEqual({
      supportsSqlFunctions242: true,
      supportsSafeSourceNameGraphs: false,
      supportsScanTables: false,
      supportsJsonl: false,
      supportsStreamBufferPolicy: false,
      supportsKafkaRecordMetadata: false,
    });
  });

  it('unlocks 2.5 preview flags and safe sourceName on 2.5.0-alpha.5 and 2.5.0', () => {
    for (const version of ['2.5.0-alpha.5', '2.5.0', '2.6.0']) {
      expect(resolveTargetFeatures(version)).toEqual({
        supportsSqlFunctions242: true,
        supportsSafeSourceNameGraphs: true,
        supportsScanTables: true,
        supportsJsonl: true,
        supportsStreamBufferPolicy: true,
        supportsKafkaRecordMetadata: true,
      });
    }
  });

  it('opens each 2.5 capability at the first upstream release that ships it', () => {
    // Verified against the tagged sources: scantables route in alpha.1,
    // buffer policy (#4133) in alpha.2, sourceName fix (#4213), JSON Lines
    // (#4218), and Kafka metadata (#4214) in alpha.5.
    expect(resolveTargetFeatures('2.5.0-alpha.1')).toEqual({
      supportsSqlFunctions242: true,
      supportsSafeSourceNameGraphs: false,
      supportsScanTables: true,
      supportsJsonl: false,
      supportsStreamBufferPolicy: false,
      supportsKafkaRecordMetadata: false,
    });
    for (const version of ['2.5.0-alpha.2', '2.5.0-alpha.3', '2.5.0-alpha.4']) {
      expect(resolveTargetFeatures(version)).toEqual({
        supportsSqlFunctions242: true,
        supportsSafeSourceNameGraphs: false,
        supportsScanTables: true,
        supportsJsonl: false,
        supportsStreamBufferPolicy: true,
        supportsKafkaRecordMetadata: false,
      });
    }
  });

  it('keeps the sourceName warning active on every 2.5 alpha before alpha.5', () => {
    for (const version of ['2.5.0-alpha.1', '2.5.0-alpha.4']) {
      expect(resolveTargetFeatures(version).supportsSafeSourceNameGraphs).toBe(false);
    }
    expect(resolveTargetFeatures('2.5.0-alpha.5').supportsSafeSourceNameGraphs).toBe(true);
  });

  it('orders prereleases below the stable release and tolerates build suffixes', () => {
    // A 2.5.0 prerelease is below stable 2.5.0, and beta/rc sort after alpha.
    expect(resolveTargetFeatures('2.5.0-beta.1').supportsJsonl).toBe(true);
    expect(resolveTargetFeatures('2.5.0-rc.1').supportsJsonl).toBe(true);
    // Image-style and git-describe suffixes do not change the release.
    expect(resolveTargetFeatures('2.4.2-slim').supportsSqlFunctions242).toBe(true);
    expect(resolveTargetFeatures('2.5.0-alpha.4-12-gabcdef0').supportsJsonl).toBe(false);
    expect(resolveTargetFeatures('2.5.0-alpha.5-3-gabcdef0').supportsJsonl).toBe(true);
    // A 2.4.2 prerelease is not the 2.4.2 release.
    expect(resolveTargetFeatures('2.4.2-rc.1').supportsSqlFunctions242).toBe(false);
  });
});

describe('resolveAuthoringCapabilities', () => {
  it('keeps the palette available for a stored OFFLINE target using its last known version', () => {
    const profile = resolveAuthoringCapabilities({ version: '2.4.2', status: 'OFFLINE' });
    expect(profile.graphRules).toBe(true);
    expect(profile.ekuiperVersion).toBe('2.4.2');
    expect(profile.sources).toEqual([...BASELINE_CAPABILITY_SOURCES]);
    expect(profile.sinks).toEqual([...BASELINE_CAPABILITY_SINKS]);
  });

  it('falls back to the audited baseline when no version is known yet', () => {
    for (const status of [undefined, 'UNKNOWN', 'OFFLINE', 'ONLINE']) {
      const profile = resolveAuthoringCapabilities({ version: null, status });
      expect(profile.graphRules).toBe(true);
      expect(profile.ekuiperVersion).toBe('2.4.1');
    }
    expect(resolveAuthoringCapabilities({}).graphRules).toBe(true);
  });

  it('stays unavailable for an INCOMPATIBLE target', () => {
    expect(resolveAuthoringCapabilities({ version: '2.3.0', status: 'INCOMPATIBLE' }).graphRules).toBe(false);
    expect(resolveAuthoringCapabilities({ version: null, status: 'INCOMPATIBLE' }).graphRules).toBe(false);
  });
});
