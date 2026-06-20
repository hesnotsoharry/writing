# Show HN Launch Kit — Writers Nook

> Status: draft (2026-06-10). For Cole to edit into his own voice and post from his own HN account.
> Companion to [`marketing-execution-plan.md`](./marketing-execution-plan.md) item 1.1.
> **Do not post until launch preconditions clear** (signed v0.3.0 live, checkout verified, license
> keys held). Items marked **[CONFIRM]** need Cole's answer before posting — HN will ask, and a
> wrong or evasive answer there costs more than the post earns.

## Posting mechanics

- **URL field:** `https://writersnook.app` · **Title:** pick below (≤80 chars). Show HN posts may
  include a text body — use the draft; it shows up under the link.
- **Timing:** Tuesday–Thursday, 8–10am Eastern. Avoid US holidays and big-news days.
- **Be present:** the first 2 hours decide everything. Clear the morning; answer every substantive
  comment quickly, plainly, non-defensively. Conceding a fair criticism ("yep, fair — it doesn't do
  X yet") plays far better on HN than spin.
- **Never** ask anyone to upvote, share the link asking for support, or post from a brand-new
  account if an older one exists — HN's voting-ring detection buries posts for this.
- If it doesn't take off (most don't), that's normal: one reshare attempt weeks later with a
  different title is acceptable per HN convention. Don't delete-and-repost same week.

## Title options (pick one, edit freely)

1. `Show HN: Writers Nook – a local-first novel-writing app (one-time purchase)`
2. `Show HN: I built a calm, local-first writing app for novelists – no AI, no accounts`
3. `Show HN: A Scrivener alternative that's local-first, one-time purchase, no AI`

Recommendation: **1**. Option 3 borrows Scrivener's name for recognition but invites "it's not as
powerful as Scrivener" as the top comment frame. Option 2 leads with negations; 1 leads with what
it *is*.

## Body draft (~300 words — edit into your voice; the personal opening matters most)

---

I built Writers Nook for a writer close to me. She wanted somewhere to write a novel that wasn't a
subscription, didn't push AI into the draft, and didn't quietly upload her manuscript anywhere — and
the options were basically Scrivener (powerful, but showing its age) or markdown editors that don't
understand novels. So I built the tool she wanted, and it turned out other writers wanted it too.

It's a Windows desktop app (macOS planned): a Scrivener-style binder for chapters and scenes, a
distraction-free editor, character/world notes alongside the manuscript, and automatic backup. Your
work lives in local files on your machine. No account is needed to write, nothing you type touches a
server, and there's no telemetry reading your manuscript.

Technical notes, since this is HN:

- Tauri 2 + React + TipTap. The editor state is a Yjs CRDT document per scene, persisted to a local
  SQLite database. Yjs for a single-user app sounds odd, but it gives a robust undo manager today
  and makes future device sync a transport problem instead of a rewrite.
- One Yjs doc per scene (not per manuscript) keeps load/save constant-time as a novel grows.
- Auto-update via signed releases; the updater verifies signatures before installing.

Deliberate non-features: no AI, no cloud storage of your writing, no subscription. It's a one-time
purchase ($29 founder price, $49 after) because the running cost is near zero by design — there's no
server farm to feed.

I'm a solo dev and this started as a side project / a gift. Happy to answer anything about the
Yjs/SQLite design, Tauri vs. Electron, or the no-AI/local-first positioning. Honest criticism
welcome — that's why I'm here.

---

## Q&A prep — the questions HN will ask

**1. "Why not just use Obsidian (free) + a plugin?"**
Fair — Obsidian is excellent. Differences: Writers Nook is built around the novel as a structure
(binder, scenes, manuscript order, compile-toward-a-book) rather than a knowledge graph; zero setup;
and it's for writers who don't want to assemble a tool from plugins. If you love Obsidian, keep it.

**2. "Scrivener is $59.99 and more powerful. Why this?"**
Concede the power point. Position: Scrivener does ~500 things; most novelists use ~30 of them and
pay a learning-curve tax on the rest. Writers Nook does the 30 well, looks like it was designed this
decade, and is calmer to sit in for a 6am writing session. Also Windows-first: Scrivener's Windows
version has historically lagged its Mac sibling.

