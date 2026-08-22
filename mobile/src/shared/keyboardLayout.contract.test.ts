import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

const MOBILE_SOURCE = path.resolve(__dirname, "..");
const APP = path.resolve(MOBILE_SOURCE, "App.tsx");
const ASSISTANT_SCREEN = path.resolve(MOBILE_SOURCE, "features", "ai", "AiAssistantScreen.tsx");
const FORMAT_BAR = path.resolve(MOBILE_SOURCE, "features", "editor", "keyboardFormatBar.tsx");
const FOCUS_HUD = path.resolve(MOBILE_SOURCE, "features", "focus", "FocusHud.tsx");
const SCREEN = path.resolve(MOBILE_SOURCE, "components", "Screen.tsx");
const BIBLE_ENTRY = path.resolve(MOBILE_SOURCE, "features", "storybible", "BibleEntryScreen.tsx");
const PAIR_SCREEN = path.resolve(MOBILE_SOURCE, "features", "pairing", "PairScreen.tsx");
const ACTIVATION_SCREEN = path.resolve(MOBILE_SOURCE, "features", "license", "ActivationScreen.tsx");

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(entryPath);
    return /(?<!\.test)\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

function legacyKeyboardImports(source: string): boolean {
  const imports = source.match(/import\s+[^;]*?\s+from\s+["'][^"']+["'];?/g) ?? [];
  return imports.some((statement) => /\buseAnimatedKeyboard\b/.test(statement));
}

it("installs KeyboardProvider inside the app's SafeAreaProvider", () => {
  const app = readFileSync(APP, "utf8");

  expect(app).toMatch(/import\s+\{[^}]*\bKeyboardProvider\b[^}]*\}\s+from\s+["']react-native-keyboard-controller["']/);
  expect(app).toMatch(/<SafeAreaProvider>\s*[\s\S]*?<KeyboardProvider(?:\s[^>]*)?>/);
});

it("removes the diagnostic footer from keyboard-open layout", () => {
  const app = readFileSync(APP, "utf8");

  expect(app).toMatch(/useKeyboardState\(\(state\) => state\.isVisible\)/);
  expect(app).toMatch(/\{!keyboardVisible && <DevFooter\b/);
});

it("does not import the legacy per-mount keyboard hook in production source", () => {
  const legacyImports = productionSourceFiles(MOBILE_SOURCE)
    .filter((file) => legacyKeyboardImports(readFileSync(file, "utf8")))
    .map((file) => path.relative(MOBILE_SOURCE, file));

  expect(legacyImports).toEqual([]);
});

it("keeps the controller shared-height signs for the editor and Focus HUD", () => {
  const formatBar = readFileSync(FORMAT_BAR, "utf8");
  const focusHud = readFileSync(FOCUS_HUD, "utf8");

  expect(formatBar).toMatch(/useReanimatedKeyboardAnimation\(\)/);
  expect(formatBar).toMatch(/translateY:\s*keyboard\.height\.value/);
  expect(formatBar).toMatch(/height:\s*-keyboard\.height\.value/);
  expect(focusHud).toMatch(/useReanimatedKeyboardAnimation\(\)/);
  expect(focusHud).toMatch(/translateY:\s*keyboard\.height\.value\s*-\s*bottomInset/);
});

it("keeps the assistant verb chips and composer in KeyboardStickyView", () => {
  const assistant = readFileSync(ASSISTANT_SCREEN, "utf8");

  expect(assistant).toMatch(/import\s+\{[^}]*\bKeyboardStickyView\b[^}]*\}\s+from\s+["']react-native-keyboard-controller["']/);
  expect(assistant).toMatch(/<KeyboardStickyView(?:\s[^>]*)?>[\s\S]*?<VerbChips\b[\s\S]*?<Composer\b[\s\S]*?<\/KeyboardStickyView>/);
});

it("scrolls Screen with the keyboard-aware scroll view, keeping the safe-area edges", () => {
  const screen = readFileSync(SCREEN, "utf8");

  expect(screen).toMatch(/import\s+\{[^}]*\bKeyboardAwareScrollView\b[^}]*\}\s+from\s+["']react-native-keyboard-controller["']/);
  expect(screen).toMatch(/<KeyboardAwareScrollView[\s\S]*?keyboardShouldPersistTaps="handled"/);
  // The scroll branch must not fall back to a plain ScrollView — it cannot lift a
  // focused input clear of the software keyboard.
  expect(screen).not.toMatch(/<ScrollView\b/);
  // Regression guard for the double-counted bottom inset: the app root owns it.
  expect(screen).toMatch(/const EDGES = \["top", "left", "right"\] as const;/);
  expect(screen.match(/edges=\{EDGES\}/g)).toHaveLength(2);
});

it("keeps the story-bible entry's own scroll container keyboard-aware", () => {
  const entry = readFileSync(BIBLE_ENTRY, "utf8");

  expect(entry).toMatch(/import\s+\{[^}]*\bKeyboardAwareScrollView\b[^}]*\}\s+from\s+["']react-native-keyboard-controller["']/);
  expect(entry).toMatch(/<KeyboardAwareScrollView[\s\S]*?keyboardShouldPersistTaps="handled"/);
  expect(entry).not.toMatch(/<ScrollView\b/);
});

it("scrolls the pairing and activation inputs clear of the keyboard", () => {
  const pair = readFileSync(PAIR_SCREEN, "utf8");
  const activation = readFileSync(ACTIVATION_SCREEN, "utf8");

  // Manual pairing is the branch that holds the TextInput; the camera branch has none.
  expect(pair).toMatch(/<Screen scroll\b/);
  expect(activation).toMatch(/<Screen scroll\b/);
});
