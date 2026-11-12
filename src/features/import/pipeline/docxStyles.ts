/**
 * docxStyles.ts — read word/styles.xml into resolved paragraph and run styles.
 *
 * Word stores most formatting on styles, inherited through `basedOn` chains and
 * the document defaults. A custom "Chapter Title" style with an outline level is
 * as much a chapter heading as Heading 1, so levels come from `outlineLvl` first
 * and from the "heading N" name second.
 */
export const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/** Formatting a style or paragraph sets. `undefined` = not set here (inherit). */
export interface Fmt {
  level?: number | null;
  bold?: boolean;
  italic?: boolean;
  caps?: boolean;
  centered?: boolean;
  /** Font size in half-points. */
  size?: number;
  /** null = explicitly not a list (numId 0). */
  listLevel?: number | null;
  pageBreakBefore?: boolean;
}

export interface ResolvedStyle extends Fmt { name: string | null }

export interface DocxStyles {
  byId: Map<string, ResolvedStyle>;
  /** The default paragraph style's id ("Normal" in most files). */
  defaultParagraph: string | null;
  /** Body text size in half-points, the base for ImportLine.relSize. */
  bodySize: number;
}

const OFF = new Set(["0", "false", "off", "none"]);

export function wChild(el: Element | null | undefined, name: string): Element | null {
  if (!el) return null;
  for (const c of Array.from(el.children)) if (c.namespaceURI === W && c.localName === name) return c;
  return null;
}

export function wVal(el: Element | null): string | null {
  return el ? el.getAttributeNS(W, "val") : null;
}

function onOff(el: Element | null): boolean | undefined {
  if (!el) return undefined;
  const v = wVal(el);
  return v === null || !OFF.has(v.toLowerCase());
}

export function runFmt(rPr: Element | null): Fmt {
  const size = wVal(wChild(rPr, "sz"));
  return {
    bold: onOff(wChild(rPr, "b")), italic: onOff(wChild(rPr, "i")),
    caps: onOff(wChild(rPr, "caps")) ?? onOff(wChild(rPr, "smallCaps")),
    size: size ? Number(size) : undefined,
  };
}

function listLevelOf(pPr: Element | null): number | null | undefined {
  const numPr = wChild(pPr, "numPr");
  if (!numPr) return undefined;
  if (wVal(wChild(numPr, "numId")) === "0") return null;
  return Number(wVal(wChild(numPr, "ilvl")) ?? 0);
}

export function paraFmt(pPr: Element | null): Fmt {
  const outline = wVal(wChild(pPr, "outlineLvl"));
  const jc = wVal(wChild(pPr, "jc"));
  let level: number | null | undefined;
  if (outline !== null) level = Number(outline) < 9 ? Number(outline) + 1 : null;
  return {
    level, listLevel: listLevelOf(pPr), pageBreakBefore: onOff(wChild(pPr, "pageBreakBefore")),
    centered: jc === null ? undefined : jc === "center",
  };
}

/** Fields set on `own` win; the rest come from `base`. */
export function mergeFmt<T extends Fmt>(own: T, base: Fmt): T {
  const out: Fmt = { ...base };
  for (const [k, v] of Object.entries(own)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out as T;
}

const levelFromName = (name: string | null) => {
  const m = name?.match(/^heading\s*([1-9])$/i);
  return m ? Number(m[1]) : undefined;
};

interface RawStyle { name: string | null; basedOn: string | null; fmt: Fmt; isDefault: boolean; type: string | null }

function readRawStyle(el: Element): [string, RawStyle] {
  const name = wVal(wChild(el, "name"));
  const fmt = mergeFmt(paraFmt(wChild(el, "pPr")), runFmt(wChild(el, "rPr")));
  const dflt = el.getAttributeNS(W, "default");
  return [el.getAttributeNS(W, "styleId") ?? "", {
    name, basedOn: wVal(wChild(el, "basedOn")), fmt, type: el.getAttributeNS(W, "type"),
    isDefault: dflt !== null && !OFF.has(dflt.toLowerCase()),
  }];
}

function resolveAll(raw: Map<string, RawStyle>, defaults: Fmt): Map<string, ResolvedStyle> {
  const done = new Map<string, ResolvedStyle>();
  const resolve = (id: string, depth: number): Fmt => {
    const r = raw.get(id);
    if (!r || depth > 12) return defaults;
    const cached = done.get(id);
    if (cached) return cached;
    const merged = mergeFmt(r.fmt, r.basedOn ? resolve(r.basedOn, depth + 1) : defaults);
    const style: ResolvedStyle = { ...merged, name: r.name, level: merged.level ?? levelFromName(r.name) };
    done.set(id, style);
    return style;
  };
  for (const id of raw.keys()) resolve(id, 0);
  return done;
}

function docDefaults(doc: Document | null): Fmt {
  const dd = doc?.getElementsByTagNameNS(W, "docDefaults")[0] ?? null;
  const rPr = wChild(wChild(dd, "rPrDefault"), "rPr");
  const pPr = wChild(wChild(dd, "pPrDefault"), "pPr");
  return mergeFmt(paraFmt(pPr), runFmt(rPr));
}

function readRawStyles(doc: Document | null): Map<string, RawStyle> {
  const raw = new Map<string, RawStyle>();
  if (!doc) return raw;
  for (const el of Array.from(doc.getElementsByTagNameNS(W, "style"))) {
    const [id, style] = readRawStyle(el);
    if (id) raw.set(id, style);
  }
  return raw;
}

/** Parse styles.xml; a missing or broken file yields defaults only. */
export function parseDocxStyles(xml: string | null): DocxStyles {
  const doc = xml ? new DOMParser().parseFromString(xml, "application/xml") : null;
  const defaults = docDefaults(doc);
  const raw = readRawStyles(doc);
  const byId = resolveAll(raw, defaults);
  const defaultParagraph = [...raw].find(([, r]) => r.isDefault && r.type === "paragraph")?.[0] ?? null;
  const normalSize = defaultParagraph ? byId.get(defaultParagraph)?.size : undefined;
  return { byId, defaultParagraph, bodySize: normalSize ?? defaults.size ?? 20 };
}
