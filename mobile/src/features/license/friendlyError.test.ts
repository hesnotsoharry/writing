import { describe, expect, it } from "vitest";

import { friendlyError } from "../../shared/licenseErrors";

describe("friendlyError shared copy", () => {
  it("is byte-identical for every error kind", () => {
    expect(friendlyError("format_error", "ignored")).toBe("That doesn't look like a license key — keys look like XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX and are in your purchase email.");
    expect(friendlyError("invalid_key", "ignored")).toBe("That key doesn't look right — double-check your purchase email.");
    expect(friendlyError("network", "ignored")).toBe("Couldn't reach the license server — check your connection and try again.");
    expect(friendlyError("rejected", "Activation limit reached.")).toBe("Activation limit reached.");
  });
});
