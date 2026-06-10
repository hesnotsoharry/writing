/**
 * Server-side email validation — TypeScript port of public/form-utils.js isValidEmail.
 * Independent copy: Workers functions must not import browser-served public/ files.
 * Rules: non-empty string, exactly one '@' with non-empty local+domain, domain has
 * a '.' with non-empty segments on each side, no leading/trailing dot in domain,
 * no consecutive dots anywhere in the domain, and a real TLD (at least one char
 * after the final dot).
 */
export function isValidEmail(s: unknown): boolean {
  if (typeof s !== "string" || s.trim().length === 0) return false;
  const parts = s.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (domain[0] === "." || domain[domain.length - 1] === ".") return false;
  if (domain.includes("..")) return false;
  const dotIdx = domain.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx >= domain.length - 1) return false;
  return true;
}
