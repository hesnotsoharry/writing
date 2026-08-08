# S5 implementation plan: live editing on mobile

Status: **PLANNED**

Definition source: the approved mobile design (`docs/superpowers/specs/2026-08-05-device-sync-mobile-design.md`, D4) and the locked Option A bridge contract in `roadmap/s4-mobile-architecture-blueprint.md`.

Readiness: `N0_ESTABLISHED / READY_TO_PLAN`. S5 extends the already-built S4 mobile browse/read path; it does not introduce a new actor, document model, or sync policy. The cross-runtime boundary already has a locked contract, and S5a supplies the executable protocol oracle before either runtime uses it.

## Goal

An Android user can open a synced scene, edit it in the existing TipTap/Yjs document format, leave the scene without losing the last sub-500 ms batch, and see changes converge with desktop through the existing `SyncEngine`. SQLite remains canonical whenever the editor WebView is absent. A 50,000-word scene must hydrate, remain responsive, and survive bidirectional bridge traffic.

## Locked boundaries

- Keep one Yjs document per scene and `scene_docs.state_base64` as base64 `TEXT`.
- Keep Option A: sync engine, relay, crypto, SQLite, and binder stay in RN/Hermes; only the open editor document and editor DOM live in the WebView.
- Add a live-scene port to the existing `SyncEngine`; do not build a second engine and do not try to pass a WebView `Y.Doc` to `attachLiveDoc`.
- Preserve the desktop `attachLiveDoc(sceneId, doc)` behavior and all existing desktop callers.
- Do not modify existing files under `src/editor/`. S5 may add one mobile-specific core module there, and the editor-web bundle must import it and the existing frozen extensions.
- Hydrate a fresh `Y.Doc` before mounting TipTap, never pass `content` to `useEditor`, and keep `StarterKit.configure({ undoRedo: false })` because Collaboration owns undo.
- WebView-to-RN local updates are merged into one batch on the existing 500 ms persistence window. RN persists the batch before publishing a protocol `live` frame or acknowledging it.
- RN-to-WebView remote updates are persisted before posting the same incremental update. The WebView applies them with `SYNC_ORIGIN`, so its local update observer does not echo them.
- An epoch advance is replacement, not a Yjs merge: flush local work, persist the authoritative full state, send `replace`, destroy the old WebView editor/doc, hydrate a new doc, and key-remount the editor.
- Navigation away from a scene is intercepted until a `flush` round-trip has completed. A timeout is visible and blocks the unmount while unconfirmed local work may exist.
- Every new production function is sized for the repository limits: at most 40 non-comment lines, complexity at most 10, nesting depth at most 3, at most four parameters, no `any`, and no production file over 300 non-comment lines. Split protocol parsing, ACK tracking, persistence serialization, and React presentation into separate modules rather than suppressing rules.

## Runtime shape

```text
TipTap + one live Y.Doc (editor WebView)
  local Yjs updates --merge for 500 ms--> update(base64)
  remote update <--apply with SYNC_ORIGIN-- RN live-scene port
                    |                 ^
                    v                 |
           MobileSceneDocStore (persist first)
                    |
                    v
          existing SyncEngine / relay protocol
```

The RN live-scene port is the ordering boundary. Local WebView messages, remote engine deliveries, hydrate, replace, and close all enter one serialized promise queue per mounted scene. This prevents two read/merge/write operations from racing against the same SQLite row.

## S5 bridge protocol contract

Create the canonical definitions in `src/sync/mobileEditorBridgeProtocol.ts`, re-export them from `mobile/src/shared/mobileEditorBridgeProtocol.ts`, and import that one definition from both runtimes. JSON is the envelope; `update` is standard base64 for Yjs bytes. No message may include prose, keys, relay credentials, or serialized exceptions.

