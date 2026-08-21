import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { getBinderStore } from "../../db/stores";
import type { LiveSceneFlushResult } from "../../shared/engine";
import { createMobileLiveScenePort, subscribeMobileDocReplaced } from "../../sync/mobileEngine";
import {
  type MobileLiveScenePort, subscribeMobileSceneReplaced,
} from "../../sync/mobileLiveScenePort";
import { useTheme } from "../../theme/ThemeProvider";
import { copyText } from "../ai/mobileClipboard";
import type { SelectionCommand } from "../ai/selectionBridge";
import type { FocusSettings } from "../focus/focusSettings";
import type { AutoLinkTapPayload } from "../storybible";
import { routeBridgeMessage } from "./bridgeRouting";
import {
  EDITOR_ASSET_TIMEOUT_MS, EDITOR_BOOT_TIMEOUT_MS, EDITOR_ERROR_FORWARDER,
} from "./editorBootBudget";
import { OpeningOverlay } from "./editorOverlays";
import type {
  EditorCommandName, EditorSelectionMessage, EditorSelectionState,
} from "./editorUiProtocol";
import { getEditorWebAssetUri } from "./editorWebAsset";
import { FormatBar } from "./FormatBar";
import { deriveFormatBarState } from "./formatBarState";
import { createEditorThemeBootstrap, NativeEditorUiController } from "./nativeEditorUi";
import { createSceneEditorState, reduceSceneEditor, type SceneEditorAction } from "./sceneEditorState";
import { useSceneExitGuard } from "./useSceneExitGuard";

export type SceneEditorSelection = EditorSelectionState;
export interface SceneEditorHostProps {
  sceneId: string;
  projectId?: string;
  onSelectionChange?: (selection: SceneEditorSelection) => void;
  onRequestEntityLink?: (selection: SceneEditorSelection | null) => void;
  onRequestSelectionActions?: (
    selection: SceneEditorSelection | null, command: (command: SelectionCommand) => void,
  ) => void;
  focus?: { enabled: boolean; settings: FocusSettings };
  onWordCountChange?: (wordCount: number) => void;
  onAutoLinkTap?: (payload: AutoLinkTapPayload) => void;
  /** Fires when the editor gives up and the read-only reader should take over.
   *  SceneScreen owns everything past that point — it unmounts this host and
   *  renders the reader plus the retry notice itself. */
  onFallbackChange?: (isFallback: boolean) => void;
}

type Dispatch = (action: SceneEditorAction) => void;

class WebViewTransport {
  private view: WebView | null = null;
  postMessage = (message: string): void => { this.view?.postMessage(message); };
  bind = (view: WebView | null): void => { this.view = view; };
}

function createHostPort(sceneId: string) {
  const transport = new WebViewTransport();
  return { transport, port: createMobileLiveScenePort({ sceneId, transport }) };
}

function useEditorAsset(dispatch: Dispatch): string | null {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      if (current) dispatch({ type: "asset-failed", token: 1 });
    }, EDITOR_ASSET_TIMEOUT_MS);
    void getEditorWebAssetUri().then((loadedUri) => {
      if (!current) return;
      clearTimeout(timer); setUri(loadedUri); dispatch({ type: "asset-loaded", token: 1 });
    }).catch((error: unknown) => {
      // The editor falling back to read-only is a visible, confusing failure —
      // "Couldn't load the editor" with no reason is not diagnosable from a
      // device. Surface the cause; the fallback still renders either way.
      console.error("[editor] asset load failed", error);
      if (current) dispatch({ type: "asset-failed", token: 1 });
    });
    return () => { current = false; clearTimeout(timer); };
  }, [dispatch]);
  return uri;
}

async function loadWordCount(projectId: string | undefined, sceneId: string): Promise<number> {
  if (!projectId) return 0;
  const store = await getBinderStore();
  const data = await store.loadProject(projectId);
  return data.scenes.find(({ id }) => id === sceneId)?.word_count ?? 0;
}

