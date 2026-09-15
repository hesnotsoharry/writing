---
project: writing
updated: 2026-09-15
---

## Current state

### What landed today (2026-09-15 — release day plumbing, items 1-5 of the launch list)

Cole's calls this session: push master, deploy the relay, apply 0009 + the LS
webhook event, cut 0.13.1, rebuild both phone apps. Done or in flight:

- **Supabase `writersnook` was PAUSED** (free-tier 7-day idle pause) — meaning
  the whole managed-AI backend (balance, chat proxy, both webhooks) had been
  dead, independent of the missing pricing CTA. Restored via the Management
  API (`POST /v1/projects/{ref}/restore`, PAT from Credential Manager). **This
  will recur whenever nobody uses AI for a week** — the two-active-project cap
  and pause-cycling notes are in `~/.claude/notes/environment.md`. A pg_cron
  or scheduled `/balance` ping is the cheap keep-alive if it bites again.
- **Migration 0009 (`clawback_topup`) applied** through the Management API
  `database/query` endpoint (the CLI's `db query --linked` fails on this
  network: IPv6-only direct DB path). Verified `clawback_topup` + the
  `credit_events_decrement_request_uniq` index exist.
- **Relay worker deployed** (`writersnook-relay`, version `fe87f142`, custom
  domain `sync.writersnook.app`) — over-capacity reject + ping/pong are live.
  12/12 relay tests green first. There is still no CI for it: redeploy is
  `npx wrangler deploy` from `relay-worker/`.
- **Model catalog refresh finished and committed** (`3b61675`). The client half
  (Fable 5 + GLM-5.3 in, GLM-5.2 out of the picker, `sanitizeManagedModel`)
  had been sitting uncommitted with NO server allowlist/rate entries — both new
  picks would have 400'd at the proxy. Server now: `MANAGED_MODELS`, `RATES`,
  `MIN_CACHEABLE_TOKENS` (Fable floor 512) all carry them; Sonnet 5 billed at
  its now-permanent $2/$10, Luna/Terra at their 2026-07-30 cuts; GLM-5.2 stays
  served for pre-0.13.1 clients. The acceptance test that pinned "Fable 5 is
  deliberately excluded" was flipped on purpose — it now pins that Fable
  resolves at its own rate (a Haiku fallback would under-bill 10x). Rates
  re-verified against the Anthropic, OpenAI and OpenRouter pages on 2026-09-15.
- **v0.13.1 committed and tagged** (`427886f`) off current master — the first
  desktop release with Settings > Sync and the whole audit campaign. Do NOT
  publish the stale v0.13.0 tag. Cole runs `.\publish.ps1` then `publish-mac.sh`.
