# Go-to-Market — pricing, model, distribution, Canadian logistics

> Status: **strategy draft (2026-06-04).** Decision-support, not a locked decision. Captures the
> output of a deep market-research pass (6 parallel research agents + adversarial price verification,
> run 2026-06-04). Numbers are USD unless noted. Revisit before any public launch.
>
> This doc orients the launch; it does not commit code or spend. Treat the price points as
> well-grounded recommendations, not final values — confirm against live competitor pricing and a
> Canadian accountant before going live.

> **Companion doc:** [`launch-infra-checklist.md`](./launch-infra-checklist.md) — the operational
> side: full stack + costs, per-service setup status (Cloudflare / Resend / Lemon Squeezy / Wise /
> Azure / Supabase), the licensing + account architecture, secrets list, and gotchas. This doc is
> strategy; that one is the build/launch checklist.

## The one-line position

A **modern, calm, local-first desktop writing app — one-time purchase, no AI, with painless backup
built in.** It fills a structurally empty seat: the no-AI / one-time quadrant is occupied only by
Scrivener (powerful but dated, ~15-yr-stale price, "hard to learn"), iA Writer (bare minimalist
markdown), and Atticus (really a formatting tool). Nobody owns *modern + calm + owns-your-data +
one-time + backup-included*. That gap is **product-character**, not price — which makes it defensible.

Lead with **ownership**, not opposition: *"Your writing, on your machine, forever — no account, no
subscription, no AI training."*

## Why now (market tailwinds, verified 2026-06-04)

- **Subscription fatigue is documented.** Ulysses switched to subscription (2017) → 2.5 stars in
  days → never regained its default-Mac-writing-app slot. Scrivener's perpetual license became its
  moat. In 2024–25 Affinity relaunched **free** and Obsidian dropped its commercial license. The
  category is fleeing recurring fees.
- **"No AI" is a trust signal, not a gimmick** — but it tested as a **MODERATE wedge: a tie-breaker
  / reassurance, not a headline.** Authors Guild data: only ~7% of writers use AI to generate text;
  ~91% want disclosure when AI is used. Recent flashpoints: a 600-signature anti-AI-book author
  petition (within hours), Hachette pulling a contracted novel over suspected AI, and Grammarly
  being sued over an AI feature that impersonated writers. So: keep "no AI" as the quiet
  reassurance underneath an ownership-first pitch — do **not** make it the marquee line.

## Target segments (ranked by fit)

| Rank | Segment | Why | Willingness to pay |
|---|---|---|---|
| 1 | **Self-published / indie authors** | $1.25B market, +264% titles in 5 yrs, explicitly reject subscription creep, juggle many projects (backup matters) | $50–150 one-time; resist $20+/mo |
| 2 | **Hobbyist / NaNoWriMo novelists** | Largest absolute population, privacy-leaning, convert from free tools when they hit a wall | $30–65 one-time |
| 3 | Professional / full-time writers | High WTP, value data ownership | $50–300 one-time |
| ✗ | Screenwriters / students | Want cloud + collaboration + AI — **misaligned**; ignore for launch | — |

Overlap of the two best segments → **~$45–65 one-time** is the demand-set price anchor.

## Pricing & model (Obsidian playbook: perpetual app + optional honest sync)

| Tier | Price | Notes |
|---|---|---|
| **App (one-time, perpetual)** | **$49 USD** | Deliberately under Scrivener's $59.99 — "the modern, calm alternative for less." Free point updates; optional paid major-version upgrade (~$19–25) every couple years *if* a v2 ever ships. |
| **Launch / founder price** | **$29–34** for first ~3 months | Seeds reviews + word-of-mouth (the biggest lever for an unknown indie tool), then raise to $49. Early buyers feel smart, not gouged. |
| **Device Sync (Phase 2)** | **$4/mo billed annually (~$40/yr)** or **$5/mo monthly** | Matches Obsidian Sync to the dollar — the price writers already accept. End-to-end encrypted relay; no server-side storage of user content (LS compliance, 2026-06-09). |
| **Free local backup (in base app)** | **$0 — point at the user's own Dropbox/OneDrive folder** | Defuses the "why pay $5/mo when Dropbox exists" objection. Paid sync becomes "we make it effortless," not "we hold your backups hostage." |
| **Trial** | **21–30 days, no credit card** | Trial *length* barely affects conversion; *no-card* + *let them import a real project* matter a lot. **No permanent free tier** — pure support burden, no revenue for a solo dev. |

