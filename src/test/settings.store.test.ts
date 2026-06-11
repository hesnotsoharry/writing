// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  getTweak,
  GRAMMAR_KEY,
  setStoredTweak,
  SETTINGS_NS,
  SPELLCHECK_KEY,
  STYLEHINTS_KEY,
  TWEAK_DEFAULTS,
  useSettings,
} from "../features/settings/settings.store";

afterEach(() => {
  localStorage.clear();
});

describe("wave-16 key contract", () => {
  it("SPELLCHECK_KEY is the exact camelCase string 'spellCheck'", () => {
    expect(SPELLCHECK_KEY).toBe("spellCheck");
  });

  it("GRAMMAR_KEY is the exact camelCase string 'grammar'", () => {
    expect(GRAMMAR_KEY).toBe("grammar");
  });

  it("STYLEHINTS_KEY is the exact camelCase string 'styleHints'", () => {
    expect(STYLEHINTS_KEY).toBe("styleHints");
  });
});

describe("TWEAK_DEFAULTS", () => {
  it("spellCheck defaults to true", () => {
    expect(TWEAK_DEFAULTS.spellCheck).toBe(true);
  });

  it("grammar defaults to true", () => {
    expect(TWEAK_DEFAULTS.grammar).toBe(true);
  });

  it("styleHints defaults to false", () => {
    expect(TWEAK_DEFAULTS.styleHints).toBe(false);
  });

  it("rmapLabelsAlways defaults to false (hover-only is the safe default)", () => {
    expect(TWEAK_DEFAULTS.rmapLabelsAlways).toBe(false);
  });
});

describe("getTweak", () => {
  it("returns fallback when the key is absent from localStorage", () => {
    const result = getTweak(SPELLCHECK_KEY, true);
    expect(result).toBe(true);
  });

  it("returns fallback when the stored value is corrupt JSON", () => {
    localStorage.setItem(SETTINGS_NS + SPELLCHECK_KEY, "not json{");
    const result = getTweak(SPELLCHECK_KEY, true);
    expect(result).toBe(true);
  });

  it("returns fallback when stored value is the literal string \"null\"", () => {
    localStorage.setItem(SETTINGS_NS + SPELLCHECK_KEY, "null");
    expect(getTweak(SPELLCHECK_KEY, true)).toBe(true);
  });
});

describe("setStoredTweak / getTweak round-trip", () => {
  it("reads back the value written by setStoredTweak", () => {
    setStoredTweak(SPELLCHECK_KEY, false);
    expect(getTweak(SPELLCHECK_KEY, true)).toBe(false);
  });
});

describe("useSettings", () => {
  it("initial tweaks deep-equal TWEAK_DEFAULTS on clean storage", () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.tweaks).toEqual(TWEAK_DEFAULTS);
  });

  it("setTweak updates in-memory state immediately", () => {
    const { result } = renderHook(() => useSettings());
    act(() => {
      result.current.setTweak("grammar", true);
    });
    expect(result.current.tweaks.grammar).toBe(true);
  });

  it("setTweak persists the value so a fresh hook instance reads it back", () => {
    const { result: first } = renderHook(() => useSettings());
    act(() => {
      first.current.setTweak("grammar", true);
    });

    // A new hook instance reads from localStorage — must see the persisted value.
    const { result: second } = renderHook(() => useSettings());
    expect(second.current.tweaks.grammar).toBe(true);
  });
});