- **EAS production builds kicked off from `mobile/`** (`EAS_NO_VCS=1`):
  Android `f162c039` (versionCode 3, app-bundle), then iOS with
  `--auto-submit` to TestFlight (buildNumber 9). `eas build:list` shows state;
  the AAB downloads from the build page. **The Play Console has NO bundle at
  all** (checked "Latest app bundles: None" in the Alpha track this session) —
  the August versionCode-2 AAB was never uploaded, which is fine: it predated
  the 29 sync fixes. Upload the versionCode-3 AAB instead (drag into the staged
  closed-testing release; extension can't push 119 MB).
- **Master pushed; the marketing deploy then failed three times** on Pages'
  bundled npm 10.9.2 (`edgesOut` arborist crash, registry drift against a
  lockfile-less install). Fixed by committing an npm 11 `package-lock.json`
  and dropping `.npmrc`'s `package-lock=false` (`25daabc`); the `NPM_VERSION=11`
  env var route was tried first and ignored. Full write-up in
  `marketing/.claude/vendor-gotchas/cloudflare-pages.md`. **Verified live:**
  writersnook.app/pricing serves the subscribe CTA, `lemon.js`, `ls-config.js`
  and `checkout.js` again.
- **v0.13.1 PUBLISHED on Windows** (Cole ran `publish.ps1`; GitHub release
  2026-09-15 18:11Z with `WritersNook_0.13.1_x64-setup.exe` + `latest.json`,
  `windows-x86_64` key verified). macOS half dispatched via the GitHub Actions
  workflow `Publish macOS release` (input `tag=v0.13.1`, run `35006534193`) —
  no physical Mac involved; it upserts `darwin-aarch64` into the same manifest.
- **Lemon Squeezy subscription webhook now also fires `order_refunded`** (saved
  via the dashboard; 7 events). The refund clawback path is fully live.
- **A real app purchase was silently lost while Supabase was paused and has
  been recovered.** Order `9464369` (Bethany Clark, $30.74, 2026-09-13 02:16Z)
  got 500s on all three webhook deliveries. Resent both `order_created`
  deliveries (purchase row created), then wrote the license key + email onto
  the row directly and ledgered `license_key_created` in `webhook_events` —
  Cole chose NOT to resend that delivery because it would send our license
  email two days late (LS's own receipt already carried the key). A future LS
  resend now dedupes to 200 without emailing. **Lesson: a paused Supabase
  project loses purchases, not just AI.** The keep-alive item below is not
  optional.

### Bug-fix campaign from the 2026-08-27 ultracode audit (in progress, same day)

The 63-item audit tracker lives at `roadmap/bug-audit-2026-08-27.md` (full
report: the "WritersNook Bug Audit" artifact). CAMPAIGN COMPLETE: 61/63
fixed across ~25 commits (highlights: critical mobile catch-up corruption
P0.1, fleet-wide stale-flush resurrections P1.1/P1.3, sync protocol v1.4 —
epoch owner on the wire + targeted hello, exclusive meta/bible write tails,
persistent HLC, the P9 money bugs, transport liveness). P8.6 (CSP) deferred
pending a dev smoke. Needs Cole: P5.6 decision (goals uniqueness vs LWW merge),
applying `marketing/supabase/0009_clawback_topup.sql` + subscribing the LS
subscription webhook to `order_refunded`, deploying the relay worker
(capacity + ping/pong), and a live sync session to verify P0.1 on the real
pair. Everything is committed locally, NOT pushed (push deploys marketing).

### What landed today (2026-08-27 — Play Console setup complete, first AAB building)

Agent session drove the Play Console (claude-in-chrome) end-to-end for
`app.writersnook` ("WritersNook — Companion", app id 4973880574039488183):

- **All app-content declarations done and saved**: Ads (none), Advertising ID
  (none), Government apps (no), Financial features (none), Health (none),
  Target audience (**18+**), Data safety (**no data collected/shared**, per the
  runbook's E2E/ephemeral rationale), app category (App → Productivity),
  contact details (support@writersnook.app / https://writersnook.app).
- **Content rating diverges from the runbook's guess**: the current IARC
  questionnaire counts generative AI as "online content", so honest answers
  (fictional violence/drug references possible, mild-moderate language, no
  sexual content) landed **ESRB Teen / PEGI 12 / ClassInd 14** — not
  Everyone/PEGI 3. Fine for an 18+ target; redo the questionnaire if that ever
  matters.
- **Store listing saved complete**: runbook draft text verbatim, 512 icon
  (resized from `mobile/assets/icon.png`), generated 1024×500 feature graphic,
  and 4 real phone screenshots (hub, binder, editor, corkboard) captured from
  the Aug-21 `app-release.apk` on the `Medium_Phone_API_36.1` emulator, cropped
  to 1080×2160 to drop the debug footer. Assets live in the Play asset library;
  sources in the session scratchpad only — regenerate from device if better
  ones are wanted (the old APK still shows the trial pill + test project names).
- **Android upload keystore now exists LOCALLY** (divergence from the runbook's
  "let EAS hold it"): `mobile/credentials/upload-keystore.jks` + password in
  `mobile/credentials.json` (both gitignored). Play App Signing re-signs, so a
  lost upload key is recoverable via Play support. **Back it up.**
- **First production AAB built on EAS** (versionCode 2, package
  `app.writersnook`) and saved to `~/Downloads/writersnook-1.0.0-versionCode2.aab`.
  **Closed testing Alpha track is fully staged**: 177 countries targeted,
  "Internal Testing v1" email list (2 users) attached, feedback email set, and
  a draft release is open at Create closed testing release. **The ONE manual
  step left (Cole): drag the Downloads .aab into that page's upload box**, name
  the release ("1.0.0 (2)"), add a release note, Next → Save → then "Send app
  for review" in Publishing overview. Browser-automation of the upload itself
  was blocked (119 MB > extension's 10 MB file cap; page CSP + Chrome
  local-network rules killed the fetch-injection routes; the permission
  classifier blocked the rest — correctly, they're grant/publish-shaped).
  Optional follow-up for automated future submissions: invite
  `play-publisher@erudite-gate-407303.iam.gserviceaccount.com` (key already at
  `mobile/credentials/play-publisher.json`, gitignored) in Play Console → Users
  and permissions with release-to-testing permissions, then `eas submit` works
  headlessly (set `submit.production.android.track` to the alpha track).
  Production access needs 12+ opted-in testers for 14 continuous days.

### What landed today (2026-08-22, second wave — Cole's live sync session, diagnosed and fixed)

Cole ran the sync-session runbook on the real pair. Every "sync failure" he
reported turned out to be **UI staleness**: the phone-born project, its bible
doc, the goals rows and the notes were all byte-identical in both DBs within
seconds (verified by pulling both DBs mid-session) — desktop views just never
re-queried. Fixes, all committed and gated:

- **Live refresh** (`5cbf9a6`): the LWW row adapter, meta apply target and
  bible apply target now dispatch window events (`src/sync/syncEvents.ts`);
  project list, binder, goals dialog, inspector rings, inbox, boards list and
  bible list subscribe. Mobile GoalsScreen subscribes to engine applies the
  way useHubModel always did.
- **Goals read the synced rows, not localStorage fiction** (`5cbf9a6`): the
  master switch ANDs into every scope (kills the phantom "0 / 1000" with
  goals off), `enabled` gates and is toggleable per goal on BOTH platforms,
  `config_json` round-trips so mobile-created streak/deadline goals render on
  desktop. Mobile gains per-goal enable/edit/delete (`cc7c25c`) — it was
  create-only, and its "Session goal" checkbox was the device-local sitting
  tracker mislabeled (now "Track this sitting / THIS DEVICE ONLY").
  **Honest gap:** streak/session COUNTING is still unimplemented on mobile —
  definitions sync, counters never move (`recordGoalDay` has no callers). And
  desktop's manuscript/chapter/scene scope is still localStorage-only (needs
  a schema column). Both deliberate deferrals.
- **Relationship map rebuilt on the board canvas machinery** (`8fbbc8a`):
  edges and nodes shared no transform origin (lines floated when zoomed) and
  the 360-pass force layout re-ran per touch frame. One 1×1 world layer, UI-
  thread gestures via the shared `useBoardTransform`, constant layout radius.
- **Mobile project creation** (`ff161cd`): name prompt via the standard
  create-prompt sheet, and a Default Board seeded per project (fresh UUID id);
  the board viewer self-heals boardless projects. This exposed a real desktop
  bug — the lazy seed's fixed `brainstorm-default` id can be claimed by only
  ONE project (unscoped PK, swallowed conflict), so every later project was
  boardless. Fixed with a UUID fallback (`e73b05b`).
- **Metro + cargo coexistence** (`3c806d0`): Metro's repo-root watcher died
  on vanishing `src-tauri/target` incrementals whenever the desktop dev build
  ran; blockList now excludes it. Also: commits to shared src/ hot-reload the
  phone dev client mid-test — hold writes while Cole is device-testing.
- **In flight elsewhere: iOS TestFlight registration** (separate agent, Cole-
  initiated). It renamed the app identity `com.coles.writersnook` →
  `app.writersnook` in `mobile/app.json` (+ EAS project id, iOS
  ShareExtension entitlements). Docs and adb tooling references to the old
  package id go stale at next prebuild — sweep them once that work settles.
  `mobile/app.json` is intentionally left uncommitted here.
- **Gate truth:** desktop tsc/lint clean, 2271 pass (sql.js OOM flake
  transient under full-suite load only); mobile tsc/lint clean, 382 pass.
  Runbook items #6/#7 (reconnect convergence, keep-both conflict) remain
  unrun — they need a session where Metro restarts don't matter.

### What landed today (2026-08-22 — items 2–5 of the priority list, in one pass)

- **v0.13.0 (renamed from 0.12.9 at Cole's call, 2026-08-22 — "a lot of changes") is prepped and tagged; Cole runs the publish.** The release carries
  the sync-ledger backfill desktop-side (the "older desktop never seeds" gap)
  plus today's joined-device fix. Sync stays gated off (`syncExperimental`), so
  shipping it risks nothing. Run `.\publish.ps1`, then `publish-mac.sh` on the
  Mac. The release gate is green again: the 6 stale wave-46 eval-harness
  assertions were updated to the current contract (0-10 judge scale, 600-cell
  pilot), so `npm run test` exits 0 — 2226 pass, 0 fail.
- **The joined-device stranding is fixed without the origin-role ruling**
  (`27a32f3`). The discriminator moved from device role to doc existence: a
  project received via sync always has a meta doc (the apply target builds the
  `projects` row FROM it), so "no doc" reliably means "born locally, never
  bootstrapped". `createProject` now bootstraps meta+bible docs at creation on
  both platforms, bootstrap is idempotent (overwriting an existing doc erases
  tombstones and resets epochs — the resurrection bug, now pinned by tests),
  and the startup sweeps run on any role, which retroactively rescues projects
  already stranded on joined devices. Mobile also gained its first bible
  bootstrap — a mobile-born project's Story Bible was stranded even though its
  binder replicated. The "should origin stay a per-device role" question is
  DEFERRED, not answered: nothing needed it.
- **Relationship-map links are editable on mobile** (`9e0b080`) — the one
  non-deliberate parity gap, ported in the board-links shape: tap a node →
  Links → checkbox sheet. Creates use the "Related to" default; deletes clear
  every joining row both directions. No sync work needed — `entity_relations`
  already replicates through the bible doc. Label editing stays on the entry
  screen; node layout stays on desktop.
- **Turnstile phase 1 is built and dark** (`b76aad7`). `/api/ai/trial-session`
  verifies a token when present, grants without one until `TURNSTILE_ENFORCED`
  flips; the re-exchange path never checks. Contact + newsletter enforce
  outright once `TURNSTILE_SECRET_KEY` exists (they deploy in lockstep with
  their forms). Widgets render only once the placeholder site key in
  `marketing/public/site.js` is replaced. **Phase 2 is also built** (same day,
  `2672950`, in v0.13.0): the desktop client no longer first-grants silently —
  the assistant panel shows a one-time activation card hosting the challenge
  page in an iframe, usable even when the widget is unavailable while the
  server stays permissive. Existing trials (stored key) see zero change.
  **Still needed:** create the widget in the Cloudflare dashboard (the stored
  API token lacks Turnstile scope and the Chrome extension was offline), set
  the Pages secret, patch the placeholder site key in `site.js` AND
  `turnstile-challenge.html` — then the phase-3 `TURNSTILE_ENFORCED` flip
  once the v0.13.0 updater adoption soaks.
- **Play submission plumbing** (`1fccd62`): privacy.html now covers the phone
  app (camera/QR, share sheet, E2E sync, AI credential handoff, Fathom
  site-only), mobile is `1.0.0`, and
  `roadmap/coordination/play-store-submission.md` has the listing draft,
  data-safety answers, and the one interactive EAS keystore command. Remaining
  submission blockers: EAS keystore (Cole, one command), in-app account
  deletion + a `delete-account.html` URL, screenshots/feature graphic, splash
  verification on device.
- **Gate truth:** desktop tsc/lint clean, full vitest 2226 pass / 0 fail (one
  known sql.js OOM flake in `sweepFullSync.test.ts` under full-suite parallel
  load only — passes in isolation). Mobile tsc/lint clean, 370 pass / 1
  pre-existing skip. Marketing 347 pass (up 15: new Turnstile suites).

**Mobile has moved from feature QA into distribution plumbing.** The features
were in good shape; the *shippable artifact* had never been built. As of
2026-08-20 the app is companion-only, carries real branding, and produces a
release manifest that Play would accept. It still cannot be submitted: see
"What's next".

Desktop remains shipped at **v0.12.8** (tagged 2026-07-30) with **144 commits
on master past that tag** — 39 of them in `src/`/`src-tauri/`, and they are the
entire device-sync programme (protocol v1.1 -> v1.3, QR pairing, HKDF+AES-GCM
framing, epoch ownership, seven LWW domains, bible replication, catch-up). It
is all gated off behind `syncExperimental: "off"`
(`src/features/settings/settings.store.ts:113`), so no released build has it.
The relay IS deployed and live — `wss://sync.writersnook.app` answers with the
worker's own 404 body on a plain GET.

### What landed today (2026-08-21 — three real bugs, all verified on device)

Cole's Pixel 3 XL was driven live over wireless adb against his real paired
desktop for all three.

- **The mobile editor hung on "Opening editor…" and fell back to read-only**
  (`d3b1fe6`). Diagnosed as a race, not the documented "silent handshake stall":
  `port.receive("ready")` does not resolve when the port has read the message,
  it resolves once the hydrate round-trip that `ready` starts has been acked
  (`handleReady` awaits its own ack). The host dispatched *after* that await, so
  the two handshake actions arrived inverted — `hydrate-acked` first, which the
  reducer drops outside `hydrating`, then `ready`, leaving the phase in
  `hydrating` with nothing left to advance it. A hydrate slower than the guest's
  250 ms `ready` retry let a second `ready` short-circuit through in time; a
  fast one lost. Small scenes and a warm WebView hydrate fast, which is why it
  presented as "works once per app launch". Routing moved to
  `mobile/src/features/editor/bridgeRouting.ts` so the ordering has a test seam.
  **The previous session's conclusion that "the WebView never loads a page at
  all" was wrong** — CDP over the phone's WebView socket showed the page loading,
  ProseMirror mounting and the guest posting a valid hydrate ack; the earlier
  "no targets" reading was taken after the fallback had already unmounted the
  WebView. Verified: four consecutive opens of the same scene all render prose,
  the doc-less "A stray idea" opens editable, typing updates the counter.
- **A project with chapters but no scenes was a dead end** (`451388b`).
  `isProjectEmpty` asked "no folders AND no scenes", so one empty chapter made
  the project count as non-empty and the binder's only empty state was a
  `ListEmptyComponent` that a single header row defeated. Now "no scenes", with
  desktop's row semantics mirrored: every scene-less chapter gets an inline "add
  one" row, and Short pieces always renders. `buildBinderTree` also rescues
  scenes whose `folder_id` names a folder the project does not have — desktop
  drops those orphans, but on mobile a dropped row is prose you cannot reach.
- **First sync never backfilled row-domain data** (`f018256`) — the most
  important of the three. Full brief:
  `roadmap/coordination/first-sync-row-backfill-brief.md`. Documents reconcile
  against the DATABASE; rows reconciled against `sync_lww_rows`, a change log
  migration 022 creates empty and nothing ever seeded, so anything written
  before sync went live reached no peer. Reconciliation was also push-only, so
  an empty device announced nothing and triggered nothing — device #3 would have
  broken even with a seeded ledger. Adapters can now enumerate their own table,
  `prepareSession` seeds the ledger as a tombstone-aware set difference stamped
  from each row's own timestamp (never the clock — a "now" stamp would outrank a
  real tombstone and resurrect every deleted board and note), and the reconciler
  answers a summary naming an unknown row with its own summary for that scope.
  No protocol bump: v1.3 messages only.
  **Runtime oracle, on the real pair:** the desktop dev app picked the change up
  and seeded; the phone now holds `boards: brainstorm-default | Default Board`
  where it previously had only orphan `board_docs` content, plus 10 scene
  snapshots it never had. That is the reported bug, gone, on live data.
- **Gate truth:** desktop `tsc` + `lint` clean; desktop vitest **2159 passed /
  6 failed**, the same 6 wave-46 eval-harness failures as yesterday
  (`scorer.test.ts`, `eval-runner.test.ts`) and no new ones. Mobile: `tsc` clean,
  lint clean, **248 passed**. The live-relay suite passes 11/11 against a local
  `wrangler dev` (`SYNC_LIVE_RELAY=ws://127.0.0.1:8788 npx vitest run
  liveRelay.integration`), including the new backfill case.

### What landed today (2026-08-20 — launch readiness + distribution plumbing)

- **Commercial legal copy corrected.** `terms.html` and `refunds.html` were live
  carrying "Template copy for review — please have these terms checked by
  counsel before launch", and described the deprecated $5/mo Device Sync as the
  only subscription while the $14.99/mo AI assistant had been selling since
  2026-06-14. Both rewritten: AI subscription and credit sections, a
  "Your writing and AI" section, a liability cap with a consumer-law carve-out,
  and a governing-law clause. 332 marketing tests still pass.
  **Superseded 2026-08-21:** the jurisdiction is Ontario, the clause names it,
  and the pages are deployed.
- **Mobile is companion-only (decision, Cole 2026-08-20).** Both "Buy a license"
  links, the "Top up" button that opened the Lemon Squeezy portal, and the
  now-unreferenced `getPortalUrl` were removed. Apple 3.1.1 and Play Billing
  both require IAP for digital goods unlocked in-app and this client has no IAP,
  so those were the likeliest rejection. Licence *activation* is untouched —
  that is verification, not purchase.
- **Branding and build config.** The app was still shipping the stock Android
  robot launcher icon. Icons and splash generated from `app-icon.png`; the
  adaptive foreground is the mark inset into the 66% safe zone on flat parchment
  so the system mask is the only container shape. `eas.json` gained `production`
  and `submit` profiles.
- **`SYSTEM_ALERT_WINDOW` no longer ships in release.** It is emitted by
  prebuild (present since the first prebuild commit `b21ea0f`), so a manifest
  edit would be undone on the next run — `android.blockedPermissions` is the fix
  that survives regeneration. Verified against both merged manifests: release
  has no overlay permission, no cleartext and is not debuggable; debug keeps all
  three. `CHANGE_WIFI_MULTICAST_STATE` turned out to be debug-only already.
- **Two cold Android builds, both BUILD SUCCESSFUL** (12m05s, then 9m58s after
  the config change). The APK was unpacked and `aapt2 dump` run against it:
  it carries the feather icon and the adaptive foreground layer, label
  `WritersNook`, `targetSdkVersion 36`, and still has the overlay permission in
  debug so the dev menu works. Debug APK is 324 MB (universal + dev client).
- **Gate truth:** desktop `tsc` and `lint` are clean; desktop vitest is
  **2122 passed / 6 failed**, and all 6 failures are in the wave-46 eval harness
  (`src/test/scorer.test.ts`, `src/test/eval-runner.test.ts`) — stale assertions
  drifted from the implementation, NOT missing API keys. No shipping app code
  fails. But `npm run test` exits 1, so the release gate is red by default.
  Mobile: 234 pass. Marketing: 332 pass. relay-worker: 11 pass.

### Prep for the #22 device session — read before running it

The reconnect drain is **not** instant, and expecting it to be would produce a
false FAIL. Scene entries clear only on a round trip: `onConnection` ->
`syncNow()` flushes the outbox and sends hello (`src/sync/engine.ts:145`), but
an entry clears only when the *peer's* hello arrives with a state vector that
already covers our doc (`answerHello` -> `acknowledgeDoc`,
`src/sync/engine.ts:315`). If the peer built its hello before applying our
flush, the entry survives until the next sweep — and the sweep is
`sweepMs ?? 60_000` (`src/sync/engine.ts:342`). **Watch the counter for 60+
seconds before calling #22 a failure.** Row entries are different: they clear on
an explicit `row-ack` (`src/sync/engine.ts:275`) and should drop promptly. Rows
draining fast while scenes lag is the expected signature, not a defect.

`src/test/sync/outbox.test.ts` covers enqueue, ack semantics and flush ordering
but has **no coverage of the reconnect -> flush -> peer-hello -> ack round
trip**. Write that integration test against the `liveRelay.integration.test.ts`
harness AFTER the behaviour has been observed once, so it encodes reality.

### Previous state (2026-08-14)

**Agent-side #18 and #21 verification is complete.** The rebuilt Android client
now passes a real share-resolver → Inbox → SQLite provenance run and an
airplane-mode 0 → 1 → 2 → 3 queue-depth run backed by SQLite snapshots. The
offline run used a disposable clone because the existing emulator DB already
contained 11 unrelated pending rows; the original mobile DB was restored to its
exact pre-test hash afterward, and networking was restored. The desktop app and
its live database were not opened.

The matrix now has **22 full PASS rows, 2 partial rows, and 4 blank rows.** The
partial rows are #2 (inherited, not re-run) and #23 (entry point only). Desktop
remains unaffected: v0.12.7 shipped, working version 0.12.8.

### What landed today (sixth session — keyboard cleanup)

- **Keyboard ownership is unified.** Expo SDK 57's matched
  `react-native-keyboard-controller` 1.21.9 now provides the root
  `KeyboardProvider`. The editor bar and Focus HUD use its persistent shared
  animation value instead of Reanimated 4.5's deprecated per-mount
  `useAnimatedKeyboard`; this matters when Focus mode mounts after the keyboard
  is already open.
- **The Android gap had an observed cause, not an inset guess.** The diagnostic
  footer reserved 220px below the navigation tree while the overlaid keyboard
  covered it, so every full-keyboard translation landed 220px too high. The
  footer now leaves layout while the keyboard is visible. On API 36 the live
  editor kept IME focus and its caret visible; the format-bar controls moved
  from `[625,2064][740,2179]` to `[625,1390][740,1505]`, directly above the
  keyboard surface.
- **Assistant typing is no longer covered.** One `KeyboardStickyView` moves the
  four verb chips and composer as a single dock. With a real available managed
  credential, the focused composer rendered at `[32,1305][675,1424]` and all
  chips remained visible above the keyboard; no prompt was sent and no credit
  was spent.
- **Adjacent dev reliability fix:** managed-AI credential loading now uses the
  same static `expo-secure-store` import already established by the sync key
  store. Its redundant dynamic import repeatedly failed after an adb reverse
  loss (`Could not load bundle` / dev-client `reload` error), preventing an
  otherwise valid credential from enabling the composer.
- **Native/device evidence:** the dev APK assembled successfully (SHA-256
  `98836A123CB0B1E0C0C041FACD5095C05F4088C2EBD37A44855F98495C4989F4`).
  #6/#7/#25/#27 pass their Android regressions. The known WebView renderer
  crash recurred independently; a temporary 4GB AVD RAM override stabilized
  the final Assistant run and did not alter the checked-in AVD configuration.
- **Gates:** 234 mobile tests pass and 1 is skipped; mobile lint and both
  typechecks pass. `expo install --check` does not flag Keyboard Controller; it
  separately reports four pre-existing Expo 57 patch updates (`expo`,
  `expo-asset`, `expo-build-properties`, `expo-dev-client`), intentionally not
  mixed into this native keyboard change.
- **Data safety:** the app was force-stopped and the original mobile DB restored
  byte-for-byte to SHA-256
  `C457AFCBB427E3C83D55C66708D6B01F2B29EDA7963116DEF222D75D91C5BE5D`.
  `integrity_check=ok`, the 11 pre-existing pending rows remain, the share marker
  remains, networking is on, and the desktop app/database were untouched.

### What landed today (fifth session — agent verification)

- **Android share target restored (`d7e2135`).** `app.json` already declared
  `expo-share-intent`, but neither the checked-in nor merged manifest contained
  `ACTION_SEND`. Expo prebuild changed only the manifest; a regression test now
  guards `SEND` + `DEFAULT` + `text/*`, the Gradle merged manifest passes, and
  the packaged APK was independently inspected. **Runtime PASS:** Android's
  real resolver listed WritersNook; selecting it produced the exact shared body
  and `Share sheet` provenance in both the rendered Inbox and SQLite.
- **Offline queue status is ordinarily reachable (`f53a704`).** Settings now
  exposes **Review queue** without needing a synthetic restore mismatch.
  `OfflineCatchUp` supports device-wide status, preserves project-scoped behind
  recovery, and has a working back button. **Runtime PASS:** while continuously
  disconnected in airplane mode, the screen rendered zero, then 1 → 2 → 3
  queued scenes; four SQLite snapshots independently matched those counts with
  no non-scene rows and three distinct durable markers.
- **Two safe cosmetics cleared (`b04f968`).** Assistant verb pills are capped
  at the intended 44dp band, and the format-bar sparkle now announces
  `AI selection actions` instead of the unrelated editor command name.
  **Device re-check PASS 2026-08-14:** the four pills render as one normal 44dp
  row (115px at 420dpi), and the newly labelled sparkle still opens the real
  SelectionActions sheet.
- **Build/gates:** x86_64 dev client assembled at
  `mobile/android/app/build/outputs/apk/debug/app-debug.apk` (SHA-256
  `B5A82F060CA13FFAAA86E067E897C35F559A5ADA0EFFABDF8FC8C3368A75C1CA`).
  Mobile lint and both typechecks pass; 229 tests pass, 1 is skipped.
- **Runtime blocker cleared after Cole's restart.** `emulator -accel-check`
  returned 0, `Medium_Phone_API_36.1` booted, and the rebuilt client was
  installed. After verification, the original mobile DB was restored
  byte-for-byte and airplane mode was disabled.

### What landed today (fourth session)

Two Codex-built fixes, reviewed here, both device-verified:

- **Selection commands from the SelectionActions sheet actually apply now.**
  They were reaching TipTap after ProseMirror's selection had collapsed, so
  toggle-ai-exclude / bold / italic silently no-opped — proven with a CDP
  message hook (command arrives, `window.getSelection()` collapsed, no mark in
  the doc). The WebView now remembers the last non-collapsed selection and
  restores it before selection-dependent commands, with a doc-identity guard
  against stale ranges (`mobile/editor-web/src/editorUiBridge.ts`).
- **Unpaired rigs can mint a real trial credential.** Mobile's AI credential
  only ever arrives via a desktop credential-offer over sync; this rig has
  never paired, so the composer was `editable={false}` — which is why typed
  text kept vanishing (IME focus provably stuck on the Back button). A
  `__DEV__`-only "Dev only: grant trial AI" button on the unavailable notice
  feeds a synthetic offer through the real `consumeCredentialOffer` →
  first-grant `/api/ai/trial-session` path. Failures alert loudly now (the
  first attempts failed silently and burned the 3-per-IP daily grant cap).
- Matrix header is at **22 of 28**; the two rows carry the full evidence, and
  five new rig traps are written up (unroutable Tailscale Metro URL + the
  `exp+slug` deep-link recovery, adb daemon crashes dropping forwards,
  keyboard-race taps, `input text` with no editable focus opening Settings,
  and the a11y tree omitting live sheets).

### What landed today (third session)

Four commits, all built by Codex dispatches and reviewed here before acceptance.

**The cosmetic list is cleared, and one of them was hiding a real bug.**

- **Hub goal tile** said "Progress unavailable" under a target the Goals screen
  showed real progress for — `deriveGoalModel` hardcoded `current: null`. The Hub
  now loads the same persisted goal-local state and shares one `localProgress`
  helper with GoalsScreen. Device-verified: "250 word goal / today" with a live
  ring.
- **Wiring that up exposed an older defect.** A daily goal's progress is
  manuscript words minus a stored baseline, and that baseline was written once by
  a create-if-missing `ensure()` with no notion of the date — so a "daily" goal
  measured words since it was first opened, and once met stayed met forever.
  State now carries a `baselineDate` and re-arms at the local day boundary while
  streak and met-days survive. Matches the day-keyed contract desktop already
  uses; pre-existing records have no `baselineDate` and re-arm on first read.
- **Inspector snapshot count** was queried once at mount, so it read "0
  snapshots" against a populated history. It now reloads on navigation focus
  while open — verified by reading 3, taking a snapshot, and returning to 4 with
  no restart.
- **Focus-mode layout.** The settings panel clipped its "Session goal" row and
  the HUD sat behind the format bar — both because each was anchored to the
  screen bottom with no knowledge of the keyboard spacer or the bar's 54px band.
  The overlay now clears both. Verified keyboard down AND up.

**Two rig traps cost real time and are now written down** (detail in the matrix):
zeroed animation scales park every bottom sheet off-screen so it looks like a
broken sheet, and a crashing WebView renderer (logged explicitly by Chromium) is
a *different* failure from the documented silent handshake stall.

### What landed in the previous session

**Reachability — eight finished features a finger could not reach:**

| Feature | Why it was unreachable |
|---|---|
| Goals | Registered; nothing navigated to it. The Hub's goal ring was inert decoration |
| Catch-up (`OfflineCatchUp`) | Same — so the behind-state recovery path could never surface |
| Version history | Entry point sat below a sheet fold that neither scrolled nor accepted touches |
| Story Bible CTA | Same fold — *and* its handler was literally `() => undefined` |
| AI model picker | Registered; zero callers |
| Hidden-from-AI review | Registered; zero callers |
| Boards | Route HAD a caller, but two barrels exported `BoardViewerScreen` and the navigator imported the 3-line stub instead of the real 123-line viewer |
| Binder scene actions | Hub → Binder had no long-press at all, while the editor's drawer had the full set |

**The editor finally honours dark mode.** Chrome, format bar and fallback were
all dark while the writing surface stayed cream — the screen a writer stares at
was the one dark mode never reached. The theme message was ACKed by the web
channel *before* TipTap bound its handler, so the one-in-flight queue dropped it
permanently, and theme was only ever pushed once. Pre-bind messages are now
buffered and replayed, dark is seeded before first paint (no cream flash), and
live theme changes reach an open editor. Focus dimming was retuned for dark so
dimmed paragraphs stay legible.

**Snapshot restore reported success and did nothing durable.** Three faults in
one path: the restore replaced the stored doc but not the OPEN editor's Y.Doc,
so the stale in-memory doc merged the reverted prose straight back; the epoch
write left `plaintext_projection` untouched, so even a correct write looked
lost; and the first fix then failed closed on every attempt, because
`flushLocal()` inferred "dirty" from hydration alone and told a writer who had
typed nothing that their edits were pending. Now device-verified end to end —
restore applies, the open editor updates, and it survives force-stop and cold
relaunch.

**Also fixed:** the binder screen's theme-blindness, the outliner's drag (the
FlatList was cancelling the pan, so the drop never applied), the Projects card
going stale after archive/restore, and the last mojibake.

**Decision 0016 recorded:** the binder drawer is button-only under gesture
navigation. Android owns the left edge and the app never receives the swipe;
claiming it back means taking Back away inside the editor, which is a worse
trade than losing a hidden affordance. Matrix #8 is resolved as accepted
behaviour, not an open defect.

### Verified on device

#11 inspector, #12 Story Bible facts grid (2×2 holds at the small label size),
#14 corkboard drag, #15 sticky headers, #17 Goals (created a 250 w/day goal, ring
tracks 0/250), #20 archive round-trip (restored "Opening" back into Chapter One,
`folder_id = gate-f1` — re-confirms c44f2d2), #19 snapshots end to end,
#24 theme across every screen including the editor, #27 focus mode.

This session re-verified on a fresh rig: #11 (inspector snapshot count live,
3 → 4 without restart), #17 (Hub ring shows real progress), #27 (focus layout,
keyboard down and up).