```ts
export const MOBILE_EDITOR_BRIDGE_VERSION = 1 as const;

export type MobileEditorBridgeVersion = typeof MOBILE_EDITOR_BRIDGE_VERSION;
export type BridgeSessionId = string;
export type BridgeSceneId = string;
export type BridgeSequence = number;
export type Base64YjsUpdate = string;

export type BridgeAckType = "hydrate" | "update" | "replace" | "flush";

export type BridgeErrorCode =
  | "invalid-message"
  | "version-mismatch"
  | "session-mismatch"
  | "scene-mismatch"
  | "sequence-gap"
  | "persist-failed"
  | "apply-failed"
  | "ack-timeout";

export interface ReadyMessage {
  v: MobileEditorBridgeVersion;
  type: "ready";
  sessionId: BridgeSessionId;
}

export interface HydrateMessage {
  v: MobileEditorBridgeVersion;
  type: "hydrate";
  sessionId: BridgeSessionId;
  sceneId: BridgeSceneId;
  seq: BridgeSequence;
  update: Base64YjsUpdate;
}

export interface UpdateMessage {
  v: MobileEditorBridgeVersion;
  type: "update";
  sessionId: BridgeSessionId;
  sceneId: BridgeSceneId;
  seq: BridgeSequence;
  update: Base64YjsUpdate;
}

export interface ReplaceMessage {
  v: MobileEditorBridgeVersion;
  type: "replace";
  sessionId: BridgeSessionId;
  sceneId: BridgeSceneId;
  seq: BridgeSequence;
  update: Base64YjsUpdate;
}

export interface FlushMessage {
  v: MobileEditorBridgeVersion;
  type: "flush";
  sessionId: BridgeSessionId;
  sceneId: BridgeSceneId;
  seq: BridgeSequence;
}

export interface AckMessage {
  v: MobileEditorBridgeVersion;
  type: "ack";
  sessionId: BridgeSessionId;
  sceneId: BridgeSceneId;
  seq: BridgeSequence;
  ackType: BridgeAckType;
}

export interface BridgeErrorMessage {
  v: MobileEditorBridgeVersion;
  type: "error";
  sessionId: BridgeSessionId;
  sceneId?: BridgeSceneId;
  seq?: BridgeSequence;
  code: BridgeErrorCode;
  recoverable: boolean;
}

export type NativeToWebViewMessage =
  | HydrateMessage
  | UpdateMessage
  | ReplaceMessage
  | FlushMessage
  | AckMessage
  | BridgeErrorMessage;

export type WebViewToNativeMessage =
  | ReadyMessage
  | UpdateMessage
  | AckMessage
  | BridgeErrorMessage;
```

Protocol rules:

1. The WebView creates a fresh opaque `sessionId` on every page load/process restart and sends `ready`. RN echoes that ID in every subsequent message. A message from an old session is ignored and reported as `session-mismatch` without touching storage.
2. RN sends `hydrate` only after `ready`. `update` in a hydrate or replace is a full encoded Yjs state. The WebView applies it to a fresh `Y.Doc` before mounting `MobileEditorCore`, then ACKs `hydrate`.
3. Each sender owns an independent, positive, safe-integer `seq` counter for each `(sessionId, sceneId)`. ACKs echo the sender's sequence and do not consume the receiver's counter. Duplicates re-send the prior ACK; a gap is rejected and forces a full rehydrate rather than guessing at order.
4. WebView local document updates are accumulated as bytes and merged with `Y.mergeUpdates` for 500 ms. Only one WebView-to-RN update may be awaiting an ACK. Edits made while it is in flight are merged into the next batch, bounding queue growth.
5. RN receives `update`, validates session/scene/sequence, serially merges it with stored state, updates `state_base64`, plaintext projection, and word count, asks the existing engine to publish the incremental `live` update, schedules the normal saved-scene notification, and only then sends `ack(update)`. Offline relay state does not delay the ACK because SQLite is the durability boundary; the normal sweep later converges.
6. For a remote live update, the engine calls the attached RN port. The port serially persists the merged full state first, then posts the original incremental `update` to the WebView. The WebView applies it with `Y.applyUpdate(doc, bytes, SYNC_ORIGIN)` and ACKs. The local batching observer ignores `SYNC_ORIGIN`.
7. RN permits only one unacknowledged RN-to-WebView **state payload** (`hydrate`, `update`, `replace`, or `flush`). Additional remote increments are merged for bridge delivery after each one has already been persisted individually/in order. ACK/error control messages bypass that state window, or simultaneous edits could deadlock while each side waits to acknowledge the other. A replace supersedes queued visual updates because its full state is authoritative.
8. On `flush`, the WebView immediately drains its 500 ms buffer. If that produces an update, it waits for RN's update ACK, then ACKs the RN flush sequence. If there is no buffer or in-flight update, it ACKs immediately.
9. `replace` is sent only after the engine has accepted the epoch and persisted the full replacement. The WebView destroys the TipTap editor and old `Y.Doc`, hydrates a new doc from `update`, key-remounts, then ACKs. It must never apply replacement bytes to the old doc.
10. ACK timeout is a named constant (start with 5 seconds, injectable in tests). Navigation timeout keeps the route mounted and offers Retry/Stay. Ready/hydrate failure before editing falls back to S4 read-only rendering. Error logging may contain version, type, scene ID, session ID, sequence, queue length, and timings, but never update bytes or prose.

## Phase S5a — pure bridge protocol and parser oracle

Purpose: land the wire contract and hostile-input handling without changing either runtime.

Files:

