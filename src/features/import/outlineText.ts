/**
 * outlineText.ts — flatten outline HTML elements (as produced by mammoth from a
 * .docx) into the plain-text lines stored in a scene synopsis.
 */

/** Collapse runs of whitespace and trim. */
export function cleanText(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Text of an element excluding any nested lists (a list item's own label). */
export function ownText(el: Element): string {
  const parts: string[] = [];
  el.childNodes.forEach((node) => {
    if (node instanceof Element && (node.tagName === "UL" || node.tagName === "OL")) return;
    parts.push(node.textContent ?? "");
  });
  return cleanText(parts.join(""));
}

/** Direct child elements matching a tag name (upper-case). */
export function childrenByTag(el: Element, tag: string): Element[] {
  return Array.from(el.children).filter((c) => c.tagName === tag);
}

function listLines(list: Element, depth: number, out: string[]): void {
  for (const li of childrenByTag(list, "LI")) {
    const label = ownText(li);
    if (label) out.push(`${"  ".repeat(depth)}• ${label}`);
    for (const nested of Array.from(li.children)) {
      if (nested.tagName === "UL" || nested.tagName === "OL") listLines(nested, depth + 1, out);
    }
  }
}

function tableLines(table: Element, out: string[]): void {
  for (const row of Array.from(table.querySelectorAll("tr"))) {
    const cells = Array.from(row.children).map((c) => cleanText(c.textContent)).filter(Boolean);
    if (cells.length > 0) out.push(cells.join(" | "));
  }
}

/** The synopsis lines one top-level element contributes (empty when it has no text). */
export function elementLines(el: Element): string[] {
  const out: string[] = [];
  if (el.tagName === "UL" || el.tagName === "OL") listLines(el, 0, out);
  else if (el.tagName === "TABLE") tableLines(el, out);
  else {
    const text = cleanText(el.textContent);
    if (text) out.push(text);
  }
  return out;
}

/** Join synopsis lines; null when there is nothing to store. */
export function toSynopsis(lines: readonly string[]): string | null {
  const text = lines.join("\n").trim();
  return text ? text : null;
}
