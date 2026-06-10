# Marketing Execution Plan — WritersNook

> Status: **execution plan (2026-06-10).** Companion to [`go-to-market.md`](./go-to-market.md)
> (strategy: pricing, positioning, segments) — this doc is the operational sequence: who does what,
> in what order, and where AI agents do the work vs. assist vs. stay out.
>
> Owner key: **[Cole]** human-only · **[AI]** agent does it end-to-end · **[Cole+AI]** AI drafts /
> researches, Cole reviews, personalizes, and is the public face.

## Operating principles

1. **AI never posts as Cole.** Reddit comments, HN replies, and outreach emails go out under Cole's
   name, in Cole's voice, after Cole edits. AI finds the threads, drafts the talking points, and
   preps Q&A — ghostwritten community presence is detectable and burns the exact trust the product
   sells. (Drafts are raw material, not scripts.)
2. **Nothing public until the launch preconditions clear** (HANDOFF: signed v0.3.0 published, Cole +
   partner hold license keys, E2E purchase verified live). Marketing drives traffic to a checkout
   that must already work.
3. **Time-box the drip.** Phase 2 is ~2-3 hrs/week of Cole's time, sustained, not a sprint. The
   AI-side work (SEO pages, research digests) is what compounds without Cole's hours.

---

## Phase 0 — Launch-ready assets (now → launch week)

Goal: when the first spike of strangers hits writersnook.app, the page converts and we can see it.

| # | Item | Owner | Notes |
|---|---|---|---|
| 0.1 | Finish launch infra sequence | [Cole+AI] | Already tracked in HANDOFF (signing → E2E → v0.3.0 → keys). Blocks everything below. |
| 0.2 | **Demo GIF / 30-sec video** on landing page | [Cole+AI] | AI writes the shot list + script (binder → write → automatic backup beat); Cole screen-records (OBS, free); AI compresses/embeds it. The single mandatory missing asset. |
| 0.3 | Privacy-friendly analytics on marketing site | [Cole] | **2-min one-click (verified 2026-06-10):** CF dashboard → Pages project → Metrics → Enable Web Analytics — auto-injects on next deploy, no code. (A commented manual-beacon fallback is already in every page; if using it instead, register the analytics site under `writersnook.app`, NOT `*.pages.dev` — CORS.) |
| 0.4 | OG/social-card meta tags + favicon | [AI] | ✅ **DONE 2026-06-10** — canonical + OG/twitter tags on all 17 pages; favicon.png uses the real logo mark on a parchment tile (regen source: `public/favicon-source.html`); og-card.png (1200x630) from `public/og-card.html`. Regen recipe in `marketing/.claude/vendor-gotchas/cloudflare-pages.md`. |
| 0.5 | Testimonials block on landing page | [Cole+AI] | Cole asks writing partner + first buyers (AI drafts the ask-email); AI builds the section. 3-5 short quotes with first names. |
| 0.6 | Press-kit page (`/press`) | [AI] | ✅ **DONE 2026-06-10** — `press.html` live in site chrome (boilerplate, fact sheet, founder line, logo downloads), linked from footer on all pages. App screenshots still "on request" — add real ones when the demo assets get made (0.2). |
| 0.7 | Defensive `writersnook.ca` + trademark first-pass | [Cole] | Carried from GTM doc TODOs. ~10 min + ~$15/yr. Do before the name is on HN's front page, not after. |

## Phase 1 — Launch moments (launch week, one-shot posts)

Goal: 2-3 traffic spikes, first cohort of strangers' money, backlinks.

