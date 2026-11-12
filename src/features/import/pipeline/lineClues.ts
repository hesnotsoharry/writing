/**
 * lineClues.ts — the text patterns and visual features the classifier groups by,
 * and the plain-English labels the import preview shows for each group.
 */
import type { ImportLine } from "./importLine";

const UNITS = "one|two|three|four|five|six|seven|eight|nine";
const TEENS = "ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen";
const TENS = "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety";
const NUMBER_WORD = `(?:(?:${TENS})(?:[- ](?:${UNITS}))?|${TEENS}|${UNITS}|hundred)`;
const NUMBER = `(?:\\d{1,4}|[ivxlcdm]{1,8}|${NUMBER_WORD})`;
const END = "(?=$|[\\s:.\\-–—,])";

/** Checked in order; the first match names the group. */
export const PATTERNS: [string, RegExp][] = [
  ["part", new RegExp(`^(?:part|book|act|volume)\\s+${NUMBER}${END}`, "i")],
  ["chapter", new RegExp(`^(?:chapter|chap\\.|ch\\.)\\s*${NUMBER}${END}`, "i")],
  ["chapter", /^(?:prologue|epilogue|interlude|afterword|foreword|preface|introduction)(?=$|[\s:.\-–—,])/i],
  ["number", new RegExp(`^${NUMBER}\\.?$`, "i")],
];

const FEATURES: [string, (l: ImportLine) => boolean][] = [
  ["page", (l) => l.pageBreakBefore],
  ["large", (l) => l.relSize >= 1.15],
  ["bold", (l) => l.bold],
  ["caps", (l) => l.caps],
  ["centred", (l) => l.centered],
];

/** The visual features that make a short line look like a title, in a fixed order. */
export function lookFeatures(line: ImportLine): string[] {
  return FEATURES.filter(([, has]) => has(line)).map(([name]) => name);
}

const WEIGHT: Record<string, number> = { page: 1.5, large: 2, bold: 1, caps: 1, centred: 1 };

/** How strongly a look group reads as a heading; used to rank chapters over scenes. */
export function lookStrength(key: string): number {
  return key.slice("look:".length).split("+").reduce((n, f) => n + (WEIGHT[f] ?? 0), 0);
}

const FEATURE_WORDS: Record<string, string> = { large: "larger", bold: "bold", caps: "all-caps", centred: "centred" };

const FIXED_LABELS: Record<string, string> = {
  "pattern:chapter": "Lines like “Chapter 7” or “Prologue”",
  "pattern:part": "Lines like “Part Two” or “Book One”",
  "pattern:number": "Lines that are just a number (“12”, “IV”)",
  break: "Scene breaks (“* * *”, “#”)",
  "list:0": "Top-level bullets",
  "list:1": "Second-level bullets",
  "list:2": "Third-level bullets",
  "list:3": "Deeper bullets",
};

const joinWords = (w: string[]) => (w.length > 1 ? `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}` : w[0]);

/** e.g. "Short bold, larger and centred lines at the top of a page". */
function lookLabel(features: string[]): string {
  const adjectives = features.filter((f) => f !== "page").map((f) => FEATURE_WORDS[f]);
  const page = features.includes("page") ? " at the top of a page" : "";
  return adjectives.length > 0 ? `Short ${joinWords(adjectives)} lines${page}` : `Short lines${page}`;
}

export function groupLabel(key: string): string {
  if (FIXED_LABELS[key]) return FIXED_LABELS[key];
  if (key.startsWith("level:")) return `Heading ${key.slice("level:".length)} lines`;
  return lookLabel(key.slice("look:".length).split("+"));
}
