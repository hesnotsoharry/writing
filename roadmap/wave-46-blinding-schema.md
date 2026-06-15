---
project: writing
wave: 46
artifact: P0-8 — Blinding Infrastructure Schema
created: 2026-06-15
status: ready for Cole review
---

# W46 P0-8 — Blinding Infrastructure Schema

This is the data-contract the Phase-1 eval rig implements to guarantee W46 Decision 5 (blind grading). Schema descriptions only — no implementation code. Derived from the locked spec's Section 6 (Blinding Protocol) and Section 11 P0-8.

## 1. Label generation

- **Algorithm:** `secrets.token_hex(2)` per output (Python) → 4-char hex labels (e.g. "OUT-3f7a"), 65,536 label space for ~1710 outputs. (If the eval rig is TS/Node rather than Python, the equivalent is `crypto.randomBytes(2).toString('hex')` — note both.)
- **Rejection-sample for uniqueness:** Collision prob < 3% without replacement, so rejection sampling guarantees uniqueness WITHIN a run.
- **Scope:** Labels are assigned FRESH PER TASK and are task-scoped: "OUT-3f7a" in T1 is a DIFFERENT model than "OUT-3f7a" in T3. Within a single task-excerpt comparison set, each model's output keeps a stable label.
- **No sequential numbering:** Sequential labels leak ordering information.

## 2. Keymap — `eval-keymap.json`

- **One entry per output.** Entry format:
  ```json
  {
    "OUT-3f7a": {
      "model": "claude-sonnet-4-6",
      "task": "T3",
      "condition": "harness-on",
      "excerpt": "excerpt-2",
      "sample": 3
    }
  }
  ```
- **Condition enum:** "harness-on" | "harness-off" | "post-hoc-on" | "post-hoc-off" | "blank-box".
- **Keymap isolation:** The keymap is held by the orchestrator OUTSIDE any judge agent's prompt context. Judge subagents must never receive it. Keymap isolation is confirmed before any judge dispatch.

## 3. Output storage — `eval-outputs/{task}/{label}.txt`

- **One file per output,** containing the STRIPPED output text only (post self-ID-stripping, see §5).
- **Path pattern:** `eval-outputs/T3/OUT-3f7a.txt`.

## 4. Scores file — `eval-scores.json`

- **One entry per output label,** holding each judge's per-dimension score + CoT reasoning. Example:
  ```json
  {
    "OUT-3f7a": {
      "D1_judge_A": 3,
      "D1_cot_A": "...",
      "D2_judge_A": 2,
      "D2_cot_A": "...",
      "D5_judge_A": 3,
      "D5_cot_A": "...",
      "D1_judge_B": "...",
      "D3_scorer": 2.5,
      "D4_rulecheck": 4
    }
  }
  ```
- **Scorer roles:** D3 comes from the objective scorer (not a judge); D4 from the mechanical rule checker (not a judge); only D1/D2/D5 are judge-scored.
- **D3 status field:** Include a `D3_status` field per output ("calibrated" | "provisional").

## 5. Self-ID stripping fields

Every output passes a strip pass BEFORE its label is assigned (full rules in spec Section 6 "Self-ID Stripping"); the schema must record, per output:

- `stripped: boolean`
- `strip_removed_word_count: number`
- `regenerated: boolean` (true if re-generated once for in-body self-ID)
- `self_id_failure: boolean` (true if fingerprint persisted after the 1 re-gen)

**Flagging rule:** Outputs where stripping removed > 20 words are flagged for human review.

## 6. Reveal log — `eval-reveal-log.json`

- **Content:** Timestamped log of keymap-seal and keymap-reveal events, plus per-judge score-batch submit+finalize timestamps.
- **Integrity check:** Confirm via timestamp comparison that NO judge score was submitted after the keymap was unsealed. Any post-reveal score is flagged as potentially compromised.
- **Example shape:**
  ```json
  {
    "keymap_sealed_at": "<iso>",
    "keymap_revealed_at": "<iso>",
    "judge_batches": [
      {
        "judge": "A",
        "task": "T3",
        "submitted_at": "<iso>",
        "finalized_at": "<iso>"
      }
    ]
  }
  ```

## 7. File inventory

| Artifact | Path | Purpose |
|---|---|---|
| Keymap | `eval-keymap.json` | Master mapping of label → model/task/condition/excerpt/sample; held by orchestrator, not shared with judges |
| Outputs | `eval-outputs/{task}/{label}.txt` | Stripped output text, one file per output |
| Scores | `eval-scores.json` | Per-label judge scores (D1/D2/D5), objective scorer (D3), rule checker (D4), plus CoT and status |
| Reveal log | `eval-reveal-log.json` | Timeline of keymap seal/reveal and judge score submissions; integrity verification |
| Seeded errors (T5) | `eval-seeded-errors.json` | Cross-reference to P0-3; T5 task-specific error corpus |
| Model probe | `eval-model-probe-{date}.json` | Cross-reference to P0-4; diagnostic telemetry from eval tasks |
