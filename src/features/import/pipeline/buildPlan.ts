/**
 * buildPlan.ts — classified lines + each group's role → chapters and scenes.
 *
 *  - "chapter" lines start a chapter; "scene" lines start a titled scene in it;
 *    "split" lines (scene breaks) start an untitled scene; everything else is text.
 *  - Text goes into the scene's synopsis (outline mode) or its text (draft mode).
 *  - Untitled scenes: the only scene in a chapter takes the chapter's name; text
 *    under a chapter before its first titled scene is "Chapter notes" in outline
 *    mode; any other untitled scene is "Scene N".
 *  - Text before the first chapter becomes one short piece ("Outline notes" or
 *    "Front matter"). With no chapters at all, everything lands in one
 *    "Imported" chapter so nothing is ever dropped.
 */
import {
  CHAPTER_NOTES_TITLE, FALLBACK_CHAPTER_TITLE, FRONT_MATTER_TITLE, MAX_TITLE, OUTLINE_NOTES_TITLE, type OutlineChapter,
  type OutlinePlan, type OutlineScene, wordCount,
} from "../outlinePlan";
import type { Classification, Role } from "./classify";
import type { ImportLine } from "./importLine";

/** Where text under a scene goes. */
export type BodyMode = "synopsis" | "scene";

/** Role per group key — the classifier's guesses, possibly changed by the user. */
export type RoleMap = Record<string, Role>;

export const defaultRoles = (c: Classification): RoleMap => Object.fromEntries(c.groups.map((g) => [g.key, g.role]));

interface Segment { title: string | null; lines: ImportLine[] }
interface DraftChapter { title: string; segments: Segment[] }

const clip = (t: string) => (t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE - 1)}…` : t);

/** A text line as it reads in a synopsis or a paragraph: bullets keep their depth. */
function renderLine(line: ImportLine): string {
  return line.listLevel === null ? line.text : `${"  ".repeat(line.listLevel)}• ${line.text}`;
}

function sceneFrom(title: string, lines: ImportLine[], mode: BodyMode): OutlineScene {
  const rendered = lines.map(renderLine);
  if (mode === "scene") return { title, synopsis: null, body: rendered.length ? rendered : null };
  return { title, synopsis: rendered.length ? rendered.join("\n") : null, body: null };
}

function untitledName(ch: DraftChapter, index: number, kept: Segment[], mode: BodyMode): string {
  if (kept.length === 1) return ch.title;
  const titledLater = kept.some((s) => s.title !== null);
  if (mode === "synopsis" && index === 0 && titledLater) return CHAPTER_NOTES_TITLE;
  return `Scene ${index + 1}`;
}

function finishChapter(ch: DraftChapter, mode: BodyMode): OutlineChapter {
  const kept = ch.segments.filter((s) => s.title !== null || s.lines.length > 0);
  const scenes = kept.map((seg, i) => sceneFrom(seg.title ?? untitledName(ch, i, kept, mode), seg.lines, mode));
  return { title: ch.title, scenes };
}

interface Walk { chapters: DraftChapter[]; front: ImportLine[] }

function current(w: Walk): DraftChapter {
  if (w.chapters.length === 0) w.chapters.push({ title: FALLBACK_CHAPTER_TITLE, segments: [{ title: null, lines: [] }] });
  return w.chapters[w.chapters.length - 1];
}

function step(w: Walk, line: ImportLine, role: Role | undefined, anyChapters: boolean): void {
  if (role === "chapter") { w.chapters.push({ title: clip(line.text), segments: [{ title: null, lines: [] }] }); return; }
  if (role === "scene") { current(w).segments.push({ title: clip(line.text), lines: [] }); return; }
  if (role === "split") {
    if (w.chapters.length > 0 || !anyChapters) current(w).segments.push({ title: null, lines: [] });
    return;
  }
  if (w.chapters.length === 0 && anyChapters) { w.front.push(line); return; }
  const segs = current(w).segments;
  segs[segs.length - 1].lines.push(line);
}

/** Build the plan for the given roles and body mode. Never throws; see planProblem. */
export function buildPlan(c: Classification, roles: RoleMap, mode: BodyMode): OutlinePlan {
  const roleOf = (i: number) => { const k = c.groupKey[i]; return k ? roles[k] : undefined; };
  const anyChapters = c.lines.some((_, i) => roleOf(i) === "chapter");
  const w: Walk = { chapters: [], front: [] };
  c.lines.forEach((line, i) => step(w, line, roleOf(i), anyChapters));
  const notesTitle = mode === "synopsis" ? OUTLINE_NOTES_TITLE : FRONT_MATTER_TITLE;
  return {
    chapters: w.chapters.map((ch) => finishChapter(ch, mode)),
    notes: w.front.length > 0 ? sceneFrom(notesTitle, w.front, mode) : null,
  };
}

/** Prose or notes? Long paragraphs of real sentences mean a draft. */
export function guessBodyMode(c: Classification): BodyMode {
  const text = c.lines.filter((_, i) => c.groupKey[i] === null && c.lines[i].listLevel === null);
  const words = text.reduce((n, l) => n + wordCount(l.text), 0);
  return words >= 300 && words / Math.max(text.length, 1) >= 25 ? "scene" : "synopsis";
}
