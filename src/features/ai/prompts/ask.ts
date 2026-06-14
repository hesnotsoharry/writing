/**
 * Ask verb — prompt template and per-verb token cap.
 *
 * Ask is a free-form writing assistant: any question, grounded in the manuscript,
 * harnessed by its own anti-AI-ism prompt (not SHARED_PRINCIPLES, which is
 * critique-shaped). Decision 2, Wave 47.
 */
import type { AiMessage } from "../ai.client";
import type { AssembledContext } from "../ai.types";
import { buildGrounding } from "./shared";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum output tokens for the ask verb. Client-side estimate constant; server maxTokens is authoritative. */
export const ASK_MAX_TOKENS = 2048;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Return shape of buildAskMessages — system + user messages. */
export interface AskMessages {
  system: string;
  messages: AiMessage[];
}

// ── Template ──────────────────────────────────────────────────────────────────

/**
 * Build the system prompt + messages array for an ask request.
 * Accepts optional prior-turn history for multi-turn conversations.
 */
export function buildAskMessages(
  ctx: AssembledContext,
  userQuestion: string,
  history?: AiMessage[],
): AskMessages {
  const parts: string[] = [
    `You are a writing assistant embedded directly inside a fiction writer's manuscript.
The writer can ask you anything: craft questions, story problems, plot logic, character
motivation, word choice, research-style questions, or how to approach a revision.
Answer the actual question directly and usefully. Lead with substance — no preamble.
Use the manuscript context below when it is relevant; when the question is general, you do
not need to force a connection to the open scene.
<style>
Do not open with praise, a compliment, or a restatement of the question. No "Certainly",
"Great question", "I'd be happy to" — just answer.
Avoid AI-isms and filler: no "delve", "tapestry", "testament to", "navigate the complexities",
"it's important to note", "in the realm of", "rich and vibrant", or hollow throat-clearing.
Match the length of your answer to the question. Short questions get short answers. Do not pad
with restated conclusions or summaries.
Write plainly and concretely. Prefer specifics over generalities.
</style>
<prose>
Do NOT generate story prose, scene drafts, or rewrites unless the writer explicitly asks for them.
Your default is to advise and discuss, not to write the writer's book for them.
When the writer does ask for prose, keep it tight and purposeful — no purple description, no
filler beats, no padding to fill space.
</prose>`,
  ];

  parts.push(...buildGrounding(ctx));

  return {
    system: parts.join("\n"),
    messages: [...(history ?? []), { role: "user", content: userQuestion }],
  };
}
