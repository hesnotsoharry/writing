import { describe, expect, it } from "vitest";

import { DEF_FIELDS, DEF_SECTIONS, mergeFacts } from "../../shared/fullEntryDefs";
import type { CustomEntityType, EntityField } from "../../shared/storyBibleStore";
import { TYPE } from "../../theme/typography";
import { buildEntryModel } from "./typeModel";

const BUILTINS = ["character", "location", "item", "faction", "lore", "theme"];
const CUSTOM: CustomEntityType = {
  id: "type-vessel", projectId: "p1", name: "Vessel", icon: "pin", color: "sea",
  fieldsJson: JSON.stringify([{ key: "class", label: "Class" }, { key: "captain", label: "Captain" }]),
  sectionsJson: JSON.stringify([
    { key: "description", icon: "archive", label: "Description" },
    { key: "history", icon: "clock", label: "History" },
  ]),
};

describe("buildEntryModel", () => {
  it("drives all six built-ins through the same ordered schema path", () => {
    for (const type of BUILTINS) {
      const model = buildEntryModel(type, [], null, []);
      expect(model.facts.map((fact) => fact.label)).toEqual(DEF_FIELDS[type]);
      expect(model.sections.map((section) => section.label)).toEqual(DEF_SECTIONS[type].map((section) => section.label));
    }
  });

  it("uses the same path for a custom type definition", () => {
    const model = buildEntryModel(CUSTOM.id, [], null, [CUSTOM]);
    expect(model.facts.map((fact) => fact.label)).toEqual(["Class", "Captain"]);
    expect(model.sections.map((section) => section.label)).toEqual(["Description", "History"]);
  });
});

describe("mergeFacts integration", () => {
  it("merges stored defaults and preserves a sorted custom field", () => {
    const stored: EntityField[] = [
      { id: "age", entityId: "e1", kind: "fact", key: "Age", value: "34", sort: 4 },
      { id: "eyes", entityId: "e1", kind: "fact", key: "Eye colour", value: "Grey", sort: 2 },
    ];
    const facts = mergeFacts("character", stored);
    expect(facts.map(({ label, value }) => [label, value])).toEqual([
      ["Age", "34"], ["Occupation", ""], ["Status", ""], ["First appears", ""], ["Eye colour", "Grey"],
    ]);
    expect(facts.at(-1)?.isDefault).toBe(false);
  });
});

describe("mobile fact-grid contract", () => {
  it("keeps the non-wrapping 2x2 grid label size at 9.5px", () => {
    expect(TYPE.factLabel.fontSize).toBe(9.5);
    expect(DEF_FIELDS.character).toHaveLength(4);
    expect(DEF_FIELDS.location).toHaveLength(4);
  });
});
