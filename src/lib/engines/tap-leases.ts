export const MAX_TAPS_PER_USER = 5;
export const MAX_INSPECTION_SAMPLES = 500;

export interface TapLease {
  leaseId: string;
  userId: string;
  nodeId: string;
  ruleId: string;
  tapNodeId: string;
}

interface TapGroupState {
  leases: Map<string, TapLease>;
  externallyEnabled: boolean;
}

const tapGroups = new Map<string, TapGroupState>();
let leaseSeq = 0;

function groupKey(nodeId: string, ruleId: string, tapNodeId: string): string {
  return `${nodeId}::${ruleId}::${tapNodeId}`;
}

export function countUserActiveTaps(userId: string): number {
  let count = 0;
  for (const group of tapGroups.values()) {
    for (const lease of group.leases.values()) {
      if (lease.userId === userId) count += 1;
    }
  }
  return count;
}

export function acquireTapLease(input: {
  userId: string;
  nodeId: string;
  ruleId: string;
  tapNodeId: string;
  externallyEnabled?: boolean;
}): { ok: true; lease: TapLease; shouldEnableUpstream: boolean } | { ok: false; code: 'TAP_LIMIT_REACHED'; message: string } {
  if (countUserActiveTaps(input.userId) >= MAX_TAPS_PER_USER) {
    return {
      ok: false,
      code: 'TAP_LIMIT_REACHED',
      message: `Maximum of ${MAX_TAPS_PER_USER} active wire-tap views per user reached.`,
    };
  }

  const key = groupKey(input.nodeId, input.ruleId, input.tapNodeId);
  let group = tapGroups.get(key);
  const isFirstManagerLease = !group || group.leases.size === 0;

  if (!group) {
    group = {
      leases: new Map(),
      externallyEnabled: Boolean(input.externallyEnabled),
    };
    tapGroups.set(key, group);
  } else if (input.externallyEnabled) {
    group.externallyEnabled = true;
  }

  const lease: TapLease = {
    leaseId: `lease-${++leaseSeq}`,
    userId: input.userId,
    nodeId: input.nodeId,
    ruleId: input.ruleId,
    tapNodeId: input.tapNodeId,
  };
  group.leases.set(lease.leaseId, lease);

  return {
    ok: true,
    lease,
    shouldEnableUpstream: isFirstManagerLease && !group.externallyEnabled,
  };
}

export function releaseTapLease(leaseId: string): { shouldDisableUpstream: boolean; target?: Omit<TapLease, 'leaseId' | 'userId'> } {
  for (const [key, group] of tapGroups.entries()) {
    const lease = group.leases.get(leaseId);
    if (!lease) continue;
    group.leases.delete(leaseId);
    const remaining = group.leases.size;
    const shouldDisableUpstream = remaining === 0 && !group.externallyEnabled;
    if (remaining === 0) {
      tapGroups.delete(key);
    }
    return {
      shouldDisableUpstream,
      target: {
        nodeId: lease.nodeId,
        ruleId: lease.ruleId,
        tapNodeId: lease.tapNodeId,
      },
    };
  }
  return { shouldDisableUpstream: false };
}

export function resetTapLeasesForTest(): void {
  tapGroups.clear();
}

export class BoundedSampleBuffer<T> {
  private readonly items: T[] = [];
  private dropped = 0;

  constructor(private readonly maxItems = MAX_INSPECTION_SAMPLES) {}

  push(item: T): void {
    if (this.items.length >= this.maxItems) {
      this.items.shift();
      this.dropped += 1;
    }
    this.items.push(item);
  }

  snapshot(): { samples: T[]; dropped: number } {
    return { samples: [...this.items], dropped: this.dropped };
  }
}

