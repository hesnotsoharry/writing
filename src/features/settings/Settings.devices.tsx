import { useEffect, useState } from "react";

import {
  describeDevice, isDeviceOnline, type SyncDevice,
} from "../../sync/deviceRoster";

/** Re-render cadence for the relative times below. Last-seen is the whole point
 *  of this list, so "4 minutes ago" must not sit frozen at "just now". */
const TICK_MS = 30_000;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function relativeTime(iso: string, now: number): string {
  const seen = Date.parse(iso);
  if (!Number.isFinite(seen)) return "unknown";
  const minutes = Math.floor((now - seen) / 60_000);
  if (minutes < 1) return "moments ago";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function deviceMeta(device: SyncDevice, online: boolean, now: number): string {
  const parts = [device.platform ?? "Unknown platform"];
  if (device.self) parts.push("this device");
  else parts.push(online ? "online now" : `last seen ${relativeTime(device.lastSeenAt, now)}`);
  return parts.join(" · ");
}

interface DeviceRowProps {
  device: SyncDevice;
  connected: boolean;
  now: number;
  onForget: (id: string) => void;
}

function DeviceRow({ device, connected, now, onForget }: DeviceRowProps) {
  const online = isDeviceOnline(device, connected, now);
  return (
    <li className="sync-device" data-online={online} data-self={device.self}>
      <span className="sync-device-dot" aria-hidden="true" />
      <span className="sync-device-text">
        <span className="sync-device-name">{describeDevice(device)}</span>
        <span className="sync-device-meta">{deviceMeta(device, online, now)}</span>
      </span>
      {!device.self && !online && (
        <button className="btn sync-device-forget" onClick={() => onForget(device.id)}>
          Remove from list
        </button>
      )}
    </li>
  );
}

export interface DeviceListProps {
  devices: SyncDevice[];
  connected: boolean;
  onForget: (id: string) => void;
}

/** The device list for the Sync panel.
 *
 *  Deliberately worded as an observation log, not an access-control list.
 *  Everything holding the pairing key is in the relay room, so this list cannot
 *  add or remove a device's access — "Remove from list" only clears a stale
 *  entry, and the caption says so. Claiming otherwise would be the one
 *  genuinely dangerous thing this panel could do. */
export function DeviceList({ devices, connected, onForget }: DeviceListProps) {
  const now = useNow();
  const others = devices.filter((device) => !device.self).length;
  return (
    <div className="sync-devices">
      <div className="sync-devices-heading">
        Devices on this key{others > 0 ? ` (${others + 1})` : ""}
      </div>
      <ul className="sync-device-list">
        {devices.map((device) => (
          <DeviceRow key={device.id} device={device} connected={connected}
            now={now} onForget={onForget} />
        ))}
      </ul>
      {others === 0 && (
        <p className="sync-devices-empty">No other device has connected yet. A device appears
          here the first time it reaches this one.</p>
      )}
      <p className="sync-devices-note">Any device holding your pairing string can join, so this
        list records what has connected &mdash; it does not control access. Removing an entry only
        clears it here; if that device still has the key it will reappear. To lock a lost device
        out, turn sync off on every device and pair again with a fresh key.</p>
    </div>
  );
}
