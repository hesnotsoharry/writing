/* Assistant data — verb definitions, canned grounded replies, seed conversations,
   credit math, and the fake streaming engine. All mock; in prod these are the
   verb prompt templates (prompts/*.ts), the conversations table, and ai.client. */

const AI_VERBS = {
  brainstorm: {
    label: "Brainstorm", icon: "zap", action: "Brainstorm",
    blurb: "Think out loud with a partner who knows the book",
    placeholder: "What are you wondering about?",
    starters: [
      "What could Tomas know that keeps him quiet but not lying?",
      "Three ways the spring tide could trap someone besides Maren",
      "Why would Edda hide the second keeper from everyone?",
    ],
  },
  critique: {
    label: "Critique", icon: "target", action: "Critique",
    blurb: "Honest craft feedback on what's on the page",
    placeholder: "What should I look hard at?",
    starters: [
      "Does this opening earn its quiet, or is it just slow?",
      "Is the letter doing too much expository work?",
    ],
  },
  betaread: {
    label: "Beta read", icon: "book", action: "Beta read",
    blurb: "A first reader's reactions, beat by beat",
    placeholder: "What do you want a reader's eye on?",
    starters: [
      "Read this scene cold — where do you lean in, where do you drift?",
      "Do you trust Tomas at the end of this scene?",
    ],
  },
  proofread: {
    label: "Proofread", icon: "check", action: "Proofread",
    blurb: "Typos, grammar, consistency — never style",
    placeholder: "Anything in particular to watch for? (optional)",
    starters: [
      "Check this scene",
      "Check tense and UK spellings",
    ],
  },
};
const AI_VERB_ORDER = ["brainstorm", "critique", "betaread", "proofread"];

/* ---- Canned replies (grounded in The Salt Year) --------------------------- */

