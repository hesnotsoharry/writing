---
project: writing
scope: wiring each phase asked for but did not own
updated: 2026-08-08
---

# Pending wiring hooks

Phases work under exclusive file ownership, so when a phase needs a change in a
file another phase owns it reports the change here instead of making it. This
file is the consolidation worklist. Delete an entry once it is applied and
verified.

## From P2c (LWW domains)

**Engine construction — desktop and mobile.**

```ts
const lwwRegistry = new LwwDomainRegistry();
const lwwDomains = registerLwwDomains(lwwRegistry, db, {
  aiConversationsEnabled: false,
});
new SyncEngine({ /* existing options */ lwwRegistry });
```

After construction:

```ts
const lwwBridges = createLwwLocalBridges(
  (mutation) => syncEngine.publishRow(mutation),
  lwwDomains.aiConversationsEnabled,
);
```

On setting change: `lwwDomains.setAiConversationsEnabled(enabled)`.

**Opt-out leak guard — required, not optional.** Without it, AI rows already
queued in the outbox or recorded in the LWW shadow table can still go out after
the user turns the setting off. That is prompts and model replies leaving the
device after the user said no.

```ts
// LwwReconciler.sendSummary and receiveSummary:
if (!this.registry.get(domainOrMessageDomain)) return;

// SyncEngine outbox flush:
if (message.t === "row" && !lwwRegistry.get(message.domain)) return;
```

**Feature-store hooks — only after a successful local SQL mutation.**

| Domain | Hook |
|---|---|
| Goals | `goals.saved` / `goals.deleted` |
| Quick notes | `quickNotes.saved` / `quickNotes.deleted` |
| Archive | publish the generated archive-row id after insert; `archive.deleted` after restore or purge removes it |
| Snapshots | `sceneSnapshots.saved` / `.deleted` from **user-authored** snapshot operations only |
| Boards | `boards.saved` / `.deleted`, resolving `project_id` before rename/delete |
| Manuscript context | `manuscriptAbout.saved(projectId, projectId)` |
| AI | create/title/config → `conversationSaved`; append → `conversationSaved` then `messageAppended`; delete → `conversationDeleted` |

**Do not hook generic `takeSnapshot`.** The engine takes a safety snapshot
before applying a remote epoch replacement, and that one is deliberately
local-only. Hooking the generic path would replicate it.

Remote projections must keep going through the registered raw-SQL adapters and
must never call these bridges — that is the ping-pong guard.

**Setting key:** `syncAiConversations`, default `false`. The settings phase
surfaces it.

## From P2b (Bible domain doc)

**New engine options** (`engineTypes.ts`):

```ts
bibleApplyTarget?: BibleApplyTarget;
ensureProjectBibles?: () => Promise<void>;
subscribeBibleSaves?: (
  callback: (projectId: string, stateBase64: string) => void,
) => () => void;
```

**Bootstrap** — `engineSession.ts`, before reading the master key:

```ts
await Promise.all([
  options.ensureProjectMetas?.(),
  options.ensureProjectBibles?.(),
]);
```

**`EngineDocRepository.mergeDomain` must return the persisted merged update**
(today it returns nothing), so the router can project exactly what was stored
rather than re-reading and racing.

**Inbound projection** — `remoteUpdateRouter.ts`, inside the existing
arrival-order chain, so a bible frame cannot overtake a meta frame:

```ts
if (channel.kind === "bible") {
  const merged = await this.dependencies.docs.mergeDomain("bible", channel.id, update);
  if (!merged) return;
  const doc = new Y.Doc();
  Y.applyUpdate(doc, merged);
  if (this.dependencies.options.bibleApplyTarget) {
    await applyBibleDoc(channel.id, doc, this.dependencies.options.bibleApplyTarget);
  }
  return;
}
```

**Outbound** — subscribe in `SyncEngine.start()`, unsubscribe in `stop()`, and
push content immediately via a `diff` on `bibleChannel(projectId)` enqueued to
the outbox. Full snippet in the P2b dispatch result; the shape matches the
existing meta-save push.

**Defaults.** Desktop: `SqliteBibleApplyTarget`, `ensureAllProjectBibles`,
`subscribeBibleSaves`. Mobile: `MobileBibleApplyTarget`,
`subscribeMobileBibleSaves` (no `ensureProjectBibles` — mobile clones rather
than bootstraps).

Story Bible mutators call `bridgeBibleLocalWrite` /
`bridgeMobileBibleLocalWrite` explicitly around their SQL mutation. **Do not
subscribe to generic store or database writes** — remote projection goes
through those same stores and would ping-pong.

## From P2d (mobile store layer)

_Pending — dispatch in flight._
