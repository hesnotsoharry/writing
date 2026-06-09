import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

import type { SaveCallback } from "./types";

/**
 * Native Tauri save: shows the OS save-file dialog, then writes the bytes via
 * the `write_export_file` Rust command.  The Rust side takes `Vec<u8>`, so we
 * convert strings with TextEncoder and Uint8Arrays with Array.from().
 */
export const tauriSave: SaveCallback = async (
  suggestedFilename: string,
  data: string | Uint8Array
): Promise<void> => {
  const path = await save({ defaultPath: suggestedFilename });
  if (!path) return; // user cancelled
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
  await invoke("write_export_file", { path, contents: Array.from(bytes) });
};
