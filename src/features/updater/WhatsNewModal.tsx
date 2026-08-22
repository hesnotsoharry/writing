/**
 * WhatsNewModal — release notes for the current version, shown once after an
 * update (see useWhatsNew) or on demand from Settings ▸ About. Reuses
 * UpdateModal's ReleaseNotes rendering and .scrim/.sheet/.btn styling.
 */
import { createPortal } from "react-dom";

import { Icon } from "../../components/Icon";
import { ReleaseNotes } from "./UpdateModal";

export interface WhatsNewModalProps {
  version: string;
  /** Section text, or null to show a graceful fallback (e.g. Settings' on-demand path). */
  notes: string | null;
  onClose: () => void;
}

export function WhatsNewModal({ version, notes, onClose }: WhatsNewModalProps) {
  return createPortal(
    <div className="scrim" onClick={onClose}>
      <div className="sheet upd-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <Icon name="feather" style={{ width: 22, height: 22, color: "var(--accent)", flexShrink: 0 }} />
          <div>
            <div className="sheet-title">{`What's new in ${version}`}</div>
          </div>
        </div>
        {notes !== null
          ? <ReleaseNotes text={notes} />
          : <div className="upd-body"><p className="upd-note">No release notes for this version.</p></div>}
        <div className="sheet-foot">
          <button className="btn btn-primary" onClick={onClose}>Nice</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
