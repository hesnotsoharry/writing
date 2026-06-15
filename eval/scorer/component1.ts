/**
 * Component 1 — Mechanical Regex/Pattern Matcher (W46 design §1).
 *
 * Pure functions; no side effects, no imports outside this module tree.
 *
 * Operations (in order):
 *   1a. scoreOpener          — sycophantic filler opener (0 or 0.5)
 *   1b. scoreClicheDensity   — high-frequency AI cliché phrases (0–4)
 *   1c. scoreStructure       — sentence-structure uniformity (0–~2.5)
 *   1d. scoreLexical         — lexical poverty: TTR + MTLD + repetition (0–4)
 *
 * Final score = mean(1a, 1b, 1c, 1d).
 *
 * MTLD algorithm: McCarthy & Jarvis (2010) bidirectional factor-count at
 * TTR threshold 0.72. Reliable only for texts ≥ 500 words; skipped below
 * MTLD_MIN_WORDS.
 */

import type { Component1Breakdown, Component1Result } from "./types.ts";
import {
  ADJ_NOUN_CAP,
  ADJ_NOUN_REPEAT_THRESHOLD,
  ADJ_NOUN_SCORE,
  AI_NAME_REGEXES,
  AI_NAME_SCORE,
  ALL_CLICHE_PHRASES,
  CLICHE_BRACKET_LOW_MAX,
  CLICHE_BRACKET_MID_MAX,
  CLICHE_SCORE_HIGH,
  CLICHE_SCORE_LOW,
  CLICHE_SCORE_MID,
  CONSECUTIVE_BONUS,
  CONSECUTIVE_WINDOW,
  CONSECUTIVE_WORD_DIFF,
  EM_DASH_BONUS,
  EM_DASH_PER_PARA_THRESHOLD,
  EM_DASH_RE,
  HF_WORD_RATIO_THRESHOLD,
  HF_WORD_SCORE,
  HIGH_FREQ_WORDS,
  MTLD_AI_BAND_SCORE,
  MTLD_AI_FLOOR,
  MTLD_HUMAN_MIN,
  MTLD_MIN_WORDS,
  MTLD_SCORE_MAX,
  MTLD_THRESHOLD,
  NEGATION_AI_FLOOR,
  NEGATION_HUMAN_MAX,
  NEGATION_INVERSION_RE,
  NEGATION_MIN_TOKENS,
  NEGATION_SCORE_MAX,
  NOUN_REPEAT_CAP,
  NOUN_REPEAT_SCORE,
  NOUN_REPEAT_THRESHOLD,
  NOUN_REPEAT_WINDOW,
  OPENER_HIT_SCORE,
  OPENER_REGEX,
  SILENCE_FRAMING_BONUS,
  SILENCE_FRAMING_REGEX,
  STDDEV_BORDER_HIGH,
  STDDEV_BORDER_LOW,
  TRANSITION_BORDER_HIGH,
  TRANSITION_BORDER_LOW,
  TRANSITION_PARA_STARTERS,
  TRANSITION_SCORE_HEAVY,
  TTR_HUMAN_MIN,
  TTR_MIN_WORDS,
  TTR_SCORE_LOW,
  TTR_SCORE_SUSPICIOUS,
  TTR_SUSPICIOUS_LOW,
} from "./wordlists.ts";

// ── Shared utilities ──────────────────────────────────────────────────────────

/** Linear interpolation: maps x in [x0,x1] to y in [y0,y1]. Clamps at ends. */
function linearInterp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x <= Math.min(x0, x1)) return x0 <= x1 ? y0 : y1;
  if (x >= Math.max(x0, x1)) return x0 <= x1 ? y1 : y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

/** Split text into sentences on sentence-ending punctuation. */
export function segmentSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Split text into paragraphs on double-newline boundaries. */
export function segmentParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Tokenize text to an array of lowercase word tokens.
 * Strips punctuation except apostrophes and hyphens (contractions, hyphenates).
 */
export function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-z]/.test(w));
}

/** Population standard deviation of a numeric array. Returns 0 for < 2 values. */
export function computeStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ── 1a: Sycophantic Opener ────────────────────────────────────────────────────

/**
 * Score sub-detector 1a: sycophantic / filler opener.
 * Checks first 50 characters for the canonical opener regex (design §1a).
 * Returns 0.5 on match, 0.0 otherwise (binary signal).
 */
export function scoreOpener(text: string): number {
  const head = text.trimStart().slice(0, 50);
  return OPENER_REGEX.test(head) ? OPENER_HIT_SCORE : 0;
}

// ── 1b: Cliché Density ────────────────────────────────────────────────────────

