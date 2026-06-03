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
