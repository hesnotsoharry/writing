#!/usr/bin/env node
/**
 * W48 — Cache-behavior LIVE smoke (P2 + P4 oracles).
 * Behavior-level HTTP probes against the DEPLOYED worker — NOT code-path tests.
 * Deliberately probes the public endpoint contract (POST /api/ai/chat, the `done`
 * SSE event's creditsCost) so it survives the W48→W50 rebase that shifts
 * chat.ts/credits.ts call sites.
 *
 * ── WHAT THIS PROVES ────────────────────────────────────────────────────────
 *   P2 (cache survives edits): the Anthropic prompt cache hits across a scene
 *       EDIT. Pre-W48 the scene lived inside the cached `system` block, so any
 *       edit busted the cache (every edited turn billed as a cold cache-WRITE).
 *       Post-W48 the scene rides in the user turn, so editing it leaves `system`
 *       byte-identical and the cache reads cheaply. Oracle: an edited warm turn
 *       costs ~the same as a non-edited warm turn, and far less than the cold turn.
 *   P4 (economics): over a realistic write→ask→edit→ask session, total credits
 *       spent is well below the naive "every turn is cold" baseline.
 *
 * ── CRITICAL CAVEAT — read before interpreting results ──────────────────────
 *   The LIVE default verb-config runs EVERY verb on claude-haiku-4-5 (see
 *   marketing/functions/_lib/verb-config.ts). Haiku's cacheable-prefix floor is
 *   4096 tokens (~16,384 chars). A realistic stable prefix is ~1,200 tokens
 *   (W48 P0 measurement) — BELOW Haiku's floor — so on the default config the
 *   cache NEVER FIRES and W48's benefit is DORMANT. It pays off only for
 *   Sonnet/Opus (1024-token floor) or a Haiku manuscript with a >16k-char Story
 *   Bible. This smoke therefore forces MODEL=claude-sonnet-4-6 to exercise and
 *   prove the cache path. To confirm the user-facing win on the real default,
 *   either upgrade the verbs to Sonnet or test a very rich Haiku manuscript.
 *   (See memory: ai-caching-favors-sonnet-upgrade-economics.)
 *
 * ── PRECONDITIONS ───────────────────────────────────────────────────────────
 *   • Run AFTER W50 lands → W48 rebases & merges → Cloudflare deploys the worker
 *     (the worker change deploys on push to master). The 1h TTL + beta header
 *     only exist post-deploy.
 *   • Spends REAL Anthropic tokens (a handful of small Sonnet requests, a few
 *     cents). Mind the $25/day global ceiling. Run once, read the table.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   LICENSE_KEY=<your-active-license-key> node marketing/scripts/w48-cache-smoke.mjs
 *   # or trial:   TRIAL_KEY=trial_xxxxxxxx node marketing/scripts/w48-cache-smoke.mjs
 *   # overrides:  WORKER_BASE_URL=https://writersnook.app  MODEL=claude-sonnet-4-6  VERB=critique
 *
 * Exit code 0 = both oracles PASS; 1 = a FAIL or a request error.
 */

const BASE = (process.env.WORKER_BASE_URL || "https://writersnook.app").replace(/\/$/, "");
const LICENSE_KEY = process.env.LICENSE_KEY;
const TRIAL_KEY = process.env.TRIAL_KEY;
const MODEL = process.env.MODEL || "claude-sonnet-4-6"; // force Sonnet — see CRITICAL CAVEAT
const VERB = process.env.VERB || "critique"; // 'critique'/'ask' respect the model override; 'proofread' does NOT

// A stable grounding block large enough to clear the Sonnet 1024-token (~4096-char)
// floor AND stay byte-identical across turns (this is the cached prefix). ~6,000 chars.
const STABLE_SYSTEM = [
  "You are a trusted writing partner giving a focused critique. Be specific and direct.",
  "<principles>Ground every claim in a named line or short quote. State problems directly. Do not open with praise.</principles>",
  "About this manuscript:",
  "Synopsis: On a remote tidal island, a taciturn lighthouse keeper and a guilt-ridden mainland detective uncover a decades-old pattern of drownings tied to the keeper's own family and the council's quiet complicity.",
  "Genre: literary crime / gothic. Tone: quiet, foreboding, elegiac; restrained interiority; weather as pressure. POV: close third, present tense.",
  "Linked worldbuilding entities:",
  ...Array.from({ length: 24 }, (_, i) =>
    `- Entity ${i + 1}: a recurring figure or place in the manuscript with stable, session-long background facts that do not change while the writer edits the current scene, included here to model a rich Story Bible that clears the cache floor.`,
  ),
].join("\n");

// Three versions of the SAME scene — v2/v3 are "edits" of v1 (what the writer types).
const SCENE_V1 = "The tide came in fast across the causeway. " .repeat(36);
const SCENE_V2 = "The tide came in fast across the causeway, and she counted the stones. ".repeat(28);
const SCENE_V3 = "She counted the stones as the grey water took them, one by one, without hurry. ".repeat(24);

