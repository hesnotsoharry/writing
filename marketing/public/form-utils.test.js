// ============================================================================
// form-utils.test.js — unit tests for isValidEmail
//
// Tests the function directly (not a mock of it). Each test names the contract.
// Covers: valid addresses, missing @, multiple @, empty/non-string, no TLD,
// dot at domain start/end, and the empty-string edge case.
// ============================================================================

import { describe, expect, it } from "vitest";
import { isValidEmail } from "./form-utils.js";

describe("isValidEmail", () => {
  // --- valid cases ---

  it("returns true for a standard email address", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("returns true for an email with a subdomain", () => {
    expect(isValidEmail("user@mail.example.com")).toBe(true);
  });

  it("returns true for an email with a plus tag in the local part", () => {
    expect(isValidEmail("user+tag@example.com")).toBe(true);
  });

  it("returns true for an email with dots in the local part", () => {
    expect(isValidEmail("first.last@example.org")).toBe(true);
  });

  it("returns true for single-character local part and domain", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
  });

  // --- invalid cases ---

  it("returns false for an empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("returns false for a whitespace-only string", () => {
    expect(isValidEmail("   ")).toBe(false);
  });

  it("returns false when the @ sign is missing", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });

  it("returns false when there are two @ signs", () => {
    expect(isValidEmail("user@@example.com")).toBe(false);
  });

  it("returns false when the local part before @ is empty", () => {
    expect(isValidEmail("@example.com")).toBe(false);
  });

  it("returns false when the domain after @ is empty", () => {
    expect(isValidEmail("user@")).toBe(false);
  });

  it("returns false for a domain with no TLD dot", () => {
    expect(isValidEmail("user@examplecom")).toBe(false);
  });

  it("returns false when the domain dot is the first character (dot at start)", () => {
    expect(isValidEmail("user@.example.com")).toBe(false);
  });

  it("returns false when the domain ends with a dot", () => {
    expect(isValidEmail("user@example.")).toBe(false);
  });

  it("returns false for a non-string value (number)", () => {
    expect(isValidEmail(42)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidEmail(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isValidEmail(undefined)).toBe(false);
  });
});
