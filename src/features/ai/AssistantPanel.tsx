/**
 * AssistantPanel — opt-in AI brainstorm panel for the right-panel inspector slot.
 *
 * Phase 4 lifecycle: dormant affordance (all builds) → consent walkthrough on
 * first open → subscription-key entry → brainstorm-ready UI.
 *
 * No network call may occur before the consent walkthrough is accepted.
 *
 * Also exports InspectorTabShell and wrapInspectorSlot — the tab wrapper used by
 * App.content.tsx to place this panel alongside SceneInspector.
 */
import { type ReactNode, useCallback, useState } from "react";
import type * as Y from "yjs";

import type { StoryBibleStore } from "../../db/storyBibleStore";
import { getTweak, setStoredTweak } from "../settings/settings.store";
import { BrainstormPane, KeyEntryPanel } from "./AssistantPanel.brainstorm";
import { ConsentWalkthrough } from "./ConsentWalkthrough";

// ── Types ─────────────────────────────────────────────────────────────────────

type PanelPhase = "dormant" | "consent" | "key-entry" | "ready";

// ── Phase initializer ─────────────────────────────────────────────────────────

function initialPhase(): PanelPhase {
  if (!getTweak("aiConsentGiven", false)) return "consent";
  if (!getTweak("aiLicenseKey", "")) return "key-entry";
  return "ready";
}

// ── Shared inner wrapper ──────────────────────────────────────────────────────

function PanelScroll({ children }: { children: ReactNode }) {
  return (
    <div className="panel-inspector">
      <div className="insp-scroll">{children}</div>
    </div>
  );
}

// ── Dormant affordance ────────────────────────────────────────────────────────

function DormantAffordance({ onEnable }: { onEnable: () => void }) {
  return (
    <div className="ai-dormant">
      <p className="ai-dormant-text">AI brainstorming is available when you&apos;re ready.</p>
      <button className="btn btn-primary" onClick={onEnable}>Enable</button>
    </div>
  );
}

// ── AssistantPanel (phase controller) ────────────────────────────────────────

export interface AssistantPanelProps {
  sceneId: string | null;
  sceneName: string | null;
  doc: Y.Doc | null;
  store: StoryBibleStore;
}

export function AssistantPanel({ sceneId, sceneName, doc, store }: AssistantPanelProps) {
  const [phase, setPhase] = useState<PanelPhase>(initialPhase);
  const handleAccept = useCallback(() => {
    setStoredTweak("aiConsentGiven", true);
    setPhase("key-entry");
  }, []);
  const handleDismiss = useCallback(() => { setPhase("dormant"); }, []);
  const handleReEnable = useCallback(() => { setPhase("consent"); }, []);
  const handleKeySuccess = useCallback((key: string) => {
    setStoredTweak("aiLicenseKey", key);
    setPhase("ready");
  }, []);
  const handleChangeKey = useCallback(() => {
    setStoredTweak("aiLicenseKey", "");
    setPhase("key-entry");
  }, []);
  if (phase === "dormant") {
    return <PanelScroll><DormantAffordance onEnable={handleReEnable} /></PanelScroll>;
  }
  if (phase === "consent") {
    return <PanelScroll><ConsentWalkthrough onAccept={handleAccept} onDismiss={handleDismiss} /></PanelScroll>;
  }
  if (phase === "key-entry") {
    return <PanelScroll><KeyEntryPanel onSuccess={handleKeySuccess} /></PanelScroll>;
  }
  const licenseKey = getTweak("aiLicenseKey", "");
  return (
    <BrainstormPane
      key={licenseKey}
      sceneId={sceneId}
      sceneName={sceneName}
      doc={doc}
      store={store}
      licenseKey={licenseKey}
      onChangeKey={handleChangeKey}
    />
  );
}

// ── InspectorTabShell ─────────────────────────────────────────────────────────

export interface InspectorTabShellProps {
  inspector: ReactNode;
  assistant: ReactNode;
}

/**
 * Tabs the SceneInspector and AssistantPanel in the right-panel slot.
 * Rendered as the inspector prop to AppShell (which wraps it in .panel-inspector).
 */
export function InspectorTabShell({ inspector, assistant }: InspectorTabShellProps) {
  const [tab, setTab] = useState<"inspector" | "assistant">("inspector");
  return (
    <div className="ai-tab-shell">
      <div className="ai-tab-bar">
        <button className={`ai-tab-btn${tab === "inspector" ? " active" : ""}`} onClick={() => setTab("inspector")}>
          Scene
        </button>
        <button className={`ai-tab-btn${tab === "assistant" ? " active" : ""}`} onClick={() => setTab("assistant")}>
          Assistant
        </button>
      </div>
      <div className="ai-tab-content">
        {tab === "inspector" ? inspector : assistant}
      </div>
    </div>
  );
}

// ── Mount helper ──────────────────────────────────────────────────────────────

/** Duck-typed host props consumed by wrapInspectorSlot — subset of SideSlotsProps. */
export interface SlotHostProps {
  selectedSceneId: string | null;
  activeScene?: { title?: string | null } | null;
  doc?: Y.Doc | null;
  storyBibleStore: StoryBibleStore;
  /** From the aiEnabled tweak — when false, hides all AI chrome. */
  aiEnabled: boolean;
}

/**
 * Wraps a SceneInspector node with the AI tab shell when aiEnabled is true.
 * Returns the base node unchanged when aiEnabled is false (all AI chrome gone).
 */
export function wrapInspectorSlot(
  base: React.ReactNode,
  p: SlotHostProps,
): React.ReactNode {
  if (!p.aiEnabled) return base;
  return (
    <InspectorTabShell
      inspector={base}
      assistant={
        <AssistantPanel
          sceneId={p.selectedSceneId}
          sceneName={p.activeScene?.title ?? null}
          doc={p.doc ?? null}
          store={p.storyBibleStore}
        />
      }
    />
  );
}
