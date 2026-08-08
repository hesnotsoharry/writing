# Concurrent restores: why restore-wins is not yet correct, and what to change

status: **proposed — needs Cole's call on a protocol bump**
date: 2026-08-08
relates to: `2026-08-06-sync-protocol-v1.md` (v1.1 meta doc, `docEpochs`)
found by: adversarial review of the 2026-08-08 sync-latency work

## The claim we currently make

"Restore wins": restoring a snapshot on one device makes that content authoritative,
and every other device discards its copy and adopts the restored one. As of
2026-08-08 this is verified true for **one restore at a time** — measured live,
peer converges in ~1s, no resurrection.

It is **not** true when two devices restore concurrently, and the failure is quiet.

## Why it breaks

`docEpochs` is a plain `Y.Map<number>`; `bumpEpoch()` does an ordinary `set()`
(`metaDoc.ts`). Two devices restoring the same scene before hearing from each other
both write a number for the same key. Yjs resolves that concurrent set as
last-writer-wins by client id — which converges (all replicas end on the SAME value)
but does **not** guarantee the value is the larger one. Codex reproduced this over
200 merges: with 3 written on one side and 2 on the other, the merged value was 2 in
99 runs and 3 in 101.

Two consequences:

1. **In-memory `known` disagrees with the doc.** `EpochManager.readMetaUpdate()`
   keeps `Math.max(known, incoming)`, so a device that locally wrote 3 stays at 3
   while the converged doc says 2. `accepts()` gates on `epoch === known`, so the
   two devices now reject each other's frames for that scene indefinitely.
2. **Even when both land on the same number, nobody is the winner.** Both devices
   consider themselves applied at that epoch, so neither is `isBehind`, so both
   publish their own full state stamped identically — and the contents merge instead
   of one replacing the other. That is precisely the resurrection the epoch mechanism
   exists to prevent, arriving by a different door.

Neither shows up in the current tests because every test restores on one side only.

## The shape of the fix

The epoch needs to answer two questions, and today it only encodes one:

- *has the content been replaced?* (a counter — what we have)
- *whose copy is authoritative?* (missing)

Record ownership alongside the counter, e.g. per scene:

```ts
docEpochs[sceneId] = { n: number; deviceId: string }
```

Yjs still converges the key to a single entry, and now every device can compare that
entry against its own device id:

- entry.deviceId === mine → I performed the winning restore; I am applied.
- otherwise → I am behind; withhold my copy and adopt the owner's, exactly as the
  single-restore path already does via `handleBehindFrame`.

That makes concurrent restores deterministic — one winner, everyone else adopts,
no mutual rejection and no silent merge — without needing a new message type. Read
the doc entry as authoritative rather than `Math.max`-ing it, so `known` cannot
drift above what the doc says.

A G-Counter (per-device slots, summed) also gives monotonicity, but on its own it
makes concurrent restores *worse*: both devices end up behind with neither able to
supply a replacement. Ownership is the part that actually breaks the tie.

## Cost and why it needs a decision

- Protocol bump (v1.2): the meta doc value shape changes, so a v1.1 peer sending a
  bare number must still be understood. Needs a read shim and a decision about what
  a v1.1 peer does with the richer value.
- `EpochManager` changes from "max wins" to "doc entry wins", which touches
  `accepts()`, `isBehind()`, and the persisted applied-epoch store.
- Wants a live two-device test that restores on both sides inside the same second —
  the current rig (two identifier-isolated binaries, `WRITING_CDP_PORT`) can do it.

## Recommendation

Do it before mobile lands (S5), not after. Every additional device multiplies the
chance of two restores overlapping, and the failure is silent data loss — the user
sees a successful restore and later finds the discarded text back. Until then the
limitation is documented in `roadmap/HANDOFF.md`: restore-wins holds for one restore
at a time.