Reference competitor prices (USD, verified 2026-06-04): Scrivener $59.99 one-time · iA Writer
$49.99 Mac / $29.99 Win · Atticus $147 one-time · Obsidian free core + $4–5/mo Sync (10 GB) ·
Ulysses $5.99/mo · Dabble $9–29/mo or $699 lifetime · AI-first tools (Sudowrite $10–44/mo, Squibler
$30–90/mo, Novelcrafter $4–20/mo BYOK) are a different market.

## Distribution

- **Primary: Lemon Squeezy** (direct checkout). 5% + $0.50/txn, and — critically — **Merchant of
  Record**: they are the legal seller to end customers and collect/remit US state sales tax, EU/UK
  VAT, AU GST, etc. You never register in those jurisdictions. This is the single biggest
  keep-it-a-side-project lever (see Canada notes). Paddle is the equivalent alternative.
- **Secondary: Microsoft Store** — free to list (MS waived dev-account fees in 2025), Windows
  discovery + trust signal; Tauri produces the MSIX. Link Store → site → Lemon Squeezy checkout.
- **Tertiary: itch.io** — feedback/community channel, not primary revenue.
- **Do NOT use raw Stripe direct** — headline 2.9% + $0.30 balloons to ~8–12% effective once you add
  currency conversion + global tax compliance, all of which lands on you.
- **Skip Steam** (writing apps are invisible there) and **skip a custom license-key server** until
  Phase 2 (paid sync) forces per-user entitlement.

## Canadian logistics (Cole is Canadian)

- **Price in USD, not CAD.** Market prices in USD; most buyers are American. $49 USD ≈ $67 CAD;
  Canadians are used to USD software pricing. CAD pricing would read small/local internationally.
- **Take payouts via Wise (or similar), not the bank's default USD→CAD conversion** — banks skim
  2–4%; on a side project that's the whole margin.
- **Merchant-of-Record matters more for a solo Canadian dev.** Because Lemon Squeezy is the legal
  seller, your relationship simplifies to: LS pays *you* (one payer) → you report it as Canadian
  business income. You never touch foreign sales tax.
- **Your own obligations (confirm specifics with a Canadian small-business accountant — this changes
  whether you register, so don't guess):**
  - Income tax: sole proprietor reports on **form T2125** with the personal return — no incorporation
    needed at side-project scale. Incorporate later only if it grows.
  - **GST/HST small-supplier threshold ≈ CAD $30,000** revenue over four consecutive quarters. Under
    it, generally no need to register/charge GST/HST. The wrinkle: under the MoR model LS is the
    seller, so what counts toward *your* threshold is the payout relationship — exactly the nuance an
    accountant should confirm.
  - Keep every record from day one (LS statements, Wise conversions, deductible business expenses) —
    makes the accountant conversation short and the deductions clean.

## Branding / domain

- **Name: Writer's Nook.** Primary domain **`writersnook.app`** (purchased 2026-06-04).
- **Why `.app`:** thematically exact (it *is* an app), globally neutral (no `.ca` "local business"
  signal — same logic as USD pricing), and HSTS-preloaded so every `.app` is forced to HTTPS at the
  browser level — a free trust reinforcement for a product whose whole pitch is data safety/ownership.
  Any host serves this with free SSL; zero extra work.
- **`.com` is a squatter** (checked 2026-06-04) — no active business, so no brand-confusion or
  trademark-collision concern. Safe to build the name out.
- **TODO (cheap insurance):** register **`writersnook.ca`** defensively and redirect → `.app`
  (protects the brand + catches the obvious Canadian guess). Watch `.com` in case it lapses.
- **TODO (do before the name goes on anything permanent):** first-pass trademark search on
  Canada CIPO + US USPTO (TESS) for "Writer's Nook" / "Writersnook" in software/publishing classes.
  Free, ~10 min; protects against a forced rename later.

## Two open forks (for Cole)

1. **The "modern + calm" wedge only holds if the app genuinely looks/feels a tier above Scrivener.**
   The differentiation is product-character, so design polish *is* the moat. Validate the UI lives up
   to the positioning before launch.
2. **Effort posture:** *beer-money-with-zero-maintenance* vs. *tend-it-regularly.*
   - Zero-maintenance → ship one-time-only; treat the sync subscription as genuinely optional/later.
   - Tend-it → build the backup/sync tier properly from the start.
   This choice drives whether Phase 2 sync is a priority or a "someday."

## Research provenance

Synthesized from a 6-agent parallel research sweep + 1 adversarial price-verification pass
(2026-06-04). Verified-live competitor pricing, the Ulysses/Scrivener subscription history, Authors
Guild AI-sentiment data, sync-pricing benchmarks, segment/WTP estimates, and distribution-channel
economics. Price points are recommendations grounded in that data — re-verify before launch, as
competitor pricing drifts (the verification pass already caught several stale figures, e.g. Plottr
Pro rising from ~$10/mo to $27/mo).
