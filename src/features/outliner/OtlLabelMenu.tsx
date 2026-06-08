/**
 * OtlLabelMenu — label-assignment popover for Outliner rows.
 * Extracted from Outliner.tsx to satisfy the 300-line file limit.
 */
import { useEffect } from "react";

import { Icon } from "../../components/Icon";
import type { Label } from "../../db/labelStore";

export interface LabelMenuAt { sceneId: string; x: number; y: number; }

interface OtlLabelMenuProps {
  labels: Label[];
  active: string[];
  at: LabelMenuAt;
  onToggle: (labelId: string) => void;
  onClose: () => void;
  onManage: () => void;
}

export function OtlLabelMenu({ labels, active, at, onToggle, onClose, onManage }: OtlLabelMenuProps) {
  useEffect(() => {
    const h = () => onClose();
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div
      className="lbl-menu"
      style={{ left: at.x, top: at.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {labels.map((l) => (
        <button
          key={l.id}
          className={"lbl-menu-opt" + (active.includes(l.id) ? " on" : "")}
          onClick={() => onToggle(l.id)}
        >
          <span className="lbl-dot" style={{ background: `var(--label-${l.color})`, width: 9, height: 9 }} />
          {l.name}
          <Icon name="check" className="check" style={{ width: 15, height: 15 }} />
        </button>
      ))}
      <div className="lbl-menu-sep" />
      <button className="lbl-menu-manage" onClick={onManage}>
        <Icon name="cog" style={{ width: 14, height: 14 }} /> Manage labels…
      </button>
    </div>
  );
}
