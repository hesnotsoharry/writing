/**
 * Settings.ai.tsx — AI Assistant section for the Settings panel (Wave 35).
 * Extracted from Settings.sections.tsx to keep each file under the 300-line limit.
 */
import { SetRow, SetToggle } from "./Settings.primitives";
import { AI_REPLAY_EVENT, type Tweaks } from "./settings.store";

// ── Section prop shape (mirrors SectionProps in Settings.sections.tsx) ─────────

interface AiSectionProps {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
}

const AI_PRIVACY_COPY =
  "Every byte that leaves this machine is visible and intentional. " +
  "Requests send only what’s in the “What I can see” chips. " +
  "Nothing is stored, logged, or used for training — by us or by the model provider. " +
  "When the allowance runs out the assistant stops; it never bills you by surprise.";

// ── Expanded AI rows (shown when aiEnabled is true) ───────────────────────────

function AiExpandedRows({ tweaks, setTweak }: AiSectionProps) {
  const showKeyRow = tweaks.aiLicenseKey !== "";
  function replayWalkthrough() { window.dispatchEvent(new CustomEvent(AI_REPLAY_EVENT)); }
  return (<><SetRow label="Ask pill on selection" desc="Show a brainstorm pill when you select text in the editor."><SetToggle value={tweaks.aiSelPill} onChange={(v) => setTweak("aiSelPill", v)} /></SetRow>
    <SetRow label="Right-click menu" desc="Add AI options to the editor right-click context menu."><SetToggle value={tweaks.aiSelMenu} onChange={(v) => setTweak("aiSelMenu", v)} /></SetRow>
    <SetRow label="First-run walkthrough" desc="Re-open the consent walkthrough from the beginning."><button className="btn btn-soft" onClick={replayWalkthrough}>Show again</button></SetRow>
    <div className="ai-privacy-block">{AI_PRIVACY_COPY}</div>
    {showKeyRow && <SetRow label="AI license key" desc="Clear to re-enter a different one." last><button className="ai-change-key-btn" onClick={() => setTweak("aiLicenseKey", "")}>Change license key…</button></SetRow>}
  </>);
}

// ── AiSection (exported — consumed by Settings.sections + tests) ──────────────

export function AiSection({ tweaks, setTweak }: AiSectionProps) {
  return (<><SetRow label="Show AI assistant" desc="Off removes every trace of AI from the app — no tab, no chips, nothing." last={!tweaks.aiEnabled}><SetToggle value={tweaks.aiEnabled} onChange={(v) => setTweak("aiEnabled", v)} /></SetRow>
    {tweaks.aiEnabled && <AiExpandedRows tweaks={tweaks} setTweak={setTweak} />}</>);
}