- Create `src/sync/mobileEditorBridgeProtocol.ts` — types above, direction-specific parsers, serializer, sequence/base64 guards.
- Create `mobile/src/shared/mobileEditorBridgeProtocol.ts` — re-export only from `@writersnook/sync/mobileEditorBridgeProtocol`.
- Create `src/test/sync/mobileEditorBridgeProtocol.test.ts` — protocol oracle.

Interfaces and behavior:

- Export `parseWebViewMessage(raw: string): WebViewToNativeMessage | null`, `parseNativeMessage(raw: string): NativeToWebViewMessage | null`, and `serializeBridgeMessage(message): string`.
- Parse through `unknown` plus explicit narrowing. Do not cast parsed JSON directly and do not use `any`.
- Validate `v === 1`, non-empty bounded IDs, positive safe-integer sequences, valid `ackType`, allowed error codes, and syntactically valid base64. Yjs semantic decoding belongs to the receiving port, where failure becomes `apply-failed`.
- Direction-specific parsing rejects message kinds that are valid only in the other direction.

Vitest strategy:

- Table-test every valid message in both allowed and disallowed directions.
- Reject malformed JSON, unknown keys/types, version mismatch, blank/oversized IDs, unsafe/zero/negative sequences, invalid base64, and invalid ACK/error enums.
- Round-trip serialize/parse and pin the exact JSON field names used by the locked contract.

Gate:

- `npm run test -- mobileEditorBridgeProtocol`
- `npm run lint`
- `npx tsc --noEmit`
- No runtime file imports the protocol yet; desktop behavior and all existing tests remain unchanged.

## Phase S5b — editor-web bundle, frozen-core reuse, and shipping pipeline

Purpose: produce a self-contained offline HTML asset that can be loaded by `react-native-webview`, with a fake-host/Vitest seam before RN persistence is connected.

Files:

- Create `src/editor/MobileEditorCore.tsx` — additive minimal TipTap surface; no existing `src/editor/*` file changes.
- Create `src/test/editor/MobileEditorCore.test.tsx` — structural/schema wiring only; jsdom is not the behavioral oracle.
- Create `mobile/editor-web/index.html`.
- Create `mobile/editor-web/tsconfig.json`.
- Create `mobile/editor-web/vite.config.ts`.
- Create `mobile/editor-web/src/main.tsx`.
- Create `mobile/editor-web/src/EditorWebApp.tsx`.
- Create `mobile/editor-web/src/bridgeClient.ts`.
- Create `mobile/editor-web/src/bridgeClient.test.ts`.
- Create `mobile/editor-web/src/editor-web.css`.
- Create `mobile/editor-web/src/vite-env.d.ts` — type `window.ReactNativeWebView` without `any`.
- Create `mobile/src/features/editor/editorWebAsset.ts`.
- Create `mobile/src/features/editor/editorWebAsset.test.ts`.
- Create `mobile/vitest.config.ts` — Node/jsdom projects plus `@writersnook` alias to `../src`.
- Create `mobile/eslint.config.mjs` — mirror the root strict limits for `src/**/*.{ts,tsx}` and `editor-web/src/**/*.{ts,tsx}`; do not weaken the root config.
- Modify `mobile/package.json` and `mobile/package-lock.json` through npm only.
- Modify `mobile/metro.config.cjs` to add `html` to `resolver.assetExts` without changing the existing watch-folder or nested-dedup rules.
- Modify `mobile/app.json` to embed the generated HTML through the existing `expo-asset` integration and set Android keyboard layout mode to resize. This file is owned here for all S5 phases.

Editor contract:

- `MobileEditorCore` accepts an already-hydrated `Y.Doc`, an `editable` flag, and optional guarded callbacks. It calls `useEditor` with `StarterKit.configure({ undoRedo: false })`, `Collaboration.configure({ document: doc, field: "content" })`, `Highlight`, `Placeholder`, the existing `AiExcludeExtension`, and the existing `DropCapGate`.
- The editor-web app imports `MobileEditorCore`; it does not copy the TipTap wiring into `mobile/` and does not edit `src/editor/Editor.tsx`.
- It also imports `src/styles/tokens.css`, while `editor-web.css` supplies only the mobile page, viewport, prose, placeholder, drop-cap, highlight, and AI-exclude presentation. Do not import the entire desktop `app.css` or desktop font suite into the mobile asset.
- The bridge client owns the one long-lived WebView `Y.Doc`, applies hydrate before render, batches local updates for 500 ms, and uses `SYNC_ORIGIN` imported from `src/yjs/bindPersistence.ts` for remote increments.
- Replacement creates a new `Y.Doc` and increments a React key; no synchronous reset `setState` effect is introduced.
- The page owns mobile viewport behavior from the start: `100dvh` with a `visualViewport` fallback, ProseMirror-owned selection scrolling, and a bottom typing inset. S5d measures this through the RN host; it does not reopen editor-web ownership for opportunistic UI rewrites.