function useWordCount(projectId: string | undefined, sceneId: string): [number, () => void] {
  const [wordCount, setWordCount] = useState(0);
  const refresh = useCallback(() => {
    void loadWordCount(projectId, sceneId).then(setWordCount).catch(() => undefined);
  }, [projectId, sceneId]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 750);
    const unsubscribe = subscribeMobileDocReplaced((id) => { if (id === sceneId) refresh(); });
    return () => { clearInterval(timer); unsubscribe(); };
  }, [refresh, sceneId]);
  return [wordCount, refresh];
}

function usePortLifecycle(port: MobileLiveScenePort, uri: string | null, dispatch: Dispatch): void {
  useEffect(() => {
    if (!uri) return undefined;
    void port.start().catch((error: unknown) => {
      console.error("[editor] port.start failed", error);
      dispatch({ type: "editor-failed" });
    });
    return () => { void port.close(); };
  }, [dispatch, port, uri]);
}

function useHandshakeTimeout(phase: string, dispatch: Dispatch): void {
  useEffect(() => {
    if (!["waiting-ready", "hydrating"].includes(phase)) return undefined;
    const timer = setTimeout(() => { dispatch({ type: "editor-failed" }); }, EDITOR_BOOT_TIMEOUT_MS);
    return () => { clearTimeout(timer); };
  }, [dispatch, phase]);
}

interface SaveFooterProps { phase: string; onRetry(): void; onStay(): void }
function SaveFooter({ onRetry, onStay, phase }: SaveFooterProps) {
  const theme = useTheme();
  if (phase === "saving") return <View style={styles.savingFooter}>
    <Text style={[styles.noticeText, { color: theme.colors.ink3 }]}>Saving…</Text>
  </View>;
  if (phase !== "save-blocked") return null;
  return <View style={[styles.blockedFooter, { borderColor: theme.colors.line }]}>
    <Text style={[styles.noticeText, { color: theme.colors.ink2 }]}>Still saving — Retry or Stay</Text>
    <Pressable onPress={onRetry}><Text style={{ color: theme.colors.accent }}>Retry</Text></Pressable>
    <Pressable onPress={onStay}><Text style={{ color: theme.colors.accent }}>Stay</Text></Pressable>
  </View>;
}

interface EditorSurfaceProps {
  localUri: string; webViewKey: number; phase: string; wordCount: number;
  formatState: ReturnType<typeof deriveFormatBarState>;
  bindWebView(view: WebView | null): void;
  onMessage(event: WebViewMessageEvent): void;
  onPotentialEdit(): void;
  onCommand(command: EditorCommandName): void;
  onRequestEntityLink?(): void;
  onRequestAi?(): void;
  onFailed(): void; onTerminated(): void; onRetry(): void; onStay(): void;
}

function isLocalNavigation(request: { url: string }, localUri: string): boolean {
  return request.url === localUri || request.url.startsWith(`${localUri}#`);
}

function EditorSurface({
  bindWebView, formatState, localUri, onCommand, onFailed, onMessage, onPotentialEdit,
  onRequestAi, onRequestEntityLink, onRetry, onStay, onTerminated, phase, webViewKey, wordCount,
}: EditorSurfaceProps) {
  const theme = useTheme();
  const opening = !["editable", "saving", "save-blocked"].includes(phase);
  const injectedJavaScript = `${createEditorThemeBootstrap(theme.name)}\n${EDITOR_ERROR_FORWARDER}`;
  return <View style={styles.host}>
    <WebView key={webViewKey} ref={bindWebView} source={{ uri: localUri }}
      allowFileAccess originWhitelist={["file://*"]}
      onShouldStartLoadWithRequest={(request) => isLocalNavigation(request, localUri)}
      // Seed the theme before the first paint, and forward otherwise invisible
      // WebView errors so a broken handshake remains diagnosable from a device.
      injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
      onTouchStart={onPotentialEdit}
      onHttpError={(event) => {
        console.error("[editor] webview httpError", JSON.stringify(event.nativeEvent));
      }}
      onMessage={onMessage} onError={(event) => {
        console.error("[editor] webview error", JSON.stringify(event.nativeEvent));
        onFailed();
      }}
      onContentProcessDidTerminate={onTerminated}
      style={[styles.webView, { backgroundColor: theme.colors.paper }]} />
    {opening && <OpeningOverlay />}
    <SaveFooter phase={phase} onRetry={onRetry} onStay={onStay} />
    <FormatBar state={formatState} wordCount={wordCount}
      onCommand={onCommand} onRequestEntityLink={onRequestEntityLink} onRequestAi={onRequestAi} />
  </View>;
}

