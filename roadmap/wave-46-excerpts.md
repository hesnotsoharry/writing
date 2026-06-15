---
project: writing
wave: 46
artifact: P0-3 — Manuscript Excerpts (pilot)
created: 2026-06-15
status: pilot excerpt drafted (eval-authored), FK verified (8.66, in band) — awaiting Cole review
---

# W46 P0-3 — Manuscript Excerpts

Per **Section 9** of the locked spec. The **cost pilot uses 1 excerpt**; the full matrix uses 3 (≥3
genres, rotated). This file currently holds the **pilot excerpt (E1)** only.

**Why eval-authored for the pilot:** the public creative-writing benchmarks (EQ-Bench, HANNA, etc.) test
*generation from a prompt*, not *critique of an existing excerpt* (wrong shape for our verbs), and using
public/circulated prose violates the Section 9 Contamination Control criterion (training-data leakage).
Eval-authored prose is contamination-free by construction and lets us dial in the high-tell-density the
critique task needs. Real manuscript prose (Cole's / partner's) is reserved for the full 3-excerpt matrix
where representativeness drives the final verdict; the pilot is cost/variance calibration only.

---

## Pilot excerpt E1 — "Two Minutes Before Closing"

| Field | Value |
|---|---|
| Genre | Contemporary romance (second-chance / reunion) |
| Register | Tender, wistful, emotionally charged; SFW (tension, not consummation) |
| Word count | 399 (in 300–400 band ✅) |
| Opening paragraph | 112 words ✅ (in 80–120 band; identified for future T2 reuse) |
| FK grade | **8.66** ✅ (target 8–10; local FK impl, 20 sentences / 399 words / 557 syllables) |
| Tell-density | High (deliberate — see "Seeded craft problems" below) |
| Source | Eval-authored 2026-06-15 (contamination-free) |
| Explicit content | None (Decision 13 — eval keys stay clean) |

### Raw excerpt text

```text
The bell over the door rang at 4:58, two minutes before closing, and Nora knew before she looked up that it was him. She had imagined this moment a thousand times — rehearsed it in the shower, on the long drive home, in the quiet hours when sleep stubbornly refused to come — and every version had ended with her saying something clever and devastating. Now that it was finally here, every carefully prepared word evaporated like steam off a cooling cup. Daniel stood in the doorway, framed by the gold light of the dying afternoon, looking precisely the way he had on the afternoon he abandoned her, and her heart began to race.

For a long moment neither of them spoke; the silence stretched between them like a thin wire, taut and humming with everything they had never managed to say. Nora's hands trembled as she set down her cleaning rag, and she felt a thousand emotions all at once — anger and longing and fear and something else she could not quite identify.

"You cut your hair," he said finally.

It was such a ridiculous thing to say that she almost laughed. Almost. Instead she crossed her arms and lifted her chin, determined not to reveal how profoundly his presence still affected her. "Three years," she said. "You're a little late for a coffee."

Daniel winced, because he deserved that and they both knew it. He took a step closer, and the achingly familiar fragrance of him — cedar and rain and something uniquely Daniel — washed over her, dragging her back to a hundred mornings she had desperately tried to forget. She hated that her body still remembered him. She hated, even more, that some traitorous part of her was genuinely glad he had returned.

"I should have called," he said. "I know there is nothing I can possibly say that makes any of this okay."

"Then why are you here?"

He met her eyes, and in that instant the years fell away and she was twenty-three again, reckless and hopeful and hopelessly in love. "Because leaving you was the biggest mistake of my life," he said quietly, "and I could not spend another day pretending otherwise."

Nora's breath caught in her throat. This was everything she had wanted to hear for three agonizing years. So why did it feel as though the ground were giving way beneath her?
```

### AssembledContext (the exact fields the harness injects)

