# Launch Infrastructure & Architecture — Writer's Nook

> Status: **living setup doc (started 2026-06-04).** Tracks the commerce/accounts/delivery stack, the
> licensing + account architecture, and per-service setup status. Companion to
> [`go-to-market.md`](./go-to-market.md) (pricing/positioning strategy). Update the status column as
> you complete each piece.
>
> Decided stack the designer is wiring against: **Cloudflare (DNS+host) · Resend (email) · Supabase
> (auth+DB) · Lemon Squeezy (payments/MoR) · Azure Trusted Signing (code signing) · Wise (FX).**

## Cost summary

| Piece | Cost | When it starts |
|---|---|---|
| Cloudflare Pages (host) | **$0** | now |
| Cloudflare DNS + Email Routing | **$0** | now |
| Resend (transactional email) | **$0** (3k emails/mo free tier) | now |
| Supabase (auth + DB) | **$0** (free tier; serve installer via LS, not Supabase storage) | now |
| Lemon Squeezy (payments, MoR) | **5% + $0.50 per sale** (no fixed cost) | at first sale |
| Azure Trusted Signing (code signing) | **~$10/mo** | once set up |
| Wise Business (USD→CAD) | **~$55 one-time** | at first payout |

**Fixed monthly cost to run, pre-sales: ~$10** (just code signing). Lean launch.

## Setup status tracker

| Service | Status (2026-06-04) | What's left |
|---|---|---|
| **Cloudflare DNS** | ✅ Done — Porkbun NS → Cloudflare | Confirm Email Routing for `support@writersnook.app` → personal inbox |
| **Resend** | ✅ Done — domain wired via Cloudflare (DKIM/SPF) | Wire as Supabase SMTP sender (Supabase step); send a test to a Gmail to confirm deliverability |
| **Lemon Squeezy** | 🟡 Account + store + product + license keys + API key set up in **TEST mode**; KYC + W-8BEN submitted, **verification pending** | At launch: swap test→live keys. Later: set payout to Wise; upload **signed** installer; create webhook → backend |
| **Wise** | 🟡 Basic **Business** account created; **verification pending** | Finish KYC; activate + save **USD account details**; add CAD balance + link CA bank; enable 2FA; confirm name matches LS |
| **Azure Trusted Signing** | 🟡 Azure account created; **signing not set up** | Billing account = **Individual**; create Trusted Signing account; cert profile **Individual / Public Trust**; submit ID validation |
| **Supabase** | 🟡 Account exists; **project not created** | Create project; wire Resend SMTP; build schema (users/purchases) + row-level security |
| **Cloudflare Pages (host)** | ⬜ Decision made, not deployed | Ask designer: framework? (static/Astro/Svelte → Pages $0; heavy Next.js → maybe Vercel $20/mo). Deploy; point `writersnook.app` |

## The architecture spine

**Lemon Squeezy webhook → Supabase database.** Everything the user sees (account page, restore
purchase, re-download, license key, subscription status) is a *read* off that one database record.

```
Customer pays (LS checkout)
  → LS emails license key + receipt; success page shows key + download + account link
  → LS webhook fires → backend writes purchase record to Supabase (auto-provisions their account)
  → from then on, account page / restore / re-download all READ from that record
```

Make the webhook bulletproof: **verify the signature, make it idempotent** (a retry must not
double-create), and handle `order_created` + refund + (Phase 2) subscription events.

## Licensing & activation architecture

- **Lemon Squeezy License API**: `activate` / `validate` / `deactivate`. The **license key itself is
  the credential** — activation does NOT need your secret API key, so the app can call LS directly
  without leaking anything.
- **Verification happens once, in-app, at activation:**
  1. App shows an **"Enter your license key"** screen.
  2. User pastes key → app calls LS **`activate`** (key + machine ID) → LS returns success + instance ID.
  3. App **stores the result locally** (`{key, instance_id, activated:true}`).
  4. Unlocked — **reads the local flag forever after; never phones home again** (honors offline/no-account brand).
