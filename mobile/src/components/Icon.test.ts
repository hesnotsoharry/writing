import { describe, expect, it, vi } from "vitest";

vi.mock("react-native-svg", () => ({ SvgXml: () => null }));
vi.mock("../theme/ThemeProvider", () => ({
  useTheme: () => ({ colors: { ink: "ink" } }),
}));

import { getIconElements, ICON_PATHS, type IconName } from "./Icon";

const DESKTOP_ICON_NAMES = [
  "feather", "minus", "square", "x", "chevDown", "chevUp", "chevRight", "chevLeft",
  "plus", "edit", "grid", "book", "users", "user", "pin", "mapPin", "zap", "download",
  "target", "focus", "inbox", "clock", "type", "bold", "italic", "quote", "heading", "list",
  "search", "cloud", "calendar", "flame", "fileText", "copy", "hash", "trash", "archive",
  "rotate", "cog", "palette", "info", "folder", "command", "check", "arrowRight", "sun",
  "sparkle", "send", "shield", "shieldOff", "cloudOff", "moon", "camera", "circleOpen",
  "pencil", "moreH", "box", "flag", "globe", "link",
] as const;

describe("ICON_PATHS", () => {
  it("resolves every registered icon to elements", () => {
    for (const name of Object.keys(ICON_PATHS) as IconName[]) {
      expect(getIconElements(name), name).not.toHaveLength(0);
    }
  });

  it("is a superset of the desktop registry", () => {
    expect(DESKTOP_ICON_NAMES.every((name) => name in ICON_PATHS)).toBe(true);
  });
});
