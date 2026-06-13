/**
 * AssistantPanel — wave-35 Phase C redesign port.
 *
 * Exports: InspectorTabs, AssistantPanel, AssistantPanelProps,
 *          SlotHostProps, wrapInspectorSlot.
 * Internal: AiSlot (state host), SlotPanel, PanelReady.
 *
 * Sub-components live in AssistantPanel.parts.tsx;
 * hooks + pure helpers live in AssistantPanel.hooks.ts.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";

import type { BinderTree } from "../../binder/buildTree";
import { Icon } from "../../components/Icon";
import type { Scene } from "../../db/binderStore";
import type { StoryBibleStore } from "../../db/storyBibleStore";
import { getTweak, setStoredTweak } from "../settings/settings.store";
import {
  type AiCtxConfig,
  type AiManuscriptTree,
  type ConversationRecord,
  EMPTY_ABOUT,
  type ManuscriptAbout,
  type ProseSelection,
  type VerbKey,
} from "./ai.types";
import { AiDormant, AiMeter } from "./AiComponents";
import { AiErrorBoundary } from "./AiErrorBoundary";
import { AiConsent, AiContextPicker } from "./AiOverlays";
import { type CtxArgs, toAiTree, useContextAssembly, usePanelMessages, usePanelState } from "./AssistantPanel.hooks";
import { ContextStripPanel, OfflineBanner, PanelFooter, type PanelFooterHandle, PanelNav, PanelThread } from "./AssistantPanel.parts";

// ── Constants ─────────────────────────────────────────────────────────────────

const INIT_AI_CTX: AiCtxConfig = { extraSceneIds: [], offEntityNames: [], about: true, boundary: null };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssistantPanelProps {
  sceneId: string | null;
  sceneName: string | null;
  sceneWords: number;
  doc: Y.Doc | null;
  store: StoryBibleStore;
  tree: AiManuscriptTree;
  convos: ConversationRecord[];
  setConvos: React.Dispatch<React.SetStateAction<ConversationRecord[]>>;
  activeId: string | null;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  about: ManuscriptAbout;
  setAbout: (a: ManuscriptAbout) => void;
  aiCtx: AiCtxConfig;
  setAiCtx: (c: AiCtxConfig) => void;
  neverNames: string[];
  toggleNever: (name: string) => void;
  usedPct: number;
  resetLabel: string;
  plan: "active" | "expired";
  offline: boolean;
  consented: boolean;
  sel?: ProseSelection | null;
  initialVerb?: VerbKey;
  initialSel?: Pick<ProseSelection, "text" | "words"> | null;
  onOpenConsent: () => void;
  onOpenContext: () => void;
  onToast: (msg: string) => void;
  onSaveNote: (body: string) => void;
}

/** Props consumed by wrapInspectorSlot — App.content.tsx passes a superset. */
export interface SlotHostProps {
  selectedSceneId: string | null;
  activeScene: Scene | null;
  tree: BinderTree;
  doc?: Y.Doc | null;
  activeProjectId: string | null;
  storyBibleStore: StoryBibleStore;
  aiEnabled: boolean;
}

interface InspectorTabsProps {
  tab: "scene" | "assistant";
  setTab: (t: "scene" | "assistant") => void;
  scenePane: ReactNode;
  assistantPane: ReactNode;
}

interface SlotPanelProps {
  convos: ConversationRecord[];
  setConvos: React.Dispatch<React.SetStateAction<ConversationRecord[]>>;
  activeId: string | null;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  about: ManuscriptAbout;
  setAbout: (a: ManuscriptAbout) => void;
  aiCtx: AiCtxConfig;
  setAiCtx: (c: AiCtxConfig) => void;
  neverNames: string[];
  toggleNever: (n: string) => void;
  consented: boolean;
  aiTree: AiManuscriptTree;
  sceneId: string | null;
  sceneName: string | null;
  sceneWords: number;
  doc: Y.Doc | null;
  store: StoryBibleStore;
  onOpenConsent: () => void;
  onOpenContext: () => void;
}

// ── PanelReady (consented state) ──────────────────────────────────────────────

