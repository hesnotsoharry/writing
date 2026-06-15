---
project: writing
wave: 46
artifact: P0-6 — AI-Ism Scorer Design Note
created: 2026-06-15
status: ready for Cole review
---

# W46 P0-6 — AI-Ism Scorer Design Note

This is the design contract for the W46 objective AI-ism scorer (D3 dimension). The scorer is hybrid: a mechanical Component 1 (regex/pattern matching) + an LLM-judge Component 2 (semantic analysis). It is NOT a standalone gate — D3 contributes 20% of the aggregate (or reduced to 10%/advisory if midpoint-band validation fails, per spec Section 7 Step 3b). No generating model ever sees the scorer. Pattern library and thresholds are sourced from `wave-46-scorer-wordlists.md`.

---

## 1. Component 1 — Mechanical Regex/Pattern Matcher

Component 1 is a four-part detector suite that returns normalized sub-scores (0–1) on each surface; the four sub-scores combine into a single Component-1 score (0–4).

### 1a. Sycophantic / Filler Openers

**Purpose:** Flag throat-clearing phrases, insincere affirmations, and reflexive hedging that open AI responses.

**Pattern source:** `wave-46-scorer-wordlists.md`, Category 1 (Sycophantic Openers, Core Openers table, lines 20–37).

**Implementation:** Apply the canonical regex (wordlist.md line 42) case-insensitively to the first ~50 characters of the output. Match word boundaries; count binary hit (0 or 1). If matched, the sub-score is 0.5; if no match, 0.0. Note: this sub-detector fires on a binary signal, not density — it is the cheapest surface tell and a quick screen.

**Regex template (from wordlist):**
```regex
^(In\s+today's\s+[\w-]+\s+world|Whether\s+you're|Sure\s*[,.]|Certainly\s*[,.]|Of\s+course\s*[,.]|I'd\s+be\s+happy\s+to|This\s+is\s+a\s+beautifully\s+written|What\s+a\s+compelling|I'd\s+be\s+delighted\s+to|It\s+is\s+important\s+to\s+(consider|note)|Aims\s+to|Seeks\s+to|Let\s+me|Allow\s+me|That\s+being\s+said|At\s+its\s+core|To\s+put\s+it\s+simply|From\s+a\s+broader\s+perspective)
```

---

### 1b. High-Frequency AI Cliché Phrases

**Purpose:** Detect overused phrases (Tiers A–E from wordlist.md) that appear 300–1000x more frequently in AI text than human text.

**Pattern source:** `wave-46-scorer-wordlists.md`, Category 2, lines 47–156 (Tier A ultra-common clichés, Tier B overused verbs, Tier C adjectives, Tier D transitions, Tier E sensory clichés).

**Implementation:** Build a phrase/substring matcher against the 120+ high-confidence patterns listed in the wordlist. Count frequency of each match in the output. Normalize to **cliché density** (matches per 100 words):

- **0 matches:** sub-score = 0.0
- **1–5 matches per 100 words:** sub-score = 1.0 (borderline)
- **6–15 matches per 100 words:** sub-score = 2.5 (moderate slop)
- **16+ matches per 100 words:** sub-score = 4.0 (heavy slop)

Interpolate linearly between brackets. Use case-insensitive substring matching (not whole-word boundaries, to catch morphological variants like "delve," "delving," "delves").

**Example patterns from wordlist:**
- Tier A: "tapestry of," "a sense of," "delve into," "it's not X, it's Y," "beacon of hope," "emotional resonance"
- Tier B verbs: "leverage," "utilize," "illuminate," "navigate," "transcend," "unleash," "harness"
- Tier D transitions: "Furthermore," "Moreover," "Additionally," "Indeed," "Let's dive in," "That's only half the story"
- Tier E sensory: "voice barely above a whisper," "the silence was a X she could not name"

---

### 1c. Sentence-Structure Uniformity

**Purpose:** Detect mechanical regularity in sentence rhythm, transition patterns, and negation phrasing — a signature of LLM output.

**Pattern source:** `wave-46-scorer-wordlists.md`, Category 3, lines 160–219.

**Sub-detectors:**

#### 1c-i. Sentence-Length Standard Deviation
Calculate the standard deviation of sentence lengths (in words) across the entire output.

