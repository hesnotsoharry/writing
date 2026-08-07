import { renderSVG } from "uqr";

interface SyncQrProps {
  /** The full `writersnook://pair?...` payload — carries the raw sync master
   *  key. Callers must never log this value (see src/sync/keys.ts). */
  payload: string;
}

/** Renders the pairing payload as an inline SVG QR code. `uqr` does the
 *  actual encoding/masking/error-correction; this just injects its SVG
 *  markup, matching the existing `Icon` component's SVG-string pattern. */
export function SyncQr({ payload }: SyncQrProps) {
  const svg = renderSVG(payload, { ecc: "M", border: 2 });
  return (
    <div
      className="sync-qr"
      role="img"
      aria-label="QR code — scan with your other device to pair"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
