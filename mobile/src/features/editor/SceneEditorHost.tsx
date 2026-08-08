import { useCallback, useEffect, useReducer, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { getMobileDb } from "../../db/database";
import type { LiveSceneFlushResult } from "../../shared/engine";
import { parseWebViewMessage } from "../../shared/mobileEditorBridgeProtocol";
import {
  createMobileLiveScenePort, subscribeMobileDocReplaced,
} from "../../sync/mobileEngine";
import {
  MOBILE_LIVE_SCENE_ACK_TIMEOUT_MS, type MobileLiveScenePort,
} from "../../sync/mobileLiveScenePort";
import { PALETTE } from "../../theme/palette";
import { getEditorWebAssetUri } from "./editorWebAsset";
import {
  createSceneEditorState, reduceSceneEditor, type SceneEditorAction,
} from "./sceneEditorState";
import { useSceneExitGuard } from "./useSceneExitGuard";

interface SceneEditorHostProps { sceneId: string }
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
    const token = 1;
    const timer = setTimeout(() => {
      if (!current) return;
      current = false;
      dispatch({ type: "asset-failed", token });
    }, MOBILE_LIVE_SCENE_ACK_TIMEOUT_MS);
    getEditorWebAssetUri().then((loadedUri) => {
      if (!current) return;
      clearTimeout(timer);
      setUri(loadedUri);
      dispatch({ type: "asset-loaded", token });
    }).catch(() => {
      if (!current) return;
      clearTimeout(timer);
      dispatch({ type: "asset-failed", token });
    });
    return () => { current = false; clearTimeout(timer); };
  }, [dispatch]);
  return uri;
}

async function loadPersistedWordCount(sceneId: string): Promise<number> {
  const db = await getMobileDb();
  const rows = await db.select<Array<{ word_count: number }>>(
    "SELECT word_count FROM scenes WHERE id = $1", [sceneId],
  );
  return rows[0]?.word_count ?? 0;
}

function usePersistedWordCount(sceneId: string): [number, () => void] {
  const [wordCount, setWordCount] = useState(0);
  const refresh = useCallback(() => {
    loadPersistedWordCount(sceneId)
      .then((count) => { setWordCount(count); })
      .catch(() => undefined);
  }, [sceneId]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 750);
    const unsubscribe = subscribeMobileDocReplaced((changedId) => {
      if (changedId === sceneId) refresh();
    });
    return () => { clearInterval(timer); unsubscribe(); };
  }, [refresh, sceneId]);
  return [wordCount, refresh];
}

function usePortLifecycle(
  port: MobileLiveScenePort,
  uri: string | null,
  dispatch: Dispatch,
): void {
  useEffect(() => {
    if (!uri) return undefined;
    port.start().catch(() => { dispatch({ type: "editor-failed" }); });
    return () => { void port.close(); };
  }, [dispatch, port, uri]);
}

function useHandshakeTimeout(phase: string, dispatch: Dispatch): void {
  useEffect(() => {
    const waiting = ["waiting-ready", "hydrating"].includes(phase);
    if (!waiting) return undefined;
    const timer = setTimeout(() => { dispatch({ type: "editor-failed" }); },
      MOBILE_LIVE_SCENE_ACK_TIMEOUT_MS);
    return () => { clearTimeout(timer); };
  }, [dispatch, phase]);
}

function isLocalNavigation(request: { url: string }, localUri: string): boolean {
  return request.url === localUri || request.url.startsWith(`${localUri}#`);
}

function FallbackNotice() {
  return (
    <View pointerEvents="box-none" style={styles.fallbackLayer}>
      <View style={styles.notice}><Text style={styles.noticeText}>
        {"Couldn't load the editor — read-only"}
      </Text></View>
    </View>
  );
}

interface FooterProps {
  wordCount: number;
  phase: string;
  onRetry(): void;
  onStay(): void;
}

interface EditorSurfaceProps {
  localUri: string;
  webViewKey: number;
  phase: string;
  wordCount: number;
  bindWebView(view: WebView | null): void;
  onMessage(event: WebViewMessageEvent): void;
  onFailed(): void;
  onTerminated(): void;
  onRetry(): void;
  onStay(): void;
}

function EditorFooter({ wordCount, phase, onRetry, onStay }: FooterProps) {
  if (phase === "save-blocked") {
    return (
      <View style={styles.blockedFooter}>
        <Text style={styles.footerText}>Still saving — Retry or Stay</Text>
        <Pressable onPress={onRetry}><Text style={styles.actionText}>Retry</Text></Pressable>
        <Pressable onPress={onStay}><Text style={styles.actionText}>Stay</Text></Pressable>
      </View>
    );
  }
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>{wordCount.toLocaleString()} words</Text>
      {phase === "saving" && <Text style={styles.savingText}>Saving…</Text>}
    </View>
  );
}

