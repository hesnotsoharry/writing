import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { getBinderStore } from "../../db/stores";
import type { LiveSceneFlushResult } from "../../shared/engine";
import { parseWebViewMessage } from "../../shared/mobileEditorBridgeProtocol";
import { createMobileLiveScenePort, subscribeMobileDocReplaced } from "../../sync/mobileEngine";
import {
  MOBILE_LIVE_SCENE_ACK_TIMEOUT_MS, type MobileLiveScenePort,
} from "../../sync/mobileLiveScenePort";
import { useTheme } from "../../theme/ThemeProvider";
import type {
  EditorCommandName, EditorSelectionMessage, EditorSelectionState,
} from "./editorUiProtocol";
import { getEditorWebAssetUri } from "./editorWebAsset";
import { FormatBar } from "./FormatBar";
import { deriveFormatBarState } from "./formatBarState";
import { NativeEditorUiController } from "./nativeEditorUi";
import { createSceneEditorState, reduceSceneEditor, type SceneEditorAction } from "./sceneEditorState";
import { useSceneExitGuard } from "./useSceneExitGuard";

export type SceneEditorSelection = EditorSelectionState;
export interface SceneEditorHostProps {
  sceneId: string;
  projectId?: string;
  onSelectionChange?: (selection: SceneEditorSelection) => void;
  onRequestEntityLink?: (selection: SceneEditorSelection | null) => void;
  onRequestSelectionActions?: (selection: SceneEditorSelection | null) => void;
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
    }, MOBILE_LIVE_SCENE_ACK_TIMEOUT_MS);
    void getEditorWebAssetUri().then((loadedUri) => {
      if (!current) return;
      clearTimeout(timer); setUri(loadedUri); dispatch({ type: "asset-loaded", token: 1 });
    }).catch(() => { if (current) dispatch({ type: "asset-failed", token: 1 }); });
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
    void port.start().catch(() => { dispatch({ type: "editor-failed" }); });
    return () => { void port.close(); };
  }, [dispatch, port, uri]);
}

function useHandshakeTimeout(phase: string, dispatch: Dispatch): void {
  useEffect(() => {
    if (!["waiting-ready", "hydrating"].includes(phase)) return undefined;
    const timer = setTimeout(() => { dispatch({ type: "editor-failed" }); },
      MOBILE_LIVE_SCENE_ACK_TIMEOUT_MS);
    return () => { clearTimeout(timer); };
  }, [dispatch, phase]);
}

function FallbackNotice() {
  const theme = useTheme();
  return <View pointerEvents="box-none" style={styles.fallbackLayer}>
    <View style={[styles.notice, { backgroundColor: theme.colors.parchment }]}>
      <Text style={[styles.noticeText, { color: theme.colors.ink2 }]}>Couldn&apos;t load the editor — read-only</Text>
    </View>
  </View>;
}

function OpeningOverlay() {
  const theme = useTheme();
  return <View style={[styles.opening, { backgroundColor: theme.colors.paper }]}>
    <ActivityIndicator color={theme.colors.accent} />
    <Text style={[styles.noticeText, { color: theme.colors.ink2 }]}>Opening editor…</Text>
  </View>;
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
  onCommand(command: EditorCommandName): void;
  onRequestEntityLink?(): void;
  onRequestAi?(): void;
  onFailed(): void; onTerminated(): void; onRetry(): void; onStay(): void;
}

function isLocalNavigation(request: { url: string }, localUri: string): boolean {
  return request.url === localUri || request.url.startsWith(`${localUri}#`);
}

