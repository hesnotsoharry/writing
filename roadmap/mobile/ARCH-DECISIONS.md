---
project: writing
scope: mobile full-app build-out — architecture decisions
updated: 2026-08-08
inputs: roadmap/mobile/RECON-data-sync.md, roadmap/mobile/RECON-portability.md
---

# Mobile build-out: locked decisions

Adjudicated from the two recon reports. Implementation phases follow these; if a
phase finds one of them wrong, say so in the final message rather than quietly
choosing something else.

## D1 — Story Bible replicates through a new per-project Yjs doc

Channel `bible:<projectId>`, stored base64-TEXT like every other doc. Carries
entity bases (`characters`, `locations`, `entities`), `entity_fields`,
`scene_links`, `entity_links`, `entity_relations`, `entity_types_custom`, and
**domain-local** tombstones.

**Not** folded into `meta:<projectId>`. The meta doc is correctness-critical for
binder ordering and epoch ownership, and its global `tombstones` map is read by
v1.2 `planDeletes` — widening that union would make an old peer delete rows it
does not understand. A separate doc isolates both the schema growth and the
failure blast radius.

Long prose (`notes`, section bodies) is `Y.Text`, not whole-field LWW, so two
devices editing different sections of the same character both keep their work.

## D2 — Everything else row-shaped replicates through a generic LWW layer

New inner messages `row-hello` / `row` / `row-ack` over the existing encrypted
transport. Version = hybrid logical clock + device-id tie-break. Durable
tombstones and versions live in one shared shadow table
`sync_lww_rows(domain, project_id, row_id, hlc, device_id, deleted, payload_json)`
so a row's version survives the row's deletion.

Domains: goal definitions, quick notes, archive entries, snapshot rows, board
metadata, `manuscript_about`, AI conversations + messages.

Rejected for these: a Yjs doc per domain (append-only message logs and immutable
snapshot payloads do not need a CRDT and would grow unboundedly), and folding
into the meta doc (same reason as D1).

## D3 — Labels are already synced; the gap is authoring

`labels` and `sceneLabels` have been in the meta doc since v1.1 and both apply
targets project them. Mobile needs a `MobileLabelStore` plus the mobile half of
`src/sync/meta/localBridge.ts`, and `mobileEngine` must finally set
`subscribeMetaSaves` (unset since S4 because mobile was read-only). **No protocol
change and no migration.** Do not invent a second labels path.

## D4 — Mobile accepts epochs manually; desktop keeps accepting automatically

The design's "This device is behind → Catch up now" screen requires a state
where the replacement is *held*, not applied. Add `epochAcceptance:
"automatic" | "manual"` to the engine options; mobile runs manual.

A held replacement must be **durable** — the relay stores nothing and the epoch
owner can vanish (a documented accepted limitation). New canonical table
`sync_pending_replacements(scene_id PK, project_id, epoch_n, epoch_device,
state_base64, received_at, snapshot_id)`.

Catch-up order is fixed: stop publishing the behind scene → flush and close the
editor bridge → take and persist one safety snapshot per scene (its id is what
"Review what I wrote" opens) → apply the staged state wholesale and persist the
exact `{n,d}` as applied → notify the WebView, clear pending/outbox, resume.

**There is never a "merge anyway" option.** Preventing resurrection is the whole
point of the epoch.

## D5 — Queue depth and last-seen must be durable, not in-memory

`RelayProvider.send` drops silently when the socket is closed, and the scene
save timers and `ReplacementQueue` are in memory — so today there is nothing to
count. Add `sync_outbox` with semantic message ids and ACK state, persist
`app_meta['sync_last_peer_seen_at']`, and extend `SyncStatus` with
`lastPeerSeenAt`, `queue: {scenes, notes, boards, rows}` and `behind[]`.

"4 scenes and 2 notes to send" counts distinct dirty `(domain, id)` keys — never
raw frames, or a burst of typing reads as a backlog.

