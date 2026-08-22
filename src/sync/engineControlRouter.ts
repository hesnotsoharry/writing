import type { CredentialExchange } from "./credentialExchange";
import type { DeviceRosterTracker } from "./deviceRoster";
import type { EngineOptions } from "./engineTypes";
import type { LwwReconciler } from "./lww/reconciler";
import type { HelloMessage, InnerMessage } from "./messages";
import type { DurableOutbox } from "./outbox";
import type { SyncStatus } from "./statusEmitter";

export interface ControlRouterDeps {
  devices: DeviceRosterTracker;
  credentials: CredentialExchange;
  /** Read late: both are built after the engine's own construction and the
   *  reconciler is reset between sessions. */
  lww: () => LwwReconciler | null;
  outbox: () => DurableOutbox | null;
  send: (message: InnerMessage) => Promise<void>;
  answerHello: (hello: HelloMessage) => Promise<void>;
  patchStatus: (patch: Partial<SyncStatus>) => void;
  options: EngineOptions;
}

/** Dispatch for the non-content half of the protocol: hello, the row-LWW
 *  exchange, and credential handoff. Split out of SyncEngine, which is at the
 *  300-line ceiling — the same reason StatusEmitter and RemoteUpdateRouter live
 *  in their own files. Returns true when the message was a control message and
 *  needs no further handling. */
export class ControlRouter {
  constructor(private readonly deps: ControlRouterDeps) {}

  async handle(message: InnerMessage): Promise<boolean> {
    if (message.t === "hello") { await this.onHello(message); return true; }
    if (message.t === "row-hello") { await this.deps.lww()?.receiveSummary(message); return true; }
    if (message.t === "row") {
      const ack = await this.deps.lww()?.receiveRow(message);
      if (ack) await this.deps.send(ack);
      return true;
    }
    if (message.t === "row-ack") { await this.deps.outbox()?.acknowledge(message.id); return true; }
    return this.deps.credentials.receive(message);
  }

  private async onHello(message: HelloMessage): Promise<void> {
    const lastPeerSeenAt = new Date().toISOString();
    this.deps.patchStatus({ peerSeen: true, lastPeerSeenAt });
    await this.deps.options.saveLastPeerSeenAt?.(lastPeerSeenAt);
    // Record the sender BEFORE answering: answerHello can send a frame per doc
    // and awaits each, so a peer that drops mid-answer must still be on the
    // list. Getting this backwards would hide exactly the short-lived peer the
    // list exists to reveal.
    this.deps.patchStatus({ devices: await this.deps.devices.recordHello(message, lastPeerSeenAt) });
    await this.deps.answerHello(message);
  }
}
