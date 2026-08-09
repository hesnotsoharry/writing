import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the portable boundary.
 *
 * Mobile reuses desktop logic through `@writersnook/*` -> `../src/*`. Some
 * desktop modules reach platform singletons — the Tauri SQL plugin, the
 * keyring, the updater — and importing one of those from React Native breaks
 * the app. It broke it once: `src/sync/bible/bibleLocalBridge.ts` imported
 * `db/schema` at module scope, and the whole Metro bundle became unresolvable
 * with "Unable to resolve @tauri-apps/plugin-sql".
 *
 * Every other gate was green when that shipped. TypeScript resolves the import
 * because the types exist; vitest runs in Node where the package is installed;
 * eslint has no opinion about which platform a module may reach. The failure
 * appears only when bundling for a device.
 *
 * So this test walks the real import graph from the mobile entry point and
 * fails if any reachable module imports a forbidden package. It is a cheap
 * stand-in for a bundle, and unlike a bundle it runs in CI in under a second.
 */

const MOBILE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(MOBILE_ROOT, "..", "..");
const DESKTOP_SRC = path.join(REPO_ROOT, "src");

/** Packages that exist only on the desktop shell. */
const FORBIDDEN = [
  "@tauri-apps/api",
  "@tauri-apps/plugin-sql",
  "@tauri-apps/plugin-updater",
  "@tauri-apps/plugin-opener",
  "@tauri-apps/plugin-dialog",
  "@tauri-apps/plugin-fs",
];

const ENTRY_POINTS = [
  path.join(MOBILE_ROOT, "App.tsx"),
  path.join(MOBILE_ROOT, "sync", "mobileEngine.ts"),
  path.join(MOBILE_ROOT, "db", "stores.ts"),
];

/**
 * Value imports only. `import type` / `export type` are erased before the
 * bundler ever sees them, so a type-only reference to a Tauri-bound module is
 * harmless — `src/sync/engine.ts` legitimately does exactly that for
 * `AppliedEpochs`. Counting those would make this guard cry wolf on correct
 * code, and a guard that cries wolf gets deleted.
 */
const IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:[^;'"]*?\sfrom\s*)?["']([^"']+)["']/g;
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx", ".js"];

function resolveSpecifier(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@writersnook/")) {
    base = path.join(DESKTOP_SRC, specifier.slice("@writersnook/".length));
  } else if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null; // A bare package — checked separately against FORBIDDEN.
  }
  for (const extension of EXTENSIONS) {
    const candidate = base.endsWith(".ts") || base.endsWith(".tsx") ? base : `${base}${extension}`;
    try {
      readFileSync(candidate, "utf8");
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

interface Violation { file: string; specifier: string; via: string[] }

function walk(entries: readonly string[] = ENTRY_POINTS): Violation[] {
  const seen = new Set<string>();
  const violations: Violation[] = [];
  const queue: Array<{ file: string; trail: string[] }> = entries
    .map((file) => ({ file, trail: [file] }));

  while (queue.length > 0) {
    const { file, trail } = queue.shift() as { file: string; trail: string[] };
    if (seen.has(file)) continue;
    seen.add(file);

    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    for (const match of source.matchAll(IMPORT_RE)) {
      const specifier = match[1];
      if (FORBIDDEN.some((pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`))) {
        violations.push({ file, specifier, via: trail });
        continue;
      }
      const resolved = resolveSpecifier(specifier, file);
      if (resolved !== null) queue.push({ file: resolved, trail: [...trail, resolved] });
    }
  }
  return violations;
}

describe("portable boundary", () => {
  it("no module reachable from the mobile entry points imports a desktop-only package", () => {
    const violations = walk();
    const report = violations
      .map((v) => `${path.relative(REPO_ROOT, v.file)} imports ${v.specifier}\n  via ${
        v.via.map((f) => path.relative(REPO_ROOT, f)).join("\n   -> ")}`)
      .join("\n\n");
    expect(report).toBe("");
  });

  it("actually traverses the desktop tree through the @writersnook alias", () => {
    // A guard on the guard: if resolution silently stopped working, the test
    // above would pass vacuously. mobileEngine reaches desktop sync code.
    const resolved = resolveSpecifier("@writersnook/sync/engine", ENTRY_POINTS[1]);
    expect(resolved).not.toBeNull();
  });

  it("detects a real violation — negative control", () => {
    // Walking from a genuinely desktop-bound module must report the Tauri
    // import. Without this, a broken matcher would leave the suite green and
    // the boundary unguarded, which is the exact failure mode being prevented.
    const desktopOnly = path.join(DESKTOP_SRC, "sync", "bible", "desktopBibleBridge.ts");
    const violations = walk([desktopOnly]);
    expect(violations.map((v) => v.specifier)).toContain("@tauri-apps/plugin-sql");
  });
});
