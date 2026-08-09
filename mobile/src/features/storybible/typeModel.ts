import type { IconName } from "../../components";
import { ENTITY_TYPE_DEFS } from "../../shared/entityTypeDefs";
import {
  DEF_FIELDS,
  DEF_SECTIONS,
  type MergedFact,
  type MergedSection,
  mergeFacts,
  mergeSections,
  ROLE_KEY,
  type SectionDef,
} from "../../shared/fullEntryDefs";
import type { CustomEntityType, EntityField } from "../../shared/storyBibleStore";
import type { LabelToken } from "../../theme/tokens";

export const BUILTIN_TYPE_KEYS = Object.keys(ENTITY_TYPE_DEFS);

export interface MobileTypeDef {
  key: string;
  label: string;
  icon: IconName;
  accent: LabelToken;
  custom: boolean;
}

export interface EntryModel {
  facts: MergedFact[];
  sections: MergedSection[];
  role: string;
  type: MobileTypeDef;
}

interface CustomFieldDef { key: string; label: string }

const BUILTIN_ACCENTS: Record<string, LabelToken> = {
  character: "clay", location: "moss", item: "gold",
  faction: "plum", lore: "sea", theme: "slate",
};

function isIconName(value: string): value is IconName {
  return [
    "user", "mapPin", "box", "flag", "globe", "sparkle", "circleOpen",
    "archive", "pin", "book", "target", "zap", "command", "feather",
  ].includes(value);
}

function isLabelToken(value: string): value is LabelToken {
  return ["clay", "sea", "moss", "plum", "gold", "slate", "rose", "ink"].includes(value);
}

export function findCustomType(type: string, customTypes: CustomEntityType[]): CustomEntityType | undefined {
  return customTypes.find((item) => item.id === type || item.name === type);
}

export function resolveMobileType(type: string, customTypes: CustomEntityType[]): MobileTypeDef {
  const builtin = ENTITY_TYPE_DEFS[type];
  if (builtin) return {
    key: type, label: builtin.label, icon: isIconName(builtin.icon) ? builtin.icon : "circleOpen",
    accent: BUILTIN_ACCENTS[type] ?? "ink", custom: false,
  };
  const custom = findCustomType(type, customTypes);
  return {
    key: type, label: custom?.name ?? type,
    icon: custom && isIconName(custom.icon) ? custom.icon : "circleOpen",
    accent: custom && isLabelToken(custom.color) ? custom.color : "ink", custom: true,
  };
}

function parseArray(value: string): unknown[] {
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

function customFields(custom: CustomEntityType | undefined): string[] | undefined {
  if (!custom) return undefined;
  const fields = parseArray(custom.fieldsJson).flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const row = item as Partial<CustomFieldDef>;
    return typeof row.label === "string" ? [row.label] : typeof row.key === "string" ? [row.key] : [];
  });
  return fields.length > 0 ? fields : undefined;
}

function isSectionDef(value: unknown): value is SectionDef {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Partial<SectionDef>;
  return typeof row.key === "string" && typeof row.label === "string" && typeof row.icon === "string";
}

function customSections(custom: CustomEntityType | undefined): SectionDef[] | undefined {
  if (!custom) return undefined;
  const sections = parseArray(custom.sectionsJson).filter(isSectionDef)
    .map((section) => ({ ...section, icon: isIconName(section.icon) ? section.icon : "circleOpen" }));
  return sections.length > 0 ? sections : undefined;
}

function mergeCustomFacts(labels: string[], stored: EntityField[]): MergedFact[] {
  const facts = stored.filter((field) => field.kind === "fact" && field.key !== ROLE_KEY);
  const defaults = new Set(labels);
  const rows = new Map(facts.map((field) => [field.key, field]));
  const base = labels.map((label) => ({
    fieldId: rows.get(label)?.id, label, value: rows.get(label)?.value ?? "", isDefault: true,
  }));
  const extra = facts.filter((field) => !defaults.has(field.key)).sort((a, b) => a.sort - b.sort)
    .map((field) => ({ fieldId: field.id, label: field.key, value: field.value, isDefault: false }));
  return [...base, ...extra];
}

function mergeCustomSections(defs: SectionDef[], stored: EntityField[]): MergedSection[] {
  const rows = new Map(stored.filter((field) => field.kind === "section").map((field) => [field.key, field.value]));
  return defs.map((section) => ({ ...section, text: rows.get(section.key) ?? "" }));
}

export function buildEntryModel(type: string, fields: EntityField[], notes: string | null,
  customTypes: CustomEntityType[]): EntryModel {
  const custom = findCustomType(type, customTypes);
  const fieldsDef = customFields(custom);
  const sectionsDef = customSections(custom);
  const role = fields.find((field) => field.kind === "fact" && field.key === ROLE_KEY)?.value ?? "";
  return {
    facts: fieldsDef ? mergeCustomFacts(fieldsDef, fields) : mergeFacts(type, fields),
    sections: sectionsDef ? mergeCustomSections(sectionsDef, fields) : mergeSections(type, fields, notes),
    role,
    type: resolveMobileType(type, customTypes),
  };
}

export function expectedSchema(type: string): { fields: string[]; sections: string[] } {
  return {
    fields: [...(DEF_FIELDS[type] ?? ["Type", "Status", "First appears"])],
    sections: (DEF_SECTIONS[type] ?? [
      { key: "description", icon: "archive", label: "Description" },
      { key: "notes", icon: "fileText", label: "Notes" },
    ]).map((section) => section.label),
  };
}
