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
}

// ---------------------------------------------------------------------------
// scanNodeDecorations — collect decorations from one text node.
// ---------------------------------------------------------------------------

function scanNodeDecorations(
  text: string,
  pos: number,
  re: RegExp,
  matchMap: ReturnType<typeof alBuildMatcher>["byVariant"],
): Decoration[] {
  const out: Decoration[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const matched = m[1] ?? m[0];
    const entry = matchMap.get(matched);
    if (!entry) continue;
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
  const allowedTypes = cfg.autolinkTypes.length > 0
    ? new Set(cfg.autolinkTypes) : null;
  const filtered = allowedTypes
    ? cfg.alIndex.entries.filter((e) => allowedTypes.has(e.type))
    : cfg.alIndex.entries;
  if (filtered.length === 0) return DecorationSet.empty;

  const pseudo = filtered.map((e) => ({
    id: e.id, projectId: "", type: e.type, name: e.name, notes: null,
    aliases: e.aliases ?? null,
  }));
  const { re, byVariant } = alBuildMatcher(pseudo);
  if (!re) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    decorations.push(...scanNodeDecorations(node.text, pos, re, byVariant));
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
    return { alIndex: null, autolinkOn: true, autolinkTypes: [] };
  },
  addProseMirrorPlugins() {
    return [createAutolinkPlugin(this.options)];
  },
});

export default AutoLinkExtension;
export { alBuildMatcher };
