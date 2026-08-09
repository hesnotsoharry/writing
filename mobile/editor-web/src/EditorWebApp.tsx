import { MobileEditorCore } from "@writersnook/editor/MobileEditorCore";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import type { BridgeClient } from "./bridgeClient";
import { attachEditorUi } from "./editorUiBridge";

type Editor = Parameters<NonNullable<ComponentProps<typeof MobileEditorCore>["onReady"]>>[0];

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
  const detachUi = useRef<(() => void) | null>(null);
  useEffect(bindViewportHeight, []);
  useEffect(() => () => { detachUi.current?.(); }, []);
  const onReady = useCallback((editor: Editor) => {
    detachUi.current?.();
    detachUi.current = attachEditorUi(editor, client);
  }, [client]);

  if (!snapshot.hydrated) {
    return <main className="editor-page editor-page--waiting" aria-busy="true" />;
  }

  return (
    <main className="editor-page">
      <MobileEditorCore
        key={snapshot.editorKey}
        doc={snapshot.doc}
        editable
        onReady={onReady}
        onDestroy={() => { detachUi.current?.(); detachUi.current = null; }}
      />
    </main>
  );
}
