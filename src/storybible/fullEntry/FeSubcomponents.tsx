/**
 * Sub-components for FullEntry: FeHeroAvatar, FeScene, AddField, FeProseSection,
 * FeDetailsGroup, FeAppearsIn, FeEyebrow. Kept in a separate file to hold FullEntry.tsx
 * under the 300-line limit.
 */

import { useEffect, useRef, useState } from "react";

import type { IconName } from "../../components/Icon";
import { Icon } from "../../components/Icon";
import type { StoryBibleStore } from "../../db/storyBibleStore";
import { STATUS_META } from "../../lib/status";
import type { AppearsInRow, MergedFact, MergedSection } from "./defs";
import { Editable } from "./Editable";

// ── FeHeroAvatar ──────────────────────────────────────────────────────────────

interface FeHeroAvatarProps {
  type: "character" | "location";
  initial: string;
  /** asset:// URL for the portrait image, or null when no portrait is set. */
  displaySrc?: string | null;
  /** Called when the user clicks "Add portrait" or "Change portrait". */
  onAdd?: () => void;
  /** Called when the user clicks "Remove portrait". */
  onRemove?: () => void;
  /** Called when the <img> fires onError (stale file — clear without deleting). */
  onPortraitError?: () => void;
}

export function FeHeroAvatar({
  type, initial, displaySrc, onAdd, onRemove, onPortraitError,
}: FeHeroAvatarProps) {
  if (displaySrc) {
    // Portrait set — render image with change/remove affordance below it.
    return (
      <div className="fe-avatar-col">
        <div className={`fe-portrait${type === "character" ? " round" : ""}`}>
          <img
            src={displaySrc}
            alt="Portrait"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={onPortraitError}
          />
        </div>
        <button className="fe-portrait-add" onClick={onRemove}>
          <Icon name="x" className="ic" /> Remove
        </button>
      </div>
    );
  }
  // No portrait — render monogram + "Add portrait" button.
  return (
    <div className="fe-avatar-col">
      <div className={`fe-av-lg ${type}`}>{initial}</div>
      <button className="fe-portrait-add" onClick={onAdd}>
        <Icon name="plus" className="ic" /> Portrait
      </button>
    </div>
  );
}

// ── FeScene ───────────────────────────────────────────────────────────────────

interface FeSceneProps {
  sceneId: string;
  title: string;
  chapter: string;
  status: string;
  words: number;
  onOpen?: (sceneId: string) => void;
}

export function FeScene({ sceneId, title, chapter, status, words, onOpen }: FeSceneProps) {
  const meta = STATUS_META[status as keyof typeof STATUS_META] ?? STATUS_META.blank;
  return (
    <div className="fe-scene" onClick={() => onOpen?.(sceneId)}>
      <span className="sdot" style={{ background: meta.dot }} />
      <span className="stitle">{title}</span>
      <span className="sch">{chapter}</span>
      <span className="sw">{words ? `${words.toLocaleString()}w` : "—"}</span>
      <Icon name="chevRight" className="schev" style={{ width: 14, height: 14 }} />
    </div>
  );
}

// ── AddField ──────────────────────────────────────────────────────────────────

interface AddFieldProps {
  entityId: string;
  store: StoryBibleStore;
  onAdded: () => void;
}

export function AddField({ entityId, store, onAdded }: AddFieldProps) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding && ref.current) ref.current.focus();
  }, [adding]);

  async function commit() {
    const key = label.trim();
    if (key) {
      await store.addEntityField(entityId, "fact", key);
      onAdded();
    }
    setLabel("");
    setAdding(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") { void commit(); }
    else if (e.key === "Escape") { setLabel(""); setAdding(false); }
  }

  if (adding) {
    return (
      <input
        ref={ref}
        className="fe-add-label-input"
        value={label}
        placeholder="Field name…"
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => { void commit(); }}
        onKeyDown={handleKey}
      />
    );
  }
  return (
    <button className="fe-add" onClick={() => setAdding(true)}>
      <Icon name="plus" className="ic" /> Add field
    </button>
  );
}

// ── FeProseSection ────────────────────────────────────────────────────────────

interface FeProseSectionProps {
  section: MergedSection;
  /** Called with the new text value; caller binds the key/kind. */
  onCommit: (value: string) => void;
}

export function FeProseSection({ section, onCommit }: FeProseSectionProps) {
  return (
    <div className="fe-sec">
      <div className="fe-sec-label">
        <Icon name={section.icon as IconName} className="ic" />
        {" "}{section.label}
      </div>
      <Editable
        key={section.key + ":" + section.text}
        className="fe-prose"
        multiline
        value={section.text}
        placeholder={`Add ${section.label.toLowerCase()}…`}
        onCommit={onCommit}
      />
    </div>
  );
}

// ── FeFact ────────────────────────────────────────────────────────────────────

interface FeFactProps {
  label: string;
  value: string;
  /** Called with the new value; caller binds the label/kind. */
  onCommit: (value: string) => void;
}

export function FeFact({ label, value, onCommit }: FeFactProps) {
  return (
    <div className="fe-fact">
      <div className="fe-fact-l">{label}</div>
      <Editable
        key={label + ":" + value}
        className="fe-fact-v"
        value={value}
        placeholder="Add"
        onCommit={onCommit}
      />
    </div>
  );
}

// ── FeDetailsGroup ────────────────────────────────────────────────────────────

interface FeDetailsGroupProps {
  entityId: string;
  facts: MergedFact[];
  store?: StoryBibleStore;
  refresh: () => void;
  onCommitFact: (label: string, value: string) => void;
}

export function FeDetailsGroup({ entityId, facts, store, refresh, onCommitFact }: FeDetailsGroupProps) {
  return (
    <div className="insp-group">
      <div className="insp-label">
        <Icon name="info" className="ic" /> Details
        {store && (
          <button
            className="add" title="Add field"
            onClick={() => { void store.addEntityField(entityId, "fact", "New field").then(refresh); }}
          >
            <Icon name="plus" style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>
      <div className="fe-facts">
        {facts.map((f) => (
          <FeFact key={f.label} label={f.label} value={f.value}
            onCommit={(v) => onCommitFact(f.label, v)} />
        ))}
      </div>
    </div>
  );
}

// ── FeAppearsIn ───────────────────────────────────────────────────────────────

interface FeAppearsInProps {
  rows: AppearsInRow[];
  onOpen?: (sceneId: string) => void;
}

export function FeAppearsIn({ rows, onOpen }: FeAppearsInProps) {
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
    </div>
  );
}

// ── FeEyebrow — inline-editable role eyebrow ──────────────────────────────────

export interface FeEyebrowProps {
  role: string;
  isChar: boolean;
  onCommit: (v: string) => void;
}

export function FeEyebrow({ role, isChar, onCommit }: FeEyebrowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(role);

  function commit() {
    setEditing(false);
    const val = draft.trim();
    if (val !== role) onCommit(val);
  }

  if (editing) {
    return (
      <input className="fe-eyebrow-input" value={draft} autoFocus
        placeholder={isChar ? "Character role…" : "Location role…"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") setEditing(false); }} />
    );
  }
  return (
    <div className={`fe-eyebrow${isChar ? "" : " location"}`}
      title="Click to edit role"
      onClick={() => { setDraft(role); setEditing(true); }}>
      {role || (isChar ? "Character" : "Setting")}
    </div>
  );
}
