/* ============================================================================
   Sample content for the prototype — an original literary novel-in-progress.
   "The Salt Year" by a beginning novelist. Plus a fragments collection.
   ========================================================================== */

// Prose paragraphs reused for the open scene. Original text.
const SCENE_PROSE = [
  "The ferry came in low against the morning, its one good engine coughing as Maren stepped onto the causeway. Thornwick rose out of the water the way she remembered it — grey, patient, indifferent to whether she had come back at all.",
  "She had told no one she was coming. There was no one left to tell. The letter in her coat pocket had been folded and unfolded so many times that the creases had gone soft as cloth, and she did not need to read it again to hear her grandmother's voice in the lines.",
  "“The light still needs keeping,” Edda had written, in the last month before the silence. “Whatever else you decide, the light needs keeping. Come when you can. Come before you can.”",
  "Maren had not come before she could. She had come three weeks too late, with a key that no longer fit a door she half hoped would be locked.",
  "The lighthouse stood at the far end of the island where the land thinned to a wrist of black rock. From the causeway it looked smaller than it lived in her memory — but everything from childhood did, she supposed. The mind kept things at the scale of the child who first feared them.",
  "Tomas was waiting by the harbour wall with his hands in his pockets and the particular stillness of a man who has decided not to say the obvious thing. He nodded at her bag, at her good shoes, at the whole unsuitable fact of her.",
  "“You'll want different boots,” was all he said.",
];

const PROJECTS = [
  { id: "p-salt", title: "The Salt Year", type: "novel", words: 41280, target: 80000 },
  { id: "p-frag", title: "Fragments & Short Pieces", type: "collection", words: 6430, target: null },
];

// Tree for the active project (The Salt Year).
const TREE = {
  chapters: [
    {
      id: "ch-1",
      title: "I · Low Tide",
      words: 9120,
      scenes: [
        { id: "s-1", title: "The Causeway", words: 1840, status: "draft",
          synopsis: "Maren returns to Thornwick three weeks after Edda's death. Tomas meets her at the harbour. Establishes the island, the letter, the unkept light.",
          characters: ["Maren Vale", "Tomas Roe"], locations: ["Thornwick Island", "The Causeway"] },
        { id: "s-2", title: "An Empty Lighthouse", words: 2210, status: "final",
          synopsis: "She lets herself in. The keeper's rooms, exactly as left. The logbook open to a half-finished entry.",
          characters: ["Maren Vale"], locations: ["The Lighthouse"] },
        { id: "s-3", title: "What the Logbook Said", words: 1670, status: "revise",
          synopsis: "Maren reads back through Edda's last entries and finds a name she doesn't recognise.",
          characters: ["Maren Vale", "Edda Vale"], locations: ["The Lighthouse"] },
        { id: "s-4", title: "Tomas Knows Something", words: 1410, status: "outline",
          synopsis: "Dinner at the Roe house. Tomas is careful; his daughter is not.",
          characters: ["Maren Vale", "Tomas Roe", "Lia Roe"], locations: ["The Roe House"] },
        { id: "s-5", title: "The First Night", words: 1990, status: "draft",
          synopsis: "Alone in the tower. The lamp mechanism, the wind, a light answering from the mainland that should not be there.",
          characters: ["Maren Vale"], locations: ["The Lighthouse"] },
      ],
    },
    {
      id: "ch-2",
      title: "II · The Causeway Floods",
      words: 11700,
      scenes: [
        { id: "s-6", title: "Cut Off", words: 2050, status: "draft",
          synopsis: "Spring tide takes the causeway. Maren is stranded on the island for the first time as an adult.",
          characters: ["Maren Vale", "Tomas Roe"], locations: ["The Causeway", "Thornwick Island"] },
        { id: "s-7", title: "The Other Keeper", words: 2380, status: "revise",
          synopsis: "She traces the unfamiliar name to a second keeper Edda never mentioned. The story complicates.",
          characters: ["Maren Vale", "Edda Vale"], locations: ["The Lighthouse"] },
        { id: "s-8", title: "Lia's Map", words: 1620, status: "outline",
          synopsis: "Lia shows Maren a child's map of the island with a place marked that no longer exists.",
          characters: ["Maren Vale", "Lia Roe"], locations: ["Thornwick Island"] },
        { id: "s-9", title: "Low Water", words: 2540, status: "draft",
          synopsis: "At the lowest tide of the year, the old jetty surfaces. Maren walks out to it.",
          characters: ["Maren Vale"], locations: ["The Old Jetty"] },
      ],
    },
    {
      id: "ch-3",
      title: "III · What the Storm Left",
      words: 6240,
      scenes: [
        { id: "s-10", title: "The Glass House", words: 1880, status: "outline",
          synopsis: "The greenhouse where Edda grew impossible things. A door Maren was never allowed through.",
          characters: ["Maren Vale", "Edda Vale"], locations: ["The Glass House"] },
        { id: "s-11", title: "Names on the Wall", words: 1460, status: "blank",
          synopsis: "Pencilled keeper names going back a century — and one scratched out.",
          characters: ["Maren Vale"], locations: ["The Lighthouse"] },
        { id: "s-12", title: "Tomas, Finally", words: 0, status: "blank",
          synopsis: "The conversation he's been avoiding since the harbour.",
          characters: ["Maren Vale", "Tomas Roe"], locations: ["The Roe House"] },
      ],
    },
  ],
  shortPieces: [
    { id: "sp-1", title: "Opening — alt. version", words: 740, status: "revise",
      synopsis: "A colder open: start at the funeral, not the ferry.", characters: ["Maren Vale"], locations: [] },
    { id: "sp-2", title: "Edda, a sketch", words: 520, status: "draft",
      synopsis: "Free-write to find the grandmother's voice.", characters: ["Edda Vale"], locations: [] },
  ],
};

