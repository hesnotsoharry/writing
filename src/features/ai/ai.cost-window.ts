import type { ManagedModel } from "./ai.types";

const WINDOW_KEY = "ai_cost_window_v1";
const WINDOW_SIZE = 8; // per model

type WindowStore = Partial<Record<ManagedModel, number[]>>;

function readStore(): WindowStore {
  try {
    const raw = localStorage.getItem(WINDOW_KEY);
    return raw ? (JSON.parse(raw) as WindowStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: WindowStore): void {
  try {
    localStorage.setItem(WINDOW_KEY, JSON.stringify(store));
  } catch { /* quota exceeded — silently ignore */ }
}

/**
 * Push an observed per-reply cost into the per-model rolling window.
 * Skips zero-cost entries (BYOK always reports 0; don't pollute the window).
 */
export function pushCostEntry(model: ManagedModel, costUnits: number): void {
  if (costUnits <= 0) return;
  const store = readStore();
  const arr = Array.isArray(store[model]) ? store[model]! : [];
  arr.push(costUnits);
  if (arr.length > WINDOW_SIZE) arr.splice(0, arr.length - WINDOW_SIZE);
  store[model] = arr;
  writeStore(store);
}

/**
 * Return the rolling average cost per reply for the given model, or null if
 * the window is empty (cold start — caller should fall back to TYPICAL_REQUEST).
 */
export function avgCostForModel(model: ManagedModel): number | null {
  const arr = readStore()[model];
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const nums = arr.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}
