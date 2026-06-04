export function QuickCapture({ onClose }: { onClose: () => void }) {
  return (
    <div className="scrim">
      <div className="sheet">
        <p>Quick Capture (coming soon)</p>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
