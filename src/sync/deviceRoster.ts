/** The roster of devices that share this sync key.
 *
 *  The relay room is derived from the master key (HKDF), so every device holding
 *  that key is in the same room and the transport was always many-device. What
 *  was missing was memory: the engine collapsed every peer into one `peerSeen`
 *  boolean, so "Connected — synced with your other device" was true whether one
 *  device answered or four did, and an unpaired device was indistinguishable
 *  from a sleeping one. The roster keeps a per-device last-seen instead.
 *
 *  It is a LOCAL observation log, not an authority. Nothing here can grant or
 *  revoke access — possession of the master key does that, which is why
 *  forgetting an entry cannot evict its device from the room.
 */

/** How long after its last hello a device still counts as present. Hellos land
 *  on connect and then on the engine's 60s sweep, so one missed sweep must not
 *  read as absent — two-and-a-half sweeps is the smallest window that survives
 *  a slow round trip without holding a departed device online for minutes. */
export const DEVICE_ONLINE_WINDOW_MS = 150_000;

/** Past this the oldest entries are dropped. Far above any real household; it
 *  exists so a corrupted or hostile roster cannot grow without bound. */
const ROSTER_LIMIT = 24;

export interface SyncDevice {
  id: string;
  /** Absent for peers on a build older than this field, and for any peer whose
   *  OS gave no usable hostname. The UI shows the short id in that case. */
  name: string | null;
  platform: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  /** True for the entry describing the device the roster is stored on. */
  self: boolean;
}

export interface DeviceSighting {
  id: string;
  name?: string | null;
  platform?: string | null;
  seenAt: string;
  self?: boolean;
}

function isDevice(value: unknown): value is SyncDevice {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string" && entry.id.length > 0
    && typeof entry.firstSeenAt === "string" && typeof entry.lastSeenAt === "string";
}

function normalize(value: unknown): SyncDevice | null {
  if (!isDevice(value)) return null;
  const entry = value as unknown as Record<string, unknown>;
  return {
    id: entry.id as string,
    name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : null,
    platform: typeof entry.platform === "string" && entry.platform ? entry.platform : null,
    firstSeenAt: entry.firstSeenAt as string,
    lastSeenAt: entry.lastSeenAt as string,
    self: entry.self === true,
  };
}

/** Newest sighting first, so the UI order needs no further sorting and the cap
 *  drops the stalest entry rather than an arbitrary one. */
function byLastSeenDesc(a: SyncDevice, b: SyncDevice): number {
  return b.lastSeenAt.localeCompare(a.lastSeenAt);
}

/** Tolerant of anything: a missing row, older shapes, hand-edited JSON. A
 *  roster that fails to parse must not stop sync from starting. */
export function parseRoster(json: string | null | undefined): SyncDevice[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalize).filter((entry): entry is SyncDevice => entry !== null)
      .sort(byLastSeenDesc).slice(0, ROSTER_LIMIT);
  } catch {
    return [];
  }
}

export function serializeRoster(roster: SyncDevice[]): string {
  return JSON.stringify(roster);
}

/** ISO-8601 UTC strings compare correctly as strings, so no Date parsing is
 *  needed — and a clock-skewed peer cannot walk our last-seen backwards. */
function laterOf(existing: string | undefined, incoming: string): string {
  if (!existing) return incoming;
  return incoming > existing ? incoming : existing;
}

/** Upsert one sighting. `firstSeenAt` is preserved once set — it is the only
 *  field that answers "when did this device join?", which is what makes a
 *  device you do not recognise legible. A sighting that carries no name never
 *  erases a name we already learned; peers on older builds send none. */
export function recordSighting(roster: SyncDevice[], sighting: DeviceSighting): SyncDevice[] {
  const merged = mergeEntry(roster.find((entry) => entry.id === sighting.id), sighting);
  return [merged, ...roster.filter((entry) => entry.id !== sighting.id)]
    .sort(byLastSeenDesc).slice(0, ROSTER_LIMIT);
}

/** A blank incoming value means "I did not say", never "clear it". */
function preferred(incoming: string | null | undefined, held: string | null | undefined): string | null {
  const trimmed = incoming?.trim();
  if (trimmed) return trimmed;
  return held ?? null;
}

