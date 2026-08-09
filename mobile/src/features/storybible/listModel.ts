import { ROLE_KEY } from "../../shared/fullEntryDefs";
import type { CustomEntityType, Entity, EntityField } from "../../shared/storyBibleStore";
import type { MobileTypeDef } from "./typeModel";
import { resolveMobileType } from "./typeModel";

export interface BibleListRow extends Entity {
  role: string;
}

export interface BibleListGroup {
  type: MobileTypeDef;
  entries: BibleListRow[];
}

export interface BibleFilter {
  key: string;
  label: string;
  count: number;
}

export function roleFromFields(fields: EntityField[]): string {
  return fields.find((field) => field.kind === "fact" && field.key === ROLE_KEY)?.value ?? "";
}

export function groupBibleEntries(entries: BibleListRow[], customTypes: CustomEntityType[],
  query = "", filter = "all"): BibleListGroup[] {
  const needle = query.trim().toLocaleLowerCase();
  const visible = entries.filter((entry) => {
    const matchesFilter = filter === "all" || entry.type === filter;
    const matchesQuery = needle === "" || `${entry.name} ${entry.role} ${entry.notes ?? ""}`.toLocaleLowerCase().includes(needle);
    return matchesFilter && matchesQuery;
  });
  const byType = new Map<string, BibleListRow[]>();
  visible.forEach((entry) => byType.set(entry.type, [...(byType.get(entry.type) ?? []), entry]));
  return [...byType].map(([type, rows]) => ({
    type: resolveMobileType(type, customTypes),
    entries: [...rows].sort((left, right) => left.name.localeCompare(right.name)),
  })).sort((left, right) => left.type.label.localeCompare(right.type.label));
}

export function buildBibleFilters(entries: Pick<Entity, "type">[], customTypes: CustomEntityType[]): BibleFilter[] {
  const counts = new Map<string, number>();
  entries.forEach((entry) => counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1));
  const filters = [...counts].map(([key, count]) => ({
    key, count, label: resolveMobileType(key, customTypes).label,
  })).sort((left, right) => left.label.localeCompare(right.label));
  return [{ key: "all", label: "All", count: entries.length }, ...filters];
}