Desktop consistency boundary:

- Reused from `src/editor/`: `AiExcludeExtension`, `DropCapGate`, and the additive `MobileEditorCore` that pins the same StarterKit/Collaboration field/Highlight/Placeholder schema.
- Kept desktop-only: `EditorHeader`, `FormatBubble` (desktop hover/AI/settings behavior), `EditorContextMenu`, `SpellCheckPopover` and `ProofreadExtension` (Tauri IPC/dictionary path), `AutoLinkExtension`/`AutoLinkPeek` (story bible is not in S5), `FocusModeExtension` (desktop `.canvas-scroll` assumptions), page-flip hooks, story-bible link counts, desktop canvas chrome, binder drag handles, and all dnd-kit behavior.
- Existing marks still round-trip because their schema extensions are registered even when mobile exposes no command for them. Omitted decorations are UI-only and must not rewrite document content.

Build and ship contract:

- `mobile/editor-web/vite.config.ts` sets `root` to `mobile/editor-web`, uses React plus `vite-plugin-singlefile`, and writes one generated file to `mobile/editor-web/dist/index.html`. The single file avoids relative-script failures under `file://` and makes the asset atomic.
- Vite aliases the repository root source and dedupes `react`, `react-dom`, `yjs`, and TipTap packages to the explicit versions installed in `mobile/node_modules`. A clean mobile install must not accidentally resolve the desktop `node_modules` copies.
- Add compatible TipTap/ReactDOM versions plus Vite, the React plugin, `vite-plugin-singlefile`, Vitest, and strict ESLint tooling to `mobile/package.json`; update the lock with npm, never by hand.
- Add scripts `editor-web:build`, `editor-web:watch`, `test`, `lint`, `typecheck:native`, `typecheck:editor-web`, and aggregate `typecheck`. `prestart` and `preandroid` run `editor-web:build`; `eas-build-post-install` runs it on EAS before Metro bundles the app.
- `editorWebAsset.ts` uses a static `require("../../../editor-web/dist/index.html")`, `Asset.fromModule(...).downloadAsync()`, and returns `localUri`. `SceneEditorHost` later passes `{ uri: localUri }` with `allowFileAccess` enabled. No dev server is used by the app: debug and release both load the same offline asset. The optional Vite watch command only regenerates that asset.
- Metro's static require plus the Expo asset config makes the HTML part of Android/EAS artifacts. Gate a clean production export/archive and inspect the asset manifest; do not accept “works from a local Vite server” as shipping proof.
- Windows dev loop: Metro does not reliably discover a directory created after it starts. Stop Metro before first creating/building `mobile/editor-web/dist`, then restart with cache cleared (`npx expo start --dev-client -c`). Once the directory exists, the watch build may overwrite the asset, but remount/reload the WebView to defeat asset caching.

Vitest/build strategy:

- Fake `window.ReactNativeWebView.postMessage` and prove ready, hydrate-before-mount, 500 ms merge, one-in-flight backpressure, ACK release, `SYNC_ORIGIN` echo suppression, flush ordering, and fresh-doc replace.
- The `MobileEditorCore` jsdom test asserts extension presence and that no `content` option is passed. It explicitly does not claim keyboard, selection, or ProseMirror layout coverage.
- Build twice from a clean output directory and assert exactly one non-empty `dist/index.html`, with no external script/style URLs and no network requirement.

Gate:

- `npm run test -- MobileEditorCore`
- From `mobile/`: `npm run test -- bridgeClient editorWebAsset`
- From `mobile/`: `npm run editor-web:build && npm run lint && npm run typecheck`
- From the repository root: `npm run lint && npx tsc --noEmit`
- Load the generated file in a normal Chromium page with a fake RN host and verify typing emits one batched message. Runtime keyboard claims wait for S5d.

## Phase S5c — RN live-scene port and SyncEngine seam

Purpose: connect the bridge to durable mobile storage and the existing relay engine without mounting a WebView UI.

Files:

- Create `mobile/src/sync/mobileLiveScenePort.ts`.
- Create `mobile/src/sync/mobileLiveScenePort.test.ts`.
- Create `src/test/sync/engineLiveScenePort.test.ts`.
- Modify `src/sync/engine.ts` — add the sibling port seam while retaining `attachLiveDoc` unchanged for desktop.
- Modify `mobile/src/shared/engine.ts` — re-export the new port-related types.
- Modify `mobile/src/shared/serialize.ts` — re-export `encodeDoc` in addition to the existing portable helpers.
- Modify `mobile/src/sync/mobileEngine.ts` — add only the composition/factory needed to construct a port with the singleton, scene store, and word-count updater.