function EditorSurface({
  bindWebView, formatState, localUri, onCommand, onFailed, onMessage,
  onRequestAi, onRequestEntityLink, onRetry, onStay, onTerminated, phase, webViewKey, wordCount,
}: EditorSurfaceProps) {
  const theme = useTheme();
  const opening = !["editable", "saving", "save-blocked"].includes(phase);
  return <View style={styles.host}>
    <WebView key={webViewKey} ref={bindWebView} source={{ uri: localUri }}
      allowFileAccess originWhitelist={["file://*"]}
      onShouldStartLoadWithRequest={(request) => isLocalNavigation(request, localUri)}
      onMessage={onMessage} onError={onFailed}
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

function handleParsedMessage(message: ReturnType<typeof parseWebViewMessage>,
  options: BridgeMessageOptions): void {
  if (message?.type === "ready") options.dispatch({ type: "ready", sessionId: message.sessionId });
  if (message?.type === "ack" && message.ackType === "hydrate") {
    options.ui.start(message.sessionId, options.uiColors);
    options.dispatch({ type: "hydrate-acked", sessionId: message.sessionId });
  }
  if (message?.type === "update") options.refresh();
  if (message?.type === "error") options.dispatch({ type: "editor-failed" });
}

async function receiveBridgeEvent(event: WebViewMessageEvent, options: BridgeMessageOptions) {
  const raw = event.nativeEvent.data;
  if (options.ui.receive(raw)) return;
  const message = parseWebViewMessage(raw);
  await options.port.receive(raw);
  handleParsedMessage(message, options);
}

function useBridgeMessage(options: BridgeMessageOptions) {
  return useCallback((event: WebViewMessageEvent) => receiveBridgeEvent(event, options),
    [options]);
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

export function SceneEditorHost({
  onRequestEntityLink, onRequestSelectionActions, onSelectionChange, projectId, sceneId,
}: SceneEditorHostProps) {
  const theme = useTheme();
  const [state, dispatch] = useReducer(reduceSceneEditor, undefined, createSceneEditorState);
  const [{ port, transport }] = useState(() => createHostPort(sceneId));
  const [selection, setSelection] = useState<EditorSelectionMessage | null>(null);
  const onSelection = useCallback((next: EditorSelectionMessage) => {
    setSelection(next); onSelectionChange?.(next);
  }, [onSelectionChange]);
  const ui = useMemo(() => new NativeEditorUiController(sceneId, transport, onSelection),
    [onSelection, sceneId, transport]);
  const colors = useMemo(() => ({
    theme: theme.name, character: theme.label.clay, location: theme.label.moss,
    item: theme.label.gold, faction: theme.label.plum, lore: theme.label.sea,
    themeType: theme.label.slate,
  }), [theme]);
  const localUri = useEditorAsset(dispatch);
  const [wordCount, refresh] = useWordCount(projectId, sceneId);
  usePortLifecycle(port, localUri, dispatch);
  useHandshakeTimeout(state.phase, dispatch);
  useEffect(() => { if (state.phase === "fallback") void port.close(); }, [port, state.phase]);
  const { guard, stay } = useExitState(port, state, dispatch);
  const onMessage = useBridgeMessage({ port, ui, uiColors: colors, dispatch, refresh });
  if (state.phase === "fallback") return <FallbackNotice />;
  if (!localUri) return <View style={styles.host}><OpeningOverlay /></View>;
  return <EditorSurface localUri={localUri} webViewKey={state.webViewKey} phase={state.phase}
    wordCount={wordCount} formatState={deriveFormatBarState(selection)} bindWebView={transport.bind}
    onMessage={(event) => { void onMessage(event); }} onCommand={(command) => { ui.command(command); }}
    onRequestEntityLink={onRequestEntityLink
      ? () => { onRequestEntityLink(selection); } : undefined}
    onRequestAi={onRequestSelectionActions
      ? () => { onRequestSelectionActions(selection); } : undefined}
    onFailed={() => { dispatch({ type: "editor-failed" }); }}
    onTerminated={() => { dispatch({ type: "process-terminated" }); }}
    onRetry={() => { void guard.retry(); }} onStay={stay} />;
}

const styles = StyleSheet.create({
  host: { flex: 1 }, webView: { flex: 1 },
  opening: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: 10 },
  fallbackLayer: { position: "absolute", inset: 0, zIndex: 2 },
  notice: { margin: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  noticeText: { fontSize: 13, textAlign: "center" },
  savingFooter: { minHeight: 24, alignItems: "center", justifyContent: "center" },
  blockedFooter: {
    minHeight: 44, borderTopWidth: 1, paddingHorizontal: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
});
