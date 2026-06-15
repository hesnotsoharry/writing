/**
 * W46 cost-pilot excerpt E1 — "Two Minutes Before Closing"
 * Source: roadmap/wave-46-excerpts.md (P0-3), eval-authored 2026-06-15.
 *
 * FK grade 8.66 (target 8–10 ✓), 399 words, SFW, high tell-density.
 * This is the ONLY excerpt used in the cost pilot (Section 9 / Section 10).
 */

import type { AssembledContext } from "../src/features/ai/ai.types.ts";

// ── Raw excerpt text ──────────────────────────────────────────────────────────

export const E1_EXCERPT_TEXT = `The bell over the door rang at 4:58, two minutes before closing, and Nora knew before she looked up that it was him. She had imagined this moment a thousand times — rehearsed it in the shower, on the long drive home, in the quiet hours when sleep stubbornly refused to come — and every version had ended with her saying something clever and devastating. Now that it was finally here, every carefully prepared word evaporated like steam off a cooling cup. Daniel stood in the doorway, framed by the gold light of the dying afternoon, looking precisely the way he had on the afternoon he abandoned her, and her heart began to race.

For a long moment neither of them spoke; the silence stretched between them like a thin wire, taut and humming with everything they had never managed to say. Nora's hands trembled as she set down her cleaning rag, and she felt a thousand emotions all at once — anger and longing and fear and something else she could not quite identify.

"You cut your hair," he said finally.

It was such a ridiculous thing to say that she almost laughed. Almost. Instead she crossed her arms and lifted her chin, determined not to reveal how profoundly his presence still affected her. "Three years," she said. "You're a little late for a coffee."

Daniel winced, because he deserved that and they both knew it. He took a step closer, and the achingly familiar fragrance of him — cedar and rain and something uniquely Daniel — washed over her, dragging her back to a hundred mornings she had desperately tried to forget. She hated that her body still remembered him. She hated, even more, that some traitorous part of her was genuinely glad he had returned.

"I should have called," he said. "I know there is nothing I can possibly say that makes any of this okay."

"Then why are you here?"

He met her eyes, and in that instant the years fell away and she was twenty-three again, reckless and hopeful and hopelessly in love. "Because leaving you was the biggest mistake of my life," he said quietly, "and I could not spend another day pretending otherwise."

Nora's breath caught in her throat. This was everything she had wanted to hear for three agonizing years. So why did it feel as though the ground were giving way beneath her?`;

// ── Assembled context (wave-46-excerpts.md §AssembledContext) ─────────────────

export const E1_CTX: AssembledContext = {
  about: {
    synopsis:
      "Three years after Daniel left their engagement to take a job overseas, Nora has rebuilt her life around the Marigold, the small-town café she inherited from her grandmother. His unannounced return, minutes before closing, forces her to decide whether forgiveness is possible — and whether she still wants the future they once planned.",
    genre: "Contemporary Romance",
    tone: "Tender, wistful, emotionally charged; restrained rather than melodramatic",
    pov: "Third person limited (Nora), past tense",
    notes:
      "Stay close in Nora's head; she is guarded and dry-witted, not weepy. Ground physical description in concrete sensory detail, not abstractions. This is a reunion / second-chance romance — the ache is in restraint, not declaration.",
  },
  entitySummaries: [
    {
      name: "Nora Bell",
      type: "character",
      keyFacts:
        "Owns and runs the Marigold café, inherited from her grandmother. Was engaged to Daniel; he left for an overseas job three years ago. Guarded, dry sense of humor. Recently cut her hair short. Mid-twenties.",
    },
    {
      name: "Daniel Reyes",
      type: "character",
      keyFacts:
        "Nora's former fiancé. Left town three years ago for a job abroad; has now returned, seeking reconciliation. Regretful, careful with his words. Carries a familiar scent of cedar and rain.",
    },
    {
      name: "The Marigold",
      type: "location",
      keyFacts:
        "A small-town café Nora runs and lives above; closes at 5 p.m. Warm gold afternoon light through the front windows. The emotional anchor of the life Nora built after Daniel left.",
    },
  ],
  sceneTitle: "Two Minutes Before Closing",
  sceneExcerpt: E1_EXCERPT_TEXT,
  sceneExcerptTruncated: false,
  boundaryLine:
    "This is a third-person-limited, past-tense narrative anchored in Nora's POV. Do not suggest first-person or present-tense rewrites, and do not give the reader access to Daniel's interiority.",
  selectionText: null,
  extraScenes: [],
};