Engine interface:

```ts
export type LiveSceneFlushResult =
  | { status: "flushed" }
  | { status: "timed-out"; pendingLocal: boolean }
  | { status: "unavailable"; pendingLocal: boolean };

export interface EngineLiveScenePort {
  applyRemoteUpdate(update: Uint8Array): Promise<void>;
  flushLocal(): Promise<LiveSceneFlushResult>;
  replaceFromState(stateBase64: string): Promise<void>;
}

// New public SyncEngine surface; the existing attachLiveDoc/detachLiveDoc stays.
attachLiveScenePort(sceneId: string, port: EngineLiveScenePort): void;
detachLiveScenePort(port: EngineLiveScenePort): void;
publishLiveUpdate(sceneId: string, update: Uint8Array): Promise<void>;
```

Engine behavior:

- A desktop live `Y.Doc` and an RN live port are mutually exclusive. Attaching either detaches the prior binding. `stop()` clears both.
- `publishLiveUpdate` enforces the active scene ID, pause/behind checks, current epoch stamp, and existing encrypted `live` message path. A stale SceneScreen cannot publish into the newly opened scene.
- Normal remote scene updates delegate to the attached port. The port, not the engine, performs the persist-first merge so local and remote SQLite writes share one serialization queue. Closed scenes continue through the current `mergeScene` path.
- Before an authoritative behind-epoch replacement, the engine asks the port to flush. The epoch manager snapshots canonical stored mobile state, saves the replacement, then the engine calls `replaceFromState`. A timed-out/unavailable WebView must not stall the inbound engine forever; continue with the already-persisted state, surface a recoverable bridge error, and let replacement win as the approved epoch policy requires.
- `targetedSaveFrame` treats a port-attached scene as open just like a desktop `openScene`, avoiding duplicate immediate content frames. The persisted store still participates in reconnect sweeps.

RN port interface and ordering:

```ts
export interface MobileLiveSceneTransport {
  postMessage(message: string): void;
}

export interface MobileLiveScenePortOptions {
  sceneId: string;
  transport: MobileLiveSceneTransport;
  ackTimeoutMs?: number;
}

export interface MobileLiveScenePort {
  start(): Promise<void>;
  receive(rawMessage: string): Promise<void>;
  applyRemoteUpdate(update: Uint8Array): Promise<void>;
  flushLocal(): Promise<LiveSceneFlushResult>;
  replaceFromState(stateBase64: string): Promise<void>;
  close(): Promise<LiveSceneFlushResult>;
}
```

- `start` attaches the engine port but does not post hydrate until the matching `ready` arrives. Hydrate reads canonical state through the serialized queue.
- Local updates decode to bytes, merge with the stored full state using transient RN `Y.Doc` instances, persist base64/projection/word count, publish the original incremental bytes, notify the normal saved-scene path, and ACK. RN does not retain a second live editor `Y.Doc`.
- `applyRemoteUpdate` performs the same serialized store merge, then posts the original incremental update. `replaceFromState` assumes the engine already persisted the replacement and posts it as a full-state replace.
- `close` sends flush, waits for the flush ACK and all earlier update ACKs, then detaches. It returns a result rather than unmounting on its own; the screen owns navigation policy.
- ACK tracking, sequence tracking, persistence merge, and message routing are separate helpers/classes so the module stays within lint size and complexity limits.

Vitest strategy:

- Port tests use an in-memory scene store, fake engine, fake transport, fake timers, and real Yjs bytes.
- Prove local persist → engine publish/notify → ACK order; remote persist → post order; local/remote race convergence; duplicate sequence idempotence; gap rejection; wrong scene/session rejection; offline engine state still ACKs after persistence; and no update bytes in errors/logs.
- Prove flush with no edits, flush while a 500 ms batch is pending, flush with an update ACK in flight, timeout with pending work, and detach only after safe completion.
- Prove replace flushes/snapshots/persists before posting, destroys queued visual increments, and never merges replacement into the old document.
- Engine tests retain the entire desktop live-doc suite and add port publish, remote delivery, epoch replacement, stale-scene, pause, disconnect, and targeted-save suppression cases.

Concurrent merge point:

`mobile/src/sync/mobileEngine.ts` is concurrently gaining relay-URL override persistence. S5c must begin from the then-current file and add its imports/factory around the resulting `startMobileEngine`/relay URL behavior. Do not replace the file, restore the literal default path, or plan against today's line numbers. The S5 factory should reuse the final singleton and final startup path; relay selection is not a responsibility of `MobileLiveScenePort`.

