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
import type { Segment } from "./buildTextIndex";
import { buildTextIndex, charOffsetToPmPos } from "./buildTextIndex";
import type { CheckResult } from "./checkTypes";

// ---------------------------------------------------------------------------
// Plugin key — exported so tests can dispatch meta transactions directly.
// ---------------------------------------------------------------------------

export const proofreadKey = new PluginKey<DecorationSet>("proofread");

// ---------------------------------------------------------------------------
// Tokenizer — contraction/hyphen-aware word regex (Unicode letter runs).
// ---------------------------------------------------------------------------

// Includes ASCII apostrophe (U+0027) + typographic single quotes (U+2018/U+2019) + hyphen,
// so straight-quote contractions ("don't") stay one token (StarterKit has no Typography extension).
const WORD_REGEX = /[\p{L}]+(?:['‘’-][\p{L}]+)*/gu;

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
// runChecks — async spell-check, dispatches meta transaction on completion.
// ---------------------------------------------------------------------------

async function runChecks(
  view: EditorView,
  isCurrentSeq: () => boolean,
  spellerFactory: () => Promise<NSpell>,
): Promise<void> {
  let speller: NSpell;
  try {
    speller = await spellerFactory();
  } catch (err) {
    console.warn("[proofread] dictionary unavailable, skipping check:", err);
    return;
  }
  if (!isCurrentSeq()) return;
  const { plain, segments } = buildTextIndex(view.state.doc);
  const results = spellCheckWords(plain, segments, speller);
  if (!isCurrentSeq()) return;
  view.dispatch(view.state.tr.setMeta(proofreadKey, results));
}

// ---------------------------------------------------------------------------
// Decorations helper.
// ---------------------------------------------------------------------------

function buildDecorations(doc: ProseMirrorNode, results: CheckResult[]): DecorationSet {
  const decorations = results.map((r) =>
    Decoration.inline(r.from, r.to, {
      class: r.type === "spelling" ? "spell-error" : "grammar-error",
    }),
  );
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

    return {
      update(view: EditorView, prev: EditorState) {
        if (!view.state.doc.eq(prev.doc)) schedule(view);
      },
      destroy() {
        destroyed = true;
        if (timer !== null) { clearTimeout(timer); timer = null; }
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
