export type ErrorKind = "format_error" | "invalid_key" | "rejected" | "network";

export function friendlyError(kind: ErrorKind, message: string): string {
  if (kind === "format_error") {
    return "That doesn't look like a license key — keys look like XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX and are in your purchase email.";
  }
  if (kind === "invalid_key") {
    return "That key doesn't look right — double-check your purchase email.";
  }
  if (kind === "network") {
    return "Couldn't reach the license server — check your connection and try again.";
  }
  return message;
}
