/**
 * HistoryRail — compact inspector section showing the last 3 snapshots.
 * Direction A from the spec: lives in the editor inspector as an `.insp-group`.
 *
 * Renders:
 *   - The 3 most recent snapshot rows (each shows kind glyph, label, timestamp, word count)
 *   - "＋" button in the group header to take a snapshot
 *   - "See all & compare" / "Open version history" link button
 *
 * Canon: design-reference/snapshots.jsx HistorySection + SNAPSHOTS-SPEC.md.
 */
import { Icon } from "../components/Icon";
import type { Snapshot } from "../db/snapshotStore";
import { InspGroup } from "./InspGroup";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatWhen(createdAt: number): string {
  const diff = Date.now() - createdAt;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(createdAt).toLocaleDateString();
}

// ── Compact snap row (rail only) ─────────────────────────────────────────────

interface RailSnapRowProps { snapshot: Snapshot; currentWords: number; onClick: () => void; }

function RailSnapRow({ snapshot, currentWords, onClick }: RailSnapRowProps) {
  const delta = snapshot.wordCount - currentWords;
  return (
    <button className="snap-row" onClick={onClick}>
      <div className="snap-top">
        <span className={"snap-kind" + (snapshot.kind === "auto" ? " auto" : "")}>
          <Icon name={snapshot.kind === "auto" ? "rotate" : "check"} className="ic" />
        </span>
        <span className={"snap-label" + (snapshot.label ? "" : " untitled")}>
          {snapshot.label ?? "Auto-save"}
        </span>
      </div>
      <div className="snap-meta">
        <span>{formatWhen(snapshot.createdAt)}</span>
        <span>·</span>
        <span>{snapshot.wordCount.toLocaleString()}w</span>
        {delta !== 0 && (
          <span className="snap-delta">
            {delta > 0 ? <span className="up">+{delta}</span> : <span className="dn">{delta}</span>}
            {" "}vs now
          </span>
        )}
      </div>
    </button>
  );
}

// ── HistoryRail ───────────────────────────────────────────────────────────────

export interface HistoryRailProps {
  snapshots: Snapshot[];
  currentWords: number;
  onOpenAll?: () => void;
  onCapture?: () => void;
}

export function HistoryRail({
  snapshots,
  currentWords,
  onOpenAll,
  onCapture,
}: HistoryRailProps) {
  const recent = snapshots.slice(0, 3);
  const captureAction = (
    <button className="add" title="Take snapshot" onClick={onCapture}>
      <Icon name="camera" style={{ width: 14, height: 14 }} />
    </button>
  );
  return (
    <InspGroup gkey="history" icon="rotate" label="History" action={captureAction}>
      {recent.length > 0 ? (
        recent.map((s) => (
          <RailSnapRow
            key={s.id}
            snapshot={s}
            currentWords={currentWords}
            onClick={() => onOpenAll?.()}
          />
        ))
      ) : (
        <div className="empty-hint">
          No versions yet. Take a snapshot before a big change.
        </div>
      )}
      <button className="add-entity" onClick={onOpenAll}>
        <Icon name="rotate" style={{ width: 13, height: 13 }} />{" "}
        {recent.length > 0 ? "See all & compare" : "Open version history"}
      </button>
    </InspGroup>
  );
}
