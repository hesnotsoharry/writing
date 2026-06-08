/**
 * AutoLink TipTap extension — read-only decoration layer that highlights
 * Story Bible entity names in prose with a CSS class `al-link`.
 *
 * Architecture:
 * - A ProseMirror Plugin holds a DecorationSet as plugin state.
 * - `state.apply` maps decorations through transactions; rebuilds on meta.
 * - A debounced `pluginView.update` schedules rebuilds after doc changes so
 *   typing is never synchronously delayed by decoration computation.
 * - No doc mutations, no schema changes, no key handlers — pure decoration.
 *
 * Spec: design-reference/AUTOLINK-SPEC.md, design-reference/autolink.jsx.
 */

import { Extension } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

import type { AlIndex } from "../../lib/alBuildIndex";
import { alBuildMatcher } from "../../lib/alBuildIndex";

// ---------------------------------------------------------------------------
// Plugin key + spec types
// ---------------------------------------------------------------------------

export const autolinkKey = new PluginKey<DecorationSet>("autolink");

/** Stored on each inline Decoration so hover handlers can read entity metadata. */
export interface AutoLinkDecoSpec {
  autolinkEntityId: string;
  autolinkEntityType: string;
  autolinkEntityName: string;
}

export interface AutoLinkConfig {
  alIndex: AlIndex | null;
  autolinkOn: boolean;
  autolinkTypes: string[];
  autolinkScope: "all" | "first";
}

// ---------------------------------------------------------------------------
// scanNodeDecorations — collect decorations from one text node.
// ---------------------------------------------------------------------------

interface NodeScanMatcher {
  re: RegExp;
  byVariant: ReturnType<typeof alBuildMatcher>["byVariant"];
}

function scanNodeDecorations(
  text: string,
  pos: number,
  matcher: NodeScanMatcher,
  seen: Set<string> | null,
): Decoration[] {
  const out: Decoration[] = [];
  matcher.re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = matcher.re.exec(text)) !== null) {
    const matched = m[1] ?? m[0];
    const entry = matcher.byVariant.get(matched);
    if (!entry) continue;
    // autolinkScope="first": skip subsequent mentions of the same entity.
    if (seen !== null) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
    }
    const from = pos + m.index;
    const to = from + matched.length;
    const spec: AutoLinkDecoSpec = {
      autolinkEntityId: entry.id,
      autolinkEntityType: entry.type,
      autolinkEntityName: entry.name,
    };
    out.push(Decoration.inline(from, to, {
      class: "al-link",
      "data-entity-id": entry.id,
      "data-entity-type": entry.type,
      "data-entity-name": entry.name,
    }, spec));
  }
  return out;
}

// ---------------------------------------------------------------------------
// buildDecorations — entry point for the plugin state.
// ---------------------------------------------------------------------------

export function buildDecorations(
  doc: ProseMirrorNode,
  cfg: AutoLinkConfig,
): DecorationSet {
  if (!cfg.autolinkOn || !cfg.alIndex || cfg.alIndex.entries.length === 0) {
    return DecorationSet.empty;
  }
  // Always build the Set — empty autolinkTypes (all chips off) must produce
  // zero filtered entries and therefore zero decorations.  The previous
  // `length > 0 ? Set : null` guard inverted the UI contract: [] → null →
  // bypass filter → link ALL types.
  const allowedTypes = new Set(cfg.autolinkTypes);
  const filtered = cfg.alIndex.entries.filter((e) => allowedTypes.has(e.type));
  if (filtered.length === 0) return DecorationSet.empty;

  const pseudo = filtered.map((e) => ({
    id: e.id, projectId: "", type: e.type, name: e.name, notes: null,
    aliases: e.aliases ?? null,
  }));
  const { re, byVariant } = alBuildMatcher(pseudo);
  if (!re) return DecorationSet.empty;

  // "first" scope: one Set per buildDecorations call, reset each pass.
  const seen: Set<string> | null = cfg.autolinkScope === "first" ? new Set<string>() : null;
  // After the null guard above, re is narrowed to RegExp (non-null).
  const matcher: NodeScanMatcher = { re, byVariant };
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    decorations.push(...scanNodeDecorations(node.text, pos, matcher, seen));
  });
  return DecorationSet.create(doc, decorations);
}

// ---------------------------------------------------------------------------
// Plugin state helpers.
// ---------------------------------------------------------------------------

function applyPluginState(
  tr: Transaction,
  old: DecorationSet,
  currentConfig: { value: AutoLinkConfig },
): DecorationSet {
  const meta = tr.getMeta(autolinkKey) as AutoLinkConfig | undefined;
  if (meta !== undefined) {
    currentConfig.value = meta;
    return buildDecorations(tr.doc, meta);
  }
  return tr.docChanged ? old.map(tr.mapping, tr.doc) : old;
}

// ---------------------------------------------------------------------------
// Plugin view — debounced rebuild after doc changes.
// ---------------------------------------------------------------------------

interface PluginViewInstance {
  update(view: EditorView, prevState: EditorState): void;
  destroy(): void;
}

function makePluginView(currentConfig: { value: AutoLinkConfig }): () => PluginViewInstance {
  return () => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function schedule(view: EditorView): void {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (destroyed) return;
        view.dispatch(view.state.tr.setMeta(autolinkKey, currentConfig.value));
      }, 300);
    }

    return {
      update(view: EditorView, prevState: EditorState): void {
        if (!view.state.doc.eq(prevState.doc)) schedule(view);
      },
      destroy(): void {
        destroyed = true;
        if (timer !== null) { clearTimeout(timer); timer = null; }
      },
    };
  };
}

// ---------------------------------------------------------------------------
// Plugin factory.
// ---------------------------------------------------------------------------

function createAutolinkPlugin(config: AutoLinkConfig): Plugin {
  const currentConfig = { value: { ...config } };
  return new Plugin<DecorationSet>({
    key: autolinkKey,
    state: {
      init(_cfg, state) { return buildDecorations(state.doc, currentConfig.value); },
      apply(tr, old) { return applyPluginState(tr, old, currentConfig); },
    },
    props: {
      decorations(state) { return autolinkKey.getState(state); },
    },
    view: makePluginView(currentConfig),
  });
}

// ---------------------------------------------------------------------------
// TipTap Extension.
// ---------------------------------------------------------------------------

const AutoLinkExtension = Extension.create<AutoLinkConfig>({
  name: "autolink",
  addOptions() {
    return { alIndex: null, autolinkOn: true, autolinkTypes: [], autolinkScope: "all" as const };
  },
  addProseMirrorPlugins() {
    return [createAutolinkPlugin(this.options)];
  },
});

export default AutoLinkExtension;
export { alBuildMatcher };
