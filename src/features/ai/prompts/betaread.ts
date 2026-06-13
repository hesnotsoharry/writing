/**
 * Beta read verb — prompt template and per-verb token cap.
 * First-person reader reactions, beat by beat.
 */
import type { AiMessage } from "../ai.client";
import type { AssembledContext } from "../ai.types";
import { buildGrounding, SHARED_PRINCIPLES } from "./shared";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum output tokens for the betaread verb. */
export const BETAREAD_MAX_TOKENS = 1024;

// ── Template ──────────────────────────────────────────────────────────────────

/**
 * Build the system prompt + messages array for a beta read request.
 * Responds as a first-person reader reacting beat by beat.
 */
export function buildBetareadMessages(
  ctx: AssembledContext,
  ask: string,
  history?: AiMessage[],
): { system: string; messages: AiMessage[] } {
  const parts: string[] = [
    "You are a first-time reader encountering this manuscript with fresh eyes.",
    "React as a reader would: share what pulls you in, what confuses you, what you feel.",
    "Work beat by beat through the material. You may quote lines with `> ` to anchor your reactions.",
    "Be honest about where your attention drifts and where it sharpens.",
    SHARED_PRINCIPLES,
    "You are a reader, NOT an editor. Do NOT line-edit, copy-edit, or suggest rewrites.",
    "Respond only to what you experienced as a reader: immersion, confusion, emotional beats, pacing.",
    "Do NOT propose alternative phrasing or structural fixes — only report your experience.",
  ];

  parts.push(...buildGrounding(ctx));

  return {
    system: parts.join("\n"),
    messages: [...(history ?? []), { role: "user", content: ask }],
  };
}
