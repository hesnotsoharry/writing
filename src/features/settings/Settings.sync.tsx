import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import { syncEngine } from "../../sync/desktopEngine";
import { isDeviceOnline } from "../../sync/deviceRoster";
import type { SyncStatus } from "../../sync/engine";
import { DEFAULT_RELAY_URL } from "../../sync/engineDefaults";
import {
  buildPairPayload,
  decodeMasterKey,
  encodeMasterKey,
  generateMasterKey,
} from "../../sync/keys";
import {
  clearSyncMasterKey,
  getSyncMasterKey,
  setSyncMasterKey,
} from "../../sync/keyStorage";
import { clearSyncRole, setSyncRole, type SyncRole } from "../../sync/syncRole";
import { CredentialShareRow } from "./Settings.credentialShare";
import { DeviceList } from "./Settings.devices";
import { SetRow } from "./Settings.primitives";
import { getTweak, type Tweaks } from "./settings.store";
import { SyncQr } from "./SyncQr";

interface SyncSectionProps {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
}

type KeyState = "loading" | "missing" | "ready";
const INITIAL_STATUS: SyncStatus = { state: "off", peerSeen: false, lastSyncAt: null };
const PAIRING_ERROR = "That pairing string doesn't look right. Check it and try again.";

function startSync(): Promise<void> {
  return syncEngine.start(getTweak("syncRelayUrl", ""));
}

/** Counts peers seen inside the presence window, not roster length: the roster
 *  remembers devices that have gone away, and the status line is about now. */
function onlinePeerCount(status: SyncStatus): number {
  const now = Date.now();
  return (status.devices ?? []).filter(
    (device) => !device.self && isDeviceOnline(device, status.state === "connected", now),
  ).length;
}