Gate:

- `npm run test -- engineLiveScenePort engineMetaEpoch localSceneWrites`
- From `mobile/`: `npm run test -- mobileLiveScenePort && npm run lint && npm run typecheck`
- `npm run lint && npx tsc --noEmit`
- Existing desktop live-relay and epoch tests remain green without call-site changes.

## Phase S5d — editable SceneScreen, exit guard, fallback, and keyboard UX

Purpose: replace the S4 reader with an editable WebView when the packaged asset and handshake succeed, while keeping the reader as a safe fallback.

Files:

- Create `mobile/src/features/editor/SceneReader.tsx` — the extracted S4 read-only rendering/loading path.
- Create `mobile/src/features/editor/SceneEditorHost.tsx` — asset load, WebView ref/transport, handshake state, status UI, and lifecycle callbacks.
- Create `mobile/src/features/editor/useSceneExitGuard.ts` — React Navigation `beforeRemove` flush/ACK interception.
- Create `mobile/src/features/editor/sceneEditorState.ts`.
- Create `mobile/src/features/editor/sceneEditorState.test.ts`.
- Modify `mobile/src/features/editor/SceneScreen.tsx` — thin keyed composition only.

Screen state contract:

```text
loading asset -> waiting for ready -> hydrating -> editable
      |                 |                |
      +------ failure before edits ------+--> S4 read-only fallback

editable -> saving/flush -> safe detach -> navigation continues
                    |
                 timeout -> route remains mounted + Retry/Stay
```

- Key `SceneEditorHost` by `sceneId`; never reset editor state synchronously in an effect.
- Load the S4 `SceneReader` data independently so it is immediately available if asset loading, WebView loading, ready, or hydrate fails before editing begins.
- Use `WebView.onMessage` for WebView-to-RN and the WebView ref's `postMessage` for RN-to-WebView. Set `originWhitelist` to local content only, disallow navigation away from the local asset, and keep network access unnecessary.
- Display compact native states for “Opening editor…”, “Saving…”, “Couldn't load the editor — read-only”, and “Still saving — Retry or Stay”. Do not show raw exceptions.
- On Android, rely on the configured resize keyboard mode and a flex-height WebView rather than stacking a second `KeyboardAvoidingView` resize. Consume the viewport/selection behavior already owned by S5b. Verify, do not assume, autocorrect, selection handles, long-press, hardware back, and cursor visibility above the keyboard.
- Preserve the native scene title/header and a native word-count/saving footer. Word count updates from the RN port's persisted projection, not from unacknowledged DOM state.
- `onContentProcessDidTerminate` is wired now: mark the old session unavailable, detach only after classifying pending work, create a new WebView/session, and rehydrate from SQLite. S5 does not promise recovery of a WebView-local batch that died before reaching RN.
- If a WebView fails after all local work is ACKed, it may remount or fall back to the reader from SQLite. If the port reports unconfirmed local work, do not silently unmount into the reader.

Vitest versus emulator:

- Vitest covers the pure screen-state reducer, stale async load tokens, fallback selection, exit-guard decisions, process-restart session invalidation, and “never navigate on dirty timeout”. Mocking WebView proves prop/callback wiring only.
- A real Android emulator is required for TipTap input, selection, keyboard resize, hardware back, WebView asset loading, ProseMirror scroll/layout, and actual `postMessage` behavior. jsdom green is not an editor-behavior gate.

Gate:

- From `mobile/`: `npm run test -- sceneEditorState && npm run lint && npm run typecheck && npm run editor-web:build`
- Android emulator, airplane mode: cold-launch the installed/dev build, open an existing scene, type, immediately press Back in under 500 ms, reopen, and see the exact text.
- Android emulator, online: type on mobile and observe desktop update; type on desktop and observe mobile update without caret jump or echo; rapidly switch between two scenes and prove neither receives the other's updates.
- Force the asset/ready failure path and confirm the same S4 prose remains readable with editing clearly disabled.
- Root `npm run lint`, `npx tsc --noEmit`, and touched root tests remain green.

## Phase S5e — emulator exit gate and 50,000-word bridge soak

Purpose: accept S5 on observed end-to-end behavior and measured bridge pressure, not only unit tests.

Files:

- Create `mobile/src/sync/mobileEditorBridgeSoak.test.ts` — deterministic 50,000-word/full-state and burst-update harness using the production protocol/queue helpers through the mobile Vitest alias configuration.
- No production files are owned by this phase. Defects return to the phase owner listed in Dispatch order so the final verification lane does not make cross-cutting edits.

Automated soak:

