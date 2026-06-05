/**
 * CustomTypeCreator — modal for creating a new custom entity type.
 * Name + icon picker + color/accent picker → registers a new type.
 */
import { useEffect, useRef, useState } from "react";

import type { IconName } from "../components/Icon";
import { Icon } from "../components/Icon";
import type { StoryBibleStore } from "../db/storyBibleStore";

// ── Constants ─────────────────────────────────────────────────────────────────

const CT_PALETTE = ["clay", "sea", "moss", "plum", "gold", "slate", "rose", "ink"] as const;
type CtColor = typeof CT_PALETTE[number];
const CT_ICONS: IconName[] = ["archive", "pin", "book", "sparkle", "target", "zap", "command", "feather"];
function ctVar(c: CtColor): string { return `var(--label-${c})`; }
function ctTint(c: CtColor): string { return `color-mix(in srgb, var(--label-${c}) 16%, transparent)`; }

// ── Sub-components ─────────────────────────────────────────────────────────────

function CtIconPicker({ icon, onPick }: { icon: IconName; onPick: (ic: IconName) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <label className="field-label">Icon</label>
      <div className="et-iconpick">
        {CT_ICONS.map((ic) => (
          <button key={ic} className={`et-icon-btn${icon === ic ? " on" : ""}`} onClick={() => onPick(ic)}>
            <Icon name={ic} style={{ width: 17, height: 17 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function CtAccentPicker({ color, onPick }: { color: CtColor; onPick: (c: CtColor) => void }) {
  return (
    <div>
      <label className="field-label">Accent</label>
      <div style={{ display: "flex", gap: 6 }}>
        {CT_PALETTE.map((c) => (
          <button key={c} className={`et-sw${color === c ? " on" : ""}`} style={{ background: ctVar(c) }} onClick={() => onPick(c)} />
        ))}
      </div>
    </div>
  );
}

function CtPreview({ icon, color, label, singular }: { icon: IconName; color: CtColor; label: string; singular: string }) {
  return (
    <div className="et-preview">
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 9 }}>Preview</div>
      <div className="bib-row" style={{ cursor: "default" }}>
        <div className="bib-badge sq" style={{ width: 28, height: 28, background: ctTint(color), color: ctVar(color) }}>
          <Icon name={icon} style={{ width: 15, height: 15 }} />
        </div>
        <div><div className="nm">A new {singular}</div><div className="role">{label}</div></div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 8 }}>
        Default fields: Type · Status · First appears. Default sections: Description · Notes.
      </div>
    </div>
  );
}

interface CtBodyProps {
  inputRef: React.RefObject<HTMLInputElement | null>; name: string; setName: (v: string) => void;
  icon: IconName; setIcon: (v: IconName) => void; color: CtColor; setColor: (v: CtColor) => void;
  label: string; singular: string; handleKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
}
function CtBody({ inputRef, name, setName, icon, setIcon, color, setColor, label, singular, handleKeyDown }: CtBodyProps) {
  return (
    <div className="sheet-body">
      <label className="field-label">Name</label>
      <div className="fr-field" style={{ marginBottom: 16 }}>
        <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Spells" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }} onKeyDown={handleKeyDown} />
      </div>
      <div className="et-row" style={{ marginBottom: 4 }}>
        <CtIconPicker icon={icon} onPick={setIcon} />
        <CtAccentPicker color={color} onPick={setColor} />
      </div>
      <CtPreview icon={icon} color={color} label={label} singular={singular} />
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CustomTypeCreatorProps {
  projectId: string;
  store: StoryBibleStore;
  onClose: () => void;
  onCreate: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CustomTypeCreator({ projectId, store, onClose, onCreate }: CustomTypeCreatorProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconName>("zap");
  const [color, setColor] = useState<CtColor>("plum");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const label = name.trim() || "Untitled";
  const singular = label.replace(/s$/, "");
  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    store.createCustomType({ projectId, name: trimmed, icon, color })
      .then(() => { onCreate(); })
      .catch((err: unknown) => { console.error("[CustomTypeCreator] createCustomType failed", err); setSaving(false); });
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onClose(); }
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="plus" className="ic" /> New entity type</div>
            <div className="sheet-sub">Make your own — Spells, Ships, Timelines. It behaves like the built-ins.</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <CtBody inputRef={inputRef} name={name} setName={setName} icon={icon} setIcon={setIcon}
          color={color} setColor={setColor} label={label} singular={singular} handleKeyDown={handleKeyDown} />
        <div className="sheet-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={!name.trim() || saving} onClick={handleCreate}>
            <Icon name="check" className="ic" /> Create type
          </button>
        </div>
      </div>
    </div>
  );
}
