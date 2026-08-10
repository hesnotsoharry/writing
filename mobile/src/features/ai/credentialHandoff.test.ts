import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearSessionFromMemory, consumeCredentialOffer, markByokOnlyUnavailable,
} from "./credentialHandoff";
import { createDevTrialOffer } from "./devTrialOffer";

function harness() {
  let value: string | null = null;
  const secureStore = {
    getItemAsync: vi.fn(async () => value),
    setItemAsync: vi.fn(async (_key: string, next: string) => { value = next; }),
    deleteItemAsync: vi.fn(async () => { value = null; }),
  };
  const client = {
    acquireSession: vi.fn(async () => ({ token: "session", expiresAt: 9999999999 })),
    acquireTrialSession: vi.fn(async () => ({ token: "trial", expiresAt: 9999999999 })),
  };
  return { secureStore, client };
}

describe("managed credential handoff", () => {
  beforeEach(() => { clearSessionFromMemory(); });

  it("stores a valid long-lived offer in SecureStore and mints locally", async () => {
    const deps = harness();
    const offer = { t: "credential-offer", id: "offer-1", managed: {
      aiLicenseKey: "license", aiModel: "claude-sonnet-5", aiEnabled: true,
    } };
    const result = await consumeCredentialOffer(offer, deps);
    expect(result.ack).toEqual({ t: "credential-ack", id: "offer-1", accepted: true });
    expect(deps.client.acquireSession).toHaveBeenCalledWith("license");
    expect(deps.secureStore.setItemAsync).toHaveBeenCalledOnce();
    const persisted = JSON.parse(deps.secureStore.setItemAsync.mock.calls[0][1]) as Record<string, unknown>;
    expect(persisted).not.toHaveProperty("token");
  });

  it("rejects a replayed offer", async () => {
    const deps = harness();
    const offer = { t: "credential-offer", id: "offer-1", managed: {
      aiTrialKey: "trial-key", aiModel: "gpt-5.4-mini", aiEnabled: true,
    } };
    await consumeCredentialOffer(offer, deps);
    const replay = await consumeCredentialOffer(offer, deps);
    expect(replay.availability.state).toBe("replayed");
    expect(replay.ack.accepted).toBe(false);
    expect(deps.client.acquireTrialSession).toHaveBeenCalledOnce();
  });

  it("accepts the dev first-grant trial offer", async () => {
    const deps = harness();
    const result = await consumeCredentialOffer(createDevTrialOffer(), deps);
    expect(result.availability.state).toBe("available");
    if (result.availability.state !== "available") return;
    expect(result.availability.credential.kind).toBe("trial");
    expect(deps.client.acquireTrialSession).toHaveBeenCalledWith("");
  });

  it("keeps BYOK-only state unavailable and stores no provider secret", async () => {
    const deps = harness();
    await markByokOnlyUnavailable(deps);
    const invalidByokOffer = { t: "credential-offer", id: "byok", managed: {
      aiModel: "custom", aiEnabled: true, providerKey: "must-not-cross",
    } };
    const result = await consumeCredentialOffer(invalidByokOffer, deps);
    expect(result.availability).toEqual({
      state: "unavailable", message: "Set up managed AI on desktop",
    });
    expect(deps.secureStore.setItemAsync).not.toHaveBeenCalled();
    expect(deps.client.acquireSession).not.toHaveBeenCalled();
  });
});