- Generate a real TipTap-shaped `Y.XmlFragment("content")` scene of 50,000 words, encode it, and assert hydrate is accepted at its observed size.
- Simulate at least 1,000 incremental edits in both directions with delayed ACKs, duplicates, and a scene switch. Assert final Yjs state equality, sequence monotonicity, a maximum of one in-flight message per direction, bounded pending batches, and no lost last batch after flush.
- Include an epoch replacement during queued traffic. Assert the replacement state wins, pre-replacement queued visual updates are discarded, and later valid updates converge on the new epoch.
- Record durations and peak encoded/pending byte counts as assertions with generous regression ceilings derived from the emulator run; do not assert machine-specific millisecond precision.

Emulator exit gate:

1. Build the editor asset, launch from a clean Metro cache, and verify the app works with the Vite dev server stopped and the network disabled except when testing relay sync.
2. Open the 50,000-word scene. Record hydrate-to-editable time, RN-to-WebView ACK latency, WebView-to-RN persist/ACK latency, peak pending bytes, and whether typing/selection remains visibly responsive. Instrument IDs, sequence, byte count, queue depth, and timings only—never content.
3. Type continuously through several 500 ms windows; immediately navigate back and reopen. The final characters must be present.
4. With desktop online, edit alternately on desktop and mobile, then edit both during a brief disconnect and reconnect. Stored desktop, stored mobile, and both open editors must converge.
5. Switch scenes repeatedly while updates are in flight. No cross-scene text, late ACK, or stale error may appear in the new scene.
6. Trigger a desktop epoch restore while the mobile scene is open. Mobile takes the normal safety snapshot, receives `replace`, remounts from the full state, and does not resurrect discarded prose.
7. Exercise soft keyboard open/close, autocorrect, selection handles, long-press, multiline edits near the bottom, rotation if currently permitted, and Android hardware Back. No selection/caret may remain obscured and Back may not bypass flush.
8. Kill/reload the Android WebView after an ACKed edit and confirm rehydrate from SQLite. Record the remaining unacknowledged-process-death limitation for iOS without claiming it solved.
9. Run the final full gates: root `npm run test`, `npm run lint`, `npx tsc --noEmit`; mobile `npm run test`, `npm run lint`, `npm run typecheck`, `npm run editor-web:build`; then the Android emulator matrix above.

S5 is accepted only when every step passes and the 50,000-word observations are recorded in the implementation report. “Bundle built” or “Vitest green” alone is not acceptance.

## Fallback and recovery rules

- Before the first successful hydrate ACK, any bundle/asset/WebView/ready failure selects the S4 reader. The screen remains useful for browsing and never pretends it is editable.
- After editing begins, SQLite contains every ACKed local batch. A clean WebView remount always creates a new session and hydrates that state; it never reuses sequence counters or the old `Y.Doc`.
- Navigation is allowed only after `close()` returns `flushed`, or when the port can prove there is no unconfirmed local work. Timeout with pending work blocks navigation.
- The engine may receive updates with no WebView mounted. It persists them as today; the next editor mount hydrates canonical SQLite state.
- Protocol recovery is full-state rehydrate. Do not invent replay logs or persist bridge queues in S5.

## Ranked risks

1. **Data loss during scene exit or replacement — critical.** Detection: fake-timer flush tests, under-500 ms Back test, replacement-during-pending test, and persisted-state reopen. Mitigation: navigation interception, one serialized port queue, persist-before-ACK, explicit flush ACK, and no unmount on dirty timeout.
2. **Scene/session race writes into the wrong editor — critical.** Detection: rapid A→B→A switching with delayed messages and stale ACK injection. Mitigation: fresh session ID per page load, scene ID on every stateful message, independent monotonic sequences, load tokens, and engine active-scene guard.
3. **Epoch replacement merges/resurrects discarded prose — critical.** Detection: restore while local/remote updates are queued plus snapshot inspection. Mitigation: flush, safety snapshot from canonical stored state, persist full replacement, fresh `Y.Doc` key-remount, and discard superseded visual increments.
4. **Bridge backpressure on a huge scene — high.** Detection: 50,000-word soak metrics, delayed ACKs, queue depth/byte instrumentation, and typing observation. Mitigation: full state only for hydrate/replace, 500 ms `Y.mergeUpdates`, one in-flight message each direction, coalesced pending updates, configurable ACK timeout, and SQLite as the no-WebView source of truth.
5. **Keyboard/viewport behavior in WebView — high (known S0 open item).** Detection: real Android emulator plus human-hands physical-device checks for autocorrect, handles, long-press, bottom-of-document typing, and Back. Mitigation: resize keyboard mode, dynamic viewport sizing, ProseMirror-owned scrolling, bottom inset, and no double keyboard avoidance. TenTap bridge utilities are a contingency only after a measured failure; its editor bundle is not adopted because the Yjs path remains ours.
6. **Generated HTML is absent from Metro/EAS or resolves duplicate dependencies — high.** Detection: clean mobile install/build, production export/archive inspection, offline launch, and a bundle dependency report. Mitigation: EAS/prestart build hooks, static asset require, Metro `html` asset extension, single-file output, explicit mobile dependencies, Vite dedupe, and the existing Metro hierarchical-lookup prohibition.
7. **WebView process death on iOS — medium, deliberately not solved in S5.** Detection: exercise `onContentProcessDidTerminate` when an iOS test device becomes available and distinguish ACKed from unacknowledged local work. Mitigation now: lifecycle callback, new session ID, SQLite rehydrate, idempotent ACK handling, no RN dependency on a persistent WebView, and no protocol assumption that a page survives. Durable recovery of a batch that never left the terminated process remains future work.
8. **Concurrent `mobileEngine.ts` work is overwritten — medium.** Detection: inspect the final diff against the relay-URL override changes and run cold-boot/custom-relay tests. Mitigation: one small additive factory merge in S5c, no line-number-based patch, and no ownership of relay URL policy in the live-scene port.

