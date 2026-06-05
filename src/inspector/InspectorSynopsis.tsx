/**
 * InspectorSynopsis — editable synopsis block for the right-pane inspector.
 * Extracted from SceneInspector.tsx to keep that file under the 300-line limit.
 */
import { useRef, useState } from "react";

import { Icon } from "../components/Icon";
import type { Scene } from "../db/binderStore";
import { SqliteBinderStore } from "../db/sqliteBinderStore";

// Module-level singleton — constructor is side-effect-free (getDb is lazy).
// Shared with SceneInspector via module scope; both import the same symbol.
const binderStore = new SqliteBinderStore();

// -- SynopsisEditField — controlled textarea for inline synopsis editing ----
interface SynopsisEditFieldProps {
  sceneId: string | null; localSynopsis: string;
  onCommit: (next: string | null) => void; onCancel: () => void;
}
function SynopsisEditField({ sceneId, localSynopsis, onCommit, onCancel }: SynopsisEditFieldProps) {
  const [draft, setDraft] = useState(localSynopsis);
  const committedRef = useRef(false);

  const commit = () => {
    if (!sceneId || committedRef.current) return;
    committedRef.current = true;
    const trimmed = draft.trim();
    onCommit(trimmed.length > 0 ? trimmed : null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
    if (e.key === "Escape") { onCancel(); }
  };

  return (
    <textarea
      autoFocus
      className="synopsis"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      style={{ width: "100%", resize: "vertical", overflowWrap: "anywhere",
               wordBreak: "break-word", boxSizing: "border-box",
               background: "var(--parchment-deep)", color: "var(--ink)" }}
    />
  );
}

// -- SynopsisGroup — editable synopsis block --------------------------------
interface SynopsisGroupProps { scene: Scene | null; sceneId: string | null; }
export function SynopsisGroup({ scene, sceneId }: SynopsisGroupProps) {
  const [localSynopsis, setLocalSynopsis] = useState<string>(scene?.synopsis ?? "");
  const [prevSceneId, setPrevSceneId] = useState<string | null>(sceneId);
  const [editing, setEditing] = useState(false);

  if (prevSceneId !== sceneId) {
    setPrevSceneId(sceneId);
    setLocalSynopsis(scene?.synopsis ?? "");
    setEditing(false);
  }

  const handleCommit = (next: string | null) => {
    setLocalSynopsis(next ?? "");
    setEditing(false);
    binderStore.setSceneSynopsis(sceneId!, next).catch((e: unknown) => {
      console.error("[SceneInspector] setSceneSynopsis failed", e);
    });
  };

  return (
    <div className="insp-group">
      <div className="insp-label">
        <Icon name="fileText" className="ic" /> Synopsis
        <button className="add" aria-label="Edit synopsis" onClick={() => { if (sceneId) setEditing(true); }}>
          <Icon name="edit" style={{ width: 13, height: 13 }} />
        </button>
      </div>
      {editing
        ? <SynopsisEditField sceneId={sceneId} localSynopsis={localSynopsis}
            onCommit={handleCommit} onCancel={() => setEditing(false)} />
        : <div className="synopsis" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
            {localSynopsis}
          </div>}
    </div>
  );
}