## What's next

1. **Confirm the macOS workflow run finished** and `latest.json` under
   `v0.13.1` carries both `windows-x86_64` and `darwin-aarch64`. Rerun with
   `gh workflow run publish-macos.yml -f tag=v0.13.1` if it failed.
2. **Cole: eyeball LS variant `1782075` is still active** — the only part of
   the subscription path nobody has verified from the dashboard side.
3. **Cole: Play Console** — upload the versionCode-3 AAB from EAS build
   `f162c039` into the staged Alpha release, name it "1.0.0 (3)", send for
   review. Production access needs 12+ opted-in testers for 14 days, so the
   clock only starts once this lands.
4. **iOS**: install the new TestFlight build (1.0.0 #9) once Apple's processing
   mail arrives; it is the first phone build with P0.1 in it.
5. **Live sync session on the real pair** (desktop 0.13.1 + either phone) to
   verify P0.1 before beta testers get the link. DB-swap protocol in
   `.claude/known-issues.md`; Cole must not open the desktop app during it.
6. **P5.5 (goals uniqueness)** — decided direction: enforce one goal per
   (project, goal_type) as a merge rule in the sync apply target (LWW picks the
   newer row and tombstones the loser), then add the UNIQUE constraint behind
   it. Not a user-facing toggle. Not built yet.
7. **Supabase keep-alive — now urgent, it cost a purchase record** — a
   scheduled ping (Cloudflare cron hitting a cheap read endpoint, or pg_cron)
   so the project never idles into a pause again.

### Blocked on Cole

0. **Three of those four are answered (Cole, 2026-08-21) — do not re-ask them.**
   (a) Governing law is **Ontario**, and `marketing/public/terms.html:130`
   already carried it; the `PROVINCE_PLACEHOLDER` note below was stale, not a
   real blocker. (b) **Push approved** — done, so the corrected terms and
   refunds pages are live. (c) The **Apple Developer Program membership is
   active and paid**: Apple ID `colestacey@icloud.com`, signing held by EAS
   (CLI authed as `codingmagic`), no Mac required. This is recorded in
   `~/.claude/notes/environment.md`, which is the file to check before asking
   Cole anything about accounts, devices, or paid memberships. (d) The **sync
   session** is the one still outstanding.

1. **Sync checks need Cole.** #2/3 pairing + clone, #10 reorder convergence,
   #13 entity to desktop, #22 convergence and the end-to-end half of #23 need a
   desktop peer. The DB-swap protocol in `.claude/known-issues.md` requires
   Cole's explicit OK and that he not open the desktop app during the run.
2. **Not verified, flagged honestly:** focus-mode keep-awake is wired correctly
   (`expo-keep-awake`, tagged, cleaned up on unmount) but could not be confirmed
   — the dev client holds `KEEP_SCREEN_ON` on the same window either way.
3. Cole-hands: real-device QR scan and the iOS leg, including the new Keyboard
   Controller path.
4. Watch: the read-only fallback. Last session's note tied it to "reopening a
   scene right after a restore" — that framing was wrong. It recurred with no
   restore involved, and this time logcat named the cause outright:
   `chromium: Renderer process (NNNNN) crash detected (code -1)`, repeating.
   That is a **different mechanism** from the documented silent handshake stall,
   which leaves no error at all. It followed a host reboot and a full app
   restart cleared it, so it reads as rig instability — but the symptom is the
   writing surface going read-only, so re-check on a stable rig or a release
   build. Grep recipe in the matrix.

### Second batch, same day — follow-ups worked through

- **`manuscript_about` now has `updated_at`** (`ac07954`, migration 023). It was
  the only replicated row domain with no timestamp, so its seeds stamped at 0
  and two pre-sync devices tied with device id deciding a whole About page.
  The column is deliberately NOT in the replicated column list: `parsePayload`
  requires every listed column, so a payload from an older peer would throw and
  the row would be dropped. Its job is to order this device's seed, not travel.
- **The pairing push is paced, not capped** (`7c48ae5`) — against the earlier
  suggestion, and the reason matters. A cap does not reduce the work, it strands
  part of it, and nothing re-sends row summaries on the sweep (it only sends
  hello), so a stranded remainder waits for the next reconnect. It now yields
  the tick every 25 rows so pairing does not look frozen, and a test pushes two
  full batches plus a remainder and asserts every row lands. Queue-depth UI
  still does not move during a backfill — that push bypasses the outbox, and
  wiring it through would mean taking on ack semantics. Left alone deliberately.
- **The migration test tax is retired** (part of `ac07954`). Eight migration
  test files carried an `expect(LATEST).toBe(22)` pin next to their real
  assertion, so every new migration broke eight unrelated files — the trap
  CLAUDE.md warns about. Each already asserted `user_version === LATEST`, which
  is the real claim; the property the pins reached for is now asserted once in
  `runMigrations.test.ts` (versions unique, ascending, gapless).
- **Turnstile scout re-run and landed** (`7c48ae5`) —
  `research/turnstile-trial-session-scout.md`. Its load-bearing claims were
  spot-checked against the code rather than taken on trust: the re-exchange path
  returns before `grant_trial` and grants zero credit, `PER_IP_DAILY_GRANT_CAP`
  is 3, and both `src/features/ai/ai.client.ts:86` and
  `mobile/src/features/ai/mobileAiClient.ts:113` call the endpoint. Its central
  point stands: Pages deploys on push while the desktop app updates
  asynchronously, so enforcement cannot land in lockstep — it needs a permissive
  Worker first, then a client release, then a flag flip.

- **The read-only fallback was covering its own prose** (`7e9f597`). The
  occluder was the notice, not a double render: `FallbackNotice` rendered inside
  a `position: absolute, inset: 0, zIndex: 2` layer and the host returned that
  layer and nothing else, so a full-bleed sibling sat across the reader's whole
  ScrollView — notice at the top, footer at the bottom, the layer owning
  everything between. Now an in-flow banner, with a real either/or swap. My
  first diagnosis (SceneScreen rendering reader and host as siblings) was wrong;
  that gate already implements the replacement. **Device-verified** by forcing
  the fallback with a 1 ms boot budget: the scene that rendered blank now
  renders its 18 words, Try again re-attempts with the prose still readable, and
  a normal open still gets the full editor.
- **Orphaned scenes no longer vanish outside the binder** — outliner, corkboard
  and drawer list now match `buildBinderTree`.
- **`word_count` is NOT a bug — do not "fix" it.** `upsertScene`'s conflict
  clause omits it on purpose: `SqlSceneRow` has no such field, the projection
  never selects or diffs it, and desktop's apply target is character-identical.
  Counts replicate through the scene-doc merge (`storedDocMerge.ts:28`), not the
  meta path, which seeds 0 for a row that does not exist yet. Adding it to the
  conflict clause would zero a locally correct count on every meta apply. Pinned
  by a test in `mobile/src/db/mobileStores.test.ts`.

### Sync device list, and what it exposed about the model (2026-08-21, fifth batch)

Cole could not tell whether unpairing his dev phone had worked, because the
emulator was on the same key and the panel said only "synced with your other
device". Built the list; answering the rest of his questions turned up a real
gap.

- **The device list is in** (`src/sync/deviceRoster.ts`, `Settings.devices.tsx`).
  Hello gained optional `name`/`platform`; each engine keeps a roster in
  `app_meta.sync_device_roster` with first-seen, last-seen and an online window
  of 150s (two-and-a-half 60s sweeps, so one missed sweep is not "gone").
  Verified in the running dev app: `CUCUMBER / Windows / this device`, with
  `firstSeenAt` from an earlier session and `lastSeenAt` from this one, so
  persistence is real and not a fresh stamp. Mobile reports `Platform.constants.Model`,
  which is what finally separates a Pixel 3 XL from `sdk_gphone64_x86_64`.
- **The panel refuses to imply access control**, because it has none. The room
  id is HKDF(masterKey) and `RelayRoom` broadcasts to every socket in it, so the
  key IS the identity and possession IS authorisation. "Remove from list" is
  local bookkeeping; the caption says a device holding the key will reappear.
- **Many devices already work; the transport was never 1:1.** What was missing
  was memory, not capability.
- **Desktop-to-desktop works and has been measured** (the 63s sweep note in
  `engine.ts` came from a desktop-to-desktop run). No platform gating anywhere —
  same panel, same flow, Windows or macOS.
- **REAL GAP FOUND (FIXED 2026-08-22, see top) — a project created on a JOINED device never replicates.**
  `ensureAllProjectMetas` and `ensureAllProjectBibles` both early-return when
  `getSyncRole() === "joined"` (`meta/bridge.ts:104`, `bible/desktopBibleBridge.ts:48`),
  they are the only callers of `bootstrapProjectMeta`/`bootstrapProjectBible`,
  and they run at engine start only. Nothing in the project-creation path
  bootstraps. `bridge.ts:36` states the consequence outright: "Projects without a
  bootstrapped row stay inert." So the origin's library flows outward and edits
  to already-replicated projects converge both ways, but a manuscript BORN on a
  joined device is stranded with no error. Mobile is always joined. Not fixed —
  it needs a ruling on whether "origin" should stay a per-device role at all.
- **Revocation needs key rotation, not accounts.** Adding accounts would not by
  itself evict a device: the room key is what grants read access, so a removed
  device stays able to decrypt until the key changes. The architecture-preserving
  fix is a first-class "Reset pairing key" on the origin — generate a new master
  key, show the new string, re-pair the devices you keep. Accounts would add a
  server, a login, password reset and a privacy surface, and still need the
  rotation. Recommendation stands unless Cole wants accounts for other reasons.

### Keyboard coverage, board links, and the parity list (2026-08-21, sixth batch)

- **Inputs in the bottom half sat under the keyboard, and the cause was
  `Sheet`.** A sheet is anchored to the window bottom, so every input in one is
  in the covered half — and gorhom's defaults were wrong for this app twice.
  `android_keyboardInputMode` defaults to `adjustPan` while `app.json` declares
  `softwareKeyboardLayoutMode: "resize"`, so the library applied its own offset
  maths on top of a window Android had already resized; `keyboardBlurBehavior`
  defaults to `none`, parking the sheet at keyboard height after dismissal. A
  plain `TextInput` is also invisible to the sheet. `TextField` now swaps to
  `BottomSheetTextInput` off a context `Sheet` provides, fixing all five sheets
  with no call-site changes. Four screens then needed their own container:
  NewEntry, NewGoal and the corkboard moved to `KeyboardAwareScrollView`, and
  the Inbox composer rides `KeyboardStickyView`.
- **There is no platform standard that does this for you.** Android resizes the
  window, iOS overlays and reports a frame; either way the app must move the
  focused input, so this app has exactly four sanctioned containers
  (`<Screen scroll>`, `KeyboardAwareScrollView`, `KeyboardStickyView`, `Sheet`)
  and `components/keyboardCoverage.test.ts` is an inventory of every
  input-bearing file against the one it uses, checked by a source scan. **A new
  text input fails the suite until it is listed** — that is the enforcement.
- **Board cards can be linked on mobile.** A list of toggles in the card sheet,
  not a drag between nodes: desktop's drag-from-handle needs a pointer and a
  canvas that is not panning under your finger. Links are treated as undirected
  (desktop stores `{from,to}` but nothing distinguishes the directions), and
  unlinking clears duplicate pairs a two-device edit can leave.

**Desktop features still absent from mobile**, all of them stated in-app:

| Gap | Deliberate? |
|---|---|
| Compile / export | yes — a desktop job |
| Replace across scenes | yes |
| Label *definition* (applying labels works) | yes |
| Relationship-map editing and link-drawing | **CLOSED 2026-08-22** — link toggling shipped on mobile; only node layout stays on desktop |
| Moving board cards (positions) | yes — a phone-chosen x/y means nothing on desktop's unbounded canvas |
| BYOK API-key entry | yes — mobile never receives provider keys |
| Subscription / top-ups | yes — companion-only, Apple 3.1.1 and Play Billing |

Custom entity types are NOT a gap — `CustomTypeScreen` is routed and works; the
settings footer claiming otherwise was stale and is corrected.

### Conflict handling for LWW rows — recommendation, not yet built

Cole asked whether the user can pick a winner for the row domains where work
can be lost (quick notes, goals, archive, snapshots, boards, manuscript About,
AI conversations — all whole-row LWW by HLC).

**Recommendation: keep both, never ask.** A picker forces a decision at the
worst moment, needs a diff UI per domain, and buys little for rows this small.
Where a picker genuinely pays — scene prose after a restore — one already
exists (the epoch banner's "Catch up now" / "Review what I wrote", with a
safety snapshot taken first).

**The prerequisite is the same either way: stop discarding the loser.** Today
`projectReceived` upserts over the local row (`sqlDomain.ts:105`) and the
displaced payload is gone, so no UI could offer a choice even if one existed.

Proposed, one seam: in `LwwReconciler.receiveRow`, when `putIfNewer` accepts an
incoming row AND that row is still pending in the outbox, the local version was
never seen by the peer — that is a genuine concurrent edit, not a stale copy.
LWW carries no causality, but "still unacked in our own outbox" is a precise
proxy we already maintain (`onConverged` -> `acknowledgeItem`). Record the
displaced payload before applying, then surface it where the data lives: for
quick notes, as a new Inbox note marked "conflicting version from <device>",
which needs no new UI because the Inbox is already a triage list. A generic
"Sync conflicts" list in Settings covers the rest.

**BUILT 2026-08-21** (Cole approved the keep-both shape). `lww/displacedRows.ts`
plus a `readDisplaced` step in `receiveRow`; detection is "still unacknowledged
in our own outbox", so an incoming winner is a real collision rather than our
own change echoing back. Preservation is scoped to `quick_notes` and
`manuscript_about` — the two domains carrying writing someone would miss — and
the preserved copy is published so it is not stranded on the losing device.
A failure to keep it is swallowed on purpose: losing the copy is bad, failing
the apply of the row that WON is worse. No picker was built and none is
planned; the one place a picker earns its keep, scene prose after a restore,
already has the epoch catch-up flow.

### Mobile UX pass (2026-08-21, fourth batch)

A full device run-through produced ~25 items. Several collapsed into single
root causes, which is the useful part of the record:

- **One bug, ten screens.** The "random gap" at the bottom of corkboard, inbox,
  storyboard, bible detail and outliner was `Screen` claiming the bottom
  safe-area inset while the footer below it claimed the same one. It only
  *looked* like a gap where a screen's background differed from the container's;
  five more screens paid the same wasted height invisibly. Fixed by giving the
  bottom inset exactly one owner, which is app-root chrome, never `Screen`.
- **The keyboard covered every input because nothing scrolled.** Android was
  configured correctly all along (`softwareKeyboardLayoutMode: "resize"`); the
  input screens simply had no scroll container, so shrinking the window had
  nowhere to put the field. `Screen`'s scroll branch now uses
  `KeyboardAwareScrollView`; the outliner followed, dropping `FlatList`.
- **"Does nothing" was three different diagnoses.** The editor's sparkle was
  selection-gated and silently returned (the assistant was reachable from
  exactly one place in the app, only via a selection — it now opens the chat).
  Storyboard panning was genuinely broken. The manuscript dropdown and the
  outliner Columns pill had never been wired at all. `research/mobile-noop-inventory.md`
  has the full audit.
- **Renaming already existed** — long-press in the binder, inline in the
  outliner. What was missing was being asked at creation, so every create path
  now prompts, and creating a scene lets you choose its chapter.
- **Swipe-back was never broken.** native-stack hard-disables the JS gesture on
  Android because there the swipe IS the OS gesture; the report was taken on a
  phone in two-button mode, which has no edge swipe. Verified working under
  gesture nav on both edges, with the binder drawer not swallowing the left one.
- **The debug footer was shipping to users.** `__DEV__`-gated now — carefully,
  because that footer owned the bottom inset and a naive third `&&` would have
  left release builds with zero owners.
- Boards gained card create/edit/delete. Mobile never authors free-form x/y;
  new cards take the next free grid slot pitched to desktop's card width,
  because a position chosen on a phone means nothing on desktop's unbounded
  canvas. Desktop compatibility comes from calling desktop's own `boardDoc`
  helpers rather than reimplementing the Yjs shapes.

- **The AI-conversations toggle was never crashing** (Cole, 2026-08-21). It was
  reported as killing the app; it turned out to be an app update resetting
  state. That matches the code — every inbound sync path is wrapped in a
  `.catch()`, so an ordinary JS error there cannot take the process down.
  Closed, no fix needed.
- **Two duplicate "Untitled scene" / "New chapter" rows in The Salt Road are
  Cole's own test creations**, not a naming-prompt regression. Not a bug.

**Lesson worth keeping:** an animation complaint was misdiagnosed twice from
reasoning and solved in one pass by measurement — slowing the transition to 2.5s
and screenshotting mid-flight showed the label already fully drawn on frame one,
which pointed straight at the layout animation and the clip being on different
views. Slow it down and look before theorising.

### The cold pair, and what it caught (2026-08-21, third batch)

A virgin emulator paired to the desktop through the real pairing UI
**reproduced the original bug in full**: all four projects, all seven scenes
and the board's Yjs content arrived, while `boards` stayed empty,
`scene_snapshots` stayed at 0 against the desktop's 11, and the LWW ledger
stayed empty. Seeding and the pull direction were both fine — nothing ever sent
the summary that starts the exchange.

`sendAllSummaries` ran only from `syncNow`, which fires on our OWN connection
event. The desktop was already connected when the emulator joined, so its state
never changed and it announced no rows. The doc path survives that because the
sweep re-sends `hello` every 60 s and the peer's hello triggers `answerHello`;
the row path had no equivalent. **The sweep now runs a full `syncNow`**
(`991009b`), so rows re-announce on the same cadence as docs and the outbox
gets a periodic retry it never had.

Two lessons worth keeping:

- **"Verified end-to-end" needs the word COLD.** The phone check passed because
  it was already paired, and `liveRelay.integration.test.ts` connects both
  engines fresh so both fire `syncNow`. Neither exercised a peer arriving at an
  already-connected device — the single most likely real-world shape.
- **Reading these DB files without replaying the WAL will lie to you**, and it
  lies worst when you are checking for ABSENCE. sql.js ignores the `-wal`, so a
  freshly synced device reads as completely empty. Copy `writing.db`,
  `-wal` and `-shm` together and open them with `node:sqlite`
  (`DatabaseSync`), which replays the log. The device's own screen is the
  cheaper cross-check.

After the fix the cold-paired emulator holds `boards: brainstorm-default`, all
11 snapshots and the matching ledger rows.

### Still open

1. **Ship v0.13.0** (Cole: `.\publish.ps1`, then `publish-mac.sh`). It carries
   the sync-ledger backfill AND the joined-device bootstrap fix desktop-side —
   both are only real once desktop ships. Prepped and tagged 2026-08-22.
2. **Mobile is still running a dev bundle from Metro.** The cold-pair proof used
   the dev client, not a release build. A release-build pair is still unrun.
3. **Turnstile: phases 1 AND 2 built; still dark** (see 2026-08-22 above).
   Next: widget + secret + site keys, ship v0.13.0, then the enforcement
   flip. Still: never enforce on `master` in one step.

### Mobile: still not submittable

- **Release signing is the debug keystore** (`android/app/build.gradle`, stock
  `androiddebugkey`). Do NOT fix this by editing build.gradle — prebuild owns
  that file and regenerates it. Use **EAS-managed credentials** so EAS holds the
  upload keystore. The Expo account is not a blocker — the `eas` CLI is already
  authed as `codingmagic` (orgs `codingmagic`, `codingmagics-team`).
- **iOS does not exist.** No `mobile/ios/` tree; never prebuilt or run.
- `version` is still `0.1.0` / `versionCode 1`. The EAS `production` profile
  auto-increments, but the marketing version needs a real number.
- No store listing, screenshots, age rating, or data-safety answers anywhere.
- `privacy.html` was last updated 2026-06-14, says "files on your own
  **computer**", and never mentions a phone, camera, or share sheet. Both stores
  will check it against the declared behaviour.
- No in-app account deletion (Apple 5.1.1(v) and Google both require it once an
  account-like identity exists — trial state, Lemon instance id, AI key).
- **The splash migration is unverified on device.** expo-splash-screen 57
  replaced `setTheme(R.style.AppTheme)` with
  `SplashScreenManager.registerOnActivity` in `MainActivity.kt`, which changes
  first-paint theming. Green tests cannot see this.

### Gotcha worth knowing

`mobile/android/` is committed to git but **prebuild regenerates the whole
tree** — it was cleared and recreated twice on 2026-08-20. Any hand edit to a
native file there is lost on the next prebuild. Native changes must go through
`app.json` or a config plugin.

### Commercial

- Add **Cloudflare Turnstile** to `/api/ai/trial-session` (and the contact and
  newsletter forms). Turnstile's free tier is $0 with no paid Cloudflare plan
  required — 20 widgets, 10 hostnames each, unlimited challenges. Today there is
  no bot defence there; exposure is bounded at $25/day by
  `GLOBAL_DAILY_TRIAL_SPEND_CAP` but an attacker can still deny the trial to
  real users in ~17 requests.
- **Device Sync is to be sold at $5/mo** (decision, Cole 2026-08-20). The LS
  variant `1748967` exists but has no checkout UUID, and `pricing.html` still
  says "not yet shipped".
- `CHANGELOG.md` stops at 0.2.1 (2026-06-08); ~25 tags have shipped since.
  `RELEASING.md` still claims the project is Windows-only.
- No error monitoring anywhere. The only way to learn a customer is broken is
  Cloudflare's live log tail.


### Cole's desktop DB holds no manuscripts (Cole, 2026-08-20)

Cole does not write in the app; his `%APPDATA%\com.coles.writing\writing.db`
has no manuscript content worth protecting, and he has cleared it for direct
testing. **The full DB-swap protocol is therefore NOT required for sync work on
his rig** — take one `Copy-Item` backup before a destructive run (it costs
seconds and still covers the `app_meta` licence row and settings) and skip the
move-aside/restore/hash ritual. This is a fact about Cole's machine only; his
writing partner's install is untouched by any of it, and this note goes stale
the moment he starts writing.

## Reference index
- [roadmap/mobile/EMULATOR-MATRIX.md](mobile/EMULATOR-MATRIX.md) — the checklist, the orphan sweep, dev-loop traps.
- [decisions/0016-mobile-drawer-is-button-only-under-gesture-nav.md](../decisions/0016-mobile-drawer-is-button-only-under-gesture-nav.md) — the drawer ruling.
- [.claude/known-issues.md](../.claude/known-issues.md) — `registered-does-not-mean-reachable` and the DB-swap protocol.
- [roadmap/coordination/mac-day-runbook.md](coordination/mac-day-runbook.md) — Mac-day execution script.
- [.claude/vendor-gotchas/tauri.md](../.claude/vendor-gotchas/tauri.md) — Tauri traps.
- [marketing/.claude/vendor-gotchas/](../marketing/.claude/vendor-gotchas/) — Cloudflare/LS traps.
- [knowledge/platforms.md](../knowledge/platforms.md) — per-platform facts.
- [CLAUDE.md](../CLAUDE.md) — stack, commands, publish contract.
- [decisions/](../decisions/) · [decisions/RECENT.md](../decisions/RECENT.md) — durable ADRs.
- Shared desktop DB: %APPDATA%\com.coles.writing\writing.db (never edit live). Mobile DB via `adb exec-out run-as com.coles.writersnook cat files/SQLite/writing.db` (+ -wal). Do NOT run publish.ps1 from agent context.
