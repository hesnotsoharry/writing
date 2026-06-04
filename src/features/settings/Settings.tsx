export function Settings({ onClose }: { onClose: () => void }) {
  return (
    <div className="scrim">
      <div className="sheet">
        <p>Settings (coming soon)</p>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