| # | Item | Owner | Notes |
|---|---|---|---|
| 1.1 | **Show HN post** | [Cole+AI] | AI drafts title variants + body (lead: local-first, one-time, no account, no AI, solo dev, Tauri — HN catnip) **and a prep doc of the 15 questions HN will ask** (Why not Obsidian? Electron? What's the sync story? Source available?) with honest answers. Cole posts from his account, replies all day. Tue-Thu morning ET. |
| 1.2 | Product Hunt listing | [Cole+AI] | AI writes tagline/description/gallery copy; Cole creates the listing. Same week as 1.1, not same day. |
| 1.3 | r/SideProject + r/indiehackers posts | [Cole+AI] | AI drafts the "I built this" narrative (the *story* — solo dev, wife/partner first user, no-subscription stance); Cole posts. |
| 1.4 | Launch email to newsletter list | [AI] | The newsletter endpoint already exists — whatever signups accumulate pre-launch get the founder-price announce. AI drafts + Cole approves send. |
| 1.5 | Post-launch retro (1 week after) | [AI] | Read analytics: which channel sent buyers vs. bouncers. Adjust Phase 2 weighting. |

## Phase 2 — The drip (ongoing, weekly cadence)

Goal: be findable and credible where writers already complain about their tools. This is where the
actual customers are; it's slower and it's mostly Cole-facing with AI doing the legwork.

| # | Item | Owner | Cadence | Notes |
|---|---|---|---|---|
| 2.1 | **Reddit/forum thread digest** | [AI] → [Cole] | Weekly | Scheduled agent scans r/writing, r/selfpublish, r/scrivener (+ writing Discords' public indexes) for live threads matching "Scrivener alternative / subscription fatigue / no-AI writing app", returns links + suggested angle per thread. Cole answers 2-4 genuinely, in his voice, links only when on-topic. **Never automated posting.** |
| 2.2 | **AuthorTube outreach** | [Cole+AI] | Batch of ~10, then monthly follow-ups | AI researches the target list (writing-software reviewers, 5k-100k subs, with contact emails + what they've reviewed + a personalization hook each); AI drafts the offer email (free key, no strings, honest "small indie app" framing); Cole sends from his address. Kindlepreneur excluded (owns Atticus). |
| 2.3 | **SEO comparison pages** on writersnook.app | [AI] | 1 page every 1-2 weeks | The compounding asset. Priority order: "WritersNook vs Scrivener" → "Writing apps without AI (2026)" → "One-time-purchase writing software" → "WritersNook vs Dabble" → "Scrivener alternatives for Windows". Honest, concede-what-they-do-better tone — fairness is the conversion lever AND the positioning. AI writes + builds in `marketing/`; Cole reviews facts/claims before each ships. |
| 2.4 | Microsoft Store listing | [Cole+AI] | One-time | AI preps the MSIX config (Tauri emits it) + listing copy; Cole owns the dev-account signup (free since 2025) and submission. Trust signal + Windows discovery. |
| 2.5 | itch.io page | [AI] → [Cole] | One-time | AI drafts the page; Cole creates the account. Low effort, community/feedback channel. |
| 2.6 | Testimonial harvesting | [Cole+AI] | Monthly | AI drafts a post-purchase "how's it going?" email template; quotes feed back into landing + comparison pages. |

## Phase 3 — November writing-season push (prep starts ~Oct 1)

The November novel-in-a-month tradition outlived the NaNoWriMo org (shut down early 2025); the
season still drives the year's biggest "I need a writing app" demand spike via community successors
+ r/nanowrimo.

| # | Item | Owner | Notes |
|---|---|---|---|
| 3.1 | Verify where the November community actually is (successor events, Discords) | [AI] | Research pass late Sept — landscape was still settling post-shutdown. |
| 3.2 | **Founder-price deadline decision** | [Cole] | GTM doc says ~3 months of founder price then $49. If launch is ~July, the window ends ~October — decide whether to extend through Nov 30 ("founder price ends with NaNo season" is a clean urgency line) or raise on schedule and run a separate November promo. Flag: don't run "discount" messaging twice in 3 months; pick one. |
| 3.3 | Season landing variant + posts | [Cole+AI] | "Write your November novel in WritersNook" angle; AI drafts page + post copy; Cole posts in season communities per 2.1 rules. |
| 3.4 | Late-Oct push week | [Cole+AI] | Concentrated version of Phase 2: digest → answers → outreach round 2 to AuthorTube (Oct = when they publish tool-roundup videos). |

## What we deliberately skip (from GTM research — don't relitigate without new data)

- Paid ads (CAC > price at $29-49)
- Steam (writing apps invisible there)
- AppSumo / lifetime-deal sites (~70% take, refund-heavy buyers)
- "No AI" as the headline (tie-breaker, not hook — ownership leads)
- Raw Stripe direct (tax compliance lands on Cole)

## AI involvement map (summary)

**AI end-to-end (agent sessions in this repo):** analytics + OG tags + press kit + comparison pages
(real `marketing/` code/content work, normal review gates) · launch email · retro analysis ·
research digests + outreach target list (scheduled/cloud agents for the weekly scan).

**AI drafts, Cole fronts:** every public post (HN/PH/Reddit), every outreach email, demo script.
The split is mechanical-vs-trust: AI does anything a stranger can't tell was delegated; Cole does
everything where a human being is the point.

**Cole only:** accounts + dashboards (HN, PH, MS Store, itch), recording the demo, replying in
threads, the founder-price/positioning judgment calls, `.ca` + trademark.

## First three moves (in order, after launch preconditions clear)

1. ~~AI ships 0.4 + 0.6 (social cards, favicon, press kit)~~ ✅ done 2026-06-10.
2. ~~Show HN draft + Q&A prep doc (1.1)~~ ✅ drafted 2026-06-10 → [`show-hn-launch-kit.md`](./show-hn-launch-kit.md) — Cole: answer the **[CONFIRM]** items in it (open-source stance, export formats, trial mechanics, offline activation behavior).
3. Demo GIF (0.2) — Cole records ~10 min of footage from AI's shot list (ask any session: "write the demo shot list"). Plus the 2-min analytics click (0.3).