Handing a frame to the socket is **not** delivery. Only a `row-ack` (or the
peer's next hello proving convergence) clears an outbox entry.

## D6 — Managed AI reaches mobile by a post-pair encrypted credential handoff

The managed proxy credential is entitlement-bound, not device-bound: the
four-hour token payload is `{licenseKey, expiresAt}` and nothing more. So it
*can* be shared to the phone.

Mechanism: after pairing completes, the desktop offers a one-shot encrypted
`credential-offer` carrying only `{aiLicenseKey | aiTrialKey, aiModel,
aiEnabled}`. Mobile stores the long-lived key in Expo SecureStore and mints its
own short-lived session token; the short-lived token is never transported.

Rejected: putting the AI key in the pairing QR (couples two independent secrets
into one scannable payload that gets screenshotted and logged), and manual key
entry on mobile (contradicts the design's "mobile inherits the paired config").

**Requires explicit desktop consent** — a "Share managed AI access with the
paired phone" confirmation, not an automatic transfer. BYOK provider keys and
local-LLM endpoints are never transported; if the desktop is BYOK-only, mobile
shows managed AI as unavailable with "Set up managed AI on desktop".

## D7 — Portraits do not sync in v1

Portrait files live outside SQLite and a desktop filesystem path is meaningless
on the phone. The Story Bible ships with the type-tinted initial fallback the
design already draws. A chunked encrypted asset channel is a later wave.

## D8 — Fix the desktop goal-persistence gap before mobile consumes goals

The `goals` table holds only `id, project_id, goal_type, target, enabled,
created_at`; deadlines, qualifiers, baselines, met-days and streak state are in
desktop `localStorage`. The designed Goals screen needs the real model, so add
`goals.config_json` + `goals.updated_at` and make the SQLite row canonical.

Progress, streak and session state stay **device-local** on purpose, per the
approved sync design — each device derives word progress from its own converged
scenes, and "this sitting" should not jump devices.

## D9 — Mobile activates its own license instance

Mobile must not copy the desktop `ActivationRecord`; its `instanceId` names the
desktop activation. The portable `licenseKey` may ride the same consented
entitlement handoff, but mobile activates it itself and persists its own
returned instance id. Trial timestamps transfer as a monotonic merge (earliest
`trialStartedAt`, latest `lastSeenAt`) so pairing cannot reset the trial.

**Two things Cole must confirm before this ships** — neither blocks
implementation:
1. The live Lemon Squeezy activation limit is ≥ 2. The repo's launch checklist
   says 3 (laptop + desktop + reinstall), but the production dashboard setting
   is not provable from code.
2. App Store / Play policy on activating an externally purchased license.

## D10 — Protocol v1.3; the outer frame stays `v: 1`

New channels and new inner message types are additive. A v1.2 peer's
`parseChannel` returns null for `bible:*` and `isInnerMessage` drops
`row`/`row-ack`, so scene, meta and board sync keep working untouched — the old
peer just does not receive the new domains.

Add a capability list to `hello` so a new peer can say "your other device needs
an update" instead of silently showing partial data.

## S3 rules that bind every new domain

These are not style preferences; each one is a defect that already shipped and
was fixed:

1. **A local mutation pushes content, not just a state vector.** Advertising
   only is what made a binder reorder take 63 seconds.
2. **Inbound frames apply in arrival order** through the existing promise chain.
   Racing meta against a replacement is what made a restore get discarded and
   then wait a full sweep for something it had already thrown away.
3. **Learn ownership before awaiting the SQL projection.** The save/apply gap is
   what let a remote epoch bump be misread as a local restore.
4. **Store callbacks must distinguish local writes from remote projection
   writes.** Hooking the lowest-level store notifies on remote applies and
   ping-pongs forever — which is why the scene path uses an explicit local-write
   bridge and the meta path does not. Every new domain bridge inherits that
   asymmetry.
