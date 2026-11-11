import {
  BASELINE_CAPABILITY_OPERATORS,
  BASELINE_CAPABILITY_SINKS,
  BASELINE_CAPABILITY_SOURCES,
  BASELINE_EKUIPER_VERSION,
  type TargetCapabilityProfile,
  type TargetFeatureFlags,
} from './types';

/**
 * Input for {@link resolveTargetCapabilities}.
 *
 * - `version`: raw `SystemInfo.version` string from the target probe
 *   (`src/lib/nodes.ts` `probeNode`), or null/undefined when the probe
 *   did not report one.
 * - `reachable`: whether the probe reached the target. Defaults to false
 *   (conservative) when omitted.
 * - `sourceNames`/`operatorNames`/`sinkNames`: optional plain identifier
 *   lists derived from the audited metadata endpoints
 *   (`GET /metadata/sources`, `GET /metadata/operators`,
 *   `GET /metadata/sinks` via `src/lib/ekuiper/client.ts`). Callers map
 *   `MetadataItem[]` to `item.name` strings before passing them in, so this
 *   module never imports the eKuiper HTTP client. When a list is provided,
 *   the baseline is intersected with it (unlisted entries become
 *   unavailable); when omitted, the version-gated baseline applies.
 */
export interface ResolveCapabilitiesInput {
  version?: string | null;
  reachable?: boolean;
  sourceNames?: readonly string[] | null;
  operatorNames?: readonly string[] | null;
  sinkNames?: readonly string[] | null;
}

/**
 * Minimum version proving the audited graph-rule baseline. This is the ONLY
 * place that may compare eKuiper versions: keep every semver condition
 * here so UI/compiler code consumes the normalized profile instead.
 */
/**
 * Parsed engine version. `prerelease` is `null` for a stable release and a
 * sortable rank for `alpha.N`, `beta.N`, and `rc.N` builds, so a prerelease
 * always sorts below the stable release that shares its leading triple.
 */
interface ParsedVersion {
  core: readonly [number, number, number];
  prerelease: number | null;
}

// Declared before the MIN_* constants below: they are parsed at module load.
const PRERELEASE_LABEL_RANK: Readonly<Record<string, number>> = {
  alpha: 1,
  beta: 2,
  rc: 3,
};

const MIN_BASELINE_VERSION = parseVersion('2.4.1');

/**
 * First upstream release that contains each capability, verified against the
 * tagged eKuiper sources (the PR merge commit is an ancestor of the tag):
 *
 * - `GET /rules/{name}/scantables` is registered in `v2.5.0-alpha.1`.
 * - Stream buffer policies (lf-edge/ekuiper#4133) first ship in `v2.5.0-alpha.2`.
 * - The sourceName fix (#4213), JSON Lines (#4218), and Kafka record metadata
 *   (#4214) first ship in `v2.5.0-alpha.5`.
 *
 * A target below the listed release does not have the capability, even when it
 * shares the `2.5.0` leading triple.
 */
const MIN_SQL_FUNCTIONS_242 = parseVersion('2.4.2');
const MIN_SCAN_TABLES = parseVersion('2.5.0-alpha.1');
const MIN_STREAM_BUFFER_POLICY = parseVersion('2.5.0-alpha.2');
const MIN_SAFE_SOURCE_NAME_GRAPHS = parseVersion('2.5.0-alpha.5');
const MIN_JSONL = parseVersion('2.5.0-alpha.5');
const MIN_KAFKA_RECORD_METADATA = parseVersion('2.5.0-alpha.5');

/**
 * Parse `major.minor.patch` plus an optional `-alpha.N` / `-beta.N` / `-rc.N`
 * tag. Trailing git-describe text (`2.4.0-alpha.1-254-g640e3ff2`) and other
 * suffixes (`2.4.2-slim`) are ignored. Returns null when no triple exists
 * (conservative: unproven).
 */
function tryParseVersion(value: string): ParsedVersion | null {
  const match = /(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)(?:\.?(\d+))?)?/i.exec(value);
  if (match === null) return null;
  const [, major, minor, patch, label, ordinal] = match;
  if (major === undefined || minor === undefined || patch === undefined) {
    return null;
  }
  const rank = label === undefined ? undefined : PRERELEASE_LABEL_RANK[label.toLowerCase()];
  return {
    core: [Number(major), Number(minor), Number(patch)],
    prerelease: rank === undefined ? null : rank * 10_000 + Number(ordinal ?? 0),
  };
}

/** Parse a hard-coded minimum release; a malformed constant is a programming error. */
function parseVersion(value: string): ParsedVersion {
  const parsed = tryParseVersion(value);
  if (parsed === null) throw new Error(`Invalid built-in version constant: ${value}`);
  return parsed;
}

function versionAtLeast(value: string, expected: ParsedVersion): boolean {
  const current = tryParseVersion(value);
  if (current === null) return false;
  for (let index = 0; index < 3; index += 1) {
    const have = current.core[index];
    const want = expected.core[index];
    if (have === undefined || want === undefined) return false;
    if (have > want) return true;
    if (have < want) return false;
  }
  const have = current.prerelease ?? Number.POSITIVE_INFINITY;
  const want = expected.prerelease ?? Number.POSITIVE_INFINITY;
  return have >= want;
}