interface BridgeMessageOptions {
  port: MobileLiveScenePort;
  ui: NativeEditorUiController;
  uiColors: Record<string, string>;
  dispatch: Dispatch;
  refresh(): void;
}

function useBridgeMessage(options: BridgeMessageOptions) {
  return useCallback((event: WebViewMessageEvent) =>
    routeBridgeMessage(event.nativeEvent.data, options), [options]);
}

function useExitState(port: MobileLiveScenePort, state: ReturnType<typeof createSceneEditorState>,
  dispatch: Dispatch) {
  const onSaving = useCallback(() => { dispatch({ type: "save-started" }); }, [dispatch]);
  const onResult = useCallback((result: LiveSceneFlushResult) => {
    dispatch({ type: "save-finished", result });
  }, [dispatch]);
  const guard = useSceneExitGuard({ enabled: state.editingBegan, port, onSaving, onResult });
  const stay = useCallback(() => { guard.stay(); dispatch({ type: "save-stayed" }); }, [dispatch, guard]);
  return { guard, stay };
}

function useFocusUi({ activeParagraph, focus, onWordCountChange, ui, wordCount }: {
  ui: NativeEditorUiController; focus: SceneEditorHostProps["focus"];
  activeParagraph: number | undefined; wordCount: number;
  onWordCountChange: SceneEditorHostProps["onWordCountChange"];
}): void {
  useEffect(() => { onWordCountChange?.(wordCount); }, [onWordCountChange, wordCount]);
  useEffect(() => { ui.focus({ enabled: focus?.enabled ?? false,
    dimParagraphs: focus?.settings.dimParagraphs ?? false,
    typewriter: focus?.settings.typewriter ?? false,
    activeParagraph: activeParagraph ?? null,
  }); }, [activeParagraph, focus, ui]);
}

function useEditorTheme(ui: NativeEditorUiController, colors: Record<string, string>): void {
  useEffect(() => { ui.theme(colors); }, [colors, ui]);
}

function useNativeEditorUi({ onAutoLinkTap, onSelectionChange, sceneId, transport }: {
  onAutoLinkTap: SceneEditorHostProps["onAutoLinkTap"];
  onSelectionChange: SceneEditorHostProps["onSelectionChange"];
  sceneId: string; transport: WebViewTransport;
}) {
  const theme = useTheme();
  const [selection, setSelection] = useState<EditorSelectionMessage | null>(null);
  const onSelection = useCallback((next: EditorSelectionMessage) => {
    setSelection(next); onSelectionChange?.(next);
  }, [onSelectionChange]);
  const ui = useMemo(() => new NativeEditorUiController(
    sceneId, transport, onSelection,
    (tap) => onAutoLinkTap?.({
      sceneId, entityId: tap.entityId, entityType: tap.entityType, anchor: tap.rect,
    }),
  ), [onAutoLinkTap, onSelection, sceneId, transport]);
  const colors = useMemo(() => ({
    theme: theme.name, character: theme.label.clay, location: theme.label.moss,
    item: theme.label.gold, faction: theme.label.plum, lore: theme.label.sea,
    themeType: theme.label.slate,
  }), [theme]);
  return { colors, selection, ui };
}