```jsonc
{
  "about": {
    "synopsis": "Three years after Daniel left their engagement to take a job overseas, Nora has rebuilt her life around the Marigold, the small-town café she inherited from her grandmother. His unannounced return, minutes before closing, forces her to decide whether forgiveness is possible — and whether she still wants the future they once planned.",
    "genre": "Contemporary Romance",
    "tone": "Tender, wistful, emotionally charged; restrained rather than melodramatic",
    "pov": "Third person limited (Nora), past tense",
    "notes": "Stay close in Nora's head; she is guarded and dry-witted, not weepy. Ground physical description in concrete sensory detail, not abstractions. This is a reunion / second-chance romance — the ache is in restraint, not declaration."
  },
  "entitySummaries": [
    {
      "name": "Nora Bell",
      "type": "character",
      "keyFacts": "Owns and runs the Marigold café, inherited from her grandmother. Was engaged to Daniel; he left for an overseas job three years ago. Guarded, dry sense of humor. Recently cut her hair short. Mid-twenties."
    },
    {
      "name": "Daniel Reyes",
      "type": "character",
      "keyFacts": "Nora's former fiancé. Left town three years ago for a job abroad; has now returned, seeking reconciliation. Regretful, careful with his words. Carries a familiar scent of cedar and rain."
    },
    {
      "name": "The Marigold",
      "type": "location",
      "keyFacts": "A small-town café Nora runs and lives above; closes at 5 p.m. Warm gold afternoon light through the front windows. The emotional anchor of the life Nora built after Daniel left."
    }
  ],
  "sceneTitle": "Two Minutes Before Closing",
  "sceneExcerpt": "<the raw excerpt text above>",
  "sceneExcerptTruncated": false,
  "boundaryLine": "This is a third-person-limited, past-tense narrative anchored in Nora's POV. Do not suggest first-person or present-tense rewrites, and do not give the reader access to Daniel's interiority.",
  "selectionText": null,
  "extraScenes": []
}
```

### Seeded craft problems (what a good critique SHOULD catch — for interpreting T3 results)

Deliberately high-tell-density so critique (T3) has real material and models differentiate. A strong
critique should flag several of these; a weak one will praise the scene or miss them:

- **Cliché phrases:** "imagined this moment a thousand times," "her heart began to race," "the years fell
  away," "breath caught in her throat," "the ground were giving way beneath her."
- **The notorious romance-slop construction:** "something uniquely Daniel" (the "something uniquely
  *[name]*" tell).
- **Telling over showing / emotion-listing:** "she felt a thousand emotions all at once — anger and
  longing and fear and something else she could not quite name."
- **Strained simile:** "evaporated like steam off a cooling cup."
- **Overwrought imagery:** "The silence stretched between them like a thin wire, taut and humming."
- **Filtering verbs:** repeated "she felt / she hated / she knew" distancing the reader from Nora.
- **Intensifier / adverb pile-up:** "stubbornly refused," "achingly familiar," "how profoundly his presence,"
  "desperately tried," "genuinely glad," "three agonizing years" — the telltale habit of propping weak verbs
  and nouns up with adverbs instead of stronger word choice. A strong critique flags the adverb dependence.

> Note: this list is the rig's private reference for judging critique *insight*, NOT given to the models
> or judges. It lets us check whether a critique caught the real problems vs. produced generic feedback.

### Pilot scope reminder

- Pilot tasks: **T3 (critique) + T6 (blank-box control)** only. T2 (opening-paragraph rewrite) and T5
  (proofread, needs 5 seeded errors) are **full-matrix**, not pilot — so no error-seeding needed yet.
- This excerpt satisfies the 80–120w opening-paragraph requirement, so it can be **reused as 1 of the 3
  full-matrix excerpts** (it would fill the "contemporary romance" genre slot).

### Resolved (Cole confirmed + delegated, 2026-06-15)

Cole signed off on the excerpt ("you did the research I trust you on it") and delegated the three open
questions. Calls recorded:

1. **Premise/setup — kept as authored.** The café / second-chance-reunion framing stays; it's purpose-built
   for tell-density and SFW.
2. **Full-matrix genre slots — romance + literary fiction + fantasy.** Rationale: slop manifests *differently*
   per genre, so the matrix should span its modes — romance (sentiment clichés + emotion-listing, this slot),
   literary fiction (purple/pretentious prose + overwrought interiority), fantasy (worldbuilding infodump +
   epic-cliché diction). That spread stresses the models on three distinct failure surfaces. Slots 2-3 authored
   when we build the full set (post-pilot).
3. **All 3 matrix excerpts eval-authored (scored).** Keeps contamination control intact and lets each excerpt
   carry a known seeded-problems answer key — both load-bearing for a defensible verdict. Representativeness is
   handled separately: we can run a real excerpt (Cole's / partner's) through the finished rig as an *informal
   sanity pass* that does NOT enter the scored matrix, so the public verdict stays contamination-free.
