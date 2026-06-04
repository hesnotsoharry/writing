/**
 * Pure export formatters — no DOM, no Tauri, vitest-safe.
 * toDocx and toPdf will be added in Phase 2.
 */

/** Render blocks as Markdown with an H1 title header. */
export function toMarkdown(blocks: string[], title: string): string {
  const header = `# ${title}`;
  if (blocks.length === 0) return header;
  return [header, ...blocks].join("\n\n");
}
