/**
 * BinderFooter — quick-notes and archived counts footer strip.
 *
 * Extracted from Binder.tsx (Phase 3) to keep Binder.tsx under the 300-line
 * ESLint max-lines limit. Consumes CSS classes defined in binder.css:
 * .binder-foot, .foot-btn, .ic, .badge — all pre-existing.
 */
import { Icon } from "../components/Icon";

interface BinderFooterProps {
  quickCount?: number;
  archivedCount?: number;
  onOpenQuickNotes?: () => void;
  onOpenArchive?: () => void;
}

export function BinderFooter({
  quickCount,
  archivedCount,
  onOpenQuickNotes,
  onOpenArchive,
}: BinderFooterProps) {
  return (
    <div className="binder-foot">
      <button className="foot-btn" onClick={() => onOpenQuickNotes?.()}>
        <Icon name="inbox" className="ic" /> Quick notes
        {quickCount != null && quickCount > 0 && (
          <span className="badge">{quickCount}</span>
        )}
      </button>
      {archivedCount != null && archivedCount > 0 && (
        <button className="foot-btn" onClick={() => onOpenArchive?.()}>
          <Icon name="square" className="ic" /> Archived
          <span className="badge" style={{ background: "var(--ink-4)" }}>
            {archivedCount}
          </span>
        </button>
      )}
    </div>
  );
}
