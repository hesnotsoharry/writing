# Sync Protocol v1 (S2 — desktop↔desktop)

status: approved with the Phase-2 design (parent: `2026-08-05-device-sync-mobile-design.md`)
date: 2026-08-06

The relay worker, the client crypto layer, and the sync engine all implement THIS document.
Change it here first if any of them needs a change.

## Keys (client-side only; the relay never sees any of these)

From the 256-bit master key (generated at pairing, keyring-held), derive via HKDF-SHA256
with salt `"writersnook-sync-v1"`:

| Derivation | info | Output |
|---|---|---|
| `roomId` | `"room"` | 32 bytes → base64url (no padding). **This is the capability**: it appears in the WS URL, is unguessable without the master key, and grants join-room only — frame contents stay E2EE. No separate auth token in v1. |
| `encKey` | `"enc"` | 32 bytes → AES-256-GCM key |

## Transport

- `GET wss://<relay-host>/room/<roomId>` with WebSocket upgrade. Anything else → 404/426.
- Text frames only. A frame over 1 MiB → close 1009. More than 8 sockets in a room → close 1013.
- The relay broadcasts every received frame verbatim to all *other* sockets in the room.
  No parsing beyond the size check, no storage, no payload logging.

## Outer frame (JSON text)

```json
{ "v": 1, "d": "<deviceId>", "n": "<msgId uuid>", "i": 0, "f": 1, "p": "<base64 chunk>" }
```

- `p` chunks are slices of one encrypted blob; slice pre-encoding at ≤ 512 KiB so the
  encoded frame stays under the 1 MiB cap. `i` is 0-based, `f` is total chunks.
- Reassembly key is `(d, n)`; receivers discard incomplete groups after 30 s.
- Receivers ignore frames where `d` equals their own deviceId (echo safety) or `v` ≠ 1.

## Encrypted blob

`12-byte random IV || AES-GCM ciphertext` of the inner-message JSON bytes. Fresh IV per
message. Decrypt failure → drop silently (wrong-key strangers can join an exposed roomId
but produce only noise).

## Inner messages (JSON; binary fields base64)

| t | Fields | Meaning |
|---|---|---|
| `hello` | `device`, `docs: [{c, sv, at}]` | Sent by each side on every (re)connect. One entry per local doc: `c` channel, `sv` = `Y.encodeStateVector`-equivalent from stored state, `at` = updated_at or null. |
| `diff` | `c`, `u` | Yjs update bringing the peer up to date; sent for each doc where the sender is ahead of the peer's hello `sv`, and as full state for docs the peer didn't list. |
| `live` | `c`, `u` | Incremental update from a live open doc, streamed as typed. |

- Channels: `scene:<sceneId>`, `board:<boardId>` (S3 adds `meta:<projectId>`).
- Receiving `diff`/`live`: merge into stored state via the doc stores; if the doc is open,
  `Y.applyUpdate(doc, u, SYNC_ORIGIN)` instead and let origin-aware persistence store it.
- Receiving `hello`: reply with `diff`s (never with another `hello` — both sides send
  theirs on connect unconditionally; replying would loop).

## Client connection discipline

Carry the S0 spike lessons: capped-backoff reconnect (max 10 s) AND a 7 s connect
watchdog that force-closes and reschedules a socket that neither opens nor closes
(Android WebView wedge; same code path serves desktop).

## v1 limits (accepted, revisit in S3)

- Snapshot-restore/replace vs relay echo: the epoch mechanism is S3. Until then the
  engine pauses sweeps during restore, and sync stays behind an experimental toggle.
- No structure sync (binder rows) — scene + board docs only.
- Sweep cadence: on connect + every 60 s while connected + after local saves; no
  store-write push hooks yet.

## v1.1 additions (S3)

