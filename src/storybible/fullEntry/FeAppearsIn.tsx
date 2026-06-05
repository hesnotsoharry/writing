/**
 * FeAppearsIn — "Appears in" rail group with optional scene link picker.
 * Extracted from FeSubcomponents.tsx to keep that file under the line limit.
 */

import { useEffect, useRef, useState } from "react";

import { Icon } from "../../components/Icon";
import type { Scene } from "../../db/binderStore";
import type { AppearsInRow } from "./defs";
import { FeScene } from "./FeSubcomponents";

// ── SceneLinkPicker ───────────────────────────────────────────────────────────

interface SceneLinkPickerProps {
  candidates: Scene[];
  onPick: (sceneId: string) => void;
  onClose: () => void;
}

function SceneLinkPicker({ candidates, onPick, onClose }: SceneLinkPickerProps) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const filtered = candidates.filter((s) =>
    s.title.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="fe-picker">
      <div className="fe-picker-search">
        <Icon name="search" className="ic" />
        <input
          ref={ref}
          className="fe-picker-input"
          placeholder="Search scenes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        />
      </div>
      {filtered.length === 0 ? (
        <div className="empty-hint" style={{ padding: "8px" }}>No scenes left to link.</div>
      ) : (
        filtered.map((s) => (
          <button className="fe-pick" key={s.id} onClick={() => onPick(s.id)}>
            <Icon name="fileText" className="ic" style={{ width: 15, height: 15, flexShrink: 0 }} />
            <span className="nm">{s.title}</span>
            <Icon name="plus" className="plus" style={{ width: 15, height: 15 }} />
          </button>
        ))
      )}
    </div>
  );
}

// ── FeAppearsIn ───────────────────────────────────────────────────────────────

export interface FeAppearsInProps {
  rows: AppearsInRow[];
  onOpen?: (sceneId: string) => void;
  /** All scenes in the project (for the link picker). If absent, no "Link scene" button. */
  allScenes?: Scene[];
  /** Current scene ids already linked (for dedup in picker). */
  linkedSceneIds?: string[];
  /** Called when the user picks a scene to link to this entity. */
  onLinkScene?: (sceneId: string) => void;
}

export function FeAppearsIn({ rows, onOpen, allScenes, linkedSceneIds, onLinkScene }: FeAppearsInProps) {
  const [picking, setPicking] = useState(false);
  const linked = new Set(linkedSceneIds ?? []);
  const candidates = (allScenes ?? []).filter((s) => !linked.has(s.id));
  return (
    <div className="insp-group">
      <div className="insp-label">
        <Icon name="fileText" className="ic" /> Appears in · {rows.length}
      </div>
      {rows.length > 0 ? (
        <div className="fe-list">
          {rows.map((row) => <FeScene key={row.sceneId} {...row} onOpen={onOpen} />)}
        </div>
      ) : (
        <div className="empty-hint">Not linked to any scene yet.</div>
      )}
      {onLinkScene && (
        picking ? (
          <SceneLinkPicker
            candidates={candidates}
            onPick={(id) => { onLinkScene(id); setPicking(false); }}
            onClose={() => setPicking(false)}
          />
        ) : (
          <button className="fe-add" onClick={() => setPicking(true)}>
            <Icon name="plus" className="ic" /> Link a scene
          </button>
        )
      )}
    </div>
  );
}
