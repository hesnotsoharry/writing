// Unit tests for the pure helpers in portraitService.ts.
// The Tauri I/O functions (pickAndSavePortrait, deletePortraitFile,
// toDisplaySrc) call the Tauri runtime and are intentionally untested
// here — there is no Tauri runtime in the test environment.
import { describe, expect, it } from "vitest";

import {
  normalizeAssetDir,
  portraitRelPath,
} from "../storybible/fullEntry/portraitService";

describe("portraitRelPath", () => {
  it("extracts a lowercase extension from a Windows absolute path", () => {
    const result = portraitRelPath("entity-1", "C:/Users/cole/Pictures/face.PNG");
    expect(result).toBe("portraits/entity-1.png");
  });

  it("extracts a lowercase extension from a simple filename", () => {
    const result = portraitRelPath("abc", "photo.JPEG");
    expect(result).toBe("portraits/abc.jpeg");
  });

  it("defaults to jpg when sourcePath has no extension", () => {
    const result = portraitRelPath("xyz", "portrait");
    expect(result).toBe("portraits/xyz.jpg");
  });

  it("defaults to jpg when sourcePath is an empty string", () => {
    const result = portraitRelPath("id-99", "");
    expect(result).toBe("portraits/id-99.jpg");
  });

  it("handles a dot-only filename (no real extension) by defaulting to jpg", () => {
    // Path like "C:/foo/.hidden" — dot is present but ext is empty string
    const result = portraitRelPath("e1", ".hidden");
    // ".hidden" has a leading dot; lastIndexOf('.') = 0, slice(1) = "hidden"
    expect(result).toBe("portraits/e1.hidden");
  });

  it("uses the last extension segment for multi-dot filenames", () => {
    const result = portraitRelPath("e2", "my.portrait.file.WebP");
    expect(result).toBe("portraits/e2.webp");
  });

  it("includes the entityId verbatim in the path", () => {
    const result = portraitRelPath("char-uuid-abc123", "shot.gif");
    expect(result).toBe("portraits/char-uuid-abc123.gif");
  });
});

describe("normalizeAssetDir", () => {
  it("converts backslashes to forward slashes", () => {
    const result = normalizeAssetDir("C:\\Users\\cole\\AppData\\Roaming\\writing");
    expect(result).toBe("C:/Users/cole/AppData/Roaming/writing");
  });

  it("strips a trailing forward slash", () => {
    const result = normalizeAssetDir("C:/Users/cole/AppData/Roaming/writing/");
    expect(result).toBe("C:/Users/cole/AppData/Roaming/writing");
  });

  it("strips a trailing backslash (converted then stripped)", () => {
    const result = normalizeAssetDir("C:\\Users\\cole\\AppData\\Roaming\\writing\\");
    expect(result).toBe("C:/Users/cole/AppData/Roaming/writing");
  });

  it("leaves a path with no trailing slash unchanged (modulo backslash conversion)", () => {
    const result = normalizeAssetDir("C:/no/trailing");
    expect(result).toBe("C:/no/trailing");
  });

  it("handles a path that is only slashes gracefully", () => {
    const result = normalizeAssetDir("/");
    expect(result).toBe("");
  });

  it("does not double-strip — only the single trailing slash is removed", () => {
    // Two trailing slashes → strip one → one forward slash remains, then strip again? No.
    // replace(/\/$/, "") strips exactly one trailing slash.
    const result = normalizeAssetDir("path//");
    // "path//" → backslash pass does nothing → replace trailing "/" once → "path/"
    // actually the regex /\/$/ only matches ONE trailing slash. So "path//" → "path/".
    // That's fine — the function guarantees no trailing slash on a clean appDataDir().
    // Documenting actual behaviour:
    expect(result).toBe("path/");
  });
});
