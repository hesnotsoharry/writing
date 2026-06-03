# Phase 1 Walking Skeleton — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the load-bearing architecture end-to-end: type prose into a TipTap editor that is backed by a Yjs document, persist that document to a local SQLite database, relaunch the app, and see the text still there.

**Architecture:** A Tauri 2 desktop app (Rust shell + React/TypeScript frontend via Vite). The editor is TipTap 3 bound to a single Yjs `Y.Doc` through `@tiptap/extension-collaboration`. The Yjs doc is serialized with `Y.encodeStateAsUpdate` and stored as base64 text in SQLite (via `tauri-plugin-sql`) — base64 because the SQL plugin does not reliably round-trip raw binary BLOBs (tauri-apps/plugins-workspace#105). The integration *seam* (Yjs ↔ base64 ↔ store ↔ rehydrate) is isolated into pure, unit-tested modules; the GUI+DB wiring is verified by a manual end-to-end smoke run.

**Tech Stack:** Tauri 2.9.x, React 18 + TypeScript + Vite, TipTap 3 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-collaboration`), Yjs, `js-base64`, `@tauri-apps/plugin-sql` (+ `tauri-plugin-sql` crate, sqlite feature), Vitest for tests.

**Why this is the first thing we build (walking-skeleton-first):** Each layer here works fine alone; the bugs live in the seams (Yjs↔SQLite serialization, hydrate-before-mount ordering, the SQL plugin's binary limitation). We prove the seams traverse the whole stack before adding any features (binder, story bible, corkboard, goals, export, backup) on top.

**Prerequisites (developer machine, Windows):**
- Node.js 20+ and npm.
- Rust toolchain via `rustup` (stable).
- MSVC build tools (Visual Studio Build Tools with "Desktop development with C++").
- WebView2 runtime (preinstalled on Windows 11).

**Repo:** work in the existing git repo at `C:\Web App\writing` (already initialized; the spec is committed). The Tauri app is scaffolded into this same folder.

---

## File Structure

Created by this plan (paths relative to repo root `C:\Web App\writing`):

```
package.json                         # frontend + tauri scripts, deps
vite.config.ts                       # Vite + Vitest config
tsconfig.json
index.html
src/
  main.tsx                           # React entry
  App.tsx                            # loads the scene doc, hydrates, mounts editor
  editor/
    Editor.tsx                       # TipTap editor bound to a provided Y.Doc
  yjs/
    serialize.ts                     # PURE: encodeDoc / applyEncoded (Yjs <-> base64)  [unit-tested]
    bindPersistence.ts               # debounced doc.on('update') -> store.save           [unit-tested]
  db/
    sceneDocStore.ts                 # SceneDocStore interface + InMemorySceneDocStore (test fake)
    sqliteSceneDocStore.ts           # tauri-plugin-sql implementation of SceneDocStore
    schema.ts                        # CREATE TABLE scene_docs (DDL) + db open helper
  test/
    serialize.test.ts
    bindPersistence.test.ts
    roundtrip.e2e.test.ts            # the walking-skeleton automated seam test
src-tauri/
  Cargo.toml                         # + tauri-plugin-sql
  src/lib.rs                         # registers the sql plugin
  capabilities/default.json          # sql permissions
  tauri.conf.json
```

Design boundaries:
- **`yjs/serialize.ts` is pure** — no Tauri, no DB, no React. It is the riskiest logic (binary→text encoding) and is fully unit-testable in Node.
- **`db/sceneDocStore.ts` defines an interface** so the persistence binding depends on an abstraction, not on Tauri. Tests use `InMemorySceneDocStore`; the app uses `SqliteSceneDocStore`.
- **`yjs/bindPersistence.ts`** wires a `Y.Doc` to any `SceneDocStore` with debouncing — unit-tested with fake timers and the in-memory store.
- **`editor/Editor.tsx`** is the only Tauri/React-coupled UI piece in the skeleton; it is verified by the manual smoke run.

---

## Task 1: Scaffold the Tauri 2 + React + TypeScript app

**Files:** generates `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src-tauri/**`.

- [ ] **Step 1: Scaffold into a temp dir, then move into the repo**

The scaffolder needs an empty target, so generate beside the repo and copy in (the repo already has `docs/` and `.git/`).

```bash
cd "C:/Web App"
npm create tauri-app@latest writing-scaffold -- --template react-ts --manager npm
```

If prompted interactively instead, choose: Frontend = **React**, language = **TypeScript**, bundler = **Vite**, package manager = **npm**.

- [ ] **Step 2: Move scaffold output into the repo root**

```bash
cd "C:/Web App/writing-scaffold"
# copy everything except its own .git (the repo root already has one)
cp -r ./package.json ./package-lock.json ./vite.config.ts ./tsconfig.json ./tsconfig.node.json ./index.html ./src ./src-tauri ./public "C:/Web App/writing/" 2>/dev/null || true
cd "C:/Web App"
rm -rf "C:/Web App/writing-scaffold"
```

- [ ] **Step 3: Install deps and run the app once**

```bash
cd "C:/Web App/writing"
npm install
npm run tauri dev
```

Expected: a native desktop window opens showing the default Tauri+React starter page. Close it.

- [ ] **Step 4: Set the app/window title and product name**

Edit `src-tauri/tauri.conf.json`: set `"productName": "writing"` and the main window `"title": "writing"`.

- [ ] **Step 5: Commit**

```bash
cd "C:/Web App/writing"
git add -A
git commit -m "chore: scaffold Tauri 2 + React + TypeScript app"
```

---

## Task 2: Add editor/persistence dependencies and Vitest

**Files:** Modify `package.json`, `vite.config.ts`.

- [ ] **Step 1: Install runtime + test dependencies**

```bash
cd "C:/Web App/writing"
npm install yjs js-base64 @tiptap/react @tiptap/starter-kit @tiptap/extension-collaboration
npm install -D vitest
```

- [ ] **Step 2: Add a Vitest config and test script**

Edit `vite.config.ts` to add a Vitest `test` block (keep the existing Tauri/React config above it):

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Tauri expects a fixed port; leave existing server config intact if present.
  clearScreen: false,
  test: {
    environment: "node",
    include: ["src/test/**/*.test.ts"],
  },
});
```

Add to `package.json` `"scripts"`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: Verify the test runner starts (no tests yet)**

Run: `npm run test`
Expected: Vitest runs and reports `No test files found` (exit is fine) — confirms the runner is wired.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add Yjs/TipTap deps and Vitest"
```

