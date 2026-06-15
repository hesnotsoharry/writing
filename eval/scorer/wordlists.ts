/**
 * Component 1 pattern library — source-of-truth transcription from
 * wave-46-scorer-wordlists.md (categories 1–5) and wave-46-scorer-design.md.
 * All numeric thresholds are named constants for testability.
 *
 * Operations (in use order):
 *   1. OPENER_REGEX            — 1a sycophantic opener check
 *   2. ALL_CLICHE_PHRASES      — 1b cliché density (tiers A–E combined)
 *   3. SILENCE_FRAMING_REGEX   — 1b sensory cliché bonus (+0.5 per match)
 *   4. EM_DASH_RE              — 1c structure bonus (prose texture)
 *   5. NEGATION_INVERSION_RE   — 1c-iii negation-inversion pattern
 *   6. TRANSITION_PARA_STARTERS — 1c-ii paragraph-opening connectors
 *   7. HIGH_FREQ_WORDS         — 1d lexical poverty (stop word list)
 *   8. AI_NAME_REGEXES         — 1d-iii proper-noun clichés
 */

// ── Category 1: Sycophantic / Filler Openers ─────────────────────────────────
// Applied case-insensitively to the first ~50 characters (wordlists.md §1).

export const OPENER_REGEX =
  /^(In\s+today's\s+[\w-]+\s+world|Whether\s+you're|Sure\s*[,.]|Certainly\s*[,.]|Of\s+course\s*[,.]|I'd\s+be\s+happy\s+to|This\s+is\s+a\s+beautifully\s+written|What\s+a\s+compelling|I'd\s+be\s+delighted\s+to|It\s+is\s+important\s+to\s+(?:consider|note)|Aims\s+to|Seeks\s+to|Let\s+me|Allow\s+me|That\s+being\s+said|At\s+its\s+core|To\s+put\s+it\s+simply|From\s+a\s+broader\s+perspective)/i;

export const OPENER_HIT_SCORE = 0.5;

// ── Category 2: High-Frequency AI Cliché Phrases ─────────────────────────────
// Tier A: Ultra-Common Clichés (wordlists.md §2, Tier A)

export const CLICHE_TIER_A: readonly string[] = [
  "tapestry of",
  "a sense of",
  "delve",
  "voice barely above a whisper",
  "the reader is left wondering",
  "a profound sense",
  "unsettling",
  "shimmer",
  "testament to",
  "beacon of hope",
  "beacon of light",
  "realm of",
  "symphony of",
  "kaleidoscope of",
  "vivid imagery",
  "rich and immersive",
  "emotional resonance",
  "shows great promise",
];

// Tier B: Overused Verbs (wordlists.md §2, Tier B — substring roots for morphological match)
export const CLICHE_TIER_B: readonly string[] = [
  "leverage",
  "utiliz",
  "illuminat",
  "navigat",
  "transcend",
  "revolutioniz",
  "unleash",
  "unlock",
  "embark",
  "facilitat",
  "harness",
  "foster",
  "ignit",
  "optimiz",
  "shed light on",
];

// Tier C: Overused Adjectives (wordlists.md §2, Tier C)
export const CLICHE_TIER_C: readonly string[] = [
  "cutting-edge",
  "robust",
  "seamless",
  "scalable",
  "dynamic",
  "vibrant",
  "pivotal",
  "transformative",
  "revolutionary",
  "innovative",
  "compelling",
  "crucial",
  "nuanced",
  "comprehensive",
  "sophisticated",
  "remarkable",
  "marvelous",
  "formidable",
  "stellar",
];

// Tier D: Transition Words & Hedging Phrases (wordlists.md §2, Tier D)
export const CLICHE_TIER_D: readonly string[] = [
  "furthermore",
  "moreover",
  "additionally",
  "indeed",
  "arguably",
  "it's worth noting",
  "could be argued that",
  "to some extent",
  "broadly speaking",
  "generally speaking",
  "tends to",
  "let's dive in",
  "deep dive",
  "but here's the kicker",
  "that's only half the story",
  "in conclusion",
  "at the end of the day",
  "a key takeaway is",
  "from a broader perspective",
];

// Tier E: Sensory & Emotional Clichés (wordlists.md §2, Tier E)
export const CLICHE_TIER_E: readonly string[] = [
  "lavender and iron",
  "lavender and vanilla",
  "lavender and hay",
];

/** All cliché phrases combined across tiers A–E, deduplicated. */
export const ALL_CLICHE_PHRASES: readonly string[] = [
  ...new Set<string>([
    ...CLICHE_TIER_A,
    ...CLICHE_TIER_B,
    ...CLICHE_TIER_C,
    ...CLICHE_TIER_D,
    ...CLICHE_TIER_E,
  ]),
];

// Cliché density scoring brackets (matches per 100 words, design §1b)
export const CLICHE_BRACKET_ZERO = 0;
export const CLICHE_BRACKET_LOW_MAX = 5; // 1–5 per 100 → score 1.0
export const CLICHE_BRACKET_MID_MAX = 15; // 6–15 per 100 → score 2.5
export const CLICHE_SCORE_LOW = 1.0;
export const CLICHE_SCORE_MID = 2.5;
export const CLICHE_SCORE_HIGH = 4.0; // 16+