## Explicitly out of S5

- App suspension, background sockets, or background sync. Foreground reconnect/sweep behavior remains the approved model.
- Mobile binder/structure mutations: no creating, renaming, reordering, archiving, status editing, synopsis editing, or other meta-doc writes from mobile.
- Story bible or goals sync/editing, including auto-link UI, goal progress, and streaks.
- iOS-specific UX/performance work beyond keeping the asset, lifecycle, session, and recovery design compatible with a later iOS gate. S5 does not claim the open physical-iPhone keyboard/process-death work complete.
- Corkboard, exports, AI UI, proofreading IPC, focus mode, desktop context menus, desktop page-turn effects, or full desktop feature parity.
- Persisted bridge replay logs, server store-and-forward, multi-user collaboration, or a new relay/protocol version.

## Dispatch order

Dispatch sequentially; phases are independently gateable but depend on the prior phase's green contract. Ownership below is exclusive inside S5. If a later gate finds a defect, return it to the owning brief instead of editing across ownership sets.

1. **S5a — protocol brief**
   - Owns: `src/sync/mobileEditorBridgeProtocol.ts`, `mobile/src/shared/mobileEditorBridgeProtocol.ts`, `src/test/sync/mobileEditorBridgeProtocol.test.ts`.
   - Acceptance: both direction parsers and the exact v1 wire shape pass hostile-input and round-trip tests; root lint/typecheck stay green.

2. **S5b — editor-web and packaging brief**
   - Owns: new `src/editor/MobileEditorCore.tsx`; `src/test/editor/MobileEditorCore.test.tsx`; all of `mobile/editor-web/`; `mobile/src/features/editor/editorWebAsset.ts` and its test; `mobile/vitest.config.ts`; `mobile/eslint.config.mjs`; `mobile/package.json`; `mobile/package-lock.json`; `mobile/metro.config.cjs`; `mobile/app.json`.
   - Acceptance: a clean install builds one offline HTML asset, Metro/EAS includes it, fake-host bridge tests pass, and no existing frozen editor file changes.

3. **S5c — engine/port brief**
   - Owns: `mobile/src/sync/mobileLiveScenePort.ts` and test; `src/sync/engine.ts`; `src/test/sync/engineLiveScenePort.test.ts`; `mobile/src/shared/engine.ts`; `mobile/src/shared/serialize.ts`; the additive S5 merge in `mobile/src/sync/mobileEngine.ts`.
   - Acceptance: persist-first ordering, echo suppression, epoch replacement, flush/timeout, and desktop regression tests pass. Merge the concurrent relay-URL work first and preserve it.

4. **S5d — SceneScreen/keyboard brief**
   - Owns: `mobile/src/features/editor/SceneScreen.tsx`, `SceneReader.tsx`, `SceneEditorHost.tsx`, `useSceneExitGuard.ts`, `sceneEditorState.ts`, and `sceneEditorState.test.ts`.
   - Acceptance: editable/fallback state machine and under-500 ms exit pass on Android emulator; wrong-scene/session messages cannot affect the mounted editor.

5. **S5e — soak/exit brief**
   - Owns: `mobile/src/sync/mobileEditorBridgeSoak.test.ts` and the final verification report only; no production code.
   - Acceptance: automated 50,000-word convergence/backpressure soak, full root/mobile checks, and the Android emulator exit matrix all pass with measured observations.
