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
