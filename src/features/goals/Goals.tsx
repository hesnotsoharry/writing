export function Goals({ onClose }: { onClose: () => void }) {
  return (
    <div className="scrim">
      <div className="sheet">
        <p>Goals (coming soon)</p>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