/**
 * Resolve version-gated engine features for one target version string.
 *
 * Conservative by design: null, empty, unparsable, or below-floor versions
 * evaluate every optional flag to `false`. Each capability opens at the first
 * release that ships it (see the `MIN_*` constants), so `2.5.0-alpha.4`
 * does not receive features that first ship in `2.5.0-alpha.5`.
 */
export function resolveTargetFeatures(version?: string | null): TargetFeatureFlags {
  const raw = typeof version === 'string' ? version.trim() : '';
  if (raw.length === 0) {
    return {
      supportsSqlFunctions242: false,
      supportsSafeSourceNameGraphs: false,
      supportsScanTables: false,
      supportsJsonl: false,
      supportsStreamBufferPolicy: false,
      supportsKafkaRecordMetadata: false,
    };
  }
  return {
    supportsSqlFunctions242: versionAtLeast(raw, MIN_SQL_FUNCTIONS_242),
    supportsSafeSourceNameGraphs: versionAtLeast(raw, MIN_SAFE_SOURCE_NAME_GRAPHS),
    supportsScanTables: versionAtLeast(raw, MIN_SCAN_TABLES),
    supportsJsonl: versionAtLeast(raw, MIN_JSONL),
    supportsStreamBufferPolicy: versionAtLeast(raw, MIN_STREAM_BUFFER_POLICY),
    supportsKafkaRecordMetadata: versionAtLeast(raw, MIN_KAFKA_RECORD_METADATA),
  };
}

/**
 * Intersect a frozen baseline with caller-supplied metadata names.
 * Comparison is case-insensitive; output keeps baseline casing and
 * baseline order (already sorted ascending) for determinism.
 */
function narrowByMetadata(
  baseline: readonly string[],
  names: readonly string[] | null | undefined,
): string[] {
  if (names === undefined || names === null) return [...baseline];
  const proven = new Set(names.map((entry) => entry.toLowerCase()));
  return baseline.filter((entry) => proven.has(entry.toLowerCase()));
}

function unavailable(version: string | null, reachable: boolean): TargetCapabilityProfile {
  return {
    ekuiperVersion: version,
    reachable,
    graphRules: false,
    sources: [],
    operators: [],
    sinks: [],
    ruleTest: false,
    ruleTestSse: false,
  };
}

/**
 * Input for {@link resolveAuthoringCapabilities}: the stored node row's last
 * known `version` and probe `status`.
 */
export interface AuthoringTargetInput {
  version?: string | null;
  status?: string | null;
}

/**
 * Capability profile for DRAFT editing and draft validation.
 *
 * Capabilities derive from the last known engine version, not from live
 * reachability: a stored `OFFLINE` probe result must not disable the palette
 * or mark existing nodes unsupported, and that status can stay stale after
 * the engine recovers. Live reachability is checked when a flow is deployed
 * (`deployFlow` re-probes a non-ONLINE target).
 *
 * - Version known: its capability profile, whatever the stored status.
 * - `INCOMPATIBLE` with no version: unavailable (the engine never reported a
 *   supported version).
 * - Never probed or no version: audited baseline (`BASELINE_EKUIPER_VERSION`)
 *   so authoring stays unblocked before a target is chosen or probed.
 */
export function resolveAuthoringCapabilities(
  input: AuthoringTargetInput,
): TargetCapabilityProfile {
  const raw = typeof input.version === 'string' ? input.version.trim() : '';
  const version = raw.length > 0 ? raw : null;
  if (version === null && input.status === 'INCOMPATIBLE') {
    return resolveTargetCapabilities({ version: null, reachable: true });
  }
  return resolveTargetCapabilities({
    version: version ?? BASELINE_EKUIPER_VERSION,
    reachable: true,
  });
}

/**
 * Resolve a normalized capability profile for one eKuiper target.
 *
 * Conservative by design: unknown, unparsable, below-baseline, or
 * unreachable versions yield `graphRules: false` with empty identifier
 * sets rather than optimistically enabling capabilities. Deterministic:
 * same input always yields the same profile (sorted identifier arrays, no
 * randomness/clock).
 */
export function resolveTargetCapabilities(
  input: ResolveCapabilitiesInput,
): TargetCapabilityProfile {
  const reachable = input.reachable === true;
  const raw = typeof input.version === 'string' ? input.version.trim() : '';
  const version = raw.length > 0 ? raw : null;

  if (!reachable || version === null) {
    return unavailable(version, reachable);
  }
  if (!versionAtLeast(version, MIN_BASELINE_VERSION)) {
    return unavailable(version, reachable);
  }

  return {
    ekuiperVersion: version,
    reachable: true,
    graphRules: true,
    sources: narrowByMetadata(
      [...BASELINE_CAPABILITY_SOURCES],
      input.sourceNames,
    ),
    operators: narrowByMetadata(
      [...BASELINE_CAPABILITY_OPERATORS],
      input.operatorNames,
    ),
    sinks: narrowByMetadata([...BASELINE_CAPABILITY_SINKS], input.sinkNames),
    // FS-0106: rule-test transport verified but not safely reachable under
    // the current registered-node policy (separate per-test SSE port, no
    // audited graph-rule test envelope). Conservative: always false until a
    // later ticket proves a safe relay. See
    // docs/FLOW_STUDIO_RULE_TEST_NOTES.md. No allowlist weakening here.
    ruleTest: false,
    ruleTestSse: false,
  };
}