const AI_REPLIES = {
  brainstorm: [
    "Three threads worth pulling, each grounded in what's already on the page.\n" +
    "- **He owed Edda a debt the light can't repay.** Tomas runs the only ferry. If Edda once kept the light burning on a night his boat should have been lost, his silence isn't guilt — it's loyalty to a version of her he won't let Maren revise.\n" +
    "- **He carried the letters.** Someone posted Edda's mail. If Tomas ferried her letters to the mainland for years, he knows who else she was writing to — and the half-finished logbook entry stops being a mystery to him and starts being a confidence.\n" +
    "- **He found her.** You've left three weeks between the death and the funeral letter. If Tomas is the one who climbed the tower, what he saw there is the thing he \"won't say and won't lie about.\" That line of his already carries this weight.\n" +
    "The second option leaves the most room for Lia — a child who's watched the envelopes change hands her whole life.",

    "Start from the constraint you've already built: the causeway floods on a schedule everyone on Thornwick knows by heart.\n" +
    "That means nobody is ever trapped by *surprise* — they're trapped by a decision. So the question for the scene isn't \"how does the tide cut her off\" but **what does Maren choose over the crossing window**: the logbook entry she's halfway through deciphering, a light she sees from the lamp room, or Lia turning up at the door with the map. Pick the one that costs her, and the flood becomes character rather than weather.\n" +
    "There's also a quieter option — she *could* make the crossing and doesn't, and tells herself it's the tide. Tomas would know the timetable too. He'd know she's lying. That gives you a wordless beat between them in chapter II.",

    "A hidden keeper makes sense if naming him would have cost Edda something she couldn't afford to lose.\n" +
    "- **The estate.** Your three-week law means the light passes through *keeping*, not blood. If a second keeper held the light during Edda's absence — even once — his name in the logbook might give him a claim. She kept him out of the official record to keep Thornwick a Vale island.\n" +
    "- **The wreck.** The Maundy Wreck built the lighthouse; perhaps the second keeper's family was on the reef that night. A name with that weight gets scratched off walls, not just left unsaid.\n" +
    "- **Love, plainly.** The least mechanical answer: he mattered, it ended, and a woman who wrote \"come before you can\" was capable of editing her own history with a pen-knife.\n" +
    "Whichever you pick, the scratched-out name in III·2 is your delivery mechanism — it's already on the wall.",
  ],
  critique: [
    "### What's working\n" +
    "The restraint. \"There was no one left to tell\" does in seven words what most returning-home openings need a page for. The letter's creases \"gone soft as cloth\" is doing real time-work — we feel the three weeks without being told twice. And Tomas refusing the obvious sentence is the best character introduction in the chapter.\n" +
    "### Questions to sit with\n" +
    "- Maren observes Thornwick as \"indifferent\" in paragraph one and the mind-keeps-things-child-sized idea arrives in paragraph five. Both are strong; together they slightly crowd the same note — her narrating her own detachment.\n" +
    "- The letter quotes Edda directly very early. Do you want her voice on page one, or is it stronger held back until the logbook scene, where the half-finished entry can land as the *first* time we hear her?\n" +
    "### If I pushed on one thing\n" +
    "\"Come when you can. Come before you can\" is your best line, and right now it's buried mid-paragraph. Consider letting it end the section. The boots exchange already earns the close of the scene; the letter could earn the close of its own beat.",

    "### What's working\n" +
    "The scene order is doing quiet structural work — arrival, empty rooms, logbook, dinner, first night alone. Each scene hands the next one a question. The chapter reads like a tide coming in.\n" +
    "### Questions to sit with\n" +
    "- Scenes 2 and 3 both happen alone in the lighthouse with paper. They earn their separation (rooms vs. logbook), but watch the rhythm: two interior scenes back to back before the Roe house dinner.\n" +
    "- \"Tomas Knows Something\" as a synopsis promises the reader's suspicion will be confirmed at dinner. If the dinner only *deepens* the suspicion, the chapter still works — but the title-promise is the kind first readers remember.\n" +
    "### If I pushed on one thing\n" +
    "The answering light in scene 5 is the chapter's cliff-edge. It's currently one clause. A first chapter can afford to spend three or four sentences on the thing that keeps a reader up past their stop.",
  ],
  betaread: [
    "Reading cold, as someone who picked this up in a shop:\n" +
    "> The ferry came in low against the morning…\n" +
    "I'm in by the second clause. \"One good engine\" tells me about the island before I've seen it.\n" +
    "**Where I leaned in:** the letter. The moment I learned she'd unfolded it until the creases went soft, I stopped evaluating the prose and started worrying about her — that's the switch you want flipped. And \"come before you can\" made me put the page down for a second, in the good way.\n" +
    "**Where I drifted:** the paragraph about the mind keeping things child-sized. It's a lovely thought, but I'd just been given the lighthouse on the horizon and I wanted to keep walking toward it.\n" +
    "**What I believe so far:** Maren, completely. Tomas, completely. The island, completely.\n" +
    "**What I'm reading for:** what's in the rest of the letter. You've shown me one line of it. I noticed.",

    "Honest answer: no — and I think that's what you want.\n" +
    "Tomas reads as *safe* but not *open*. \"You'll want different boots\" is kindness wearing a disguise, and I clocked that he looked at her shoes instead of her face. By the end of the scene I trust him with Maren's life and not with her questions, which is exactly the gap the story seems to live in.\n" +
    "One reader-reaction to know about: because he's the only living adult she talks to in chapter I, my suspicion has nowhere else to go. If you want it spread thinner by the dinner scene, I'd need one more islander with a speaking line before then — even a harbour voice telling Tomas the tide table.",
  ],
  proofread: [
    "Four small things. Your prose is otherwise clean — I've touched nothing stylistic.\n" +
    "EDIT|a key that no longer fit a door|a key that no longer fitted a door|the narration is otherwise consistently British (harbour, grey); \"fitted\" matches\n" +
    "EDIT|the scale of the child who first feared them|the scale of the child who had first feared them|sequence of tenses — optional, the simple past also reads\n" +
    "NOTE|\"You'll want different boots\" — the apostrophe here is a straight quote; the rest of the scene uses curly quotes.\n" +
    "NOTE|Thornwick, Edda, Maren and Roe all match their Story Bible spellings. No stray variants found.",
  ],
  followup: [
    "Good pressure to put on it. If Lia knows too, the secret can't be a confidence — children keep facts, not discretion. It becomes something *visible*: a place, a habit, a grave tended out of season. Her map with the vanished place marked is the natural carrier; she doesn't know she's holding evidence, which lets Tomas's silence stay loyal rather than conspiratorial.\n" +
    "Practically: the letters option survives if Lia has simply *seen* the envelopes. The found-her option doesn't survive at all — you wouldn't let a child hold that.",
    "Then I'd protect that line at all costs — don't let anything in the same paragraph compete with it. The simplest cut: end the beat on it, white space, and let the causeway section start cold. You lose nothing; the reader gets to feel the echo.",
    "That tracks with how the chapter is built. If you want one concrete next step: draft the dinner scene with Tomas answering every question Maren asks — fully, honestly — except one. Silence is loudest when it's the exception.",
  ],
};

const AI_GREETING_TITLES = { brainstorm: "Brainstorm", critique: "Critique", betaread: "Beta read", proofread: "Proofread" };

let __aiReplyCursor = {};
function aiFakeReply(verb, turn) {
  if (turn > 1 && verb === "brainstorm") {
    const pool = AI_REPLIES.followup;
    const i = (__aiReplyCursor.followup = ((__aiReplyCursor.followup ?? -1) + 1) % pool.length);
    return pool[i];
  }
  const pool = AI_REPLIES[verb] || AI_REPLIES.brainstorm;
  const i = (__aiReplyCursor[verb] = ((__aiReplyCursor[verb] ?? -1) + 1) % pool.length);
  return pool[i];
}

