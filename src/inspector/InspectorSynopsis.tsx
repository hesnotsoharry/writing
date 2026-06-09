/**
 * InspectorSynopsis — editable synopsis block for the right-pane inspector.
 * Extracted from SceneInspector.tsx to keep that file under the 300-line limit.
 */
import { useEffect, useRef, useState } from "react";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow fallback for browsers where field-sizing:content is not supported.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

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
      ref={textareaRef}
      autoFocus
      className="synopsis synopsis-edit"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

// -- useSynopsisGroupState — state + render-phase sync guards ----------------
interface SynopsisState {
  localSynopsis: string;
  editing: boolean;
  setEditing: (v: boolean) => void;
  handleCommit: (next: string | null) => void;
}

function useSynopsisGroupState(scene: Scene | null, sceneId: string | null): SynopsisState {
  const synopsisNow = scene?.synopsis ?? null;
  const [localSynopsis, setLocalSynopsis] = useState<string>(synopsisNow ?? "");
  const [prevSceneId, setPrevSceneId] = useState<string | null>(sceneId);
  const [prevSynopsis, setPrevSynopsis] = useState<string | null>(synopsisNow);
  const [editing, setEditing] = useState(false);

  if (prevSceneId !== sceneId) {
    setPrevSceneId(sceneId);
    setPrevSynopsis(synopsisNow);
    setLocalSynopsis(synopsisNow ?? "");
    setEditing(false);
  }

  // Sync when synopsis prop updates on the SAME scene (e.g. after a corkboard write
  // triggers reloadTree). The !editing guard never clobbers an in-progress edit.
  if (!editing && prevSynopsis !== synopsisNow) {
    setPrevSynopsis(synopsisNow);
    setLocalSynopsis(synopsisNow ?? "");
  }

  const handleCommit = (next: string | null) => {
    setLocalSynopsis(next ?? "");
    setEditing(false);
    binderStore.setSceneSynopsis(sceneId!, next).catch((e: unknown) => {
      console.error("[SceneInspector] setSceneSynopsis failed", e);
    });
  };

  return { localSynopsis, editing, setEditing, handleCommit };
}

// -- SynopsisGroup — editable synopsis block --------------------------------
interface SynopsisGroupProps { scene: Scene | null; sceneId: string | null; }
export function SynopsisGroup({ scene, sceneId }: SynopsisGroupProps) {
  const { localSynopsis, editing, setEditing, handleCommit } = useSynopsisGroupState(scene, sceneId);
  return (
    <div className="insp-group">
      <div className="insp-label">
        <Icon name="fileText" className="ic" /> Synopsis
        <button className="add" aria-label="Edit synopsis" onClick={() => { if (sceneId) setEditing(true); }}>
          <Icon name="edit" style={{ width: 13, height: 13 }} />
        </button>
      </div>
      {editing ? (
        <SynopsisEditField sceneId={sceneId} localSynopsis={localSynopsis}
          onCommit={handleCommit} onCancel={() => setEditing(false)} />
      ) : localSynopsis ? (
        <div className="synopsis" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
          {localSynopsis}
        </div>
      ) : null}
    </div>
  );
}
