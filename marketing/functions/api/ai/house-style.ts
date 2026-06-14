/**
 * GET /api/ai/house-style
 *
 * Returns the current v1 anti-AI-isms house-style config as JSON.
 * No auth required — the payload is not secret; it is also shipped baked-in
 * to the client as HOUSE_STYLE_DEFAULT (src/features/ai/prompts/shared.ts).
 * The two BLOCK values MUST stay in sync until W46 evaluates and tunes them.
 *
 * Response shape (200):
 *   { version: 1, enabled: true, block: string, perModelAddenda: {} }
 *
 * CORS: GET, OPTIONS — same origin allowlist as the other AI endpoints.
 */
import { getCorsHeaders } from "../../_lib/cors";

// v1 source-embedded config. The client also ships this text as its baked-in
// default (HOUSE_STYLE_BLOCK in src/features/ai/prompts/shared.ts) — keep in
// sync until W46's eval sets tuned values.
const VERSION = 1;
const ENABLED = true;
const PER_MODEL_ADDENDA: Record<string, string> = {};
const BLOCK = `<house-style>
Avoid these overused AI-writing patterns ("AI-isms") in any prose, examples, or rewrites you produce — they read as machine-generated:
- NEVER use the "It's not X, it's Y" / "Not X. Y." antithesis (e.g. "It wasn't anger. It was grief."), or its variants "less X than Y", "X — or rather Y". State the point directly.
- NEVER use the stock character names Elara, Silas, Marcus, Voss, or Blackwood. If you must name someone, choose outside this overused set.
- NEVER characterize a place or person by pairing two smells ("smelled of dust and old paper", "jasmine and woodsmoke"). Drop the smell-pair cliche.
- NEVER write "the silence was a [noun]" or equate an abstraction to a physical object/shape ("grief was a stone", "the silence was a held breath"). Cut these abstract-equals-concrete metaphors.
- NEVER define something by what it is not when you could say what it is. Avoid stacked negations and "not quite", "almost but not", "something between X and Y" hedging.
- NEVER fill space with vague abstraction ("a sense of", "a weight", "an energy", "a presence", unnamed "emotion"). Every sentence must carry concrete, specific information.
Register — show, don't tell: convey emotion through concrete action, sensory detail, and subtext, not by naming the feeling. Do NOT write that a character "felt sad/afraid/relieved"; show the behavior or detail that conveys it, and do not append an explanation of the emotional takeaway.
</house-style>`;

export const onRequestOptions: PagesFunction<Record<string, unknown>> = (context) => {
  const origin = context.request.headers.get("Origin");
  const cors = getCorsHeaders(context.request);
  const hasCors = Boolean(origin && cors["Access-Control-Allow-Origin"]);
  return new Response(null, {
    status: 204,
    headers: hasCors
      ? {
          ...cors,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        }
      : {},
  });
};

export const onRequestGet: PagesFunction<Record<string, unknown>> = (context) => {
  const cors = getCorsHeaders(context.request);
  const body = JSON.stringify({
    version: VERSION,
    enabled: ENABLED,
    block: BLOCK,
    perModelAddenda: PER_MODEL_ADDENDA,
  });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...cors,
    },
  });
};
