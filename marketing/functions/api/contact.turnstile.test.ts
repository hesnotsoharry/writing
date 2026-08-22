// ============================================================================
// Turnstile coverage for POST /api/contact. Not orchestrator-owned —
// implementer-authored, alongside the pinned contract in contact.test.ts
// (which this file does not modify). Enforced only when TURNSTILE_SECRET_KEY
// is set (deploys in lockstep with the form's widget) — unset behaves exactly
// as today, proven by the unmodified contact.test.ts continuing to pass.
// ============================================================================
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "./contact";
import { sendEmail } from "../_lib/resend";
import { verifyTurnstileToken } from "../_lib/turnstile";

vi.mock("../_lib/resend", () => ({ sendEmail: vi.fn(async () => ({ id: "email-1" })) }));
vi.mock("../_lib/turnstile", () => ({ verifyTurnstileToken: vi.fn() }));

function ctx(body: unknown, envOverride: Record<string, string> = {}) {
  return {
    request: new Request("https://writersnook.app/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env: {
      RESEND_API_KEY: "re_test_realkey",
      RESEND_FROM: "Writers Nook <noreply@writersnook.app>",
      CONTACT_TO: "support@writersnook.app",
      ...envOverride,
    },
  } as unknown as Parameters<typeof onRequestPost>[0];
}

const VALID_BODY = { name: "Nina", email: "nina@writer.com", message: "Hello there, a question." };

describe("POST /api/contact — Turnstile", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockClear();
    vi.mocked(verifyTurnstileToken).mockReset();
  });

  it("secret set + missing token -> 400, no send, no verify call", async () => {
    const res = await onRequestPost(ctx(VALID_BODY, { TURNSTILE_SECRET_KEY: "test-secret" }));
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it("secret set + invalid token -> 403, no send", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue({ success: false });
    const res = await onRequestPost(
      ctx({ ...VALID_BODY, turnstileToken: "bad" }, { TURNSTILE_SECRET_KEY: "test-secret" }),
    );
    expect(res.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("secret set + valid token -> 200, sends", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue({ success: true });
    const res = await onRequestPost(
      ctx({ ...VALID_BODY, turnstileToken: "good" }, { TURNSTILE_SECRET_KEY: "test-secret" }),
    );
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(verifyTurnstileToken).toHaveBeenCalledWith("good", "test-secret", undefined);
  });

  it("secret unset -> passes as today even with no token, and never calls verify", async () => {
    const res = await onRequestPost(ctx(VALID_BODY));
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });
});