const CHARACTERS = [
  { id: "c-1", name: "Maren Vale", role: "Protagonist", color: "character", initial: "M",
    notes: "34. Cartographer, lives inland now. Came back to keep a light she doesn't believe in. Competent, guarded, allergic to being needed.",
    scenes: 10, arc: "From outsider to keeper" },
  { id: "c-2", name: "Edda Vale", role: "Grandmother (deceased)", color: "character", initial: "E",
    notes: "The previous keeper. Present only in logbooks, letters, and the things she grew. Kept one secret too long.",
    scenes: 4, arc: "Revealed posthumously" },
  { id: "c-3", name: "Tomas Roe", role: "Ferryman", color: "character", initial: "T",
    notes: "60s. Knew Edda all his life. Knows the thing Maren has come to find out. Won't say it; won't lie either.",
    scenes: 4, arc: "Reluctant witness" },
  { id: "c-4", name: "Lia Roe", role: "Tomas's daughter", color: "character", initial: "L",
    notes: "11. The only person on Thornwick who tells Maren the truth, mostly by accident.",
    scenes: 2, arc: "Catalyst" },
];

const LOCATIONS = [
  { id: "l-1", name: "Thornwick Island", color: "location", initial: "T",
    notes: "A tidal island, reachable by causeway only at low water. Population: eleven and falling.", scenes: 5 },
  { id: "l-2", name: "The Lighthouse", color: "location", initial: "L",
    notes: "Edda's, and now Maren's. Keeper's rooms below, lamp above. The logbook lives on the desk.", scenes: 6 },
  { id: "l-3", name: "The Causeway", color: "location", initial: "C",
    notes: "Black rock and barnacle. Floods twice a day; floods completely at spring tide.", scenes: 3 },
  { id: "l-4", name: "The Roe House", color: "location", initial: "R",
    notes: "Warm, cluttered, full of the life the lighthouse lacks.", scenes: 2 },
  { id: "l-5", name: "The Old Jetty", color: "location", initial: "J",
    notes: "Surfaces only at the lowest tides. Where the second keeper's story begins.", scenes: 1 },
  { id: "l-6", name: "The Glass House", color: "location", initial: "G",
    notes: "Edda's greenhouse. Impossible plants. A locked inner door.", scenes: 1 },
];

const QUICK_NOTES = [
  { id: "qn-1", body: "Lighthouse lamp: research actual Fresnel rotation speed — Maren would know the exact number.", when: "2 days ago", status: "open" },
  { id: "qn-2", body: "What if the scratched-out name on the wall is a Vale? Earlier than Edda. Sets up Chapter III turn.", when: "yesterday", status: "open" },
  { id: "qn-3", body: "Tomas line: \"You'll want different boots.\" — use as a refrain, ends the book on it.", when: "5 hours ago", status: "open" },
  { id: "qn-4", body: "Tide table for spring — the flood scene needs the real timing to feel earned.", when: "just now", status: "open" },
];

