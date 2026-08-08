import { MobileEditorCore } from "@writersnook/editor/MobileEditorCore";
import { useEffect, useSyncExternalStore } from "react";

import type { BridgeClient } from "./bridgeClient";

function bindViewportHeight(): () => void {
  const viewport = window.visualViewport;
  const updateHeight = () => {
    const height = viewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty("--editor-viewport-height", `${height}px`);
  };
  updateHeight();
  viewport?.addEventListener("resize", updateHeight);
  window.addEventListener("resize", updateHeight);
  return () => {
    viewport?.removeEventListener("resize", updateHeight);
    window.removeEventListener("resize", updateHeight);
  };
}

export function EditorWebApp({ client }: { client: BridgeClient }) {
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot);
  useEffect(bindViewportHeight, []);

  if (!snapshot.hydrated) {
    return <main className="editor-page editor-page--waiting" aria-busy="true" />;
  }

  return (
    <main className="editor-page">
      <MobileEditorCore
        key={snapshot.editorKey}
        doc={snapshot.doc}
        editable
      />
    </main>
  );
}