**3. "Why Tauri over Electron?"** — System WebView2 instead of bundling Chromium: smaller installer,
lighter on RAM, Rust shell. Tradeoff acknowledged: WebView2 quirks exist; for a single-platform
launch they're manageable.

**4. "Is it open source?" [CONFIRM stance before posting]**
Suggested honest answer if staying closed: "Not currently. It's a paid product funding its own
development, and I'd rather sell software than support a fork ecosystem solo. The file format is the
part you should care about being open — your work is in a local SQLite file, and exports are
[formats], so you're never locked in." HN respects a direct "no, and here's why" far more than a
dodge. **Decide before posting; this WILL be asked.**

**5. "What's the file format? Am I locked in? What exports exist?" [CONFIRM export formats]**
Need the exact, true answer: what export formats exist today (docx? plain text? markdown?), and
what happens to a writer's files if they stop using the app. This is the #1 trust question for a
local-first pitch. If exports are thin today, say so and say what's planned.

**6. "Where's sync / mobile?"** — Honest: not yet, Phase 2. The Yjs foundation was laid on day one
specifically so sync is additive, not a rearchitecture. Likely a paid optional service (~$4/mo,
Obsidian Sync pricing) — the app itself stays one-time-purchase, and you can already point backups
at your own Dropbox/OneDrive folder for free.

**7. "Why does a single-user app need a CRDT?"** — Undo manager for free today; sync later without
rewriting persistence. Also per-scene docs keep performance flat as manuscripts grow.

**8. "macOS? Linux?"** — macOS planned (Tauri makes the port tractable; it's a polish-and-platform
problem, not a rewrite). Linux: honest answer about whether it's on the map. [CONFIRM stance]

**9. "Isn't 'no AI' just a gimmick / marketing by negation?"**
"It's not anti-AI ideology — it's that a drafting room shouldn't have a vendor's roadmap in it.
~7% of writers use AI to generate text (Authors Guild); the other 93% are the customers here. If
you want AI in your workflow, plenty of tools do that well; this one promises your draft is yours
and nothing reads it."

**10. "Why $29/$49 and not free/freemium?"** — Near-zero running cost by design, so one-time pricing
is sustainable; freemium requires a growth engine and support load a solo dev shouldn't take on. A
trial exists [CONFIRM trial mechanics — length, no-card?] so nobody buys blind.

**11. "What happens to my novel if you get hit by a bus / lose interest?"**
Strong answer available, use it: the app has no server dependency for writing — it keeps working
forever as installed, your files are local SQLite + your own backup folder, and exports mean the
manuscript outlives the app. Contrast quietly with subscription tools that brick on lapse.
[CONFIRM: does license activation require network on fresh install? If yes, have an honest answer
about what happens long-term — e.g., a planned offline-activation fallback or key-server escrow.]

**12. "Single SQLite file — corruption risk?"** — Per-scene Yjs docs in SQLite (WAL), plus the
automatic backup feature snapshotting off-machine. [CONFIRM backup mechanics wording: where do
backups go, how often, is it versioned?]

**13. "Windows installer — signed? SmartScreen?"** — Signed via Azure Trusted Signing (Authenticode);
auto-updates verify signatures. [CONFIRM this is live before posting — it's in flight as of
2026-06-10.]

**14. "Who is this for vs. Word/Docs?"** — Novelists managing a 50–100k-word multi-scene project.
Word/Docs are fine for documents; they're miserable for restructuring act 2 of a novel. The binder +
scene model is the point; the calm is the differentiator.

**15. "License key but 'no account'? DRM?"** — Be precise and honest: a one-time key unlocks the
app; writing never requires being online or signed in; the key system exists so purchases fund the
project, not to surveil usage. [CONFIRM exact offline behavior so the answer is precise.]

## Pre-post checklist

- [ ] Launch preconditions from HANDOFF cleared (signed v0.3.0 published, live checkout verified)
- [ ] All [CONFIRM] items above answered and folded into the body/Q&A
- [ ] Demo GIF live on writersnook.app (HN clicks through; the page must show the product moving)
- [ ] Analytics enabled (Pages → Metrics → Enable Web Analytics) — else we can't measure the spike
- [ ] Founder-price banner accurate on site (HN posts archive forever; don't show a dead promo)
- [ ] Cole's calendar clear for 2–3 hours post-submission