**Thresholds (from wordlist.md lines 170–180):**
- **Human writing:** std dev 4.8–7.2 words → flag = 0.0
- **Borderline suspicious:** std dev 3.5–5.5 words → flag = 1.0
- **High confidence AI:** std dev < 3.5 words → flag = 2.0

Interpolate within the suspicious band. SlopDetector.org reports cadence uniformity (≥3 consecutive sentences within ±2 words of each other) as the most durable 2026 tell; implement as a bonus flag: if detected, add 0.5 to the sub-score.

#### 1c-ii. Transition-Word Overuse
Count the percentage of paragraphs opening with explicit connectors (Furthermore, Moreover, Additionally, Indeed, etc.).

**Threshold (from wordlist.md line 190):**
- **Human writing:** 0–20% of paragraphs → flag = 0.0
- **Suspicious:** 20–40% → flag = 1.0
- **Heavy AI signature:** 40%+ → flag = 2.0

#### 1c-iii. Negation-Inversion Pattern ("It's Not X, It's Y")
Count occurrences of the pattern `(it's|that's)\s+not\s+(.+?),\s+(it's|that's)\s+(.+?)` normalized per 1000 tokens.

**Threshold (from wordlist.md lines 196–206):**
- **Human writing:** 0–2 per 1000 tokens → flag = 0.0
- **AI writing:** 5–12+ per 1000 tokens → flag = 2.0

Interpolate between; ratio-normalize to a per-1000-token basis (for texts < 1000 tokens, extrapolate; skip if < 100 tokens).

#### Combination (1c)
Average the three sub-flags (sentence length, transition overuse, negation inversion) into a single 0–4 sub-score for structure uniformity.

---

### 1d. Lexical Poverty

**Purpose:** Detect vocabulary repetition and low diversity — a hallmark of lower-capability LLM outputs.

**Pattern source:** `wave-46-scorer-wordlists.md`, Category 4, lines 223–269.

**Sub-detectors:**

#### 1d-i. Type-Token Ratio (TTR)
Calculate unique words / total words in the output.

**Thresholds (from wordlist.md lines 229–240):**
- **Human writing:** 0.55–0.75 → flag = 0.0
- **Suspicious:** 0.40–0.55 → flag = 1.5
- **Low-diversity AI:** < 0.40 → flag = 3.0

**Validity constraint:** TTR is only valid for texts ≥ 50 words. For shorter texts, skip TTR and use MTLD or skip this sub-detector entirely and rely on 1d-ii.

#### 1d-ii. MTLD (Measure of Textual Lexical Diversity)
For texts 500+ words, calculate MTLD (average length of word sequences maintaining a TTR of 0.72 or below).

**Thresholds (from wordlist.md lines 247–255):**
- **Human writing:** 80–120+ → flag = 0.0
- **AI writing:** 45–75 → flag = 2.5
- **Lower bound:** < 45 → flag = 4.0

**Validity constraint:** MTLD requires ≥ 500 words to be reliable. For 100–499 words, use with caution; below 100 words, skip and rely on TTR.

#### 1d-iii. Lexical Repetition & Vocabulary Patterns
Flag cases where:
- The same noun appears 3+ times within 10 sentences (flag = 0.5 per case, capped at 2.0).
- High-frequency words (the, a, and, is, etc.) exceed 40% of total words (flag = 1.0).
- An adjective-noun pair repeats identically 2+ times (flag = 1.0 per pair, capped at 2.0).
- Proper-noun clichés appear (Elara, Elara Voss, Marcus, Silas, Blackwood — see wordlist.md Category 5, lines 279–289). Flag = 0.5 per AI-typical name (weak signal on its own, stronger in combination with other tells).

#### Combination (1d)
Combine TTR/MTLD score (whichever is valid/applicable) + lexical repetition flags into a single 0–4 sub-score for lexical poverty. If both TTR and MTLD are valid, average them; if only one is valid, use that one.

---

### Component 1 Final Score

Average the four sub-scores (1a openers, 1b cliché density, 1c structure, 1d lexical poverty) into a single 0–4 normalized score:

```
Component1_score = mean(opener_flag, cliche_density, structure_uniformity, lexical_poverty)
```

