import { useEffect, useState } from "react";

import { syncEngine } from "../../sync/desktopEngine";
import type { CredentialAckMessage, ManagedCredentialState } from "../../sync/messages";
import { SetRow } from "./Settings.primitives";
import type { Tweaks } from "./settings.store";

type ShareState = "idle" | "confirming" | "sending" | "shared" | "declined" | "offline";

function managedCredential(tweaks: Tweaks): ManagedCredentialState | null {
  const common = { aiModel: tweaks.aiModel, aiEnabled: tweaks.aiEnabled };
  if (tweaks.aiLicenseKey.trim()) return { ...common, aiLicenseKey: tweaks.aiLicenseKey.trim() };
  if (tweaks.aiTrialKey.trim()) return { ...common, aiTrialKey: tweaks.aiTrialKey.trim() };
  return null;
}

function statusCopy(state: ShareState): string | null {
  if (state === "shared") return "Managed AI access was accepted by the paired phone.";
  if (state === "declined") return "The paired phone declined this offer; nothing changed there.";
  if (state === "offline") return "Connect the paired phone, then confirm sharing again.";
  return null;
}

function ConfirmShare({ onCancel, onConfirm }: { onCancel(): void; onConfirm(): void }) {
  return <div className="sync-confirm">
    <span>Share managed AI access with the paired phone? This sends your managed WritersNook AI
      subscription or trial credential, selected model, and AI on/off setting over the encrypted
      sync connection. Provider API keys and local model endpoints are not shared.</span>
    <button className="btn btn-soft" onClick={onConfirm}>Confirm share</button>
    <button className="btn" onClick={onCancel}>Cancel</button>
  </div>;
}

export function CredentialShareRow({ tweaks }: { tweaks: Tweaks }) {
  const credential = managedCredential(tweaks);
  const [state, setState] = useState<ShareState>("idle");
  const [offerId, setOfferId] = useState<string | null>(null);
  useEffect(() => {
    syncEngine.onCredentialAck((ack: CredentialAckMessage) => {
      if (ack.id === offerId) setState(ack.accepted ? "shared" : "declined");
    });
    return () => syncEngine.onCredentialAck(null);
  }, [offerId]);
  async function share(): Promise<void> {
    if (!credential) return;
    setState("sending");
    const id = crypto.randomUUID();
    setOfferId(id);
    const sentId = await syncEngine.sendCredentialOffer(credential, id);
    if (!sentId) setState("offline");
  }
  if (!credential) return <SetRow label="Share managed AI access with the paired phone"
    desc="No managed subscription or trial credential is available. BYOK provider keys and local model endpoints stay on this computer.">
    <span>Set up managed AI on desktop to share access.</span>
  </SetRow>;
  return <SetRow label="Share managed AI access with the paired phone"
    desc="Shares only your managed WritersNook AI subscription or trial credential, selected model, and AI on/off setting. BYOK provider keys and local model endpoints are never shared.">
    {state === "confirming" ? <ConfirmShare onCancel={() => setState("idle")}
      onConfirm={() => { void share(); }} />
      : <button className="btn btn-soft" disabled={state === "sending"}
        onClick={() => setState("confirming")}>{state === "sending" ? "Sharing…" : "Share access…"}</button>}
    {statusCopy(state) && <div className="sync-status">{statusCopy(state)}</div>}
  </SetRow>;
}