function useSelectionCommand(
  ui: NativeEditorUiController, selection: EditorSelectionMessage | null,
  onRequestEntityLink: SceneEditorHostProps["onRequestEntityLink"],
) {
  return useCallback((command: SelectionCommand): void => {
    if (command === "copy") { void copyText(selection?.aiSafeText ?? ""); return; }
    if (command === "link-entity") { onRequestEntityLink?.(selection); return; }
    ui.command(command);
  }, [onRequestEntityLink, selection, ui]);
}

export function SceneEditorHost({
  focus, onAutoLinkTap, onFallbackChange, onRequestEntityLink, onRequestSelectionActions,
  onSelectionChange, onWordCountChange, projectId, sceneId,
}: SceneEditorHostProps) {
  const [state, dispatch] = useReducer(reduceSceneEditor, undefined, createSceneEditorState);
  const [{ port, transport }] = useState(() => createHostPort(sceneId));
  const { colors, selection, ui } = useNativeEditorUi({
    onAutoLinkTap, onSelectionChange, sceneId, transport,
  });
  const localUri = useEditorAsset(dispatch);
  const [wordCount, refresh] = useWordCount(projectId, sceneId);
  useEditorTheme(ui, colors);
  useFocusUi({ ui, focus, activeParagraph: selection?.from, wordCount, onWordCountChange });
  usePortLifecycle(port, localUri, dispatch);
  useFocusEffect(useCallback(() => () => { void port.flushLocal(); }, [port]));
  useEffect(() => subscribeMobileSceneReplaced((id) => { if (id === sceneId) dispatch({ type: "scene-replaced" }); }), [sceneId]);
  useHandshakeTimeout(state.phase, dispatch);
  useEffect(() => { if (state.phase === "fallback") void port.close(); }, [port, state.phase]);
  // Tell the screen whether the editor gave up, so it can show the read-only
  // reader INSTEAD of the editor rather than stacked above it.
  const isFallback = state.phase === "fallback";
  useEffect(() => { onFallbackChange?.(isFallback); }, [isFallback, onFallbackChange]);
  const { guard, stay } = useExitState(port, state, dispatch);
  const onMessage = useBridgeMessage({ port, ui, uiColors: colors, dispatch, refresh });
  const selectionCommand = useSelectionCommand(ui, selection, onRequestEntityLink);
  // Nothing to draw: the notice and the reader belong to SceneScreen, which
  // swaps this host out entirely once onFallbackChange has fired.
  if (state.phase === "fallback") return null;
  if (!localUri) return <View style={styles.host}><OpeningOverlay /></View>;
  return <EditorSurface localUri={localUri} webViewKey={state.webViewKey} phase={state.phase}
    wordCount={wordCount} formatState={deriveFormatBarState(selection)} bindWebView={transport.bind}
    onMessage={(event) => { void onMessage(event); }} onCommand={(command) => { ui.command(command); }}
    onPotentialEdit={() => port.notePotentialLocalChanges()}
    onRequestEntityLink={onRequestEntityLink
      ? () => { onRequestEntityLink(selection); } : undefined}
    onRequestAi={onRequestSelectionActions
      ? () => { onRequestSelectionActions(selection, selectionCommand); } : undefined}
    onFailed={() => { dispatch({ type: "editor-failed" }); }}
    onTerminated={() => { dispatch({ type: "process-terminated" }); }}
    onRetry={() => { void guard.retry(); }} onStay={stay} />;
}

const styles = StyleSheet.create({
  host: { flex: 1 }, webView: { flex: 1 },
  noticeText: { fontSize: 13, textAlign: "center" },
  savingFooter: { minHeight: 24, alignItems: "center", justifyContent: "center" },
  blockedFooter: {
    minHeight: 44, borderTopWidth: 1, paddingHorizontal: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
});