/** Count total cliché phrase occurrences using case-insensitive substring match. */
function countClicheOccurrences(lower: string): number {
  let total = 0;
  for (const phrase of ALL_CLICHE_PHRASES) {
    let pos = 0;
    while ((pos = lower.indexOf(phrase, pos)) !== -1) {
      total++;
      pos += phrase.length;
    }
  }
  return total;
}

/**
 * Flat bracket scoring for cliché density (Decision 14: honor the table, defer interpolation).
 * d = 0 → 0.0 | 0 < d ≤ 5 → 1.0 | 5 < d ≤ 15 → 2.5 | d > 15 → 4.0
 */
function flatClicheScore(matchesPer100: number): number {
  if (matchesPer100 === 0) return 0;
  if (matchesPer100 <= CLICHE_BRACKET_LOW_MAX) return CLICHE_SCORE_LOW;
  if (matchesPer100 <= CLICHE_BRACKET_MID_MAX) return CLICHE_SCORE_MID;
  return CLICHE_SCORE_HIGH;
}

/**
 * Score sub-detector 1b: cliché density (0–4).
 * Includes the two documented-gap bonuses: silence-framing (+0.5/match)
 * and em-dash overuse structural bonus (handled in 1c).
 */
export function scoreClicheDensity(text: string): number {
  const lower = text.toLowerCase();
  const words = tokenizeWords(text);
  if (words.length === 0) return 0;

  const raw = countClicheOccurrences(lower);
  const matchesPer100 = (raw / words.length) * 100;
  const baseScore = flatClicheScore(matchesPer100);

  const silenceMatches = (text.match(SILENCE_FRAMING_REGEX) ?? []).length;
  const silenceBonus = silenceMatches * SILENCE_FRAMING_BONUS;

  return Math.min(CLICHE_SCORE_HIGH, baseScore + silenceBonus);
}

// ── 1c: Sentence-Structure Uniformity ────────────────────────────────────────

/** True if ≥ CONSECUTIVE_WINDOW consecutive sentences lie within ±CONSECUTIVE_WORD_DIFF words. */
function hasConsecutiveUniform(sentences: string[]): boolean {
  if (sentences.length < CONSECUTIVE_WINDOW) return false;
  const lengths = sentences.map((s) => tokenizeWords(s).length);
  for (let i = 0; i <= lengths.length - CONSECUTIVE_WINDOW; i++) {
    const window = lengths.slice(i, i + CONSECUTIVE_WINDOW);
    if (Math.max(...window) - Math.min(...window) <= CONSECUTIVE_WORD_DIFF) return true;
  }
  return false;
}

/**
 * Score sub-sub-detector 1c-i: sentence-length standard deviation.
 * Borderline band 3.5–5.5 → interpolate 0.0→2.0; below 3.5 → 2.0.
 * Consecutive uniformity bonus adds 0.5 if detected (design §1c-i).
 */
function scoreSentenceLength(sentences: string[]): number {
  if (sentences.length < 3) return 0;
  const lengths = sentences.map((s) => tokenizeWords(s).length);
  const stddev = computeStdDev(lengths);

  let base = 0;
  if (stddev < STDDEV_BORDER_LOW) {
    base = 2.0;
  } else if (stddev < STDDEV_BORDER_HIGH) {
    base = linearInterp(stddev, STDDEV_BORDER_HIGH, STDDEV_BORDER_LOW, 0, 2.0);
  }

  const bonus = hasConsecutiveUniform(sentences) ? CONSECUTIVE_BONUS : 0;
  return base + bonus;
}

/** True if the paragraph starts with any of the recognized transition words. */
function opensWith(para: string, starters: readonly string[]): boolean {
  const lower = para.toLowerCase().trimStart();
  return starters.some((s) => lower.startsWith(s));
}

/**
 * Score sub-sub-detector 1c-ii: transition word paragraph-opening abuse (0–2).
 * Decision 14 flat bands: < 20% → 0.0 | 20–39% → 1.0 | ≥ 40% → 2.0.
 */
export function scoreTransitions(paragraphs: string[]): number {
  if (paragraphs.length === 0) return 0;
  const count = paragraphs.filter((p) => opensWith(p, TRANSITION_PARA_STARTERS)).length;
  const ratio = count / paragraphs.length;
  if (ratio < TRANSITION_BORDER_LOW) return 0;
  if (ratio < TRANSITION_BORDER_HIGH) return 1.0;
  return TRANSITION_SCORE_HEAVY;
}

/**
 * Score sub-sub-detector 1c-iii: negation-inversion pattern (0–2).
 * Normalized per 1000 tokens. Skipped for texts < NEGATION_MIN_TOKENS.
 */
