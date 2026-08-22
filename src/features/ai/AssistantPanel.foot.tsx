/**
 * AssistantPanel.foot.tsx — PanelFoot (composer + meter + trial nudge), split out
 * of AssistantPanel.tsx to stay under the 300-line file budget. Not part of the
 * public module boundary; consumed only by AssistantPanel.tsx (PanelReady).
 */
import type { RefObject } from "react";

import { getTweak } from "../settings/settings.store";
import { applyEntityToggle, buildEntityChips } from "./ai.helpers";
import type { ManagedModel, ProseSelection, VerbKey } from "./ai.types";
import { AiMeter } from "./AiComponents";
import type { AssistantPanelProps } from "./AssistantPanel";
import { useContextAssembly } from "./AssistantPanel.hooks";
import { ContextStripPanel, PanelFooter, type PanelFooterHandle } from "./AssistantPanel.parts";

type Setter<T> = (v: T | ((prev: T) => T)) => void;

export interface PanelFootProps {
  p: AssistantPanelProps; ctx: ReturnType<typeof useContextAssembly>;
  attachedSel: Pick<ProseSelection, "text" | "words"> | null; setAttachedSel: (s: Pick<ProseSelection, "text" | "words"> | null) => void;
  footerRef: RefObject<PanelFooterHandle | null>; model: ManagedModel; effectiveByokModel: ManagedModel;
  prompt: string; setPrompt: (v: string) => void; verb: VerbKey; verbPop: boolean; setVerbPop: Setter<boolean>;
  setVerb: (v: VerbKey) => void; modelPop: boolean; setModelPop: Setter<boolean>; setModel: (v: ManagedModel) => void;
  streamingId: string | null; send: () => void; stop: () => void;
}

export function PanelFoot({ p, ctx, attachedSel, setAttachedSel, footerRef, model, effectiveByokModel, prompt, setPrompt, verb, verbPop, setVerbPop, setVerb, modelPop, setModelPop, setModel, streamingId, send, stop }: PanelFootProps) {
  const showTrialNudge = p.gateStatus === "trial" && p.plan === "active" && !p.byokActive && !!getTweak("aiLicenseKey", "");
  return (
    <div className="ai-foot">
      <ContextStripPanel sceneName={p.sceneName} extras={ctx.extras} linked={ctx.linked}
        attachedSel={attachedSel} sel={p.sel} hasAbout={ctx.hasAbout} aiCtx={p.aiCtx}
        boundaryLabel={ctx.boundaryLabel} setAttachedSel={setAttachedSel} onOpenContext={p.onOpenContext} sceneExcludedFromAi={p.sceneExcludedFromAi} onToggleSceneExclusion={p.onToggleSceneExclusion} entityChips={buildEntityChips(p.sceneEntityGroups, p.aiCtx.offEntityNames)} onToggleEntity={(n: string) => p.setAiCtx(applyEntityToggle(p.aiCtx, n))} />
      <PanelFooter ref={footerRef} plan={p.plan} usedPct={p.usedPct} offline={p.offline}
        prompt={prompt} setPrompt={setPrompt} verb={verb} verbPop={verbPop} setVerbPop={setVerbPop} setVerb={setVerb} model={effectiveByokModel} modelPop={modelPop} setModelPop={setModelPop} setModel={setModel} streamingId={streamingId} onSend={send} onStop={stop}
        est={ctx.est} onToast={p.onToast} resetLabel={p.resetLabel} byokActive={p.byokActive} byokKeys={p.byokKeys} />
      {!p.byokActive && <AiMeter usedPct={p.usedPct} resetLabel={p.resetLabel} creditsBalance={p.creditsBalance} model={model} plan={p.plan} />}
      {/* Trial-app + active-AI-subscription nudge: shows when the app is in its 14-day trial
          but the user already has a managed AI subscription. Nudges purchase before trial ends.
          Not shown for BYOK users or users who have already purchased. */}
      {showTrialNudge && (
        <div className="ai-trial-nudge">
          Your AI subscription is active. Purchase WritersNook before your trial ends to keep using it.
        </div>
      )}
    </div>
  );
}
