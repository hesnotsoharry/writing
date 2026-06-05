/**
 * EditorPane — extracted from App.content.tsx to break a potential circular
 * import when App.content.viewstage.tsx needs to render the editor fallback.
 */
import { useRef } from "react";
import type * as Y from "yjs";

import type { AppView } from "./App.state";
import type { BinderTree } from "./binder/buildTree";
import type { SqliteStoryBibleStore } from "./db/sqliteStoryBibleStore";
import { Editor } from "./editor/Editor";
import { usePageFlip } from "./editor/usePageFlip";

export function EditorPane({ doc, view, tree, selectedSceneId, storyBibleStore, linksVersion }: {
  doc: Y.Doc | null;
  view: AppView;
  tree: BinderTree;
  selectedSceneId: string | null;
  storyBibleStore: SqliteStoryBibleStore;
  linksVersion: number;
}) {
  // captureProseRef: Editor writes its captureProse fn here; usePageFlip reads it.
  const captureProseRef = useRef<() => string>(() => "");
  const { flip, onAnimationEnd } = usePageFlip({
    selectedSceneId, tree, view, captureProse: () => captureProseRef.current(),
  });
  return (
    <main className="canvas-pane">
      {doc
        ? <Editor doc={doc} tree={tree} selectedSceneId={selectedSceneId}
            storyBibleStore={storyBibleStore} linksVersion={linksVersion}
            flip={flip} onAnimationEnd={onAnimationEnd} captureProseRef={captureProseRef} />
        : <div className="canvas-empty">Select a scene to start writing.</div>}
    </main>
  );
}
