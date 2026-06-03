import type { MutableRefObject } from "react";
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";

import { Binder } from "./binder/Binder";
import type { BinderTree } from "./binder/buildTree";
import { buildTree } from "./binder/buildTree";
import { getDb } from "./db/schema";
import { seedIfEmpty } from "./db/seed";
import { SqliteBinderStore } from "./db/sqliteBinderStore";
import { SqliteSceneDocStore } from "./db/sqliteSceneDocStore";
import { Editor } from "./editor/Editor";
import { bindPersistence } from "./yjs/bindPersistence";
import { applyEncoded } from "./yjs/serialize";

interface LoadSceneCtx {
  unbindRef: MutableRefObject<(() => void) | null>;
  loadTokenRef: MutableRefObject<number>;
  mountedRef: MutableRefObject<boolean>;
  setDoc: (doc: Y.Doc | null) => void;
  setSelectedSceneId: (id: string | null) => void;
}

const sceneDocStore = new SqliteSceneDocStore();
const binderStore = new SqliteBinderStore();

/**
 * Load a scene's Yjs doc from the store and bind persistence.
 * Hydrates BEFORE mounting the editor (per the gotcha in CLAUDE.md).
 * Guards against unmount race and concurrent-switch race via token + mountedRef.
 */
async function loadScene(sceneId: string, ctx: LoadSceneCtx) {
  const { unbindRef, loadTokenRef, mountedRef, setDoc, setSelectedSceneId } =
    ctx;
  const myToken = ++loadTokenRef.current;

  // Unbind the previous scene's persistence listener before switching.
  unbindRef.current?.();
  unbindRef.current = null;
  setDoc(null);

  const d = new Y.Doc();
  const stored = await sceneDocStore.load(sceneId);

  // A newer load started, or we unmounted, during the await — abort.
  if (myToken !== loadTokenRef.current || !mountedRef.current) return;

  // Hydrate BEFORE binding persistence (load-bearing order per CLAUDE.md).
  applyEncoded(d, stored ?? "");
  const unbind = bindPersistence(d, sceneId, sceneDocStore, 500);

  // Re-check after the sync bind in case state changed; clean up if stale.
  if (myToken !== loadTokenRef.current || !mountedRef.current) {
    unbind();
    return;
  }

  unbindRef.current = unbind;
  setSelectedSceneId(sceneId);
  setDoc(d);
}

/**
 * Initialize the project tree: ensure schema, seed if empty, load tree and auto-select first scene.
 */
async function initializeProjectTree(
  cancelled: { value: boolean },
  setTree: (tree: BinderTree | null) => void,
  setLoading: (loading: boolean) => void,
  loadSceneFn: (sceneId: string) => Promise<void>
) {
  // Ensure all three tables exist (idempotent via CREATE TABLE IF NOT EXISTS).
  await getDb();
  // Seed a sample project on first launch.
  await seedIfEmpty(binderStore);

  if (cancelled.value) return;

  const projects = await binderStore.listProjects();
  if (projects.length === 0 || cancelled.value) {
    setLoading(false);
    return;
  }

  const activeProject = projects[0];
  const { folders, scenes } = await binderStore.loadProject(
    activeProject.id
  );
  if (cancelled.value) return;

  const builtTree = buildTree(folders, scenes);
  setTree(builtTree);
  setLoading(false);

  // Auto-select the first scene if there is one.
  const firstScene =
    builtTree.chapters[0]?.scenes[0] ?? builtTree.shortPieces[0] ?? null;
  if (firstScene && !cancelled.value) {
    await loadSceneFn(firstScene.id);
  }
}

interface AppContentProps {
  tree: BinderTree | null;
  selectedSceneId: string | null;
  doc: Y.Doc | null;
  onSelectScene: (sceneId: string) => void;
}

/** Center pane: the editor when a scene is open, otherwise a calm placeholder. */
function EditorPane({ doc }: { doc: Y.Doc | null }) {
  return (
    <main style={{ flex: 1, overflow: "auto" }}>
      {doc ? (
        <Editor doc={doc} />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#aaa",
            fontSize: 14,
            fontFamily: "sans-serif",
          }}
        >
          Select a scene to start writing.
        </div>
      )}
    </main>
  );
}

function AppContent({
  tree,
  selectedSceneId,
  doc,
  onSelectScene,
}: AppContentProps) {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {tree && (
        <Binder
          tree={tree}
          selectedSceneId={selectedSceneId}
          onSelectScene={onSelectScene}
        />
      )}

      <EditorPane doc={doc} />
    </div>
  );
}

/**
 * Owns the three concurrency-guard refs, the mount effect, and returns a
 * bound scene-loader so the App component stays under the 40-line limit.
 */
function useSceneLoader(
  setDoc: (d: Y.Doc | null) => void,
  setSelectedSceneId: (id: string | null) => void,
  setTree: (t: BinderTree | null) => void,
  setLoading: (v: boolean) => void
) {
  const unbindRef = useRef<(() => void) | null>(null);
  const loadTokenRef = useRef(0);
  const mountedRef = useRef(true);

  const ctx: LoadSceneCtx = {
    unbindRef,
    loadTokenRef,
    mountedRef,
    setDoc,
    setSelectedSceneId,
  };

  useEffect(() => {
    const cancelled = { value: false };
    void initializeProjectTree(cancelled, setTree, setLoading, (sceneId) =>
      loadScene(sceneId, ctx)
    );
    return () => {
      cancelled.value = true;
      mountedRef.current = false;
      // Snapshot unbindRef.current at cleanup time (satisfies react-hooks/exhaustive-deps).
      const unbind = unbindRef.current;
      unbind?.();
    };
  }, []); // stable refs + setters; exhaustive-deps false-positive on empty array

  return (sceneId: string) => void loadScene(sceneId, ctx);
}

export default function App() {
  const [tree, setTree] = useState<BinderTree | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSelectScene = useSceneLoader(
    setDoc,
    setSelectedSceneId,
    setTree,
    setLoading
  );

  if (loading) {
    return (
      <p style={{ margin: 48, fontFamily: "sans-serif", color: "#666" }}>
        Loading…
      </p>
    );
  }

  return (
    <AppContent
      tree={tree}
      selectedSceneId={selectedSceneId}
      doc={doc}
      onSelectScene={handleSelectScene}
    />
  );
}