- **LS product license settings:** activations per key = **3** (laptop + desktop + a reinstall;
  raise later if needed, can't easily walk back); **expiration = none** (perpetual).
- **Keep the download link decoupled from activation.** The link's only job is delivering the bytes;
  the **portable key** is what unlocks. This makes re-downloads, second machines, and reinstalls all
  "just work" with the same key. Do NOT bake activation into a personalized download link.
- **Don't over-invest in DRM.** Local flag could theoretically be copied — that's fine. The
  3-activation limit + one-time check is the right amount of friction for a calm $49 app. Heavy DRM
  punishes honest users and betrays the offline promise. Spend effort on the writing experience.
- *(Exact LS endpoint names/params: confirm against current LS docs when wiring the Tauri activation screen.)*

## Account model (three layers)

Mirrors **Obsidian's split** — the editor needs no account; only the paid cloud service does.

1. **The app — no account, fully offline.** Buy → key by email → activate once → write forever, no login.
2. **The account — optional convenience.** Auto-provisioned on purchase; accessed by **magic-link
   with the purchase email** (no password, no signup form). For: restore purchase, purchase history,
   re-download, **deactivate a device** (if 3 activations are used up).
3. **Backup/sync subscription (Phase 2) — requires the account** (cloud service tied to identity).

- **Do NOT force account creation.** Users effectively can't lose access — the key lives in **three
  places** (their email + LS records + their account page). Safety comes from *redundancy*, not
  forced signup. *Encourage* the account post-purchase; never gate the app behind it.
- **"Restore purchase" = magic-link in with the purchase email** → see key + re-download. No separate
  restore system to build; it's the same login.

```
BUY      → pay → LS emails key + receipt → webhook → Supabase record (account auto-exists)
ACTIVATE → download installer (from LS) → open app → paste key → LS activate → local flag → offline forever
MANAGE   → writersnook.app/account → enter email → magic link → key, re-download, deactivate device, (Phase 2) manage sub
```

## Brand-honesty tweak (do before marketing copy ships)

An account now genuinely exists, so the absolute **"no account required"** line would be contradicted
the moment someone subscribes to sync. Revise to something that stays true:

> *"Write without an account — no login, no cloud, just you and the page. Your account is only for
> your purchase and optional sync."*

Same spirit, no "well, actually." (The brand is trust — the copy can't have a contradiction in it.)

## Gotchas to remember

- **LS test vs live keys are separate** — swap test→live API keys + webhook secret at launch.
- **W-8BEN blocks the first payout if skipped** — make sure it submitted cleanly.
- **Email deliverability (DKIM/DMARC)** — set via Cloudflare/Resend; send a test to Gmail before launch.
- **Code-signing publisher name = your personal legal name** (Individual validation), not "Writer's
  Nook." Cosmetic; normal for indie apps.
- **SmartScreen reputation ramps over weeks** with an OV-level cert (Trusted Signing isn't EV) — some
  early users may still see a brief warning until install volume builds reputation. Clears on its own.
- **Wise name must match LS** or USD deposits can bounce.
- **Don't host the installer on Supabase** (free-tier bandwidth) — serve via **LS digital delivery**.
- **Supabase free-tier project pauses when idle** (pre-launch only; irrelevant once it has traffic).

## Legal pages needed (LS requires these; trust-critical)

- **Privacy Policy** — extra important; must *match* the brand ("no tracking, no AI training, your
  words stay yours"). Do NOT drop in a generic template that contradicts the pitch.
- **Terms of Service**
- **Refund Policy** (LS handles the mechanics; you state the policy)

## Secrets to collect (store in a password manager / `.env` — NEVER commit)

- **Lemon Squeezy:** API key · webhook signing secret · store ID · product/variant IDs
- **Supabase:** project URL · anon (public) key · service-role (secret) key
- **Resend:** API key
- **Session/JWT secret** (random string the backend signs logins with)
- **Azure code-signing cert** (goes into the build pipeline, not the website)
- **Wise USD account details** (routing + account number → paste into LS payout at first sale)

## Phase 2 note — backup/sync subscription

- Separate **LS subscription product**; **requires the account**; **$4/mo billed annually (~$40/yr)**
  or **$5/mo monthly** (matches Obsidian Sync). **One bundled tier = backup + cross-device sync**
  (don't split — same infrastructure). **Launch it WITH sync, not before** — backup-alone is a weak
  $5 pitch when free bring-your-own-folder backup exists in the base app.
- Free **bring-your-own-folder backup** (point at the user's Dropbox/OneDrive) carries Phase 1 at $0.
- Use **LS's hosted customer portal** for subscription management/cancellation.
- **Prose is tiny** (a novel = a few MB) → effectively unlimited storage is a selling point, with
  healthy margin. Better cost story than Obsidian's 10 GB cap (their users store images/PDFs).
- **Tauri auto-updater** (signed updates) — fast-follow after launch so a v1.0.1 doesn't mean
  emailing everyone a new link.