const STATUS_META = {
  blank:   { label: "To write", dot: "var(--ink-4)" },
  outline: { label: "Outlined", dot: "var(--note)" },
  draft:   { label: "Drafting", dot: "var(--accent)" },
  revise:  { label: "Revising", dot: "#6a86a8" },
  final:   { label: "Final",    dot: "var(--good)", done: true },
};
const STATUS_ORDER = ["blank", "outline", "draft", "revise", "final"];

// A second manuscript so the switcher has somewhere to go.
const FRAG_TREE = {
  chapters: [
    { id: "fc-1", title: "Tideline — a cycle", words: 560, scenes: [
      { id: "f-1", title: "i. Spring", words: 210, status: "final",
        synopsis: "The highest water of the year, in fourteen lines.", characters: [], locations: ["Thornwick Island"] },
      { id: "f-2", title: "ii. Neap", words: 190, status: "revise",
        synopsis: "The slack between tides. Stillness as dread.", characters: [], locations: [] },
      { id: "f-3", title: "iii. Slack water", words: 160, status: "draft",
        synopsis: "A turn that won't quite land yet.", characters: [], locations: [] },
    ] },
  ],
  shortPieces: [
    { id: "f-4", title: "The Coat", words: 1200, status: "draft",
      synopsis: "Flash piece — an inherited coat that doesn't fit.", characters: [], locations: [] },
    { id: "f-5", title: "Ferryman, a sketch", words: 640, status: "outline",
      synopsis: "Origins for Tomas. Possibly non-canon.", characters: ["Tomas Roe"], locations: [] },
    { id: "f-6", title: "Untitled, 3am", words: 90, status: "blank",
      synopsis: "", characters: [], locations: [] },
  ],
};

const TREES = { "p-salt": TREE, "p-frag": FRAG_TREE };

// Rich per-entity detail for the full-entry screen. Additive + sparse: only
// the showcased entities are authored; everything else falls back to its
// `notes` + computed scene appearances + empty (promptable) fields.
const ENTITY_DETAILS = {
  "c-1": {
    portrait: "portrait-maren.png",
    facts: { Age: "34", Occupation: "Cartographer", Status: "Living", "First appears": "I · 1" },
    sections: {
      appearance: "Lean and weather-set, with the squint of someone who reads landscapes for a living. Keeps her hair cropped short so the wind can't argue with it. Wears Edda's oilskin coat though it hangs wrong on her — the one inheritance she has let herself keep.",
      goals: "On paper: settle the estate, keep the light the three weeks the law requires, and leave before the spring tide. Underneath, unspoken: to prove she never needed the island — or the woman who raised her on it.",
      backstory: "Orphaned at six and raised on Thornwick by her grandmother. Left at eighteen for a mainland map-maker's certificate and did not come back — not for holidays, not for the funeral she missed by three weeks. Maps let her hold a place at arm's length: all coastline, no weather.",
      voice: "Clipped. Understates everything that matters and over-explains everything that doesn't. Answers a hard question with a question of her own. Says “fine” the way other people say “leave me alone.”",
    },
    people: [
      { id: "c-2", relation: "Grandmother · deceased" },
      { id: "c-3", relation: "Wary ally" },
      { id: "c-4", relation: "Unlikely confidante" },
    ],
  },
  "l-2": {
    facts: { Region: "Thornwick, north point", Type: "Working light", Established: "1871", "First appears": "I · 2" },
    sections: {
      significance: "The reason anyone still lives on Thornwick, and the reason Maren came back. Almost every turn of the book is either decided here or discovered here.",
      atmosphere: "Cold stone that never quite warms through. Paraffin, brass polish, sea-damp. After dark the lamp throws the same slow revolving shadow it has thrown for a hundred and fifty years.",
      description: "Edda's, and now Maren's. Keeper's rooms below — a bed, a stove, a desk with the logbook always open. The lamp above still turns by clockwork if you wind it. A locked cabinet that no key in the house will open.",
      history: "Lit in 1871 after the Maundy wreck took forty souls on the north reef. Kept by a Vale, or a Vale's hire, ever since. The light has failed exactly twice — once in the war, and once on the night Edda died.",
    },
    people: [
      { id: "c-1", relation: "Keeper" },
      { id: "c-2", relation: "Former keeper · deceased" },
      { id: "c-3", relation: "Frequent visitor" },
    ],
  },
};

Object.assign(window, {
  SCENE_PROSE, PROJECTS, TREE, FRAG_TREE, TREES, CHARACTERS, LOCATIONS, QUICK_NOTES, STATUS_META, STATUS_ORDER,
  ENTITY_DETAILS,
});
