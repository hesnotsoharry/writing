# Device Sync + Mobile (Phase 2) — Design

status: **APPROVED 2026-08-05** — D1 both-online-only, D2 sync in one-time license, D3 Expo+EAS free tier, D4 mobile v1 = write + browse (all §9 recommendations accepted)
date: 2026-08-05
builds on: `decisions/0001-local-first-architecture.md` (incl. 2026-06-09 LS amendment),
spec §11 Phase plan, codebase seam audit 2026-08-05 (summarized in §5/§Appendix)

---

## 1. Goals / non-goals

**Goals**
- Full two-way editing sync between a user's own devices (desktop↔mobile, desktop↔desktop),
  end-to-end encrypted, with **zero document content persisted on our infrastructure**.
- Mobile app (iOS + Android): write and edit scenes, browse the binder, view synopses/status.
- Offline-safe on every device: writing never requires connectivity; devices converge when
  both are online (see D1).

**Non-goals (Phase 2)**
- Multi-user collaboration (rooms are one user's paired devices only).
- Server-side backup or version history (forbidden by the LS amendment).
- Full feature parity on mobile (corkboard, story-bible editing, exports, AI panel come later
  or never — mobile is a *writing companion*, not a second desktop).
- Background sync while the mobile app is suspended (iOS kills sockets; sync runs foregrounded).

## 2. Locked constraints (inherited)

1. Yjs is the substrate; **one Y.Doc per scene** (do not collapse).
2. Sync contract is **Yjs updates over WebSocket**.
3. The relay is **stateless**: it forwards frames and stores nothing. Even encrypted-at-rest
   document content on our servers is off the table (LS merchant-of-record compliance).
4. The editor stays a self-contained web bundle — mobile reuses it.

## 3. Topology

```
Desktop (Tauri)  ──wss──►  Relay (CF Worker + Durable Object)  ◄──wss──  Mobile (RN)
                            · one DO per sync room
                            · WebSocket Hibernation API (near-zero idle cost)
                            · sees only opaque ciphertext frames
```

- **Relay = a small dedicated Cloudflare Worker with one Durable Object class.** A DO
  (Durable Object: Cloudflare's single-instance stateful mini-server; all sockets for one
  room land on the same instance, which is exactly what a relay needs) per room, using the
  WebSocket Hibernation API so idle rooms cost ~nothing. Reference pattern:
  [yjs-cf-ws-provider](https://github.com/TimoWilhelm/yjs-cf-ws-provider) — but ours is
  dumber: it never materializes a Y.Doc, it only fans frames out to the room's other sockets.
- **Room = sync group** (the set of paired devices), not per-document. One WS connection per
  device; frames carry an envelope `{channel: docId, payload: ciphertext}` multiplexing all
  docs (scene docs, board docs, the project meta doc) over the single socket.
- Deployed as its own Worker (not a Pages Function — DO classes need a Worker script), same
  Cloudflare account as marketing. Cost at 2-device scale: effectively zero.
- DO WS message cap is 1 MiB — large first-sync diffs must be chunked; the envelope carries
  a `seq/final` pair for reassembly.

## 4. Pairing, identity, E2EE

- **Sync key**: desktop generates a random 256-bit master key on "Enable sync". Stored in the
  OS keyring (service `com.coles.writing`, user `sync-key` — fourth entry alongside the BYOK
  keys; well under the Windows 20-credential ceiling; all keyring rules in
  `.claude/vendor-gotchas/keyring.md` apply: `use_native_store(false)` already set,
  `spawn_blocking`, no raw errors over IPC).
- **Key split via HKDF** (a standard "derive several keys from one" function):
  `roomId = HKDF(master, "room")` (public — sent to the relay to select the DO) and
  `encKey = HKDF(master, "enc")` (never leaves devices). The relay learns the room ID but
  can never derive the encryption key from it.
- **Pairing UX**: desktop shows a QR code (the master key + relay URL); phone scans it.
  Manual short-code fallback for desktop↔desktop.
- **Frame encryption**: AES-GCM via WebCrypto (available in both WebView2 and RN WebView /
  JSI polyfill). Every frame independently encrypted; relay authenticates membership with a
  token derived from `HKDF(master, "auth")` so strangers can't join a room to collect
  ciphertext or waste DO time.
- **Device identity**: each device generates a `deviceId` UUID at pairing (none exists today —
  the closest prior art is the Lemon Squeezy `instanceId` in `app_meta['license']`, which
  stays licensing-only). Used for update attribution and the pairing-management UI
  ("Cole's PC", "Pixel 9").
- Auth follows the app's established pattern (long-lived secret → short-lived token →
  memory only), mirroring `ai.client.ts` session flow.

## 5. Client sync engine (desktop first)

The seam audit found the engine can be built almost entirely **on encoded states, without
instantiating Y.Docs**: `Y.encodeStateVectorFromUpdate`, `Y.diffUpdate`, and `Y.mergeUpdates`
operate directly on the stored base64 blobs. That makes the background sweep cheap and keeps
the editor-core untouched (Decision 0008: editor is additive-only).

**Sweep protocol (per reconnect / per dirty-doc notification):**
1. Devices exchange per-doc state vectors (a state vector = a compact "how much of each
   peer's history I have" summary) for all docs in the project.
2. Each side sends `Y.diffUpdate(localState, remoteStateVector)` for docs where the peer is
   behind; receiver `Y.mergeUpdates([stored, received])` → writes back through
   `SqliteSceneDocStore` and refreshes the plaintext projection.
3. For the **live open doc**, remote diffs are applied with
   `Y.applyUpdate(doc, diff, SYNC_ORIGIN)` — forward updates are safe on live docs (the
   vendor-gotcha ban is on whole-doc *replacement*, not forward merges).

**Required refactors (small, prerequisite wave):**
- `bindPersistence` gains origin awareness: local-edit updates schedule save + notify sync;
  remote-origin updates schedule save but **skip the `onSaved` cascade** (word-count +
  entity re-detection + tree reload would otherwise thrash at keystroke frequency —
  re-run once, debounced, when a remote burst settles).
- Route the three `scene_docs` bypass writers (`manuscriptSearchStore.persistDoc`,
  `sqliteArchiveHelpers` restore/purge, plus the archive path) through the store so the
  engine sees every mutation.
- Stamp a per-doc `updated_at`/dirty flag so the sweep doesn't re-vector every doc.

**The restore hazard (sharpest correctness risk).** Snapshot-restore, snap-undo, and
Find-Replace-All deliberately *replace* doc bytes and reload the scene (Yjs can't rewind).
A naive sync would then Yjs-merge the pre-restore state back in from the other device —
resurrecting exactly what the user restored away. Mitigation: a per-doc **epoch counter**
in the project meta doc. Restore bumps the epoch; a device seeing a higher epoch than its
local one discards its local doc state and accepts the epoch-owner's full state wholesale
(taking a local safety snapshot first, same as the existing auto-snap pattern).
Restore-vs-concurrent-edit resolves as "restore wins, loser's divergence is in their
snapshot history." Sync sweeps pause while a restore is in flight locally.

**Structure sync — the project meta doc.** Binder tree/ordering, labels, synopsis/status,
and story-bible rows are relational, not CRDT. Phase 2 adds one **project-level Y.Doc**
(`Y.Map`s keyed by row id; order as fractional-index strings rather than renormalized
integers) as the *sync substrate*; SQLite remains what the UI reads (projection), bridged
at the store layer. Scoped deliberately:
- **v1 scope**: binder structure (folders/scenes/order/titles), synopsis, status, labels,
  scene create/archive, doc epochs.
- **later**: story bible entities/fields/relations, goals targets.
- **explicitly out**: goal daily progress/streaks (localStorage-only today — per-device is
  actually correct semantics), settings, AI conversations, license/trial rows.
Multi-row application is non-atomic (tauri-plugin-sql has no transactions) — apply order:
folders → scenes → links, all upserts idempotent, projection rebuilt at the end.

**First-sync project identity.** Project ids are client-generated; two devices that each
created projects locally share no ids. Pairing flow therefore does an explicit project
handshake: fresh device receives the project list and clones; a device with existing local
projects keeps them as separate local-only projects (a "link two existing projects" merge
is out of scope — surfaced in UI as "synced" vs "this device only" badges).

## 6. Mobile app

- **React Native via Expo** (recommended — see D3): Expo's dev-client + EAS Build gives us
  cloud iOS builds (no local Mac needed for day-to-day work; the CI-not-rentals lesson from
  the macOS port, applied to mobile from day one) and handles signing/store submission.
- **Editor = our existing web bundle** in `react-native-webview`, hydrated exactly like
  desktop (hydrate before mount, no `content` prop, Yjs undo). TenTap is used *only if* the
  spike shows its bridge (toolbar/keyboard handling) saves real time over wiring our own —
  its docs show no Yjs support, so its prebuilt bundle is out either way; at most we use its
  custom-bundle mode. This flips ADR R1's "worst case" (own thin wrapper) into the base case,
  and it's cheap because the editor bundle already exists.
- **Local storage**: SQLite on device (expo-sqlite), same-shaped subset of the schema, same
  base64 doc encoding. Prerequisite seam: the TS stores currently reach `getDb()`
  (tauri-plugin-sql) directly — introduce a thin DB-adapter interface so binder/scene-doc
  stores compile for both shells.
- **v1 mobile surface**: binder list → scene editor → synopsis/status view. Word-count/goals
  display read-only. No corkboard, no story-bible editing, no exports, no AI.
- **Distribution**: Cole's existing Apple Developer + Google Play accounts; TestFlight +
  Play internal track first.

## 7. Spike (retires ADR R1 — run before any other build)

1–2 days, throwaway repo. Prove, in order:
1. Editor bundle builds standalone and loads in RN WebView on Android (emulator + one real
   device) and iOS (EAS dev build).
2. Y.Doc hydration + editing works; virtual-keyboard behavior is acceptable (known WebView
   editor pain: keyboard avoidance, selection handles, autocorrect).
3. Yjs updates round-trip phone↔desktop through a local dumb WS relay (20-line Node script —
   the DO comes later); type on phone, see it on desktop, kill the connection mid-edit,
   reconnect, converge.
4. Perf sanity on a large scene (spec R2 threshold: ~50k words).

Success = all four; failure on (2) keyboard/UX is the realistic risk and would push us
toward TenTap's bridge utilities or a native-toolbar hybrid.

**Spike findings — Android leg, 2026-08-05 (`C:\Web App\writing-sync-spike`):**
- All four criteria PASSED on the Android emulator (API 36): editor bundle renders in RN
  WebView via Expo Go, virtual-keyboard typing inserts at the cursor, desktop↔phone
  round-trip syncs instantly, offline divergence converges cleanly on reconnect, and a
  50k-word scene renders + stays typing-responsive on both sides (full state = ~340 KB,
  comfortably under the DO 1 MiB frame cap).
- **Hard-won lesson for S2: the sync client needs a connect watchdog.** The Android WebView
  wedged in "connecting" forever after a relay restart — a WebSocket that neither opens nor
  closes stalls a naive retry loop. Fix (proven in `editor-web/src/wsProvider.ts`): a
  connect-timeout timer that force-closes and reschedules, plus a try/catch around the
  constructor. Carry this into the production provider.
- Still open (needs Cole): iOS leg (EAS dev build or Expo Go on a physical iPhone),
  real-device Android over LAN, and human-hands keyboard UX (autocorrect, selection
  handles, long-press).

## 8. Build sequence (wave-sized)

| # | Wave | Contents |
|---|---|---|
| S0 | Spike | §7. Go/no-go gate for everything below. |
| S1 | Sync plumbing prep | Origin-aware `bindPersistence`, bypass-writer routing, DB-adapter seam, `deviceId`. Pure refactor, ships invisible in a normal release. |
| S2 | Relay + pairing | DO relay worker, HKDF/AES-GCM frame layer, pairing UI (QR + keyring), desktop↔desktop sync of scene docs only. Testable with two desktop installs. |
| S3 | Meta doc + structure sync v1 | Project meta doc, epochs/restore interlock, binder/label/status sync, first-sync handshake. |
| S4 | Mobile shell | Expo app, binder browse, scene read (sync down). |
| S5 | Mobile editing | Editor bundle integration, sync up, keyboard polish. |
| S6 | Ship | Store listings, TestFlight/Play internal, docs + marketing page. |

Desktop↔desktop sync ships value as early as S2–S3 (Cole + writing partner both have two
machines' worth of use cases) and de-risks the relay before mobile touches it.

## 9. Open decisions (Cole)

- **D1 — Convergence model**: both-online-only sync (stateless relay, fully compliant).
  *Recommended: accept for v1.* Alternative (encrypted store-and-forward where we hold no
  keys) requires a Lemon Squeezy compliance ruling before it can even be considered.
- **D2 — Pricing**: relay cost at expected scale is ~zero. *Recommended: sync included with
  the one-time app license*; revisit only if relay abuse appears. (Subscription stays
  AI-only, preserving "costs zero when unused".)
- **D3 — Expo + EAS**: EAS free tier covers spike-cadence builds; paid from ~$19/mo only if
  build volume demands it. *Recommended: Expo, free tier until it hurts.* (Spending trigger
  → Cole approves before any paid plan.)
- **D4 — Mobile v1 surface**: confirm the §6 cut (write + browse; no corkboard/bible/AI).

## 10. Risks

| Risk | Sev | Mitigation |
|---|---|---|
| WebView editor UX on mobile keyboards | High | Spike criterion #2; TenTap bridge fallback |
| Restore/relay echo resurrection | High | Epoch design (§5); dedicated tests before S3 ships |
| Structure-merge edge cases (concurrent reorder) | Med | Fractional-index ordering; last-writer-wins per field; both-online narrows windows |
| DO 1 MiB frame cap on first sync | Med | Chunked envelope from day one |
| iOS foreground-only sockets | Low | Foreground sync is the design; sync-on-open is fast (state vectors are tiny) |
| tauri-plugin-sql non-atomicity | Med | Idempotent ordered upserts; projection rebuild last |

## Appendix — seam audit anchors (2026-08-05)

Scene doc lifecycle: `src/App.tsx:69-89` (`loadScene`), `src/yjs/serialize.ts`,
`src/yjs/bindPersistence.ts` (the app's single `doc.on("update")` observer — the sync hook
point). Persistence: `src/db/sqliteSceneDocStore.ts`; bypass writers
`src/db/manuscriptSearchStore.ts:141`, `src/db/sqliteArchiveHelpers.ts:67,164,187`.
Restore paths: `src/App.snapshots.ts:167-186`. Cascade: `src/App.detection.ts:82-90`.
DB singleton: `src/db/schema.ts:42` (`journal_mode=DELETE` is load-bearing). No WebSocket,
no `y-protocols`, no device id anywhere today; keyring prior art in `src-tauri/src/byok.rs`;
token pattern prior art in `src/features/ai/ai.client.ts`.
