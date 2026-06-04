/**
 * shortLabel — derive a compact chip label from an entity name.
 *
 * Strips a leading "The " (case-insensitive) then returns the first
 * whitespace-delimited word.
 *
 * Examples:
 *   shortLabel("The Old Mill") === "Old"
 *   shortLabel("Sarah Connor")  === "Sarah"
 *   shortLabel("Sarah")         === "Sarah"
 *   shortLabel("")              === ""
 */
export function shortLabel(name: string): string {
  const stripped = name.replace(/^the\s+/i, "");
  return stripped.split(/\s+/)[0] ?? "";
}