function OpeningOverlay() {
  return (
    <View style={styles.opening}>
      <ActivityIndicator color={PALETTE.accent} />
      <Text style={styles.noticeText}>Opening editor…</Text>
    </View>
  );
}

function EditorSurface({
  bindWebView, localUri, onFailed, onMessage, onRetry, onStay,
  onTerminated, phase, webViewKey, wordCount,
}: EditorSurfaceProps) {
  const opening = !["editable", "saving", "save-blocked"].includes(phase);
  return (
    <View style={styles.host}>
      <WebView
        key={webViewKey}
        ref={bindWebView}
        source={{ uri: localUri }}
        allowFileAccess
        originWhitelist={["file://*"]}
        onShouldStartLoadWithRequest={(request) => isLocalNavigation(request, localUri)}
        onMessage={onMessage}
        onError={onFailed}
        onContentProcessDidTerminate={onTerminated}
        style={styles.webView}
      />
      {opening && <OpeningOverlay />}
      <EditorFooter
        wordCount={wordCount} phase={phase}
        onRetry={onRetry} onStay={onStay}
      />
    </View>
  );
}

function useBridgeMessage(
  port: MobileLiveScenePort,
  dispatch: Dispatch,
  refreshWordCount: () => void,
) {
  return useCallback(async (event: WebViewMessageEvent) => {
    const raw = event.nativeEvent.data;
    const message = parseWebViewMessage(raw);
    if (message?.type === "ready") dispatch({ type: "ready", sessionId: message.sessionId });
    await port.receive(raw);
    if (message?.type === "ack" && message.ackType === "hydrate") {
      dispatch({ type: "hydrate-acked", sessionId: message.sessionId });
    }
    if (message?.type === "update") refreshWordCount();
    if (message?.type === "error") dispatch({ type: "editor-failed" });
  }, [dispatch, port, refreshWordCount]);
}

export function SceneEditorHost({ sceneId }: SceneEditorHostProps) {
  const [state, dispatch] = useReducer(reduceSceneEditor, undefined, createSceneEditorState);
  const [{ port, transport }] = useState(() => createHostPort(sceneId));
  const localUri = useEditorAsset(dispatch);
  const [wordCount, refreshWordCount] = usePersistedWordCount(sceneId);
  usePortLifecycle(port, localUri, dispatch);
  useHandshakeTimeout(state.phase, dispatch);
  useEffect(() => {
    if (state.phase === "fallback") void port.close();
  }, [port, state.phase]);
  const onSaving = useCallback(() => { dispatch({ type: "save-started" }); }, []);
  const onResult = useCallback((result: LiveSceneFlushResult) => {
    dispatch({ type: "save-finished", result });
  }, []);
  const guard = useSceneExitGuard({
    enabled: state.editingBegan, port, onSaving, onResult,
  });
  const stay = useCallback(() => {
    guard.stay();
    dispatch({ type: "save-stayed" });
  }, [guard]);
  const onMessage = useBridgeMessage(port, dispatch, refreshWordCount);
  if (state.phase === "fallback") return <FallbackNotice />;
  if (!localUri) return <View style={styles.host}><OpeningOverlay /></View>;
  return <EditorSurface
    localUri={localUri} webViewKey={state.webViewKey} phase={state.phase}
    wordCount={wordCount} bindWebView={transport.bind}
    onMessage={(event) => { void onMessage(event); }}
    onFailed={() => { dispatch({ type: "editor-failed" }); }}
    onTerminated={() => { dispatch({ type: "process-terminated" }); }}
    onRetry={() => { void guard.retry(); }} onStay={stay}
  />;
}

const styles = StyleSheet.create({
  host: { position: "absolute", inset: 0, backgroundColor: PALETTE.card },
  webView: { flex: 1, backgroundColor: PALETTE.card },
  opening: {
    position: "absolute", inset: 0, alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: PALETTE.card,
  },
  fallbackLayer: { position: "absolute", inset: 0, zIndex: 2 },
  notice: {
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 8, backgroundColor: PALETTE.bg,
  },
  noticeText: { color: PALETTE.inkMuted, fontSize: 13, textAlign: "center" },
  footer: {
    minHeight: 38, borderTopWidth: 1, borderTopColor: PALETTE.border,
    paddingHorizontal: 20, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", backgroundColor: PALETTE.card,
  },
  blockedFooter: {
    minHeight: 44, borderTopWidth: 1, borderTopColor: PALETTE.border,
    paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: PALETTE.card,
  },
  footerText: { color: PALETTE.inkFaint, fontSize: 12, fontVariant: ["tabular-nums"] },
  savingText: { color: PALETTE.inkMuted, fontSize: 12 },
  actionText: { color: PALETTE.accent, fontSize: 13, fontWeight: "600" },
});
