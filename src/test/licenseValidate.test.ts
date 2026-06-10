import { describe, expect, it } from "vitest";

import { formatLicenseKeyInput, isLicenseKeyShaped } from "../features/license/validate";

describe("formatLicenseKeyInput", () => {
  it("returns empty string for empty input", () => {
    expect(formatLicenseKeyInput("")).toBe("");
  });

  it("formats 8 hex chars without trailing dash", () => {
    expect(formatLicenseKeyInput("38b1460a")).toBe("38b1460a");
  });

  it("formats 12 hex chars with first dash", () => {
    expect(formatLicenseKeyInput("38b1460a5104")).toBe("38b1460a-5104");
  });

  it("formats 16 hex chars with two dashes", () => {
    expect(formatLicenseKeyInput("38b1460a51044067")).toBe("38b1460a-5104-4067");
  });

  it("formats 20 hex chars with three dashes", () => {
    expect(formatLicenseKeyInput("38b1460a51044067a91d")).toBe(
      "38b1460a-5104-4067-a91d",
    );
  });

  it("rounds-trip a full dashed UUID unchanged", () => {
    const uuid = "38b1460a-5104-4067-a91d-77b872934d51";
    expect(formatLicenseKeyInput(uuid)).toBe(uuid);
  });

  it("normalizes pasted input with spaces", () => {
    expect(formatLicenseKeyInput("38b1460a 5104 4067 a91d 77b872934d51")).toBe(
      "38b1460a-5104-4067-a91d-77b872934d51",
    );
  });

  it("normalizes pasted input with newlines and extra hyphens", () => {
    expect(formatLicenseKeyInput("38b1460a-5104\n4067-a91d\n77b872934d51")).toBe(
      "38b1460a-5104-4067-a91d-77b872934d51",
    );
  });

  it("drops non-hex characters", () => {
    expect(formatLicenseKeyInput("38b1460a-5104!@#$4067-a91d-77b872934d51")).toBe(
      "38b1460a-5104-4067-a91d-77b872934d51",
    );
  });

  it("caps at 32 hex chars", () => {
    expect(
      formatLicenseKeyInput("38b1460a51044067a91d77b872934d51extra"),
    ).toBe("38b1460a-5104-4067-a91d-77b872934d51");
  });

  it("handles uppercase hex characters", () => {
    expect(formatLicenseKeyInput("38B1460A-5104-4067-A91D-77B872934D51")).toBe(
      "38B1460A-5104-4067-A91D-77B872934D51",
    );
  });

  it("handles mixed case hex characters", () => {
    expect(formatLicenseKeyInput("38b1460A-5104-4067-a91D-77B872934d51")).toBe(
      "38b1460A-5104-4067-a91D-77B872934d51",
    );
  });

  it("strips whitespace from pasted input with trim-like spaces", () => {
    expect(formatLicenseKeyInput("  38b1460a-5104-4067-a91d-77b872934d51  ")).toBe(
      "38b1460a-5104-4067-a91d-77b872934d51",
    );
  });
});

describe("isLicenseKeyShaped", () => {
  it("accepts valid lowercase UUID", () => {
    expect(isLicenseKeyShaped("38b1460a-5104-4067-a91d-77b872934d51")).toBe(true);
  });

  it("accepts valid uppercase UUID", () => {
    expect(isLicenseKeyShaped("38B1460A-5104-4067-A91D-77B872934D51")).toBe(true);
  });

  it("accepts valid mixed-case UUID", () => {
    expect(isLicenseKeyShaped("38b1460A-5104-4067-a91D-77B872934d51")).toBe(true);
  });

  it("rejects too-short input", () => {
    expect(isLicenseKeyShaped("38b1460a-5104-4067-a91d")).toBe(false);
  });

  it("rejects input missing hyphens", () => {
    expect(isLicenseKeyShaped("38b1460a51044067a91d77b872934d51")).toBe(false);
  });

  it("rejects input with hyphens in wrong positions", () => {
    expect(isLicenseKeyShaped("38b1-460a5104-4067a91d-77b872934d51")).toBe(false);
  });

  it("rejects input with non-hex characters", () => {
    expect(isLicenseKeyShaped("38b1460a-5104-4067-a91d-77b872934d5!")).toBe(false);
  });

  it("rejects input with extra whitespace", () => {
    expect(isLicenseKeyShaped("  38b1460a-5104-4067-a91d-77b872934d51  ")).toBe(
      false,
    );
  });

  it("rejects empty string", () => {
    expect(isLicenseKeyShaped("")).toBe(false);
  });

  it("rejects null-like 'g' in hex position", () => {
    expect(isLicenseKeyShaped("38b1460g-5104-4067-a91d-77b872934d51")).toBe(false);
  });

  it("validates the trim-then-check pattern as used at submit", () => {
    const rawWithWhitespace = "  38b1460a-5104-4067-a91d-77b872934d51  ";
    const trimmed = rawWithWhitespace.trim();
    expect(isLicenseKeyShaped(trimmed)).toBe(true);
  });
});
