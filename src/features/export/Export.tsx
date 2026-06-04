export function Export({ onClose }: { onClose: () => void }) {
  return (
    <div className="scrim">
      <div className="sheet">
        <p>Export (coming soon)</p>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
