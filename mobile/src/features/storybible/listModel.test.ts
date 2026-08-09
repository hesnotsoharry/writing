import { describe, expect, it } from "vitest";

import type { CustomEntityType } from "../../shared/storyBibleStore";
import type { BibleListRow } from "./listModel";
import { buildBibleFilters, groupBibleEntries } from "./listModel";

const CUSTOM: CustomEntityType = {
  id: "vessel", projectId: "p", name: "Vessel", icon: "pin", color: "sea", fieldsJson: "[]", sectionsJson: "[]",
};
const ENTRIES: BibleListRow[] = [
  { id: "c", projectId: "p", type: "character", name: "Maren", notes: "Maps tides", aliases: null, role: "Cartographer" },
  { id: "l", projectId: "p", type: "location", name: "Hallow Quay", notes: null, aliases: null, role: "Harbour" },
  { id: "v", projectId: "p", type: "vessel", name: "Kittiwake", notes: null, aliases: null, role: "Cutter" },
  { id: "v2", projectId: "p", type: "vessel", name: "North Star", notes: null, aliases: null, role: "Barque" },
];

describe("Bible list model", () => {
  it("groups and counts built-in and custom types", () => {
    expect(buildBibleFilters(ENTRIES, [CUSTOM]).map(({ label, count }) => [label, count])).toEqual([
      ["All", 4], ["Character", 1], ["Location", 1], ["Vessel", 2],
    ]);
    expect(groupBibleEntries(ENTRIES, [CUSTOM]).map((group) => [group.type.label, group.entries.length])).toEqual([
      ["Character", 1], ["Location", 1], ["Vessel", 2],
    ]);
  });

  it("filters on type and searches role and notes", () => {
    expect(groupBibleEntries(ENTRIES, [CUSTOM], "maps", "all")[0].entries[0].id).toBe("c");
    expect(groupBibleEntries(ENTRIES, [CUSTOM], "", "vessel")[0].entries.map((entry) => entry.id)).toEqual(["v", "v2"]);
  });
});