---

## Task 3: Pure Yjs↔base64 serialization (the riskiest seam)

**Files:**
- Create: `src/yjs/serialize.ts`
- Test: `src/test/serialize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/test/serialize.test.ts
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { encodeDoc, applyEncoded } from "../yjs/serialize";

describe("yjs serialize", () => {
  it("round-trips a document's text through base64", () => {
    const source = new Y.Doc();
    source.getText("content").insert(0, "Mara stood at the river.");

    const base64 = encodeDoc(source);
    expect(typeof base64).toBe("string");
    expect(base64.length).toBeGreaterThan(0);

    const restored = new Y.Doc();
    applyEncoded(restored, base64);

    expect(restored.getText("content").toString()).toBe(
      "Mara stood at the river."
    );
  });

  it("produces a string safe for large documents (no stack overflow)", () => {
    const source = new Y.Doc();
    source.getText("content").insert(0, "x".repeat(200_000));
    const base64 = encodeDoc(source);
    const restored = new Y.Doc();
    applyEncoded(restored, base64);
    expect(restored.getText("content").toString().length).toBe(200_000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- serialize`
Expected: FAIL — `Cannot find module '../yjs/serialize'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/yjs/serialize.ts
import * as Y from "yjs";
import { fromUint8Array, toUint8Array } from "js-base64";

/**
 * Serialize an entire Y.Doc to a base64 string.
 * We store base64 TEXT (not a raw BLOB) because tauri-plugin-sql does not
 * reliably round-trip binary columns (tauri-apps/plugins-workspace#105).
 * `fromUint8Array` handles arbitrarily large arrays safely (no spread/stack issue).
 */
export function encodeDoc(doc: Y.Doc): string {
  return fromUint8Array(Y.encodeStateAsUpdate(doc));
}

/** Apply a base64-encoded Yjs update to a (typically empty) Y.Doc. */
export function applyEncoded(doc: Y.Doc, base64: string): void {
  if (!base64) return;
  Y.applyUpdate(doc, toUint8Array(base64));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- serialize`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/yjs/serialize.ts src/test/serialize.test.ts
