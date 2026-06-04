import type { ExportData, SaveCallback } from "./types";

function createBlobUrl(data: ExportData, mime: string): string {
  const blobParts: BlobPart[] = [data instanceof Uint8Array ? data : data];
  return URL.createObjectURL(new Blob(blobParts, { type: mime }));
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * In-lane save fallback: Blob URL + programmatic anchor click.
 * Works in jsdom (tests) and Tauri v2 webview (wry ≥0.53).
 * Guard: no-op when document is unavailable (SSR / pure-Node contexts).
 */
export const blobDownloadSave: SaveCallback = async (
  suggestedFilename: string,
  data: ExportData,
  mime: string
): Promise<void> => {
  if (typeof document === "undefined") return;
  const url = createBlobUrl(data, mime);
  try {
    triggerDownload(url, suggestedFilename);
  } finally {
    URL.revokeObjectURL(url);
  }
};