function PanelReady(p: AssistantPanelProps) {
  const { verb, setVerb, prompt, setPrompt, verbPop, setVerbPop, attachedSel, setAttachedSel,
    streamingId, setStreamingId, abortRef, sessionRef } = usePanelState(p.initialVerb, p.initialSel);
  const footerRef = useRef<PanelFooterHandle | null>(null);
  const active = p.convos.find((c) => c.id === p.activeId) ?? null;
  const ctx = useContextAssembly({ sceneId: p.sceneId, sceneWords: p.sceneWords, aiCtx: p.aiCtx, neverNames: p.neverNames, tree: p.tree, about: p.about, active });
  const ctxArgs: CtxArgs = { sceneName: p.sceneName, sceneWords: p.sceneWords, linked: ctx.linked,
    extras: ctx.extras, attachedSel, aiCtx: p.aiCtx, hasAbout: ctx.hasAbout, boundaryLabel: ctx.boundaryLabel };
  const canCompose = !p.offline && p.plan !== "expired" && p.usedPct < 100;
  const { send, stop, copyMsg, saveMsg, newConvo, deleteConvo } = usePanelMessages({
    convos: p.convos, setConvos: p.setConvos, activeId: p.activeId, setActiveId: p.setActiveId,
    prompt, setPrompt, verb, attachedSel, setAttachedSel, streamingId, setStreamingId,
    canCompose, ctxArgs, sceneId: p.sceneId, sceneName: p.sceneName,
    doc: p.doc, store: p.store, abortRef, sessionRef, onToast: p.onToast, onSaveNote: p.onSaveNote,
  });
  // abortRef is a stable ref (never reassigned); a mount-once cleanup is correct here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { abortRef.current?.abort(); }, []);
  const listMode = !active;
  const msgCount = active?.messages.length ?? 0;
  const lastLen = msgCount ? active!.messages[msgCount - 1].text.length : 0;
  return (
    <div className="ai-panel">
      {p.offline && <OfflineBanner />}
      <PanelNav active={active} onBack={() => p.setActiveId(null)} onNew={newConvo} />
      <PanelThread msgCount={msgCount} lastLen={lastLen} activeId={p.activeId} listMode={listMode}
        active={active} convos={p.convos} verb={verb} setVerb={setVerb} onOpen={p.setActiveId}
        onNew={newConvo} onDelete={deleteConvo} streamingId={streamingId} onCopy={copyMsg}
        onSaveNote={saveMsg} onStarter={(s) => { setPrompt(s); footerRef.current?.focusInput(); }} />
      {!listMode && <div className="ai-foot">
        <ContextStripPanel sceneName={p.sceneName} extras={ctx.extras} linked={ctx.linked}
          attachedSel={attachedSel} sel={p.sel} hasAbout={ctx.hasAbout} aiCtx={p.aiCtx}
          boundaryLabel={ctx.boundaryLabel} setAttachedSel={setAttachedSel} onOpenContext={p.onOpenContext} />
        <PanelFooter ref={footerRef} plan={p.plan} usedPct={p.usedPct} offline={p.offline}
          prompt={prompt} setPrompt={setPrompt} verb={verb} verbPop={verbPop} setVerbPop={setVerbPop}
          setVerb={setVerb} streamingId={streamingId} onSend={send} onStop={stop}
          est={ctx.est} onToast={p.onToast} resetLabel={p.resetLabel} />
        <AiMeter usedPct={p.usedPct} resetLabel={p.resetLabel} />
      </div>}
    </div>
  );
}

// ── AssistantPanel ─────────────────────────────────────────────────────────────

export function AssistantPanel(props: AssistantPanelProps) {
  if (!props.consented) {
    return <div className="ai-panel"><AiDormant onWake={props.onOpenConsent} /></div>;
  }
  return <PanelReady {...props} />;
}

// ── InspectorTabs (exported — replaces InspectorTabShell) ─────────────────────

/**
 * Tab shell that wraps SceneInspector (scenePane) and AssistantPanel (assistantPane).
 * Both panes are always mounted — uses the HTML hidden attribute so streams survive
 * tab switches. Active tab has the .on class.
 */
export function InspectorTabs({ tab, setTab, scenePane, assistantPane }: InspectorTabsProps) {
  return (
    <div className="panel-inspector">
      <div className="insp-tabs">
        <div className={"insp-tab" + (tab === "scene" ? " on" : "")} role="button" onClick={() => setTab("scene")}>
          <Icon name="fileText" className="ic" /> Scene
        </div>
        <div className={"insp-tab" + (tab === "assistant" ? " on" : "")} role="button" onClick={() => setTab("assistant")}>
          <Icon name="sparkle" className="ic" /> Assistant
        </div>
      </div>
      <div className="insp-pane" hidden={tab !== "scene"}>{scenePane}</div>
      <div className="insp-pane" hidden={tab !== "assistant"}>{assistantPane}</div>
    </div>
  );
}

