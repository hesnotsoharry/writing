import type { AiEstimateResult, MeterStatus } from "./ai.types";

export interface EstimateParams {
  sceneWords: number;
  extraWords?: number;
  selWords?: number;
  entityCount: number;
  about: boolean;
  turns?: number;
}

export function aiEstimate(ctx: EstimateParams): AiEstimateResult {
  const words =
    (ctx.sceneWords || 0) +
    (ctx.extraWords || 0) +
    (ctx.selWords || 0) +
    ctx.entityCount * 45 +
    (ctx.about ? 130 : 0) +
    (ctx.turns || 0) * 350;
  const pct = Math.max(0.2, Math.round((words / 4000) * 10) / 10);
  return { words, pct };
}

export function aiMeterStatus(usedPct: number, resetLabel: string): MeterStatus {
  if (usedPct >= 100) return { cls: "out", label: "Used up", sub: resetLabel };
  if (usedPct >= 80) return { cls: "warn", label: "Running low", sub: resetLabel };
  if (usedPct >= 55) return { cls: "", label: "About half left", sub: resetLabel };
  return { cls: "", label: "Plenty left this month", sub: resetLabel };
}

let __aiMsgN = 100;
export function aiMsgId(): string { return "m-" + (__aiMsgN++); }
export function aiConvoId(): string { return "cv-" + Date.now().toString(36); }
