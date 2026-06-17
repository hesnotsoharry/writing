/**
 * EditorPane — extracted from App.content.tsx to break a potential circular
 * import when App.content.viewstage.tsx needs to render the editor fallback.
 */
import { useRef } from "react";
import type * as Y from "yjs";

import type { AppView } from "./App.state";
import type { BinderTree } from "./binder/buildTree";
import type { SqliteStoryBibleStore } from "./db/sqliteStoryBibleStore";
import type { EditorFocusProps } from "./editor/Editor";
import { Editor } from "./editor/Editor";
import { usePageFlip } from "./editor/usePageFlip";
import type { SceneStatus } from "./lib/status";

export function EditorPane({ doc, view, tree, selectedSceneId, storyBibleStore, linksVersion,
  focusMode, typewriterOn, dimParagraphsOn, onOpenEntry, activeProjectId, onFindMentions, onRegisterInsert,
  onRenameScene, onSetSceneStatus, onSetSceneExcludedFromAi,
}: {
  doc: Y.Doc | null;
  view: AppView;
  tree: BinderTree;
  selectedSceneId: string | null;
  storyBibleStore: SqliteStoryBibleStore;
  linksVersion: number;
  onOpenEntry?: (id: string, kind: string) => void;
  activeProjectId?: string | null;
  onFindMentions?: (entityName: string) => void;
  onRegisterInsert?: (fn: (text: string) => void) => void;
  onRenameScene?: (id: string, title: string) => void;
  onSetSceneStatus?: (id: string, status: SceneStatus) => void;
  onSetSceneExcludedFromAi?: (id: string, exclude: boolean) => void;
} & EditorFocusProps) {
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
            flip={flip} onAnimationEnd={onAnimationEnd} captureProseRef={captureProseRef}
            focusMode={focusMode} typewriterOn={typewriterOn} dimParagraphsOn={dimParagraphsOn}
            onOpenEntry={onOpenEntry} activeProjectId={activeProjectId ?? null}
            onFindMentions={onFindMentions} onRegisterInsert={onRegisterInsert}
            onRenameScene={onRenameScene} onSetSceneStatus={onSetSceneStatus}
            onSetSceneExcludedFromAi={onSetSceneExcludedFromAi} />
        : <div className="canvas-empty">Select a scene to start writing.</div>}
    </main>
  );
}