// ── Silence-framing template (design §1 documented gap) ──────────────────────
// Pattern: "the silence was a [noun] he/she/they could not [name|explain|understand]"
// Uses global flag; safe with String.prototype.match (resets lastIndex after call).
export const SILENCE_FRAMING_REGEX =
  /(the\s+silence|silence)\s+was\s+a\s+\w+\s+(he|she|they)\s+(could\s+not|couldn't)\s+(name|explain|understand)/gi;
export const SILENCE_FRAMING_BONUS = 0.5;

// ── Em-dash overuse (design §1 documented gap) ────────────────────────────────
// Community consensus: ~3+ em-dashes per paragraph = suspicious.
export const EM_DASH_RE = /—/g;
export const EM_DASH_PER_PARA_THRESHOLD = 3;
export const EM_DASH_BONUS = 0.5;

// ── Category 3: Sentence-Structure Uniformity ────────────────────────────────

// 1c-i: Sentence-length standard deviation thresholds (wordlists.md §3a)
export const STDDEV_BORDER_LOW = 3.5; // below → high-confidence AI
export const STDDEV_BORDER_HIGH = 5.5; // above → human range
export const CONSECUTIVE_WINDOW = 3; // ≥3 consecutive sentences within ±2 words
export const CONSECUTIVE_WORD_DIFF = 2;
export const CONSECUTIVE_BONUS = 0.5;

// 1c-ii: Transition word paragraph-opening thresholds (wordlists.md §3b)
export const TRANSITION_PARA_STARTERS: readonly string[] = [
  "furthermore",
  "moreover",
  "additionally",
  "indeed",
  "also",
  "consequently",
  "therefore",
  "notably",
  "importantly",
  "however",
  "nevertheless",
  "that being said",
  "in conclusion",
  "overall",
  "broadly speaking",
  "generally speaking",
  "in addition",
  "on the other hand",
  "as a result",
  "in summary",
];

export const TRANSITION_BORDER_LOW = 0.2; // 20%
export const TRANSITION_BORDER_HIGH = 0.4; // 40%
export const TRANSITION_SCORE_HEAVY = 2.0;

// 1c-iii: Negation-inversion pattern (wordlists.md §3c)
// Global flag; safe with String.prototype.match.
export const NEGATION_INVERSION_RE =
  /(it's|that's)\s+not\s+.+?,\s+(it's|that's)\s+.+?(?=[.!?\n]|$)/gi;
export const NEGATION_HUMAN_MAX = 2; // per 1000 tokens
export const NEGATION_AI_FLOOR = 5; // per 1000 tokens → score 2.0
export const NEGATION_SCORE_MAX = 2.0;
export const NEGATION_MIN_TOKENS = 100;

// ── Category 4: Lexical Poverty ───────────────────────────────────────────────

// TTR thresholds (wordlists.md §4a)
export const TTR_MIN_WORDS = 50;
export const TTR_HUMAN_MIN = 0.55; // above → 0.0
export const TTR_SUSPICIOUS_LOW = 0.40; // 0.40–0.55 → 1.5
export const TTR_SCORE_SUSPICIOUS = 1.5;
export const TTR_SCORE_LOW = 3.0; // below TTR_SUSPICIOUS_LOW

// MTLD thresholds (wordlists.md §4b; McCarthy & Jarvis 2010)
export const MTLD_THRESHOLD = 0.72; // factor TTR boundary
export const MTLD_MIN_WORDS = 500; // reliable above this length
export const MTLD_HUMAN_MIN = 80; // above → 0.0
export const MTLD_AI_FLOOR = 45; // below → 4.0
export const MTLD_AI_BAND_SCORE = 2.5; // 45 ≤ MTLD < 80 → 2.5 (flat, Decision 14)
export const MTLD_SCORE_MAX = 4.0;

// Lexical repetition flags (design §1d-iii)
export const NOUN_REPEAT_WINDOW = 10; // sentence sliding window
export const NOUN_REPEAT_THRESHOLD = 3; // appearances = flag
export const NOUN_REPEAT_SCORE = 0.5;
export const NOUN_REPEAT_CAP = 2.0;
export const HF_WORD_RATIO_THRESHOLD = 0.4; // >40% total words = flag
export const HF_WORD_SCORE = 1.0;
export const ADJ_NOUN_REPEAT_THRESHOLD = 2; // pair seen 2+ times = flag
export const ADJ_NOUN_SCORE = 1.0;
export const ADJ_NOUN_CAP = 2.0;
export const AI_NAME_SCORE = 0.5;

// ── Category 5: Community-Flagged Character Names (wordlists.md §5a) ─────────
const AI_NAMES: readonly string[] = [
  "Elara Voss",
  "Elena Voss",
  "Elias Vance",
  "Elara Vex",
  "Elara",
  "Marcus",
  "Silas",
  "Blackwood",
];

/** Pre-compiled word-boundary regexes for AI character names. */
export const AI_NAME_REGEXES: readonly RegExp[] = AI_NAMES.map((name) => {
  const escaped = name.replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`);
});

// ── High-frequency (stop) words for content-word filtering ───────────────────
export const HIGH_FREQ_WORDS: ReadonlySet<string> = new Set<string>([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "are", "was", "were", "been",
  "be", "have", "has", "had", "do", "does", "did", "will", "would",
  "should", "could", "may", "might", "shall", "can", "not", "this",
  "that", "these", "those", "it", "its", "i", "me", "my", "we", "our",
  "you", "your", "he", "she", "they", "their", "him", "her", "us",
  "what", "which", "who", "how", "when", "where", "why", "all", "any",
  "each", "every", "some", "no", "if", "so", "up", "out", "about",
  "into", "than", "then", "also", "just", "like", "more", "over",
  "such", "only", "after", "before", "other", "too", "very", "now",
  "here", "there", "been", "its", "am", "do", "go", "get", "got",
]);