function formatStatus(status: SyncStatus): string {
  const peers = onlinePeerCount(status);
  if (status.state === "connected" && status.peerSeen && status.lastSyncAt) {
    const time = new Date(status.lastSyncAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    // "your other device" was a lie on any key with more than two devices, and
    // it hid exactly the case Cole hit: two peers online, one of them the phone
    // he thought he had unpaired. Name the count; the list below names them.
    const who = peers === 1 ? "1 device" : `${peers} devices`;
    return `Connected — synced with ${who} ${time}`;
  }
  if (status.state === "connected" || status.state === "connecting") {
    return "Waiting for your other devices";
  }
  return "Offline";
}

function PairingString({ value, payload }: { value: string; payload: string }) {
  const [copied, setCopied] = useState(false);
  async function copyPairingString(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="sync-pairing">
      <SyncQr payload={payload} />
      <div className="sync-pairing-guide">Scan with your phone, or enter this on your other device.</div>
      <div className="sync-pairing-code">
        <code>{value}</code>
        <button className="btn btn-soft" onClick={() => { void copyPairingString(); }}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

interface JoinFlowProps {
  onJoined: (pairingString: string) => Promise<void>;
  onCancel: () => void;
}

function JoinFlow({ onJoined, onCancel }: JoinFlowProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit(): Promise<void> {
    try {
      decodeMasterKey(value.trim());
      setError(null);
      await onJoined(value.trim());
    } catch {
      setError(PAIRING_ERROR);
    }
  }
  return (
    <div className="sync-join">
      <p className="sync-explainer">Projects on this device stay local-only; your other device&apos;s
        projects will appear here.</p>
      <input className="set-input sync-pairing-input" value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Paste pairing string" aria-label="Pairing string" />
      {error && <div className="sync-error" role="alert">{error}</div>}
      <div className="sync-actions">
        <button className="btn btn-soft" disabled={!value.trim()}
          onClick={() => { void submit(); }}>Connect this device</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

interface MissingKeyProps {
  joinOpen: boolean;
  busy: boolean;
  onEnable: () => void;
  onJoin: (pairingString: string) => Promise<void>;
  setJoinOpen: (open: boolean) => void;
}

function MissingKey({ joinOpen, busy, onEnable, onJoin, setJoinOpen }: MissingKeyProps) {
  return (
    <>
      <p className="sync-explainer">Your writing is end-to-end encrypted, the relay stores nothing,
        and both devices must be online at the same time to sync.</p>
      <div className="sync-actions">
        <button className="btn btn-soft" disabled={busy} onClick={onEnable}>
          {busy ? "Enabling…" : "Enable sync on this device"}
        </button>
        {!joinOpen && <button className="btn" onClick={() => setJoinOpen(true)}>
          I have a pairing string
        </button>}
      </div>
      {joinOpen && <JoinFlow onJoined={onJoin} onCancel={() => setJoinOpen(false)} />}
    </>
  );
}

interface ReadyKeyProps {
  status: SyncStatus;
  pairingString: string | null;
  pairingPayload: string | null;
  confirmingOff: boolean;
  onShowPairing: () => void;
  onRequestOff: () => void;
  onCancelOff: () => void;
  onTurnOff: () => void;
  onForget: (id: string) => void;
}

function ReadyKey(props: ReadyKeyProps) {
  return (
    <>
      <div className="sync-status" data-state={props.status.state}>{formatStatus(props.status)}</div>
      <DeviceList devices={props.status.devices ?? []}
        connected={props.status.state === "connected"} onForget={props.onForget} />
      <div className="sync-actions">
        <button className="btn btn-soft" onClick={props.onShowPairing}>Show pairing string</button>
        {!props.confirmingOff && <button className="btn" onClick={props.onRequestOff}>
          Turn off sync on this device
        </button>}
      </div>
      {props.pairingString && props.pairingPayload && (
        <PairingString value={props.pairingString} payload={props.pairingPayload} />
      )}
      {props.confirmingOff && <div className="sync-confirm">
        <span>Turn off sync and forget this device’s pairing key?</span>
        <button className="btn btn-danger" onClick={props.onTurnOff}>Turn off sync</button>
        <button className="btn" onClick={props.onCancelOff}>Cancel</button>
      </div>}
    </>
  );
}

function RelayUrlRow({ tweaks, setTweak }: SyncSectionProps) {
  return (
    <SetRow label="Relay URL" desc="Leave blank to use the WritersNook relay." last>
      <input className="set-input sync-relay-input" value={tweaks.syncRelayUrl}
        onChange={(event) => setTweak("syncRelayUrl", event.target.value)}
        placeholder="wss://sync.writersnook.app" aria-label="Relay URL" />
    </SetRow>
  );
}

function useSyncKeyState(): [KeyState, React.Dispatch<React.SetStateAction<KeyState>>] {
  const [keyState, setKeyState] = useState<KeyState>("loading");
  useEffect(() => {
    let active = true;
    void getSyncMasterKey().then((key) => {
      if (active) setKeyState(key ? "ready" : "missing");
    });
    return () => { active = false; };
  }, []);
  return [keyState, setKeyState];
}

function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(INITIAL_STATUS);
  useEffect(() => syncEngine.subscribe(setStatus), []);
  return status;
}

interface ActionSetters {
  setKeyState: React.Dispatch<React.SetStateAction<KeyState>>;
  setPairingString: React.Dispatch<React.SetStateAction<string | null>>;
  setPairingPayload: React.Dispatch<React.SetStateAction<string | null>>;
  setJoinOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setConfirmingOff: React.Dispatch<React.SetStateAction<boolean>>;
}

function useSyncActions(
  setTweak: SyncSectionProps["setTweak"],
  relayUrl: string,
  setters: ActionSetters,
) {
  const [busy, setBusy] = useState(false);
  async function showKeyAsPairing(key: Uint8Array): Promise<void> {
    setters.setPairingString(encodeMasterKey(key));
    setters.setPairingPayload(buildPairPayload(key, relayUrl, await readDeviceName()));
  }
  async function activate(key: Uint8Array, role: SyncRole): Promise<void> {
    setBusy(true);
    await setSyncMasterKey(key);
    await setSyncRole(role);
    setTweak("syncExperimental", "on");
    await startSync();
    await showKeyAsPairing(key);
    setters.setKeyState("ready");
    setters.setJoinOpen(false);
    setBusy(false);
  }
  async function showPairing(): Promise<void> {
    const key = await getSyncMasterKey();
    if (key) await showKeyAsPairing(key);
  }
  async function turnOff(): Promise<void> {
    syncEngine.stop();
    await clearSyncMasterKey();
    await clearSyncRole();
    setTweak("syncExperimental", "off");
    setters.setPairingString(null);
    setters.setPairingPayload(null);
    setters.setConfirmingOff(false);
    setters.setKeyState("missing");
  }
  return { activate, busy, showPairing, turnOff };
}

async function readDeviceName(): Promise<string | undefined> {
  try {
    const value = (await invoke<string>("device_name")).trim();
    return value || undefined;
  } catch { return undefined; }
}

export function SyncSection({ tweaks, setTweak }: SyncSectionProps) {
  const [keyState, setKeyState] = useSyncKeyState();
  const status = useSyncStatus();
  const [pairingString, setPairingString] = useState<string | null>(null);
  const [pairingPayload, setPairingPayload] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const effectiveRelayUrl = tweaks.syncRelayUrl.trim() || DEFAULT_RELAY_URL;
  const actions = useSyncActions(setTweak, effectiveRelayUrl, {
    setKeyState, setPairingString, setPairingPayload, setJoinOpen, setConfirmingOff,
  });

  const body = keyState === "ready"
    ? <ReadyKey status={status} pairingString={pairingString} pairingPayload={pairingPayload}
      confirmingOff={confirmingOff}
      onShowPairing={() => { void actions.showPairing(); }} onRequestOff={() => setConfirmingOff(true)}
      onCancelOff={() => setConfirmingOff(false)} onTurnOff={() => { void actions.turnOff(); }}
      onForget={(id) => { void syncEngine.forgetDevice(id); }} />
    : <MissingKey joinOpen={joinOpen} busy={actions.busy}
      onEnable={() => { void actions.activate(generateMasterKey(), "origin"); }}
      onJoin={(value) => actions.activate(decodeMasterKey(value), "joined")} setJoinOpen={setJoinOpen} />;

  return (
    <>
      <div className="sync-section">
        <h2 className="sync-heading">Sync between your devices (experimental)</h2>
        {keyState === "loading" ? <div className="sync-status">Checking sync setup…</div> : body}
      </div>
      {keyState === "ready" && <CredentialShareRow tweaks={tweaks} />}
      <RelayUrlRow tweaks={tweaks} setTweak={setTweak} />
    </>
  );
}
