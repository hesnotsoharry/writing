import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import {
  BaseDirectory,
  mkdir,
  readFile,
  remove,
  writeFile,
} from "@tauri-apps/plugin-fs";

// ── Pure helpers (unit-testable, no Tauri runtime needed) ──────────────────

/**
 * Returns the relative portrait path for an entity.
 * Shape: `portraits/{entityId}.{ext}` where ext is the lowercased extension
 * of sourcePath (no leading dot), defaulting to "jpg" when none found.
 */
export function portraitRelPath(entityId: string, sourcePath: string): string {
  const dot = sourcePath.lastIndexOf(".");
  const raw = dot >= 0 ? sourcePath.slice(dot + 1) : "";
  const ext = raw.toLowerCase() || "jpg";
  return `portraits/${entityId}.${ext}`;
}

/**
 * Normalises an absolute directory path for use in asset:// URLs on Windows.
 * Converts backslashes to forward slashes and strips any trailing slash.
 * This prevents the 404 that occurs when appDataDir() returns a trailing
 * backslash on Windows (the Windows trailing-slash gotcha from the research
 * sidecar — confirm on first real Windows run post-merge, Cole).
 */
export function normalizeAssetDir(dir: string): string {
  return dir.replace(/\\/g, "/").replace(/\/$/, "");
}

// ── I/O functions (thin wrappers over Tauri plugins — untestable in-lane) ──

/**
 * Opens a native file picker filtered to image types.
 * On selection: ensures the portraits directory exists, copies the chosen
 * file into $APPDATA/portraits/{entityId}.{ext}, and returns the absolute
 * path suitable for storage in portrait_path.
 * Returns null when the user cancels.
 */
export async function pickAndSavePortrait(
  entityId: string,
): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "gif"],
      },
    ],
  });

  if (selected === null) return null;

  const relPath = portraitRelPath(entityId, selected);

  await mkdir("portraits", {
    baseDir: BaseDirectory.AppData,
    recursive: true,
  });

  const bytes = await readFile(selected);
  await writeFile(relPath, bytes, { baseDir: BaseDirectory.AppData });

  const dataDir = await appDataDir();
  return `${normalizeAssetDir(dataDir)}/${relPath}`;
}

/**
 * Deletes the portrait file at absPath.
 * Swallows not-found errors — if the file is already gone that is not an
 * error condition (e.g. manual deletion between sessions).
 */
export async function deletePortraitFile(absPath: string): Promise<void> {
  try {
    await remove(absPath);
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : String(err);
    // "not found" variants differ by OS; treat any not-found as a no-op.
    const isNotFound =
      msg.includes("os error 2") ||
      msg.toLowerCase().includes("not found") ||
      msg.toLowerCase().includes("no such file");
    if (!isNotFound) throw err;
  }
}

/**
 * Converts an absolute portrait path to an asset:// URL the WebView can
 * display. Returns null if absPath is null (entity has no portrait).
 */
export function toDisplaySrc(absPath: string | null): string | null {
  if (absPath === null) return null;
  return convertFileSrc(absPath);
}
