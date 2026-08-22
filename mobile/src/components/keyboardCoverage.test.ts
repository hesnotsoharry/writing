import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every text input must sit in a container that lifts it clear of the keyboard.
 *
 * There is no platform magic that does this for you. Android resizes the window
 * (`softwareKeyboardLayoutMode: "resize"` in app.json) and iOS just overlays and
 * reports a frame — in both cases the app still has to move the focused input,
 * and an input in the bottom half of a non-scrolling screen simply stays hidden
 * under the keyboard. So the app has exactly four sanctioned containers, and
 * this test asserts every input is in one of them.
 *
 * It is an inventory, deliberately: a new input-bearing file fails until it is
 * listed here with its container, which forces the decision to be made once
 * rather than discovered on a phone.
 */
const SRC = path.resolve(__dirname, "..");
/** The two input primitives live here and are asserted by the second block
 *  below, not by the inventory — they have no container of their own; they
 *  adapt to whichever one they are dropped into. */
const PRIMITIVES = path.join(SRC, "components");

type Container =
  | "screen-scroll"     // <Screen scroll> — the default for a form
  | "keyboard-aware"    // KeyboardAwareScrollView — a screen with its own scroller
  | "keyboard-sticky"   // KeyboardStickyView — a composer docked to the bottom
  | "sheet"             // <Sheet> — handled centrally, see Sheet.tsx
  | "top-anchored";     // pinned to the top, the keyboard opens below it

interface Entry { file: string; host?: string; container: Container; why?: string }

const MARKERS: Record<Container, string | null> = {
  "screen-scroll": "<Screen scroll",
  "keyboard-aware": "KeyboardAwareScrollView",
  "keyboard-sticky": "KeyboardStickyView",
  sheet: "Sheet",
  "top-anchored": null,
};

const INVENTORY: Entry[] = [
  { file: "features/ai/AiAssistantScreen.tsx", container: "keyboard-sticky" },
  { file: "features/binder/CreatePromptSheet.tsx", container: "sheet" },
  { file: "features/binder/SceneActionsSheet.tsx", container: "sheet" },
  { file: "features/corkboard/CorkCard.tsx", host: "features/corkboard/index.tsx",
    container: "keyboard-aware" },
  { file: "features/editor/InspectorSheet.tsx", container: "sheet" },
  { file: "features/goals/NewGoalScreen.tsx", container: "keyboard-aware" },
  { file: "features/inbox/InboxScreen.tsx", container: "keyboard-sticky" },
  { file: "features/license/ActivationScreen.tsx", container: "screen-scroll" },
  { file: "features/outliner/OutlinerRow.tsx", host: "features/outliner/index.tsx",
    container: "keyboard-aware" },
  { file: "features/outliner/index.tsx", container: "keyboard-aware" },
  { file: "features/pairing/PairScreen.tsx", container: "screen-scroll" },
  { file: "features/search/index.tsx", container: "top-anchored",
    why: "the search field is the first row under the topbar" },
  { file: "features/snapshots/VersionHistoryScreen.tsx", container: "sheet",
    why: "the only input is RenameSheet" },
  { file: "features/storybible/BibleListScreen.tsx", container: "top-anchored",
    why: "the search field is the first row under the topbar" },
  { file: "features/storybible/BoardCardSheet.tsx", container: "sheet" },
  { file: "features/storybible/CustomTypeScreen.tsx", container: "sheet" },
  { file: "features/storybible/EntryFacts.tsx",
    host: "features/storybible/BibleEntryScreen.tsx", container: "keyboard-aware" },
  { file: "features/storybible/EntryHero.tsx",
    host: "features/storybible/BibleEntryScreen.tsx", container: "keyboard-aware" },
  { file: "features/storybible/EntryRelationships.tsx",
    host: "features/storybible/BibleEntryScreen.tsx", container: "keyboard-aware" },
  { file: "features/storybible/EntrySections.tsx",
    host: "features/storybible/BibleEntryScreen.tsx", container: "keyboard-aware" },
  { file: "features/storybible/NewEntryFields.tsx",
    host: "features/storybible/NewEntryScreen.tsx", container: "keyboard-aware" },
];

const INPUT = /<(TextField|SearchField|TextInput|BottomSheetTextInput)[\s/>]/;

function walk(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (full !== PRIMITIVES) walk(full, found);
      continue;
    }
    if (!name.endsWith(".tsx")) continue;
    if (INPUT.test(readFileSync(full, "utf8"))) {
      found.push(path.relative(SRC, full).split(path.sep).join("/"));
    }
  }
  return found;
}

describe("every text input has a keyboard-aware container", () => {
  const onDisk = walk(SRC).sort();

  it("has no input-bearing file missing from the inventory", () => {
    const known = new Set(INVENTORY.map((entry) => entry.file));
    expect(onDisk.filter((file) => !known.has(file))).toEqual([]);
  });

  it("has no stale inventory entry", () => {
    const present = new Set(onDisk);
    expect(INVENTORY.map((entry) => entry.file).filter((file) => !present.has(file))).toEqual([]);
  });

  it.each(INVENTORY.filter((entry) => MARKERS[entry.container] !== null))(
    "$file is inside a $container container",
    ({ container, file, host }) => {
      const source = readFileSync(path.join(SRC, host ?? file), "utf8");
      expect(source).toContain(MARKERS[container]);
    },
  );

  it("makes every exemption state its reason", () => {
    const exempt = INVENTORY.filter((entry) => entry.container === "top-anchored");
    expect(exempt.every((entry) => Boolean(entry.why))).toBe(true);
  });
});

describe("Sheet carries the keyboard configuration for every sheet input", () => {
  const sheet = readFileSync(path.join(SRC, "components/Sheet.tsx"), "utf8");

  // Sheets are anchored to the bottom of the window, so an input in one is
  // always in the half the keyboard covers. These three are the whole fix, and
  // each replaces a library default that is wrong for this app.
  it("declares adjustResize to match the app's own window mode", () => {
    expect(sheet).toContain('android_keyboardInputMode="adjustResize"');
  });

  it("restores its position when the keyboard closes", () => {
    expect(sheet).toContain('keyboardBlurBehavior="restore"');
  });

  it("tracks the keyboard interactively", () => {
    expect(sheet).toContain('keyboardBehavior="interactive"');
  });

  it("tells inputs they are in a sheet so they can swap component", () => {
    // Without BottomSheetTextInput the sheet never learns a descendant took
    // focus and does not lift at all — the props above are not enough alone.
    expect(sheet).toContain("InSheetProvider");
    expect(readFileSync(path.join(SRC, "components/TextField.tsx"), "utf8"))
      .toContain("BottomSheetTextInput");
  });
});
