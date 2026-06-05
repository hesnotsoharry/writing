/**
 * LabelManager — overlay for managing color labels.
 *
 * Allows renaming and recoloring existing labels, and adding new ones.
 * Uses the curated 8-hue palette from tokens.css (`--label-*`).
 * Mounted as a portal via .scrim/.sheet pattern (same as VersionHistory).
 *
 * Constraints honored:
 * - No setState in useEffect — the rename input is contentEditable with onBlur commit.
 * - No `any` types.
 * - Reuses Icon primitive.
 * - Curated palette only — no free color picker.
 */
import { createPortal } from "react-dom";

import { Icon } from "../../components/Icon";
import type { Label, LabelColor } from "../../db/labelStore";

const OTL_PALETTE: LabelColor[] = ["clay", "sea", "moss", "plum", "gold", "slate", "rose", "ink"];

function solidVar(color: LabelColor): string {
  return `var(--label-${color})`;
}

export interface LabelManagerProps {
  labels: Label[];
  onClose: () => void;
  onRename: (id: string, name: string) => void;
  onColor: (id: string, color: LabelColor) => void;
  onAdd: () => void;
  onDelete?: (id: string) => void;
}

interface LabelRowProps {
  label: Label;
  onRename: (id: string, name: string) => void;
  onColor: (id: string, color: LabelColor) => void;
  onDelete?: (id: string) => void;
}

function LabelRow({ label: l, onRename, onColor, onDelete }: LabelRowProps) {
  return (
    <div className="lblmgr-row" key={l.id}>
      <span className="lbl-dot" style={{ background: solidVar(l.color), width: 11, height: 11 }} />
      {/* contentEditable rename — commits on blur, no setState in effect */}
      <div
        className="lblmgr-name"
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          const text = e.currentTarget.textContent?.trim();
          onRename(l.id, text || l.name);
        }}
      >
        {l.name}
      </div>
      <div className="lblmgr-swatches">
        {OTL_PALETTE.map((c) => (
          <button
            key={c}
            className={"sw-btn" + (l.color === c ? " on" : "")}
            title={c}
            style={{ background: solidVar(c) }}
            onClick={() => onColor(l.id, c)}
          />
        ))}
      </div>
      {onDelete && (
        <button
          className="iconbtn"
          title="Delete label"
          style={{ color: "var(--danger)", flexShrink: 0 }}
          onClick={() => onDelete(l.id)}
        >
          <Icon name="trash" style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );
}

function LabelManagerFoot({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet-foot">
      <span className="lblmgr-foot-hint">
        <Icon name="palette" style={{ width: 13, height: 13 }} />
        Colours come from the app palette — labels always feel on-brand.
      </span>
      <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onClose}>
        Done
      </button>
    </div>
  );
}

export function LabelManager({ labels, onClose, onRename, onColor, onAdd, onDelete }: LabelManagerProps) {
  return createPortal(
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title">
              <Icon name="palette" className="ic" /> Labels
            </div>
            <div className="sheet-sub">
              A small, curated set — rename and recolour to keep the manuscript cohesive.
            </div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}>
            <Icon name="x" className="ic" />
          </button>
        </div>
        <div className="sheet-body">
          {labels.map((l) => (
            <LabelRow key={l.id} label={l} onRename={onRename} onColor={onColor} onDelete={onDelete} />
          ))}
          <button
            className="add-entity"
            style={{ justifyContent: "center", border: "1px dashed var(--parchment-edge)", padding: 10, marginTop: 8 }}
            onClick={onAdd}
          >
            <Icon name="plus" style={{ width: 13, height: 13 }} /> New label
          </button>
        </div>
        <LabelManagerFoot onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}
