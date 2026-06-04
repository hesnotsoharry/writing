import { Extension } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  type EditorState,
  Plugin,
  PluginKey,
  type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { NSpell } from "nspell";

import { getSpeller } from "../../lib/dictionary";
import type { GrammarProblem } from "../../lib/ipc";
import { lintText } from "../../lib/ipc";
import {
  readBoolSetting,
  SETTINGS_CHANGED_EVENT,
  SETTINGS_KEYS,
} from "../../lib/settings";
import type { Segment } from "./buildTextIndex";
import { buildTextIndex, charOffsetToPmPos } from "./buildTextIndex";
import type { CheckResult } from "./checkTypes";

// ---------------------------------------------------------------------------
// Plugin key — exported so tests can dispatch meta transactions directly.
// ---------------------------------------------------------------------------

export const proofreadKey = new PluginKey<DecorationSet>("proofread");

// ---------------------------------------------------------------------------
// Spec interface — stored on each Decoration so the popover can read it.
// ---------------------------------------------------------------------------

export interface ProofreadDecoSpec {
  proofreadType: CheckResult["type"];
  proofreadSuggestions: CheckResult["suggestions"];
}

// ---------------------------------------------------------------------------
// Tokenizer — contraction/hyphen-aware word regex (Unicode letter runs).
// ---------------------------------------------------------------------------

