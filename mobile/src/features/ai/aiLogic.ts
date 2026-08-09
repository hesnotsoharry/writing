import {
  AI_MODEL_ORDER,
  AI_MODELS,
  type ManagedModel,
  MODEL_RATES,
  TYPICAL_REQUEST,
} from "../../shared/aiCatalog";
import { type AssembledContext,SCENE_EXCERPT_CHARS } from "../../shared/aiContext";

export const CREDIT_UNIT_USD = 0.00001;

export interface LiveBalance {
  creditsBalance: number;
  monthlyAllowance: number;
  resetAt: string;
  status: "active" | "trial" | "expired";
}

export interface BalancePresentation {
  allowance: number;
  balance: number;
  remainingFraction: number;
  usedFraction: number;
}

export function presentBalance(balance: LiveBalance): BalancePresentation {
  const allowance = Math.max(0, balance.monthlyAllowance);
  const remaining = Math.min(allowance, Math.max(0, balance.creditsBalance));
  const remainingFraction = allowance > 0 ? remaining / allowance : 0;
  return { allowance, balance: remaining, remainingFraction, usedFraction: 1 - remainingFraction };
}

export function formatCreditDollars(units: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
    .format(Math.max(0, units) * CREDIT_UNIT_USD);
}

export function estimateReplies(balanceUnits: number, model: ManagedModel): number {
  const rate = MODEL_RATES[model];
  const replyCost = TYPICAL_REQUEST.inputTokens * rate.input
    + TYPICAL_REQUEST.outputTokens * rate.output;
  if (!Number.isFinite(balanceUnits) || balanceUnits <= 0 || replyCost <= 0) return 0;
  return Math.floor(balanceUnits / replyCost);
}

export interface ModelListItem {
  id: ManagedModel;
  label: string;
  provider: string;
  tier: "standard" | "premium";
  legacy: boolean;
  replies: number;
}

export interface ModelGroups {
  standard: ModelListItem[];
  premium: ModelListItem[];
  superseded: ModelListItem[];
}

function modelItem(id: ManagedModel, balance: number): ModelListItem {
  const model = AI_MODELS[id];
  return {
    id, label: model.label, provider: model.provider,
    tier: model.tier, legacy: model.legacy === true,
    replies: estimateReplies(balance, id),
  };
}

export function groupModels(balance: number): ModelGroups {
  const items = AI_MODEL_ORDER.map((id) => modelItem(id, balance));
  return {
    standard: items.filter((item) => item.tier === "standard" && !item.legacy),
    premium: items.filter((item) => item.tier === "premium" && !item.legacy),
    superseded: items.filter((item) => item.legacy),
  };
}

export function countHiddenRuns(text: string, placeholder = "[passage hidden by author]"): number {
  if (!placeholder) return 0;
  return text.split(placeholder).length - 1;
}

export interface ContextMetrics {
  sentCharacters: number;
  characterCap: number;
  progress: number;
  estimatedTokens: number;
  estimatedCostUnits: number;
}

export function measureContext(ctx: AssembledContext, model: ManagedModel): ContextMetrics {
  const serialized = JSON.stringify(ctx);
  const estimatedTokens = Math.ceil(serialized.length / 4);
  const rate = MODEL_RATES[model];
  return {
    sentCharacters: ctx.sceneExcerpt.length,
    characterCap: SCENE_EXCERPT_CHARS,
    progress: Math.min(1, ctx.sceneExcerpt.length / SCENE_EXCERPT_CHARS),
    estimatedTokens,
    estimatedCostUnits: estimatedTokens * rate.input + TYPICAL_REQUEST.outputTokens * rate.output,
  };
}

export type AiLimitReason = "managed-refusal" | "out-of-credit";

export interface AiEventShape { type: string; [key: string]: unknown }

export function parseLimitReason(event: AiEventShape): AiLimitReason | null {
  if (event.type === "content-blocked") return "managed-refusal";
  if (event.type === "credits-exhausted") return "out-of-credit";
  return null;
}