**Meta channel.** One additional channel per project: `meta:<projectId>` — a Y.Doc that
is the sync substrate for structure. Top-level maps (all keyed by SQL row id):
`folders` (Y.Map per row: title, sortKey, projectId), `scenes` (Y.Map per row: title,
folderId|null, sortKey, status, synopsis, projectId), `labels` + `sceneLabels`,
`docEpochs` (see below), and `tombstones` (Y.Map: rowId → {kind, at} for
archive/delete propagation). Ordering uses fractional-index strings (`sortKey`), NOT
renormalized integers — concurrent reorders merge without collision. SQLite remains
what the UI reads; the meta doc is written by the same store methods that write SQL
(bridge at the store layer), and applied back to SQL on remote merge.

**Meta docs sync exactly like scene docs** — same hello/diff/live messages, same
storage shape (a `project_meta_docs` table mirroring `scene_docs`). No new message
types for structure.

**Epochs.** `docEpochs` maps docId → integer epoch, bumped by any whole-doc
replacement (snapshot restore, snap-undo, Find&Replace-All rebuild). Rule: a device
whose local epoch for a doc is LOWER than the meta doc's epoch must discard its local
doc state and accept the epoch-owner's full state wholesale (taking a local
auto-snapshot first). Sweeps compare epochs before state vectors; `diff`/`live`
frames for a doc are ignored by receivers while their local epoch is behind (until
the full-state `diff` for the new epoch arrives, identified by an `e` field added to
`diff` messages on epoch'd docs). Restore-wins semantics; the loser's divergence
stays recoverable in their snapshot history.

**First-sync handshake.** A device with zero local projects clones everything on
first hello (meta + docs arrive as normal diffs). A device with existing local
projects keeps them local-only: projects sync only if their `projectId` exists in the
peer's meta channels. v1.1 has no merge-two-existing-projects flow; the UI badges
projects as "synced" vs "this device only".

Each meta doc carries a top-level `project` map (`id`, `title`, `type`) so a joining
device can create the parent `projects` row before applying folders, scenes, and labels.
The generating device persists `app_meta['sync_role'] = 'origin'`; a device entering a
pairing string persists `joined` and never bootstraps meta docs for its existing projects.

## v1.2 additions (epoch ownership)

`docEpochs` values are ownership stamps: `{ n: number, d: string }`. `n` is the
whole-document replacement counter and `d` is the persistent device id of the
device that performed that restore. `diff` and `live` messages continue to carry
only the numeric counter in `e`; ownership exists only in the Yjs meta doc.

The converged Yjs map entry is authoritative. Readers adopt that exact `{n, d}`
instead of retaining the maximum counter seen locally. The applied-epoch store also
persists the tuple. A device is behind when its applied tuple does not match the
known tuple; a missing applied entry is `{n: 0, d: ""}`. An empty owner is a wildcard
on either side of this comparison.

The wildcard is the persisted-data compatibility shim: a legacy bare numeric value
in either an on-disk v1.1 meta doc or the JSON applied-epoch store normalizes to
`{n, d: ""}`. Live wire compatibility with v1.1 peers is not provided. During
concurrent restores Yjs selects one owned entry, the losing restorer becomes behind,
withholds its scene, and requests the owner's full state for wholesale adoption.

## v1.3 additions (domain docs, row replication, durable delivery, mobile catch-up)

The encrypted outer frame remains `{ "v": 1, ... }`. All v1.3 changes are additive
inner-message fields/types or a new channel. A v1.2 receiver ignores `bible:*` because
it does not recognise that channel and drops the new inner-message types. Scene,
board, and meta traffic therefore continues to converge between v1.2 and v1.3 peers.

**Capabilities.** `hello` may carry `capabilities: string[]`. v1.3 sends
`["domain-docs", "row-lww", "manual-epochs", "managed-credential-schema"]`.
Absence means the v1.2 baseline. Capabilities are advisory UI information only; they
never grant access and do not change how known scene/meta/board frames are handled.

**Generic domain docs.** `bible:<projectId>` is a recognised Yjs channel stored in
`project_domain_docs` under domain `bible`. It uses the existing hello/diff/live
flow. Its schema and SQL projection are specified by the later Bible phase.

**Row LWW messages.** Row-shaped domains use a hybrid logical clock (HLC) and the
persistent device id as a deterministic final tie-break. A version compares by HLC
first and device id second. Tombstones live in the shared shadow table, independently
of feature rows, so deleting a feature row never forgets its version.

| t | Fields | Meaning |
|---|---|---|
| `row-hello` | `domain`, `project`, `rows: [{id, hlc, device, deleted}]`, `cursor?`, `more`, `sender?` | One bounded page of the sender's durable version summary. `project` is a project id or null. Rows are ordered by row id. `cursor` is the last row id in this page when `more` is true. `sender` is the device that emitted the page (not the last-writer of any row); receivers key paging state by it so two peers' pages cannot interleave. Older builds omit it. |
| `row` | `id`, `domain`, `project`, `row`, `hlc`, `device`, `deleted`, `payload` | One complete semantic row mutation. `id` is the coalescing outbox item id; `payload` is JSON text or null. Receivers persist the winning shadow version before projecting or tombstoning the feature row. |
| `row-ack` | `id`, `domain`, `row`, `hlc`, `device` | Semantic acknowledgement that the receiver durably accepted this version. It clears the matching row outbox item; handing bytes to a WebSocket never does. |

Each `row-hello` page contains at most **512 rows**. A receiver requests/answers the
next lexicographic page using the cursor until `more` is false. On reconnect, each
side sends rows absent from the peer summary or newer than its advertised version.
An equal/newer peer summary also proves convergence and may clear the corresponding
row outbox entry. All inbound row frames run through the same arrival-order promise
chain as document frames. A local mutation enqueues and immediately sends the full
`row`, not merely a summary.

**Durable document delivery.** Scene, board, meta, and domain-doc local writes have
one coalescing `sync_outbox` item per `(domain, item_id)`. Document entries clear
when a peer `hello` state vector proves that item converged. Row entries clear on
`row-ack` or an equal/newer `row-hello` summary. Reconnect flushes the durable outbox
in creation order before the normal hello/reconciliation sweep.

**Managed credential schema.** These messages define the later consented managed-AI
handoff; v1.3 does not initiate or store the exchange.

| t | Fields | Meaning |
|---|---|---|
| `credential-offer` | `id`, `managed: {aiLicenseKey?, aiTrialKey?, aiModel, aiEnabled}` | One encrypted, explicitly consented offer. Exactly one managed entitlement key is present. BYOK keys, provider secrets, local endpoints, activation records, and short-lived session tokens are forbidden. |
| `credential-ack` | `id`, `accepted` | Confirms or declines that offer without echoing credential material. |

**Manual epoch acceptance.** Desktop retains automatic v1.2 replacement behaviour.
Mobile stages an authoritative epoch replacement durably and reports the scene as
behind. Catch-up stops publishing the scene, flushes and closes its editor bridge,
persists one safety snapshot, applies the staged owner state wholesale, persists the
exact `{n,d}` ownership stamp, notifies the editor, clears pending/outbox state, and
then resumes publishing. There is no merge-anyway path.

## v1.4 additions (ownership on the wire + targeted hello)

**Owner-stamped update frames.** `diff` and `live` messages for an epoch'd scene
carry `o` (the epoch OWNER device id from the converged `{n, d}` stamp) alongside
`e`. Receivers reject a frame whose counter matches the known epoch but whose
owner does not (`accepts` and the behind-frame replacement path both check):
without `o`, a losing concurrent restorer's full state is indistinguishable from
the winner's — both carry the new counter. An absent or empty `o` is a wildcard,
so v1.1–v1.3 senders keep working.

**Targeted hello.** A hello sent for a single channel after a local save carries
`x: true`. Receivers answer ONLY the listed channels; without the flag the
on-connect rule (absent doc = peer lacks it = send full state) made every
targeted hello trigger a full-library broadcast from every peer. Old receivers
ignore `x` and keep the chatty-but-correct behavior. On-connect hellos remain
unflagged and keep cold-pair backfill semantics.

**Answered-hello acknowledgement.** A hello answer (sent frame OR nothing owed)
acknowledges the answering device's durable `sync_outbox` document entry for
that channel — epoch'd docs always answer full-state, so ack-on-null-only left
their entries pending forever.