function scoreNegation(text: string, wordCount: number): number {
  if (wordCount < NEGATION_MIN_TOKENS) return 0;
  const matches = (text.match(NEGATION_INVERSION_RE) ?? []).length;
  const per1000 = (matches / wordCount) * 1000;
  if (per1000 <= NEGATION_HUMAN_MAX) return 0;
  if (per1000 >= NEGATION_AI_FLOOR) return NEGATION_SCORE_MAX;
  return linearInterp(per1000, NEGATION_HUMAN_MAX, NEGATION_AI_FLOOR, 0, NEGATION_SCORE_MAX);
}

/** Average em-dashes per paragraph; returns bonus if above threshold. */
function computeEmDashBonus(text: string): number {
  const paragraphs = segmentParagraphs(text);
  if (paragraphs.length === 0) return 0;
  const dashes = paragraphs.map((p) => (p.match(EM_DASH_RE) ?? []).length);
  const mean = dashes.reduce((s, d) => s + d, 0) / paragraphs.length;
  return mean > EM_DASH_PER_PARA_THRESHOLD ? EM_DASH_BONUS : 0;
}

/**
 * Score sub-detector 1c: sentence-structure uniformity (0–~2.5).
 * Average of sentence-length stddev, transition overuse, and negation inversion,
 * plus the em-dash prose-texture bonus (design §1c).
 */
export function scoreStructureUniformity(text: string): number {
  const sentences = segmentSentences(text);
  const paragraphs = segmentParagraphs(text);
  const words = tokenizeWords(text);

  const lengthScore = scoreSentenceLength(sentences);
  const transitionScore = scoreTransitions(paragraphs);
  const negationScore = scoreNegation(text, words.length);
  const emBonus = computeEmDashBonus(text);

  const base = (lengthScore + transitionScore + negationScore) / 3;
  return base + emBonus;
}

// ── 1d: Lexical Poverty ───────────────────────────────────────────────────────

/** Type-Token Ratio: unique lowercase types / total tokens. */
export function computeTTR(words: string[]): number {
  if (words.length === 0) return 1;
  return new Set(words).size / words.length;
}

/**
 * Map TTR value to a flag score per design §1d-i thresholds (Decision 14: flat bands).
 * ≥ 0.55 → 0.0 | 0.40–0.55 → 1.5 | < 0.40 → 3.0
 */
export function scoreTTRValue(ttr: number): number {
  if (ttr >= TTR_HUMAN_MIN) return 0;
  if (ttr >= TTR_SUSPICIOUS_LOW) return TTR_SCORE_SUSPICIOUS;
  return TTR_SCORE_LOW;
}

/**
 * MTLD forward (or backward) pass: counts factors where a running word
 * sequence maintains TTR above MTLD_THRESHOLD (0.72, McCarthy & Jarvis 2010).
 * A partial factor at the end is added as a fractional count.
 * Returns the average factor length (total words / total factor count),
 * or words.length when factorCount is effectively 0 (all unique words).
 */
export function computeMTLDOneDirection(words: string[]): number {
  let factorCount = 0;
  let currentTypes = new Set<string>();
  let currentTokens = 0;

  for (const word of words) {
    currentTypes.add(word);
    currentTokens++;
    const ttr = currentTypes.size / currentTokens;
    if (ttr <= MTLD_THRESHOLD) {
      factorCount += 1;
      currentTypes = new Set<string>();
      currentTokens = 0;
    }
  }

  if (currentTokens > 0) {
    const ttr = currentTypes.size / currentTokens;
    factorCount += (1 - ttr) / (1 - MTLD_THRESHOLD);
  }

  if (factorCount < 1e-9) return words.length; // all-unique text → very high MTLD
  return words.length / factorCount;
}

/**
 * Bidirectional MTLD: average of forward and backward passes.
 * Standard McCarthy & Jarvis (2010) implementation.
 */
export function computeMTLD(words: string[]): number {
  const forward = computeMTLDOneDirection(words);
  const backward = computeMTLDOneDirection([...words].reverse());
  return (forward + backward) / 2;
}

/**
 * Map MTLD value to a flag score per design §1d-ii thresholds (Decision 14: flat bands).
 * ≥ 80 → 0.0 | 45–79 → 2.5 (gap 75–80 closed upward into the AI band) | < 45 → 4.0
 */
export function scoreMTLDValue(mtld: number): number {
  if (mtld >= MTLD_HUMAN_MIN) return 0;
  if (mtld >= MTLD_AI_FLOOR) return MTLD_AI_BAND_SCORE;
  return MTLD_SCORE_MAX;
}

/**
 * Compute diversity score from TTR and/or MTLD depending on text length.
 * Returns null when text is too short for any valid measure.
 */
