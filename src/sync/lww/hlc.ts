const PHYSICAL_WIDTH = 15;
const COUNTER_WIDTH = 6;
const HLC_PATTERN = /^(\d{15})-(\d{6})$/;

export interface HlcParts { physical: number; counter: number }
export interface VersionStamp { hlc: string; deviceId: string }

export function encodeHlc(parts: HlcParts): string {
  if (!Number.isSafeInteger(parts.physical) || parts.physical < 0
    || !Number.isSafeInteger(parts.counter) || parts.counter < 0 || parts.counter >= 1_000_000) {
    throw new RangeError("Invalid HLC parts");
  }
  return `${String(parts.physical).padStart(PHYSICAL_WIDTH, "0")}-${String(parts.counter).padStart(COUNTER_WIDTH, "0")}`;
}

export function decodeHlc(value: string): HlcParts | null {
  const match = HLC_PATTERN.exec(value);
  if (!match) return null;
  return { physical: Number(match[1]), counter: Number(match[2]) };
}

export function compareHlc(left: string, right: string): number {
  if (!decodeHlc(left) || !decodeHlc(right)) throw new TypeError("Malformed HLC");
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareVersion(left: VersionStamp, right: VersionStamp): number {
  const clock = compareHlc(left.hlc, right.hlc);
  if (clock !== 0) return clock;
  return left.deviceId < right.deviceId ? -1 : left.deviceId > right.deviceId ? 1 : 0;
}

/** The later of two HLC strings, ignoring null or malformed values. */
export function laterHlc(left: string | null, right: string | null): string | null {
  const validLeft = left && decodeHlc(left) ? left : null;
  const validRight = right && decodeHlc(right) ? right : null;
  if (!validLeft) return validRight;
  if (!validRight) return validLeft;
  return compareHlc(validLeft, validRight) >= 0 ? validLeft : validRight;
}

export class HybridLogicalClock {
  private value: HlcParts;
  constructor(seed: HlcParts = { physical: 0, counter: 0 }) { this.value = { ...seed }; }

  snapshot(): string { return encodeHlc(this.value); }

  /**
   * Move the clock forward to a previously persisted or ledger-max stamp.
   * Does not increment — the next tick/observe is what produces a new event.
   */
  advanceTo(hlc: string): void {
    const parts = decodeHlc(hlc);
    if (!parts) return;
    if (compareHlc(this.snapshot(), hlc) >= 0) return;
    this.value = { ...parts };
  }

  tick(now: number): string {
    const physical = Math.max(normalizeNow(now), this.value.physical);
    const counter = physical === this.value.physical ? this.value.counter + 1 : 0;
    this.value = { physical, counter };
    return encodeHlc(this.value);
  }

  observe(remoteValue: string, now: number): string {
    const remote = decodeHlc(remoteValue);
    if (!remote) throw new TypeError("Malformed remote HLC");
    const physical = Math.max(normalizeNow(now), this.value.physical, remote.physical);
    let counter = 0;
    if (physical === this.value.physical && physical === remote.physical) {
      counter = Math.max(this.value.counter, remote.counter) + 1;
    } else if (physical === this.value.physical) counter = this.value.counter + 1;
    else if (physical === remote.physical) counter = remote.counter + 1;
    this.value = { physical, counter };
    return encodeHlc(this.value);
  }
}

function normalizeNow(now: number): number {
  if (!Number.isSafeInteger(now) || now < 0) throw new RangeError("Invalid wall clock");
  return now;
}
