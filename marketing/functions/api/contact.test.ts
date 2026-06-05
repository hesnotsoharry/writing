// ============================================================================
// ORCHESTRATOR-OWNED ACCEPTANCE TEST — contact endpoint (m4 Phase 5).
// The implementer MUST make this pass and MUST NOT modify it.
//   POST /api/contact { name, email, message }:
//     - valid           -> sends a support email via _lib/resend, returns 200 {ok:true};
//                          the email carries the sender's email + message (so support can reply).
//     - invalid email    -> 400, no send.
//     - missing name/message -> 400, no send.
// The Resend helper is mocked at the boundary (its own contract is tested separately).
// ============================================================================
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "./contact";
import { sendEmail } from "../_lib/resend";

vi.mock("../_lib/resend", () => ({ sendEmail: vi.fn(async () => ({ id: "email-1" })) }));

function ctx(body: unknown) {
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
    },
  } as unknown as Parameters<typeof onRequestPost>[0];
}

describe("POST /api/contact", () => {
  beforeEach(() => vi.mocked(sendEmail).mockClear());

  it("sends a support email for a valid submission and returns ok", async () => {
    const res = await onRequestPost(ctx({ name: "Nina", email: "nina@writer.com", message: "Hello there, a question." }));
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const [, payload] = vi.mocked(sendEmail).mock.calls[0];
    const flat = JSON.stringify(payload);
    expect(flat).toContain("nina@writer.com"); // sender, in the body
    expect(flat).toContain("Hello there, a question."); // the message body
    // support must be able to hit Reply — sender goes in reply_to, not just the body.
    expect(payload).toMatchObject({ replyTo: "nina@writer.com" });
  });

  it("rejects an invalid email with 400 and sends nothing", async () => {
    const res = await onRequestPost(ctx({ name: "Nina", email: "not-an-email", message: "hi" }));
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects missing name or message with 400", async () => {
    expect((await onRequestPost(ctx({ email: "a@b.com", message: "hi" }))).status).toBe(400); // no name
    expect((await onRequestPost(ctx({ name: "X", email: "a@b.com" }))).status).toBe(400); // no message
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
