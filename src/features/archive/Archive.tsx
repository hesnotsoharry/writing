export function Archive({ onClose }: { onClose: () => void }) {
  return (
    <div className="scrim">
      <div className="sheet">
        <p>Archive (coming soon)</p>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