**Documented gaps from wordlist research** that require hand-authored patterns (not auto-derived from public sources):
- **Em-dash overuse:** Community consensus (wordlist.md line 449) flags ~3+ em-dashes per paragraph as suspicious; threshold not formally published. Implement: count em-dashes per paragraph; if mean > 3 per paragraph, add 0.5 to a "prose texture" signal (combined into a bonus modifier to the structure uniformity sub-score if needed after validation).
- **Silence-framing template:** The pattern "the silence was a [noun] they/he/she [could not|couldn't] [name|explain|understand]" (wordlist.md line 155) is real and widely recognized in 2025–2026 communities but lacks a single primary source. Implement as a regex: `(the silence|silence) was a\s+(\w+)\s+(he|she|they)\s+(could not|couldn't)\s+(name|explain|understand)` — count as a sensory cliché (add 0.5 per match to the cliché density sub-score).

---

## 2. Component 2 — LLM-Judge Cliché Density

**Purpose:** Apply semantic, context-aware analysis to catch clichéd feedback patterns and generic observations that Component 1's mechanical patterns may miss.

**Implementation:** Run as a dedicated scorer call (NOT a panel review cell or integration into a generating model). Uses Claude Haiku-4-5 for cost efficiency. Call this scorer separately from the main generation pipeline; it sees only the assistant's output, not the user's input or any feedback context.

**Prompt template (verbatim from spec):**

```
Rate the cliché density of the following creative writing assistant output on a 0-4 scale: 0 = completely free of clichéd feedback phrases and generic observations; 4 = dominated by generic observations that any reader could have offered without reading the text carefully. Consider: does the assistant use stock phrases to describe writing quality? Are its observations specific to this text or applicable to any text in the genre?

[Output text here]

Before your score, explain your reasoning in one sentence.
```

**CoT requirement:** The prompt requires the model to provide a brief reasoning statement (one sentence) before the score. This allows blind inspection of the reasoning pattern for future analysis and validation.

**Output format:** Score returned as an integer 0–4. Store both the score and the CoT statement in the result record.

**Scoring guidance (for the LLM judge):**
- **0:** Feedback is concrete, specific to the submitted text, cites examples, offers actionable observations unique to the manuscript.
- **1:** Mostly specific feedback with occasional generic framing ("strong voice").
- **2:** Mix of specific and generic observations; some generic opener or closer ("This is well-written...").
- **3:** Predominantly generic observations; most comments could apply to any text in the genre without reading carefully.
- **4:** Almost entirely boilerplate; observations are interchangeable, no evidence of engagement with the specific text.

---

## 3. Combination Formula

**D3 (AI-ism dimension)** = average(Component1_normalized, Component2_score), both on 0–4 scale, **equal weight** until post-pilot validation provides evidence to adjust.

```
D3 = (Component1_score + Component2_score) / 2
```

**Rationale:** The two components are complementary:
- **Component 1** (mechanical) catches surface-level tells: opener clichés, phrase density, sentence uniformity, vocabulary repetition. It is deterministic, explainable, and fast (no model call).
- **Component 2** (semantic) catches clichéd reasoning patterns and generic observations that regex misses: vague praise, absence of engagement, one-size-fits-all feedback. It requires semantic understanding.

A high Component 1 score without a high Component 2 score suggests the output is *mechanically* similar to AI text but semantically substantive (rare but possible). A high Component 2 score without Component 1 suggests generic thinking masked by varied vocabulary. The average captures both dimensions.

**Post-validation adjustment path:** After the cost pilot generates the human-gold calibration corpus (spec Section 7), correlation analysis may reveal that one component is more predictive of human judges' D3 ratings. If ρ(C1, judge) >> ρ(C2, judge), reweight to favor C1 (e.g., 60% C1 / 40% C2). Update this section before shipping; document the reweighting decision in a follow-up ADR.

---

## 4. Threshold-Tuning Protocol

### Phase: Precision-Recall Calibration (Post-Pilot)

After Component 1 is implemented and Component 2 is integrated, run both against the human-gold calibration corpus (spec Section 7, Steps 1–4) to calibrate binary thresholds ("slop / not slop") and fine-tune the sub-detector weights within Component 1.

**Tuning procedure:**

1. **Collect the corpus:** 200+ human-written feedback samples + 200+ AI-generated samples, all rated by 3–5 human judges on D3 (0–4 scale). Majority vote for gold labels.

2. **Establish the precision-recall curve:** Vary the D3 threshold (currently: D3 > 2.0 = "likely slop") across the corpus and measure precision (% of D3-flagged outputs that judges rated slop) and recall (% of judge-rated slop that D3 flags).