// Includes ASCII apostrophe (U+0027) + typographic single quotes (U+2018/U+2019) + hyphen,
// so straight-quote contractions ("don't") stay one token (StarterKit has no Typography extension).
const WORD_REGEX = /[\p{L}]+(?:['''-][\p{L}]+)*/gu;

function tokenize(plain: string): RegExpMatchArray[] {
  const matches: RegExpMatchArray[] = [];
  let match: RegExpMatchArray | null;
  const re = new RegExp(WORD_REGEX.source, WORD_REGEX.flags);
  while ((match = re.exec(plain)) !== null) {
    matches.push(match);
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Spell check — map token matches to CheckResult PM positions.
// ---------------------------------------------------------------------------

function spellCheckWords(
  plain: string,
  segments: Segment[],
  speller: NSpell,
): CheckResult[] {
  const tokens = tokenize(plain);
  const results: CheckResult[] = [];
  for (const match of tokens) {
    const word = match[0];
    if (speller.correct(word)) continue;
    const charStart = match.index ?? 0;
    const charEnd = charStart + word.length;
    results.push({
      from: charOffsetToPmPos(charStart, segments),
      to: charOffsetToPmPos(charEnd, segments),
      type: "spelling",
      message: `"${word}" may be misspelled`,
      suggestions: [],
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Grammar helpers — exported for unit testing.
// ---------------------------------------------------------------------------

/**
 * Maps a list of GrammarProblems (with plain-text char offsets) to CheckResults
 * with ProseMirror positions. Problems whose kind is "spelling" are skipped
 * because nspell already owns spelling — avoiding double-underlines.
 * Problems whose kind is "style" are skipped unless styleHintsEnabled is true
 * (writing.styleHints defaults OFF, no style engine this wave).
 */
export function grammarProblemsToCheckResults(
  problems: GrammarProblem[],
  segments: Segment[],
  styleHintsEnabled: boolean,
): CheckResult[] {
  const results: CheckResult[] = [];
  for (const problem of problems) {
    // Decision G: nspell owns spelling — skip harper's spelling/typo bucket.
    if (problem.kind === "spelling") continue;
    // Skip style lints unless the user has enabled style hints.
    if (problem.kind === "style" && !styleHintsEnabled) continue;
    results.push({
      from: charOffsetToPmPos(problem.start, segments),
      to: charOffsetToPmPos(problem.end, segments),
      type: problem.kind,
      message: problem.message,
      suggestions: problem.suggestions,
    });
  }
  return results;
}

/**
 * Calls the grammar IPC and maps results. Returns [] on any IPC failure so
 * spelling is never disrupted (Decision G — graceful degradation).
 * Exported for unit testing (vi.mock("../lib/ipc")).
 */
export async function fetchGrammarResults(
  plain: string,
  segments: Segment[],
  styleHintsEnabled: boolean,
): Promise<CheckResult[]> {
  try {
    const problems = await lintText(plain);
    return grammarProblemsToCheckResults(problems, segments, styleHintsEnabled);
  } catch (err) {
    console.warn("[proofread] grammar check failed, degrading gracefully:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// runChecks — unified spell+grammar, dispatches meta transaction on completion.
// ---------------------------------------------------------------------------

/** Clears all decorations, but only if some are live (avoids redundant dispatch). */
function clearDecorations(view: EditorView): void {
  const current = proofreadKey.getState(view.state);
  if (current !== undefined && current !== DecorationSet.empty) {
    view.dispatch(view.state.tr.setMeta(proofreadKey, []));
  }
}

/**
 * Loads the speller and runs the sync spell check.
 * Returns null ONLY when the sequence is stale (caller aborts whole tick).
 * Returns [] when the dictionary fails to load (caller continues to grammar — Fix 2).
 */
async function computeSpellResults(
  spellerFactory: () => Promise<NSpell>,
  plain: string,
  segments: Segment[],
  isCurrentSeq: () => boolean,
): Promise<CheckResult[] | null> {
  let speller: NSpell;
  try {
    speller = await spellerFactory();
  } catch (err) {
    console.warn("[proofread] dictionary unavailable, skipping check:", err);
    return []; // load failure → empty spell results; grammar still runs (Fix 2)
  }
  if (!isCurrentSeq()) return null; // stale → abort entire tick
  return spellCheckWords(plain, segments, speller);
}

async function runChecks(
  view: EditorView,
  isCurrentSeq: () => boolean,
  spellerFactory: () => Promise<NSpell>,
): Promise<void> {
  // Decision D: fresh-read-per-tick — no closure caching.
  const spellEnabled = readBoolSetting(SETTINGS_KEYS.spellCheck, true);
  const grammarEnabled = readBoolSetting(SETTINGS_KEYS.grammar, false);
  const styleHintsEnabled = readBoolSetting(SETTINGS_KEYS.styleHints, false);

  if (!spellEnabled && !grammarEnabled) {
    clearDecorations(view);
    return;
  }

  // Build the index ONCE — both checkers share the same plain string.
  const { plain, segments } = buildTextIndex(view.state.doc);

  let spellResults: CheckResult[] = [];
  if (spellEnabled) {
    const r = await computeSpellResults(spellerFactory, plain, segments, isCurrentSeq);
    if (r === null) return; // stale seq → abort
    spellResults = r;
    // Fix 2: r === [] when load failed; grammar still runs below.
  }

  let grammarResults: CheckResult[] = [];
  if (grammarEnabled) {
    if (!isCurrentSeq()) return; // Fix 4: stale after spell await — skip grammar IPC
    grammarResults = await fetchGrammarResults(plain, segments, styleHintsEnabled);
    if (!isCurrentSeq()) return; // doc may have changed during the IPC round-trip
  }

  view.dispatch(view.state.tr.setMeta(proofreadKey, [...spellResults, ...grammarResults]));
}

// ---------------------------------------------------------------------------
// Decorations helper — carries spec so the popover can read type + suggestions.
// ---------------------------------------------------------------------------

function buildDecorations(doc: ProseMirrorNode, results: CheckResult[]): DecorationSet {
  const decorations = results.map((r) => {
    const spec: ProofreadDecoSpec = {
      proofreadType: r.type,
      proofreadSuggestions: r.suggestions,
    };
    return Decoration.inline(
      r.from,
      r.to,
      { class: r.type === "spelling" ? "spell-error" : "grammar-error" },
      spec,
    );
  });
  return DecorationSet.create(doc, decorations);
}

// ---------------------------------------------------------------------------
// Plugin state spec helpers.
// ---------------------------------------------------------------------------

function pluginInit(): DecorationSet {
  return DecorationSet.empty;
}

function pluginApply(tr: Transaction, old: DecorationSet): DecorationSet {
  const meta = tr.getMeta(proofreadKey) as CheckResult[] | undefined;
  if (meta !== undefined) {
    return buildDecorations(tr.doc, meta);
  }
  return old.map(tr.mapping, tr.doc);
}

// ---------------------------------------------------------------------------
// Plugin view factory — debounce + generation counter.
// ---------------------------------------------------------------------------

function makePluginView(debounce: number) {
  return () => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let seq = 0;
    let destroyed = false;
    // Tracks the latest EditorView so the settings-changed handler can schedule
    // a re-check without capturing a stale reference from the factory closure.
    let latestView: EditorView | null = null;

    function schedule(view: EditorView): void {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        seq += 1;
        const current = seq;
        // !destroyed guards the post-await view.dispatch against a torn-down editor.
        void runChecks(view, () => !destroyed && current === seq, getSpeller);
      }, debounce);
    }

    function onSettingsChanged(): void {
      if (destroyed || latestView === null) return;
      schedule(latestView);
    }

    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);

    return {
      update(view: EditorView, prev: EditorState) {
        latestView = view;
        if (!view.state.doc.eq(prev.doc)) schedule(view);
      },
      destroy() {
        destroyed = true;
        if (timer !== null) { clearTimeout(timer); timer = null; }
        window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
      },
    };
  };
}

// ---------------------------------------------------------------------------
// ProseMirror plugin.
// ---------------------------------------------------------------------------

function createProofreadPlugin(): Plugin {
  return new Plugin<DecorationSet>({
    key: proofreadKey,
    state: { init: pluginInit, apply: pluginApply },
    props: {
      decorations(state) { return proofreadKey.getState(state); },
    },
    view: makePluginView(400),
  });
}

// ---------------------------------------------------------------------------
// TipTap Extension.
// ---------------------------------------------------------------------------

const ProofreadExtension = Extension.create({
  name: "proofread",
  addProseMirrorPlugins() {
    return [createProofreadPlugin()];
  },
});

export default ProofreadExtension;
