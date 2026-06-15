/**
 * AssistantPanel.model-pop.tsx — model picker popover for AssistantPanel.
 * Pass byokGroups to render registry-driven BYOK groups instead of managed models.
 * W45: append groups to PROVIDER_REGISTRY; this component renders them automatically.
 */
import { useState } from "react";

import { Icon } from "../../components/Icon";
import { AI_MODEL_ORDER, AI_MODELS, type ManagedModel } from "./ai.types";
import type { ProviderGroup } from "./providerRegistry";

/** Unified model picker — managed-mode or BYOK (registry-driven) depending on byokGroups. */
export function ModelPop({ model, setModel, setModelPop, onAfterSelect, byokGroups }: {
  model: ManagedModel; setModel: (m: ManagedModel) => void;
  setModelPop: (b: boolean | ((v: boolean) => boolean)) => void; onAfterSelect: () => void;
  byokGroups?: ProviderGroup[];
}) {
  const [showPremium, setShowPremium] = useState(!byokGroups && AI_MODELS[model].tier === "premium");
  if (byokGroups) return <div className="ai-modelpop">{byokGroups.map((g) => <div key={g.provider}>
    <div className="ai-modelpop-provider">{g.label}</div>
    {g.models.map((e) => <button key={e.id} onClick={() => { setModel(e.id as ManagedModel); setModelPop(false); onAfterSelect(); }}>
      <span className="nm">{e.displayName}</span>
      {e.costHint && <span className="ai-modelpop-cost">{e.costHint}</span>}
      {e.id === model && <span className="tick"><Icon name="check" className="ic" /></span>}
    </button>)}
  </div>)}</div>;
  const standardClaude  = AI_MODEL_ORDER.filter((k) => AI_MODELS[k].provider === "claude"  && AI_MODELS[k].tier === "standard");
  const standardChatGPT = AI_MODEL_ORDER.filter((k) => AI_MODELS[k].provider === "chatgpt" && AI_MODELS[k].tier === "standard");
  const premiumModels   = AI_MODEL_ORDER.filter((k) => AI_MODELS[k].tier === "premium");
  const renderModel = (k: ManagedModel) => (<button key={k} onClick={() => { setModel(k); setModelPop(false); onAfterSelect(); }}>
    <span className="nm">{AI_MODELS[k].label}</span>
    {k === model && <span className="tick"><Icon name="check" className="ic" /></span>}
  </button>);
  return (
    <div className="ai-modelpop">
      <div className="ai-modelpop-provider">Claude</div>
      {standardClaude.map(renderModel)}
      <div className="ai-modelpop-provider">ChatGPT</div>
      {standardChatGPT.map(renderModel)}
      <button className="ai-modelpop-premium-toggle" onClick={() => setShowPremium((v) => !v)}>
        <Icon name={showPremium ? "chevDown" : "chevRight"} className="ic" />
        Show premium models
        <span className="ai-modelpop-cost">~3× cost</span>
      </button>
      {showPremium && premiumModels.map(renderModel)}
    </div>
  );
}