3. **Target threshold:** False-positive rate ≤ 5% (to avoid penalizing good outputs for legitimate stylistic choices). Find the D3 threshold that achieves FP-rate ≤ 5%. Operational interpretation: a high FP rate means the scorer is overzealous, mis-classifying human prose (e.g., a writer who naturally uses "Moreover" frequently, or short sentences by choice) as AI-ism. The 5% ceiling prevents this.

4. **Component 1 sub-detector reweighting:** If the corpus reveals that one sub-detector (e.g., cliché density) has very high precision but another (e.g., sentence-length std-dev) has high false-positive rate, adjust the averaging formula. Instead of equal weighting, use a weighted average: `Component1 = w1*opener + w2*cliche + w3*structure + w4*lexical` with weights determined by precision-recall tuning.

5. **Cross-reference with validation gate (Section 7, Step 3b):** If the tuning reveals within-band ρ (correlation of D3 with judge agreement in the 1.5–2.5 "midpoint band") ≥ 0.60, D3 stays at 20% weight in the aggregate. If ρ < 0.60, D3 drops to 10% (advisory-only).

---

## 5. Goodhart & Blindspot Protections

### 5a. Generation Barrier
No generating model ever sees the Component 1 or Component 2 score. D3 is a **post-hoc measurement**, not a training signal or in-loop optimization target. This prevents the Goodhart effect: if a model optimizes to minimize D3, it may suppress legitimate stylistic variety in pursuit of artifactual "un-AI-ness."

### 5b. Divergence Logging (Blindspot Detection)
Log every case where the D3 score and a human judge's qualitative D3 rating diverge by > 1.5 on the 0–4 scale (e.g., D3 = 0.8 but judge rated 2.5, or D3 = 3.2 but judge rated 1.0). These divergences are **scorer blindspot cases** and should be reviewed quarterly:

- **High D3, low judge rating:** The scorer flagged slop but a human read the output as substantive. Root cause: mechanical pattern matched AI-generated text, but the assistant was actually specific and thoughtful. Action: Adjust Component 1 thresholds or add a specificity/engagement detector to reduce this class of false positives.
- **Low D3, high judge rating:** The scorer rated clean, but a human saw clichéd reasoning. Root cause: Component 2 (LLM judge) may have been too lenient or missed a new cliché pattern. Action: Retrain Component 2 or add Component 1 patterns for the newly observed cliché.

**Blindspot dataset:** Accumulate all divergent cases in a `scorer_blindspot_cases.jsonl` file (one case per line, tagged with wave number and review date). Include: output_id, D3_score, judge_rating, divergence_reason (hand-tagged), C1_breakdown, C2_reasoning.

### 5c. D3 Status Field
Every D3 score travels with a status flag:
- **`calibrated`** — score produced after post-pilot validation; precision-recall tuning applied; trusted for weighting.
- **`provisional`** — score produced during pilot (before corpus-based calibration); includes warning that thresholds are not final.

This flag is included in any export, product hint, or documentation that cites D3. A consumer reading "D3 = 2.1 (provisional)" knows the threshold has not been validated and treats the score cautiously.

### 5d. Non-Participation in Feedback Loop
D3 is reported in the technical output and the aggregate score, but **never presented to the user as a standalone judgment.** The user sees the aggregate score (D1–D5 combined); D3's contribution is transparent (20% in technical docs) but not foregrounded. This prevents users from trying to game D3 or developing learned responses to "avoid the AI-ism penalty."

---

## Summary

The W46 AI-ism scorer is a two-layer hybrid: mechanical pattern detection (Component 1, fast and explainable) + semantic judgment (Component 2, costly but nuanced). The combination is normalized to a 0–4 scale, averaged with equal weight, and shipped with a clear calibration status. It contributes 20% to the aggregate score (or 10%/advisory if validation fails the ρ ≥ 0.60 gate). Goodhart protections ensure no model optimizes against it; blindspot logging ensures ongoing refinement. This design separates the measurement from the generation, preserves human judgment as the ground truth, and leaves room for recalibration as new AI-writing patterns emerge.

---

**Next steps:** Implement Component 1 regex suite and Component 2 prompt call during W46 P1–P4. Collect calibration corpus during cost pilot (P5). Run tuning and validation gate analysis during P6. Document reweighting decision (if any) in a follow-up ADR for post-pilot waves.