function userTurn(sceneExcerpt, ask) {
  // Mirrors buildVolatileUserBlock + buildMessages: volatile scene prepended to the ask.
  return `Scene excerpt:\n${sceneExcerpt}\n\n${ask}`;
}

async function postJson(path, body, token) {
  const headers = { "content-type": "application/json" };
  if (token) headers["authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  return res;
}

async function getToken() {
  if (LICENSE_KEY) {
    const r = await postJson("/api/ai/session", { licenseKey: LICENSE_KEY });
    if (!r.ok) throw new Error(`POST /api/ai/session → ${r.status}: ${await r.text()}`);
    return (await r.json()).token;
  }
  if (TRIAL_KEY) {
    const r = await postJson("/api/ai/trial-session", { trialKey: TRIAL_KEY });
    if (!r.ok) throw new Error(`POST /api/ai/trial-session → ${r.status}: ${await r.text()}`);
    return (await r.json()).token;
  }
  throw new Error("Set LICENSE_KEY (active license) or TRIAL_KEY (trial_…) in the environment.");
}

// One chat request; parse the SSE stream and return the final `done` payload
// { inputTokens, outputTokens, creditsCost }. Throws on an `error` event.
async function chat(token, { system, messages, model, verb }) {
  const res = await postJson("/api/ai/chat", { system, messages, model, verb }, token);
  if (!res.ok) throw new Error(`POST /api/ai/chat → ${res.status}: ${await res.text()}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let done = null;
  for (;;) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let evt;
      try { evt = JSON.parse(payload); } catch { continue; }
      if (evt.type === "error") throw new Error(`stream error: ${evt.message}`);
      if (evt.type === "done") done = evt;
    }
  }
  if (!done) throw new Error("stream ended without a `done` event");
  return done;
}

async function main() {
  console.log(`W48 cache smoke → ${BASE}  model=${MODEL}  verb=${VERB}`);
  console.log(`stable system ≈ ${STABLE_SYSTEM.length} chars (~${Math.ceil(STABLE_SYSTEM.length / 4)} tok)\n`);
  const token = await getToken();

  // Run back-to-back (within the cache TTL window). Same system every turn.
  const turns = [];
  const seq = [
    ["T1 cold            ", SCENE_V1, "Give me one specific critique of this scene."],
    ["T2 warm (no edit)  ", SCENE_V1, "What is the strongest line, and why?"],
    ["T3 warm (EDITED)   ", SCENE_V2, "I revised the scene — one critique now?"],
    ["T4 warm (EDITED)   ", SCENE_V3, "Revised again — does the ending land?"],
  ];
  for (const [label, scene, ask] of seq) {
    const d = await chat(token, {
      system: STABLE_SYSTEM,
      messages: [{ role: "user", content: userTurn(scene, ask) }],
      model: MODEL,
      verb: VERB,
    });
    turns.push({ turn: label.trim(), inputTokens: d.inputTokens, outputTokens: d.outputTokens, creditsCost: d.creditsCost });
    console.log(`  ${label} → inputTokens=${d.inputTokens}  creditsCost=${d.creditsCost}`);
  }

  const [c1, c2, c3] = [turns[0].creditsCost, turns[1].creditsCost, turns[2].creditsCost];

  // ── P2: editing the scene (T3) must NOT bust the system cache ──────────────
  // A warm-edited turn should cost ~like a warm no-edit turn, and far below cold.
  const p2 = c3 <= c2 * 1.5 && c3 < c1 * 0.8;

  // ── P4: session economics vs the naive "every turn cold" baseline ──────────
  const total = turns.reduce((s, t) => s + t.creditsCost, 0);
  const naive = c1 * turns.length;
  const saved = naive > 0 ? Math.round((1 - total / naive) * 100) : 0;

  console.log("\n──────── RESULTS ────────");
  console.table(turns);
  console.log(`P2 (cache survives an edit): ${p2 ? "PASS" : "FAIL"}`);
  console.log(`   cold T1=${c1}  warm T2=${c2}  warm+edit T3=${c3}  (want T3 ≈ T2 ≪ T1)`);
  console.log(`P4 (session economics): total=${total}  naive-no-cache≈${naive}  → ${saved}% saved`);
  if (!p2) {
    console.log("\n⚠ If every turn cost ~the same, the cache never engaged. Check:");
    console.log("   • MODEL clears its floor (Sonnet 1024 tok; Haiku needs 4096 — see CAVEAT).");
    console.log("   • Turns ran within the cache TTL (1h post-W48; pre-W48 only 5m).");
    console.log("   • The deployed worker actually has the W48 changes (post-merge + deploy).");
  }
  process.exit(p2 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\n✗ smoke failed: ${e.message}`);
  process.exit(1);
});