function mergeEntry(existing: SyncDevice | undefined, sighting: DeviceSighting): SyncDevice {
  return {
    id: sighting.id,
    name: preferred(sighting.name, existing?.name),
    platform: preferred(sighting.platform, existing?.platform),
    firstSeenAt: existing?.firstSeenAt ?? sighting.seenAt,
    lastSeenAt: laterOf(existing?.lastSeenAt, sighting.seenAt),
    self: sighting.self ?? existing?.self ?? false,
  };
}

/** Drop one entry. Local bookkeeping only — see the file header. */
export function forgetDevice(roster: SyncDevice[], id: string): SyncDevice[] {
  return roster.filter((entry) => entry.id !== id || entry.self);
}

/** Presence is only meaningful while WE are connected: an offline device sees
 *  nobody, and reporting a stale sighting as "online now" would be a lie the
 *  user cannot check. */
export function isDeviceOnline(
  device: SyncDevice, connected: boolean, now: number,
): boolean {
  if (!connected) return false;
  if (device.self) return true;
  const seen = Date.parse(device.lastSeenAt);
  return Number.isFinite(seen) && now - seen <= DEVICE_ONLINE_WINDOW_MS;
}

/** A stable, readable fallback when a peer sent no name: enough id to tell two
 *  devices apart, not so much that it reads as a checksum. */
export function shortDeviceId(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export function describeDevice(device: SyncDevice): string {
  return device.name ?? `Unnamed device ${shortDeviceId(device.id)}`;
}

export interface DeviceIdentity { name?: string | null; platform?: string | null }

export interface DeviceRosterIo {
  load?: () => Promise<string | null>;
  save?: (json: string) => Promise<void>;
  /** This device's own name and platform, for its roster entry and its hello.
   *  Optional: a build that cannot name itself still syncs, it just shows up as
   *  an unnamed device on its peers. */
  identity?: () => Promise<DeviceIdentity>;
}

/** Owns the roster for one engine: load at session start, upsert on every
 *  hello, persist. Kept out of SyncEngine, which is at the 300-line ceiling. */
export class DeviceRosterTracker {
  private roster: SyncDevice[] = [];
  private identity: { name: string | null; platform: string | null } =
    { name: null, platform: null };

  constructor(private readonly io: DeviceRosterIo) {}

  list(): SyncDevice[] { return this.roster; }
  self(): { name: string | null; platform: string | null } { return this.identity; }

  /** Reads the stored roster and stamps this device into it, so the list is
   *  never empty and always says which entry you are looking out of. */
  async load(selfId: string, seenAt: string): Promise<SyncDevice[]> {
    const blank: DeviceIdentity = {};
    const [stored, identity] = await Promise.all([
      this.io.load?.() ?? Promise.resolve(null),
      this.io.identity?.() ?? Promise.resolve(blank),
    ]);
    this.identity = {
      name: identity.name?.trim() || null,
      platform: identity.platform || null,
    };
    this.roster = recordSighting(parseRoster(stored), {
      id: selfId, ...this.identity, seenAt, self: true,
    });
    await this.persist();
    return this.roster;
  }

  /** Fields this device contributes to its own hello. Empty for a build or
   *  platform that cannot name itself — the key never carries empty strings. */
  helloFields(): { name?: string; platform?: string } {
    return {
      ...(this.identity.name ? { name: this.identity.name } : {}),
      ...(this.identity.platform ? { platform: this.identity.platform } : {}),
    };
  }

  recordHello(
    hello: { device: string; name?: string; platform?: string }, seenAt: string,
  ): Promise<SyncDevice[]> {
    return this.record({
      id: hello.device, name: hello.name, platform: hello.platform, seenAt,
    });
  }

  async record(sighting: DeviceSighting): Promise<SyncDevice[]> {
    this.roster = recordSighting(this.roster, sighting);
    await this.persist();
    return this.roster;
  }

  async forget(id: string): Promise<SyncDevice[]> {
    this.roster = forgetDevice(this.roster, id);
    await this.persist();
    return this.roster;
  }

  private async persist(): Promise<void> {
    await this.io.save?.(serializeRoster(this.roster));
  }
}
