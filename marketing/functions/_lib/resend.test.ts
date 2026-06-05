// ============================================================================
// ORCHESTRATOR-OWNED ACCEPTANCE TEST — Resend helper contract (m4 Phase 2).
// The implementer MUST make this pass and MUST NOT modify it.
//   sendEmail(env, { to, subject, html, text }) ->
//     - real key  -> POST https://api.resend.com/emails, Bearer auth, JSON body
//                    { from: env.RESEND_FROM, to: [<to>], subject, html, text };
//                    returns { id } from the Resend response.
//     - placeholder/missing key (falsy OR startsWith "replace-") -> NO fetch,
//                    returns { id: null, skipped: true }, warns. (placeholder-guard
//                    pattern — mirrors supabase-client.js / account.js)
//     - non-ok response -> returns { id: null } and does NOT throw (email is a
//                    best-effort side effect; the webhook must not 500 on it).
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendEmail } from "./resend";

const REAL_ENV = {
  RESEND_API_KEY: "re_test_realkey123",
  RESEND_FROM: "Writers Nook <noreply@writersnook.app>",
} as unknown as Parameters<typeof sendEmail>[0];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email-abc-123" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sendEmail (Resend helper)", () => {
  it("POSTs a correctly-shaped request with a real key and returns the email id", async () => {
    const res = await sendEmail(REAL_ENV, {
      to: "buyer@example.com",
      subject: "Your Writers Nook license",
      html: "<p>key: WNOOK-X</p>",
      text: "key: WNOOK-X",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Bearer re_test_realkey123");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body);
    expect(body.from).toBe("Writers Nook <noreply@writersnook.app>");
    expect(body.to).toEqual(["buyer@example.com"]); // string coerced to array
    expect(body.subject).toBe("Your Writers Nook license");
    expect(body.html).toContain("WNOOK-X");

    expect(res.id).toBe("email-abc-123");
  });

  it("maps an optional replyTo to the Resend `reply_to` body field", async () => {
    await sendEmail(REAL_ENV, { to: "s@x.com", subject: "s", html: "h", text: "t", replyTo: "buyer@x.com" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reply_to).toBe("buyer@x.com");
  });

  it("sets the Idempotency-Key header when idempotencyKey is provided (D4 defense-in-depth)", async () => {
    await sendEmail(REAL_ENV, { to: "s@x.com", subject: "s", html: "h", text: "t", idempotencyKey: "license-9999" });
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe("license-9999");
  });

  it("skips the send (no fetch) when the key is the placeholder", async () => {
    const env = {
      RESEND_API_KEY: "replace-with-resend-api-key",
      RESEND_FROM: "Writers Nook <noreply@writersnook.app>",
    } as unknown as Parameters<typeof sendEmail>[0];

    const res = await sendEmail(env, { to: "buyer@example.com", subject: "s", html: "h", text: "t" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res).toMatchObject({ id: null, skipped: true });
    expect(console.warn).toHaveBeenCalled();
  });

  it("skips the send when the key is missing/empty", async () => {
    const env = { RESEND_FROM: "x" } as unknown as Parameters<typeof sendEmail>[0];
    const res = await sendEmail(env, { to: "buyer@example.com", subject: "s", html: "h", text: "t" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res).toMatchObject({ id: null, skipped: true });
  });

  it("does not throw on a non-ok Resend response; returns id null", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: null, error: { code: "x", message: "bad" } }), { status: 422 }),
    );
    const res = await sendEmail(REAL_ENV, { to: "buyer@example.com", subject: "s", html: "h", text: "t" });
    expect(res.id).toBeNull();
  });

  it("does not throw when fetch itself rejects (network error); returns id null", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const res = await sendEmail(REAL_ENV, { to: "buyer@example.com", subject: "s", html: "h", text: "t" });
    expect(res.id).toBeNull();
  });

  it("does not throw when an OK response carries a non-JSON body; returns id null", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>gateway timeout</html>", { status: 200 }));
    const res = await sendEmail(REAL_ENV, { to: "buyer@example.com", subject: "s", html: "h", text: "t" });
    expect(res.id).toBeNull();
  });

  it("skips the send when RESEND_FROM is missing (unconfigured sender)", async () => {
    const env = { RESEND_API_KEY: "re_test_realkey123" } as unknown as Parameters<typeof sendEmail>[0];
    const res = await sendEmail(env, { to: "buyer@example.com", subject: "s", html: "h", text: "t" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res).toMatchObject({ id: null, skipped: true });
  });
});