git commit -m "feat: pure Yjs<->base64 serialization with round-trip tests"
```

---

## Task 4: SceneDocStore interface + debounced persistence binding

**Files:**
- Create: `src/db/sceneDocStore.ts` (interface + in-memory fake)
- Create: `src/yjs/bindPersistence.ts`
- Test: `src/test/bindPersistence.test.ts`

- [ ] **Step 1: Create the store interface and in-memory fake**

```ts
// src/db/sceneDocStore.ts
/** Abstraction over where a scene's serialized Yjs doc lives. */
export interface SceneDocStore {
  /** Return the base64-encoded doc for a scene, or null if none stored. */
  load(sceneId: string): Promise<string | null>;
  /** Persist the base64-encoded doc for a scene (insert or replace). */
  save(sceneId: string, base64: string): Promise<void>;
}

/** Test/in-memory implementation. */
export class InMemorySceneDocStore implements SceneDocStore {
  private map = new Map<string, string>();
  saveCount = 0;
  async load(sceneId: string): Promise<string | null> {
    return this.map.get(sceneId) ?? null;
  }
  async save(sceneId: string, base64: string): Promise<void> {
    this.saveCount += 1;
    this.map.set(sceneId, base64);
  }
}
```

- [ ] **Step 2: Write the failing test for the persistence binding**

```ts
// src/test/bindPersistence.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Y from "yjs";
import { InMemorySceneDocStore } from "../db/sceneDocStore";
import { bindPersistence } from "../yjs/bindPersistence";
import { applyEncoded } from "../yjs/serialize";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("bindPersistence", () => {
  it("debounces saves and persists the latest state", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    const unbind = bindPersistence(doc, "scene-1", store, 500);

    doc.getText("content").insert(0, "Hello");
    doc.getText("content").insert(5, " world");
    expect(store.saveCount).toBe(0); // nothing saved before debounce elapses

    await vi.advanceTimersByTimeAsync(500);
    expect(store.saveCount).toBe(1); // collapsed into a single save

    const restored = new Y.Doc();
    applyEncoded(restored, (await store.load("scene-1"))!);
    expect(restored.getText("content").toString()).toBe("Hello world");

    unbind();
  });

  it("stops saving after unbind", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    const unbind = bindPersistence(doc, "scene-1", store, 500);
    unbind();
    doc.getText("content").insert(0, "ignored");
    await vi.advanceTimersByTimeAsync(500);
    expect(store.saveCount).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- bindPersistence`
Expected: FAIL — `Cannot find module '../yjs/bindPersistence'`.

- [ ] **Step 4: Implement the binding**

```ts
// src/yjs/bindPersistence.ts
import * as Y from "yjs";
import { encodeDoc } from "./serialize";
import type { SceneDocStore } from "../db/sceneDocStore";

/**
 * Subscribe to a Y.Doc and persist its full state to `store`, debounced.
 * Returns an unbind function that detaches the listener and cancels any
 * pending save.
 */
export function bindPersistence(
  doc: Y.Doc,
  sceneId: string,
  store: SceneDocStore,
  debounceMs = 500
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const onUpdate = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void store.save(sceneId, encodeDoc(doc));
    }, debounceMs);
  };

  doc.on("update", onUpdate);

  return () => {
    doc.off("update", onUpdate);
    if (timer) clearTimeout(timer);
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- bindPersistence`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add src/db/sceneDocStore.ts src/yjs/bindPersistence.ts src/test/bindPersistence.test.ts
git commit -m "feat: SceneDocStore interface + debounced Yjs persistence binding"
```

---

## Task 5: End-to-end seam test (the walking-skeleton automated proof)

This test proves the full logical round-trip — edit → encode → store → new doc → load → rehydrate → text present — using the in-memory store. (The real SQLite + GUI round-trip is proven by the manual smoke in Task 8.)

**Files:**
- Test: `src/test/roundtrip.e2e.test.ts`

- [ ] **Step 1: Write the end-to-end seam test**

```ts
// src/test/roundtrip.e2e.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Y from "yjs";
import { InMemorySceneDocStore } from "../db/sceneDocStore";
import { bindPersistence } from "../yjs/bindPersistence";
import { applyEncoded } from "../yjs/serialize";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("walking-skeleton seam", () => {
  it("text written into one session survives a simulated relaunch", async () => {
    const store = new InMemorySceneDocStore();
    const SCENE = "skeleton-scene";

    // --- Session 1: open, hydrate (empty), bind, write, let it persist ---
    const docA = new Y.Doc();
    applyEncoded(docA, (await store.load(SCENE)) ?? "");
    const unbindA = bindPersistence(docA, SCENE, store, 500);
    docA.getText("content").insert(0, "The salt road ran north.");
    await vi.advanceTimersByTimeAsync(500);
    unbindA();

    // --- Session 2: fresh doc, hydrate from store (the "relaunch") ---
    const docB = new Y.Doc();
    applyEncoded(docB, (await store.load(SCENE))!);

    expect(docB.getText("content").toString()).toBe("The salt road ran north.");
  });
});
```

- [ ] **Step 2: Run it and verify it passes**

Run: `npm run test -- roundtrip`
Expected: PASS. (All prior modules already exist, so this should pass immediately — it's the integration assertion over them.)

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all three test files PASS.

- [ ] **Step 4: Commit**

```bash
git add src/test/roundtrip.e2e.test.ts
git commit -m "test: end-to-end persistence seam (edit -> store -> relaunch -> present)"
```

---

## Task 6: Wire the real SQLite store via tauri-plugin-sql

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`
- Create: `src/db/schema.ts`, `src/db/sqliteSceneDocStore.ts`

- [ ] **Step 1: Add the SQL plugin (Rust + JS sides)**

```bash
cd "C:/Web App/writing"
npm run tauri add sql
```

Then confirm `src-tauri/Cargo.toml` has the sqlite feature:

```toml
[dependencies]
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

- [ ] **Step 2: Register the plugin in the Rust entrypoint**

In `src-tauri/src/lib.rs`, add the plugin to the builder (the `tauri add` command may have done this; verify):

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Grant SQL permissions**

In `src-tauri/capabilities/default.json`, ensure the `permissions` array includes:

```json
"sql:default",
"sql:allow-execute"
```

- [ ] **Step 4: Create the schema helper and DB opener**

```ts
// src/db/schema.ts
import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

/** Open (once) the app's SQLite database and ensure the schema exists. */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await Database.load("sqlite:writing.db");
      await db.execute(`
        CREATE TABLE IF NOT EXISTS scene_docs (
          scene_id TEXT PRIMARY KEY,
          state_base64 TEXT NOT NULL
        )
      `);
      return db;
    })();
  }
  return dbPromise;
}
```

- [ ] **Step 5: Implement the SQLite-backed store**

```ts
// src/db/sqliteSceneDocStore.ts
import type { SceneDocStore } from "./sceneDocStore";
import { getDb } from "./schema";

export class SqliteSceneDocStore implements SceneDocStore {
  async load(sceneId: string): Promise<string | null> {
    const db = await getDb();
    const rows = await db.select<{ state_base64: string }[]>(
      "SELECT state_base64 FROM scene_docs WHERE scene_id = $1",
      [sceneId]
    );
    return rows[0]?.state_base64 ?? null;
  }

  async save(sceneId: string, base64: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      "INSERT OR REPLACE INTO scene_docs (scene_id, state_base64) VALUES ($1, $2)",
      [sceneId, base64]
    );
  }
}
```

- [ ] **Step 6: Verify it compiles / app still launches**

Run: `npm run tauri dev`
Expected: the window opens with no Rust/JS errors in the terminal or devtools console. Close it. (The store isn't used by the UI yet — Task 7 wires it.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: SQLite-backed SceneDocStore via tauri-plugin-sql"
```

---

## Task 7: The editor, hydrated from storage and bound for persistence

**Files:**
- Create: `src/editor/Editor.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the TipTap editor bound to a provided Y.Doc**

Note: when using the Collaboration extension, do NOT pass `content` to `useEditor` (content comes from the Y.Doc), and disable StarterKit's undo/redo (Yjs provides its own).

```tsx
// src/editor/Editor.tsx
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";

export function Editor({ doc }: { doc: Y.Doc }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc, field: "content" }),
    ],
  });

  return (
    <div style={{ maxWidth: 720, margin: "48px auto", padding: "0 24px" }}>
      <EditorContent editor={editor} />
    </div>
  );
}
```

- [ ] **Step 2: Wire App to load → hydrate → mount → persist**

```tsx
// src/App.tsx
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { Editor } from "./editor/Editor";
import { SqliteSceneDocStore } from "./db/sqliteSceneDocStore";
import { applyEncoded } from "./yjs/serialize";
import { bindPersistence } from "./yjs/bindPersistence";

const SCENE_ID = "skeleton-scene";
const store = new SqliteSceneDocStore();

export default function App() {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const unbindRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = new Y.Doc();
      const stored = await store.load(SCENE_ID); // hydrate BEFORE mounting editor
      applyEncoded(d, stored ?? "");
      if (cancelled) return;
      unbindRef.current = bindPersistence(d, SCENE_ID, store, 500);
      setDoc(d);
    })();
    return () => {
      cancelled = true;
      unbindRef.current?.();
    };
  }, []);

  if (!doc) return <p style={{ margin: 48 }}>Loading…</p>;
  return <Editor doc={doc} />;
}
```

- [ ] **Step 3: Re-run the unit suite (guard against regressions)**

Run: `npm run test`
Expected: all three test files still PASS (these modules are unchanged).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: hydrate scene doc from SQLite, mount editor, persist on edit"
```

---

## Task 8: Manual end-to-end smoke run (the recorded observation)

This is the walking skeleton's terminus proof — bytes traverse the *real* stack (GUI → Yjs → base64 → SQLite → relaunch → rehydrate → GUI).

- [ ] **Step 1: Launch the app**

Run: `npm run tauri dev`
Expected: the "writing" window opens with an empty editor.

- [ ] **Step 2: Type and wait for the debounced save**

Type a sentence (e.g. `Mara had not expected the river to be silent.`). Wait ~1 second (past the 500 ms debounce).

- [ ] **Step 3: Fully close the app**

Close the window and stop `tauri dev` (Ctrl+C in the terminal) — this guarantees a cold start, not a hot reload.

- [ ] **Step 4: Relaunch and confirm persistence**

Run: `npm run tauri dev`
Expected: **the sentence you typed is still in the editor.** This is the smoke-run terminus — record it as observed (PASS) before any Phase-2 (binder) work begins.

- [ ] **Step 5: (Optional) Inspect the database**

The SQLite file lives in the app's data dir (Tauri resolves `sqlite:writing.db` under the OS app-data path). A row in `scene_docs` with `scene_id = 'skeleton-scene'` and a non-empty `state_base64` confirms the write path.

- [ ] **Step 6: Final commit (any smoke-fix tweaks)**

```bash
git add -A
git commit -m "chore: walking skeleton verified end-to-end"
```

---

## Acceptance criteria (Phase 1 walking skeleton)

1. `npm run test` → all unit/seam tests pass (serialize, bindPersistence, roundtrip).
2. The app builds and launches via `npm run tauri dev` with no console errors.
3. **Smoke run (Task 8): text typed in one session is present after a full relaunch.** ← the gate.
4. Code is production-shaped (real schema `scene_docs`, real plugin wiring) — not a throwaway prototype.

No Phase-2 work (the binder and beyond) begins until criterion 3 is observed.

---

## Self-review notes (author)

- **Spec coverage:** This plan implements the load-bearing slice of spec §5 (Tauri + TipTap + Yjs-per-scene + SQLite persistence) and the spec's "works offline" (F9) and Yjs-from-day-one decision (§11 load-bearing #1, #2). It deliberately does NOT cover binder/story-bible/corkboard/goals/quick-capture/export/backup — those are later plans, per the spec's phase decomposition.
- **BLOB decision:** spec §7 listed the per-scene Yjs log as a BLOB; research (tauri-apps/plugins-workspace#105) showed the SQL plugin doesn't round-trip binary reliably, so this plan stores it as base64 TEXT (`scene_docs.state_base64`). This refines the spec — update spec §7's `scene_docs` column to `state_base64 TEXT` for consistency.
- **Type consistency:** `SceneDocStore.{load,save}`, `encodeDoc`/`applyEncoded`, and `bindPersistence(doc, sceneId, store, debounceMs)` are used identically across all tasks and tests.
- **No placeholders:** every code step contains complete, runnable code; every run step states the expected result.
- **Version caveat:** `StarterKit.configure({ undoRedo: false })` is the TipTap v3 option name (was `history` in v2). If `npm run tauri dev` warns about an unknown option, check the installed `@tiptap/starter-kit` version and adjust to `history: false`.