// ── AiSlot + SlotPanel (internal) ─────────────────────────────────────────────

function SlotPanel(p: SlotPanelProps) {
  const onToast = (msg: string) => { console.warn("[Phase H: real toast]", msg); };
  const onSaveNote = (body: string) => { console.warn("[Phase H: real save note]", body); };
  return (
    <AiErrorBoundary>
      <AssistantPanel
        sceneId={p.sceneId} sceneName={p.sceneName} sceneWords={p.sceneWords}
        doc={p.doc} store={p.store} tree={p.aiTree}
        convos={p.convos} setConvos={p.setConvos} activeId={p.activeId} setActiveId={p.setActiveId}
        about={p.about} setAbout={p.setAbout} aiCtx={p.aiCtx} setAiCtx={p.setAiCtx}
        neverNames={p.neverNames} toggleNever={p.toggleNever} usedPct={0}
        resetLabel="Resets soon" plan="active" offline={!navigator.onLine} consented={p.consented}
        sel={null} onOpenConsent={p.onOpenConsent} onOpenContext={p.onOpenContext}
        onToast={onToast} onSaveNote={onSaveNote}
      />
    </AiErrorBoundary>
  );
}

function AiSlot({ base, p }: { base: ReactNode; p: SlotHostProps }) {
  const [inspTab, setInspTab] = useState<"scene" | "assistant">("scene");
  const [overlay, setOverlay] = useState<"consent" | "context" | null>(null);
  const [convos, setConvos] = useState<ConversationRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [about, setAbout] = useState<ManuscriptAbout>(EMPTY_ABOUT);
  const [aiCtx, setAiCtx] = useState<AiCtxConfig>(INIT_AI_CTX);
  const [neverNames, setNeverNames] = useState<string[]>([]);
  const toggleNever = useCallback((n: string) =>
    setNeverNames((ns) => (ns.includes(n) ? ns.filter((x) => x !== n) : [...ns, n])), []);
  const handleEnable = useCallback(() => {
    setStoredTweak("aiConsentGiven", true);
    setOverlay(null);
    setInspTab("assistant");
  }, []);
  const consented = getTweak("aiConsentGiven", false);
  const aiTree = toAiTree(p.tree);
  const sceneId = p.selectedSceneId;
  const sceneName = p.activeScene?.title ?? null;
  const sceneWords = p.activeScene?.word_count ?? 0;
  return (
    <>
      <InspectorTabs tab={inspTab} setTab={setInspTab} scenePane={base} assistantPane={
        <SlotPanel convos={convos} setConvos={setConvos} activeId={activeId} setActiveId={setActiveId}
          about={about} setAbout={setAbout} aiCtx={aiCtx} setAiCtx={setAiCtx}
          neverNames={neverNames} toggleNever={toggleNever} consented={consented}
          aiTree={aiTree} sceneId={sceneId} sceneName={sceneName} sceneWords={sceneWords}
          doc={p.doc ?? null} store={p.storyBibleStore}
          onOpenConsent={() => setOverlay("consent")} onOpenContext={() => setOverlay("context")} />
      } />
      {overlay === "consent" && <AiConsent onClose={() => setOverlay(null)} onEnable={handleEnable} />}
      {overlay === "context" && (
        <AiContextPicker tree={aiTree} scene={{ id: sceneId ?? "", title: sceneName ?? "", words: sceneWords }}
          entities={[]} aiCtx={aiCtx} setAiCtx={setAiCtx} neverNames={neverNames} toggleNever={toggleNever}
          about={about} setAbout={setAbout} resetLabel="Resets soon" onClose={() => setOverlay(null)} />
      )}
    </>
  );
}

// ── wrapInspectorSlot ─────────────────────────────────────────────────────────

/**
 * Wraps a SceneInspector node with the AI tab shell when aiEnabled is true.
 * Returns the base node unchanged when aiEnabled is false (all AI chrome gone).
 * App.content.tsx already passes a superset of SlotHostProps — do NOT edit it.
 */
export function wrapInspectorSlot(base: React.ReactNode, p: SlotHostProps): React.ReactNode {
  if (!p.aiEnabled) return base;
  return <AiSlot base={base} p={p} />;
}
