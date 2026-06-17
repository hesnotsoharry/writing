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
import { type Dispatch, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as Y from "yjs";

import type { AppView } from "../../App.state";
import type { BinderTree } from "../../binder/buildTree";
import { Icon } from "../../components/Icon";
import { type AiConversationStore,makeProductionAiConversationStore } from "../../db/aiConversationStore";
import type { Scene } from "../../db/binderStore";
import type { SceneEntityGroup,StoryBibleStore } from "../../db/storyBibleStore";
import { SETTINGS_CHANGED_EVENT } from "../../lib/settings";
import type { GateStatus } from "../license/license.gate";
import { BRAINSTORM_ADD_CARD, getTweak } from "../settings/settings.store";
import type { SessionResult } from "./ai.client";
import { computeUsedPct, shouldRetryBalance } from "./ai.helpers";
import {
  type AiCtxConfig,
  type AiManuscriptTree,
  type AiMessageRecord,
  type ContextSnapshot,
  type ConversationRecord,
  DEFAULT_MODEL,
  type ManagedModel,
  type ManuscriptAbout,
  type ProseSelection,
  type VerbKey,
} from "./ai.types";
import { AiDormant, AiMeter } from "./AiComponents";
import { AiErrorBoundary } from "./AiErrorBoundary";
import { AiConsent, AiContextPicker } from "./AiOverlays";
import { BALANCE_RETRY_DELAYS, type BalanceSetters, fetchBalance } from "./AssistantPanel.balance";
import { type CtxArgs, toAiTree, useContextAssembly, usePanelMessages, usePanelState } from "./AssistantPanel.hooks";
import { AiToast, ContextStripPanel, OfflineBanner, PanelFooter, type PanelFooterHandle, PanelNav, PanelThread } from "./AssistantPanel.parts";
import { useAiPanelSeed, useAiSlotHandlers, useManuscriptAbout, useProseSelection, useSceneEntityGroups } from "./AssistantPanel.slot";
import { getBadgeLabel, PROVIDER_REGISTRY,type ProviderId } from "./providerRegistry";
import { useByokKeys } from "./useByokKeys";

// ── Constants ─────────────────────────────────────────────────────────────────

const INIT_AI_CTX: AiCtxConfig = { extraSceneIds: [], offEntityNames: [], about: true, boundary: null };
/** P5 — add-to-board handlers keyed by view; missing key returns undefined (button hidden outside brainstorm). */
const BOARD_ADD_HANDLERS: Partial<Record<AppView, (m: AiMessageRecord) => void>> = { brainstorm: (m) => window.dispatchEvent(new CustomEvent(BRAINSTORM_ADD_CARD, { detail: { text: m.text } })) };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssistantPanelProps {
  sceneId: string | null;
  sceneName: string | null;
  sceneWords: number;
  doc: Y.Doc | null;
  store: StoryBibleStore;
  /** Raw entity groups for the active scene — used by PanelReady for D4 display parity. */
  sceneEntityGroups: SceneEntityGroup[];
  tree: AiManuscriptTree;
  convos: ConversationRecord[]; setConvos: React.Dispatch<React.SetStateAction<ConversationRecord[]>>;
  activeId: string | null; setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  about: ManuscriptAbout; setAbout: (a: ManuscriptAbout) => void;
  aiCtx: AiCtxConfig; setAiCtx: (c: AiCtxConfig) => void;
  neverNames: string[]; toggleNever: (name: string) => void;
  usedPct: number; creditsBalance: number; resetLabel: string;
  plan: "active" | "trial" | "expired"; offline: boolean; consented: boolean;
  sel?: ProseSelection | null; initialVerb?: VerbKey; initialSel?: Pick<ProseSelection, "text" | "words"> | null;
  onOpenConsent: () => void; onOpenContext: () => void; onToast: (msg: string) => void; onSaveNote: (body: string) => void;
  onAddToBoard?: (m: AiMessageRecord) => void; onStreamDone?: () => void; onNetworkError?: () => void;
  monthlyAllowance: number; onBalanceAfter?: (b: number) => void;
  convStore?: AiConversationStore;
  projectId?: string | null; byokActive: boolean; byokKeys: { anthropic: boolean; openai: boolean; local?: boolean }; gateStatus?: GateStatus; // W49/Fix2: byok key map + app trial state
}

/** Props consumed by wrapInspectorSlot — App.content.tsx passes a superset. */
export interface SlotHostProps {
  selectedSceneId: string | null;
  activeScene: Scene | null;
  tree: BinderTree;
  doc?: Y.Doc | null;
  activeProjectId: string | null;
  storyBibleStore: StoryBibleStore;
  /** License gate status; controls whether trial AI mint is attempted. Optional for backward compat. */
  view?: AppView; aiEnabled: boolean;  gateStatus?: GateStatus;
}

interface InspectorTabsProps { tab: "scene" | "assistant"; setTab: (t: "scene" | "assistant") => void; scenePane: ReactNode; assistantPane: ReactNode; }

interface SlotPanelProps {
  convos: ConversationRecord[]; setConvos: React.Dispatch<React.SetStateAction<ConversationRecord[]>>;
  activeId: string | null; setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  about: ManuscriptAbout; setAbout: (a: ManuscriptAbout) => void;
  aiCtx: AiCtxConfig; setAiCtx: (c: AiCtxConfig) => void;
  neverNames: string[]; toggleNever: (n: string) => void;
  consented: boolean; aiTree: AiManuscriptTree;
  sceneId: string | null; sceneName: string | null; sceneWords: number;
  sceneEntityGroups: SceneEntityGroup[]; doc: Y.Doc | null | undefined; store: StoryBibleStore;
  onOpenConsent: () => void; onOpenContext: () => void; onToast: (msg: string) => void; onSaveNote: (body: string) => void;
  convStore: AiConversationStore; projectId: string | null; onAddToBoard?: (m: AiMessageRecord) => void;
  usedPct: number; creditsBalance: number; resetLabel: string;
  plan: "active" | "trial" | "expired"; offline: boolean;
  onStreamDone: () => void; onNetworkError?: () => void;
  monthlyAllowance: number; onBalanceAfter?: (b: number) => void;
  sel?: ProseSelection | null; initialVerb?: VerbKey; initialSel?: Pick<ProseSelection, "text" | "words"> | null;
  byokActive: boolean; byokKeys: { anthropic: boolean; openai: boolean; local?: boolean }; gateStatus?: GateStatus; // W49/Fix2
}

// ── PanelReady (consented state) ──────────────────────────────────────────────

// W51 P1: exported for unit testing. Returns the chosen model unchanged — routeByokSend's
// explicit guards surface "[No API key set]" or "[Unknown model]" when the model has no
// configured key. Removed: the km[0]?.id swap that silently rerouted to a different model.
export function computeEffectiveByokModel(model: ManagedModel, byokActive: boolean, byokKeys: { anthropic: boolean; openai: boolean; local?: boolean }): ManagedModel {
  if (!byokActive) return model;
  const km = PROVIDER_REGISTRY.filter((g) => (byokKeys as Partial<Record<ProviderId, boolean>>)[g.provider]).flatMap((g) => g.models);
  // find returns the entry whose id === model (same value) or undefined; ?? model
  // makes this always return model — no substitution in either path. ModelEntry.id
  // is `string` so the cast is safe: either branch resolves to model's string value.
  return (km.find((m) => m.id === model)?.id ?? model) as ManagedModel;
}

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
interface PanelFootProps {
  p: AssistantPanelProps; ctx: ReturnType<typeof useContextAssembly>;
  attachedSel: Pick<ProseSelection, "text" | "words"> | null; setAttachedSel: (s: Pick<ProseSelection, "text" | "words"> | null) => void;
  footerRef: React.RefObject<PanelFooterHandle | null>; model: ManagedModel; effectiveByokModel: ManagedModel;
  prompt: string; setPrompt: (v: string) => void; verb: VerbKey; verbPop: boolean; setVerbPop: Setter<boolean>;
  setVerb: (v: VerbKey) => void; modelPop: boolean; setModelPop: Setter<boolean>; setModel: (v: ManagedModel) => void;
  streamingId: string | null; send: () => void; stop: () => void;
}

function PanelFoot({ p, ctx, attachedSel, setAttachedSel, footerRef, model, effectiveByokModel, prompt, setPrompt, verb, verbPop, setVerbPop, setVerb, modelPop, setModelPop, setModel, streamingId, send, stop }: PanelFootProps) {
  const showTrialNudge = p.gateStatus === "trial" && p.plan === "active" && !p.byokActive && !!getTweak("aiLicenseKey", "");
  return (
    <div className="ai-foot">
      <ContextStripPanel sceneName={p.sceneName} extras={ctx.extras} linked={ctx.linked}
        attachedSel={attachedSel} sel={p.sel} hasAbout={ctx.hasAbout} aiCtx={p.aiCtx}
        boundaryLabel={ctx.boundaryLabel} setAttachedSel={setAttachedSel} onOpenContext={p.onOpenContext} />
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

function PanelReady(p: AssistantPanelProps) {
  const { verb, setVerb, prompt, setPrompt, verbPop, setVerbPop, attachedSel, setAttachedSel, streamingId, setStreamingId, model, setModel, modelPop, setModelPop, abortRef, sessionRef } = usePanelState(p.initialVerb, p.initialSel);
  const effectiveByokModel = useMemo(() => computeEffectiveByokModel(model, p.byokActive, p.byokKeys), [model, p.byokActive, p.byokKeys]);
  const footerRef = useRef<PanelFooterHandle | null>(null), hasSeededRef = useRef(false);
  const active = p.convos.find((c) => c.id === p.activeId) ?? null;
  // D4: merge neverNames into offEntityNames so display + send use the same filter.
  const effectiveAiCtx: AiCtxConfig = { ...p.aiCtx, offEntityNames: [...new Set([...p.aiCtx.offEntityNames, ...p.neverNames])] };
  const ctx = useContextAssembly({ sceneId: p.sceneId, sceneWords: p.sceneWords, aiCtx: effectiveAiCtx, neverNames: p.neverNames, tree: p.tree, about: p.about, active, sceneEntityGroups: p.sceneEntityGroups, model: effectiveByokModel, monthlyAllowance: p.monthlyAllowance });
  const ctxArgs: CtxArgs = { sceneName: p.sceneName, sceneWords: p.sceneWords, linked: ctx.linked, extras: ctx.extras, attachedSel, aiCtx: effectiveAiCtx, hasAbout: ctx.hasAbout, boundaryLabel: ctx.boundaryLabel };
  const canCompose = !p.offline && p.plan !== "expired" && p.usedPct < 100;
  const { send, stop, copyMsg, saveMsg, newConvo, deleteConvo } = usePanelMessages({
    convos: p.convos, setConvos: p.setConvos, activeId: p.activeId, setActiveId: p.setActiveId,
    prompt, setPrompt, verb, model: effectiveByokModel, attachedSel, setAttachedSel, streamingId, setStreamingId,
    canCompose, ctxArgs, sceneId: p.sceneId, sceneName: p.sceneName,
    doc: p.doc, store: p.store, abortRef, sessionRef, onToast: p.onToast, onSaveNote: p.onSaveNote, convStore: p.convStore, projectId: p.projectId, onStreamDone: p.onStreamDone, onNetworkError: p.onNetworkError, onBalanceAfter: p.onBalanceAfter, byokActive: p.byokActive, byokKeys: p.byokKeys,
  });
  // abortRef is a stable ref (never reassigned); a mount-once cleanup is correct here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { abortRef.current?.abort(); }, []);
  // Seed: one new convo per selection-seed. Gate: initialSel. Non-seed paths have initialSel=null → inert.
  // Declared after abort-cleanup. CONTRACT: see aiSeedNewConvo.test.ts.
  useEffect(() => { if (hasSeededRef.current || !p.initialSel) return; hasSeededRef.current = true; void newConvo(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const listMode = !active; const msgCount = active?.messages.length ?? 0; const lastLen = msgCount ? active!.messages[msgCount - 1].text.length : 0;
  const footProps: PanelFootProps = { p, ctx, attachedSel, setAttachedSel, footerRef, model, effectiveByokModel, prompt, setPrompt, verb, verbPop, setVerbPop, setVerb, modelPop, setModelPop, setModel, streamingId, send, stop };
  return (
    <div className="ai-panel">
      {p.offline && <OfflineBanner />}
      {/* W49 Phase 4: badge names the active model's provider (getBadgeLabel), not just the keyed providers. */}
      <div className="ai-byok-bar" hidden={!p.byokActive}><span className="ai-chip"><Icon name="shield" className="ic" /><span>{getBadgeLabel(effectiveByokModel)}</span></span></div>
      <PanelNav active={active} onBack={() => p.setActiveId(null)} onNew={newConvo} />
      <PanelThread msgCount={msgCount} lastLen={lastLen} activeId={p.activeId} listMode={listMode}
        active={active} convos={p.convos} verb={verb} setVerb={setVerb} onOpen={p.setActiveId}
        onNew={newConvo} onDelete={deleteConvo} streamingId={streamingId} onCopy={copyMsg}
        onSaveNote={saveMsg} onAddToBoard={p.onAddToBoard} onStarter={(s) => { setPrompt(s); footerRef.current?.focusInput(); }} onFocusInput={() => footerRef.current?.focusInput()} />
      {!listMode && <PanelFoot {...footProps} />}
    </div>
  );
}

// ── AssistantPanel ─────────────────────────────────────────────────────────────

export function AssistantPanel(props: AssistantPanelProps) {
  if (!props.consented) return <div className="ai-panel"><AiDormant onWake={props.onOpenConsent} /></div>;
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
        {scenePane != null && <div className={"insp-tab" + (tab === "scene" ? " on" : "")} role="button" onClick={() => setTab("scene")}>
          <Icon name="fileText" className="ic" /> Scene
        </div>}
        <div className={"insp-tab" + (tab === "assistant" ? " on" : "")} role="button" onClick={() => setTab("assistant")}>
          <Icon name="sparkle" className="ic" /> Assistant
        </div>
      </div>
      {scenePane != null && <div className="insp-pane" hidden={tab !== "scene"}>{scenePane}</div>}
      <div className="insp-pane" hidden={tab !== "assistant"}>{assistantPane}</div>
    </div>
  );
}

// ── useConvoPersistence (internal hook) ───────────────────────────────────────

/**
 * Owns conversation + message state backed by SQLite.
 * On project change: lists conversations (messages empty — lazy on open).
 * setActiveId wraps the raw setter to load messages when a conversation is opened.
 */
function useConvoPersistence(activeProjectId: string | null) {
  const convStore = useMemo(() => makeProductionAiConversationStore(), []);
  const [convos, setConvos] = useState<ConversationRecord[]>([]);
  const [activeId, setActiveId_] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const rows = activeProjectId ? await convStore.listConversations(activeProjectId) : [];
      if (cancelled) return;
      setConvos(rows.map((r) => ({ id: r.id, title: r.title, verb: r.lastVerb, when: "now", messages: [] })));
      setActiveId_(null);
    };
    void load();
    return () => { cancelled = true; };
  }, [activeProjectId, convStore]);

  const setActiveId: Dispatch<SetStateAction<string | null>> = useCallback((action) => {
    // Resolve the next id — we only load messages for direct-value calls (the common path).
    // Function-updater calls (SetStateAction's function form) skip message loading
    // since the previous state isn't available here without an extra ref.
    if (typeof action === "function") { setActiveId_(action); return; }
    setActiveId_(action);
    if (!action) return;
    convStore.listMessages(action).then((msgs) => {
      setConvos((cs) => cs.map((c) => {
        if (c.id !== action) return c;
        // Guard: if messages are already in local state (e.g. in-flight after newConvo + send),
        // skip the DB result so an empty/stale read never clobbers an in-flight message.
        if (c.messages.length > 0) return c;
        return { ...c, messages: msgs.map((m): AiMessageRecord => ({ id: m.id, role: m.role, verb: m.verb as VerbKey, when: "now", text: m.body, ctx: m.contextJson ? (JSON.parse(m.contextJson) as ContextSnapshot) : null, creditsCost: m.creditsCost })) };
      }));
    }).catch(console.error);
  }, [convStore]);

  return { convStore, convos, setConvos, activeId, setActiveId };
}

// ── useAiBalance ──────────────────────────────────────────────────────────────

/** Fetches balance on mount + on each refresh() call; derives meter + plan + offline state.
 *  When byokActive is true (any BYOK key present): skips all managed-meter fetches and returns
 *  safe no-op values so canCompose stays true (Decision 4). When gateStatus==='trial', allows
 *  a lazily-minted trial token. */
function useAiBalance(consented: boolean, byokActive: boolean, gateStatus: GateStatus = "checking") {
  const [usedPct, setUsedPct] = useState(0); const [creditsBalance, setCreditsBalance] = useState(0); const [monthlyAllowance, setMonthlyAllowance] = useState(0);
  const [plan, setPlan] = useState<"active" | "trial" | "expired">("active");
  const [resetLabel, setResetLabel] = useState("soon");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [balanceKey, setBalanceKey] = useState(0);
  const sessionRef = useRef<SessionResult | null>(null);
  const licenseKeyRef = useRef(getTweak("aiLicenseKey", ""));
  useEffect(() => {
    if (!consented || byokActive) return; // BYOK: no managed-meter fetch
    let cancelled = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const setters: BalanceSetters = { setUsedPct, setCreditsBalance, setMonthlyAllowance, setPlan, setResetLabel, setOffline };
    const scheduleRetry = (balance: number, key: string) => {
      if (!shouldRetryBalance(!!key, balance, attempt, BALANCE_RETRY_DELAYS.length)) return;
      const delay = BALANCE_RETRY_DELAYS[attempt];
      attempt += 1;
      retryTimer = setTimeout(() => { void run(); }, delay);
    };
    const run = () => fetchBalance({ sessionRef, setters, gateStatus, getCancelled: () => cancelled, scheduleRetry });
    void run();
    return () => { cancelled = true; if (retryTimer !== null) clearTimeout(retryTimer); };
  }, [consented, balanceKey, byokActive, gateStatus]); // stable module-level fns omitted from deps
  useEffect(() => {
    const goOnline = () => setOffline(false); const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline); window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);
  const refresh = useCallback(() => setBalanceKey((k) => k + 1), []); const applyBalance = useCallback((b: number) => { setCreditsBalance(b); if (monthlyAllowance > 0) setUsedPct(computeUsedPct(monthlyAllowance, b)); }, [monthlyAllowance]);
  useEffect(() => { if (byokActive) return; const h = () => { const cur = getTweak("aiLicenseKey", ""); if (cur !== licenseKeyRef.current) { licenseKeyRef.current = cur; refresh(); } }; window.addEventListener(SETTINGS_CHANGED_EVENT, h); return () => { window.removeEventListener(SETTINGS_CHANGED_EVENT, h); }; }, [byokActive, refresh]);
  // D4: BYOK has no managed meter; return safe no-ops so canCompose stays true.
  return byokActive ? { usedPct: 0, creditsBalance: 0, plan: "active" as const, resetLabel: "", offline: false, setOffline: () => {}, refresh: () => {}, monthlyAllowance: 0, applyBalance: () => {} } : { usedPct, creditsBalance, plan, resetLabel, offline, setOffline, refresh, monthlyAllowance, applyBalance };
}

// ── AiSlot + SlotPanel (internal) ─────────────────────────────────────────────

/** Derives neverNames from persisted exclude_from_ai and provides a toggleNever
 *  that persists via setEntityExclusion then bumps a refresh counter. */
function useToggleNever(sceneEntityGroups: SceneEntityGroup[], store: SlotHostProps["storyBibleStore"], setEntityRefreshKey: React.Dispatch<React.SetStateAction<number>>) {
  const neverNames = sceneEntityGroups.flatMap((g) => g.entities.filter((e) => e.exclude_from_ai === true).map((e) => e.name));
  const toggleNever = useCallback((n: string) => {
    const flat = sceneEntityGroups.flatMap((g) => g.entities.map((e) => ({ ...e, groupType: g.type })));
    const entity = flat.find((e) => e.name === n);
    if (!entity) return;
    const exclude = entity.exclude_from_ai !== true;
    void store.setEntityExclusion(entity.groupType, entity.id, exclude).then(() => {
      setEntityRefreshKey((k) => k + 1);
    });
  }, [sceneEntityGroups, store, setEntityRefreshKey]);
  return { neverNames, toggleNever };
}

function SlotPanel(p: SlotPanelProps) {
  return <AiErrorBoundary><AssistantPanel
    sceneId={p.sceneId} sceneName={p.sceneName} sceneWords={p.sceneWords} store={p.store} tree={p.aiTree} sceneEntityGroups={p.sceneEntityGroups}
    convos={p.convos} setConvos={p.setConvos} activeId={p.activeId} setActiveId={p.setActiveId}
    about={p.about} setAbout={p.setAbout} aiCtx={p.aiCtx} setAiCtx={p.setAiCtx} neverNames={p.neverNames} toggleNever={p.toggleNever}
    usedPct={p.usedPct} creditsBalance={p.creditsBalance} resetLabel={p.resetLabel} plan={p.plan} offline={p.offline}
    consented={p.consented} sel={p.sel} initialVerb={p.initialVerb} initialSel={p.initialSel}
    onOpenConsent={p.onOpenConsent} onOpenContext={p.onOpenContext} onToast={p.onToast} onSaveNote={p.onSaveNote} onStreamDone={p.onStreamDone} onNetworkError={p.onNetworkError} onBalanceAfter={p.onBalanceAfter} monthlyAllowance={p.monthlyAllowance}
    convStore={p.convStore} projectId={p.projectId} doc={p.doc ?? null} byokActive={p.byokActive} byokKeys={p.byokKeys}
    gateStatus={p.gateStatus} onAddToBoard={p.onAddToBoard}
  /></AiErrorBoundary>;
}

function AiSlot({ base, p }: { base: ReactNode; p: SlotHostProps }) {
  const [inspTab, setInspTab] = useState<"scene" | "assistant">("scene");
  const tab = base != null ? inspTab : "assistant";
  const [overlay, setOverlay] = useState<"consent" | "context" | null>(null);
  const { convStore, convos, setConvos, activeId, setActiveId } = useConvoPersistence(p.activeProjectId);
  const { about, saveAbout } = useManuscriptAbout(p.activeProjectId, p.storyBibleStore); const [aiCtx, setAiCtx] = useState<AiCtxConfig>(INIT_AI_CTX);
  // W52 Phase 4: exclusion refresh counter — bump after setEntityExclusion to reload entity groups.
  const [entityRefreshKey, setEntityRefreshKey] = useState(0);
  const { toast, onToast, onSaveNote, handleEnable } = useAiSlotHandlers(p.activeProjectId, setOverlay, setInspTab); const consented = getTweak("aiConsentGiven", false);
  const { byokActive, ...byokKeys } = useByokKeys(); const { usedPct, creditsBalance, plan, resetLabel, offline, setOffline, refresh, monthlyAllowance, applyBalance } = useAiBalance(consented, byokActive, p.gateStatus);
  const { panelKey, initialVerb, initialSel } = useAiPanelSeed(setInspTab, setActiveId);
  const liveSel = useProseSelection(); const aiTree = toAiTree(p.tree);
  const sceneId = p.selectedSceneId; const sceneName = p.activeScene?.title ?? null; const sceneWords = p.activeScene?.word_count ?? 0;
  // D4: load raw entity groups; derive picker-facing list and persisted never-set.
  const sceneEntityGroups = useSceneEntityGroups(sceneId, p.storyBibleStore, entityRefreshKey);
  const allEntities = sceneEntityGroups.flatMap((g) => g.entities.filter((e) => e.exclude_from_ai !== true).map((e) => ({ id: e.id, name: e.name })));
  const { neverNames, toggleNever } = useToggleNever(sceneEntityGroups, p.storyBibleStore, setEntityRefreshKey);
  return (<>
    <InspectorTabs tab={tab} setTab={setInspTab} scenePane={base} assistantPane={
      <SlotPanel key={panelKey} convos={convos} setConvos={setConvos} activeId={activeId} setActiveId={setActiveId}
        about={about} setAbout={saveAbout} aiCtx={aiCtx} setAiCtx={setAiCtx}
        neverNames={neverNames} toggleNever={toggleNever} consented={consented}
        aiTree={aiTree} sceneId={sceneId} sceneName={sceneName} sceneWords={sceneWords} sceneEntityGroups={sceneEntityGroups}
        doc={p.doc} store={p.storyBibleStore} onOpenConsent={() => setOverlay("consent")}
        onOpenContext={() => setOverlay("context")} onToast={onToast} onSaveNote={onSaveNote}
        convStore={convStore} projectId={p.activeProjectId}
        usedPct={usedPct} creditsBalance={creditsBalance} resetLabel={resetLabel} plan={plan} offline={offline}
        onStreamDone={refresh} onNetworkError={() => { setOffline(true); }} onBalanceAfter={applyBalance} monthlyAllowance={monthlyAllowance} sel={liveSel} initialVerb={initialVerb} initialSel={initialSel} byokActive={byokActive} byokKeys={byokKeys}
        gateStatus={p.gateStatus} onAddToBoard={BOARD_ADD_HANDLERS[p.view!]} />
    } />
    {overlay === "consent" && <AiConsent onClose={() => setOverlay(null)} onEnable={handleEnable} />}
    {overlay === "context" && <AiContextPicker tree={aiTree} scene={{ id: sceneId ?? "", title: sceneName ?? "", words: sceneWords }}
      entities={allEntities} aiCtx={aiCtx} setAiCtx={setAiCtx} neverNames={neverNames} toggleNever={toggleNever}
      about={about} setAbout={saveAbout} resetLabel={resetLabel} onClose={() => setOverlay(null)} model={getTweak("aiModel", DEFAULT_MODEL) as ManagedModel} monthlyAllowance={monthlyAllowance} />}
    <AiToast msg={toast} />
  </>);
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