/* ---- Seed conversations (manuscript-level objects) ------------------------- */

const AI_SEED_CONVOS = [
  {
    id: "cv-1", title: "What is Tomas holding back?", verb: "brainstorm", when: "Tue",
    messages: [
      {
        id: "m-1a", role: "you", verb: "brainstorm", when: "Tue 14:02",
        text: "Tomas knows something about Edda's death. What could he actually know that keeps him quiet but never lying?",
        ctx: { scene: "The Causeway", words: 1840, entities: ["Maren Vale", "Tomas Roe"], about: true, boundary: null, sel: null },
      },
      { id: "m-1b", role: "ai", verb: "brainstorm", when: "Tue 14:02", text: AI_REPLIES.brainstorm[0] },
      {
        id: "m-1c", role: "you", verb: "brainstorm", when: "Tue 14:11",
        text: "Which of those still works if Lia knows too?",
        ctx: { scene: "The Causeway", words: 1840, entities: ["Maren Vale", "Tomas Roe", "Lia Roe"], about: true, boundary: null, sel: null },
      },
      { id: "m-1d", role: "ai", verb: "brainstorm", when: "Tue 14:12", text: AI_REPLIES.followup[0] },
    ],
  },
  {
    id: "cv-2", title: "Chapter I pacing", verb: "critique", when: "Mon",
    messages: [
      {
        id: "m-2a", role: "you", verb: "critique", when: "Mon 21:40",
        text: "Look at chapter I as a whole — is the pacing across the five scenes working?",
        ctx: { scene: "The Causeway", words: 9120, entities: ["Maren Vale", "Tomas Roe", "Edda Vale"], extras: ["I · Low Tide (5 scenes)"], about: true, boundary: "ch-1", sel: null },
      },
      { id: "m-2b", role: "ai", verb: "critique", when: "Mon 21:41", text: AI_REPLIES.critique[1] },
    ],
  },
];

const AI_SEED_ABOUT = {
  synopsis: "Maren Vale returns to a tidal island to keep her dead grandmother's lighthouse for the three weeks the law requires — and finds a second keeper's name in the logbook that no one will explain.",
  genre: "Literary fiction with a quiet mystery",
  tone: "Restrained, atmospheric, cold-water melancholy",
  pov: "Third limited (Maren), past tense",
  notes: "UK spellings. Never suggest making the mystery louder — the book works by withholding.",
};

/* ---- Credit math (display-only; a meter, not a bill) ------------------------ */

// % of the monthly allowance already used, per Tweak state.
const AI_CREDIT_BASE = { plenty: 26, low: 87, empty: 100 };
const AI_RESET_LABEL = "Resets July 1";

// Rough size of an ask, as % of the monthly allowance. Words-in dominates.
function aiEstimate(ctx) {
  const words = (ctx.sceneWords || 0) + (ctx.extraWords || 0) + (ctx.selWords || 0) +
    (ctx.entityCount || 0) * 45 + (ctx.about ? 130 : 0) + (ctx.turns || 0) * 350;
  const pct = Math.max(0.2, Math.round((words / 4000) * 10) / 10);
  return { words, pct };
}

function aiMeterStatus(usedPct) {
  if (usedPct >= 100) return { cls: "out", label: "Used up", sub: AI_RESET_LABEL };
  if (usedPct >= 80) return { cls: "warn", label: "Running low", sub: AI_RESET_LABEL };
  if (usedPct >= 55) return { cls: "", label: "About half left", sub: AI_RESET_LABEL };
  return { cls: "", label: "Plenty left this month", sub: AI_RESET_LABEL };
}

/* ---- Fake streaming engine --------------------------------------------------- */

// Streams `text` word-by-word. Returns a cancel function.
function aiStream(text, onChunk, onDone) {
  const words = text.split(/(\s+)/);
  let i = 0;
  const id = setInterval(() => {
    if (i >= words.length) { clearInterval(id); onDone && onDone(); return; }
    onChunk(words.slice(i, i + 3).join(""));
    i += 3;
  }, 26);
  return () => clearInterval(id);
}

let __aiMsgN = 100;
function aiMsgId() { return "m-" + (__aiMsgN++); }

Object.assign(window, {
  AI_VERBS, AI_VERB_ORDER, AI_SEED_CONVOS, AI_SEED_ABOUT,
  AI_CREDIT_BASE, AI_RESET_LABEL,
  aiFakeReply, aiEstimate, aiMeterStatus, aiStream, aiMsgId,
});