function computeDiversityScore(words: string[]): number | null {
  const n = words.length;
  const ttrScore = n >= TTR_MIN_WORDS ? scoreTTRValue(computeTTR(words)) : null;
  const mtldScore = n >= MTLD_MIN_WORDS ? scoreMTLDValue(computeMTLD(words)) : null;

  if (ttrScore !== null && mtldScore !== null) return (ttrScore + mtldScore) / 2;
  if (ttrScore !== null) return ttrScore;
  if (mtldScore !== null) return mtldScore;
  return null;
}

/** Filter to content words: non-stop-words of length > 3 containing a letter. */
function getContentWords(words: string[]): string[] {
  return words.filter((w) => w.length > 3 && !HIGH_FREQ_WORDS.has(w) && /[a-z]/.test(w));
}

/**
 * Count distinct content words that appear ≥ NOUN_REPEAT_THRESHOLD times
 * within any NOUN_REPEAT_WINDOW-sentence sliding window (design §1d-iii).
 */
function countNounRepetitions(sentences: string[]): number {
  const windowSize = Math.min(NOUN_REPEAT_WINDOW, sentences.length);
  const flagged = new Set<string>();
  for (let i = 0; i <= sentences.length - windowSize; i++) {
    const windowText = sentences.slice(i, i + windowSize).join(" ");
    const words = getContentWords(tokenizeWords(windowText));
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    for (const [w, cnt] of freq) {
      if (cnt >= NOUN_REPEAT_THRESHOLD) flagged.add(w);
    }
  }
  return Math.min(flagged.size * NOUN_REPEAT_SCORE, NOUN_REPEAT_CAP);
}

/**
 * Count unique content-word bigrams that repeat ≥ ADJ_NOUN_REPEAT_THRESHOLD
 * times (proxy for adjective-noun pair repetition, design §1d-iii).
 */
function countAdjNounPairs(words: string[]): number {
  const pairCounts = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i], w2 = words[i + 1];
    if (HIGH_FREQ_WORDS.has(w1) || HIGH_FREQ_WORDS.has(w2)) continue;
    if (w1.length < 3 || w2.length < 3) continue;
    const pair = `${w1} ${w2}`;
    pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
  }
  let flagged = 0;
  for (const count of pairCounts.values()) {
    if (count >= ADJ_NOUN_REPEAT_THRESHOLD) flagged++;
  }
  return Math.min(flagged * ADJ_NOUN_SCORE, ADJ_NOUN_CAP);
}

/** Count AI character name matches (design §1d-iii, Category 5). */
function countAiNames(text: string): number {
  let score = 0;
  for (const re of AI_NAME_REGEXES) {
    if (re.test(text)) score += AI_NAME_SCORE;
  }
  return score;
}

/**
 * Aggregate lexical repetition bonus from three signals (design §1d-iii):
 * noun repetition, adj-noun pair repetition, high-freq word dominance, AI names.
 */
function scoreRepetitionBonus(sentences: string[], words: string[], text: string): number {
  const nounFlag = countNounRepetitions(sentences);
  const pairFlag = countAdjNounPairs(words);
  const contentWords = words.filter((w) => !HIGH_FREQ_WORDS.has(w));
  const hfRatio = words.length > 0 ? (words.length - contentWords.length) / words.length : 0;
  const hfFlag = hfRatio > HF_WORD_RATIO_THRESHOLD ? HF_WORD_SCORE : 0;
  const nameFlag = countAiNames(text);
  return nounFlag + pairFlag + hfFlag + nameFlag;
}

/**
 * Score sub-detector 1d: lexical poverty (0–4).
 * Combines TTR/MTLD diversity score with repetition bonus (design §1d).
 */
export function scoreLexicalPoverty(text: string): number {
  const words = tokenizeWords(text);
  const sentences = segmentSentences(text);
  const diversityScore = computeDiversityScore(words) ?? 0;
  const repetitionBonus = scoreRepetitionBonus(sentences, words, text);
  return Math.min(4, diversityScore + repetitionBonus);
}

// ── Component 1 Aggregator ────────────────────────────────────────────────────

/**
 * Run all four sub-detectors and average into Component1_score (0–4).
 * Formula: mean(opener, cliche, structure, lexical) per design §1.
 */
export function scoreComponent1(text: string): Component1Result {
  const opener = scoreOpener(text);
  const cliche = scoreClicheDensity(text);
  const structure = scoreStructureUniformity(text);
  const lexical = scoreLexicalPoverty(text);

  const score = (opener + cliche + structure + lexical) / 4;

  const breakdown: Component1Breakdown = { opener, cliche, structure, lexical };
  return { score, breakdown };
}
