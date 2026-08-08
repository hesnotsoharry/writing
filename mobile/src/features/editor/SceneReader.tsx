import { useFocusEffect } from "@react-navigation/native";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View,
} from "react-native";
import * as Y from "yjs";

import { MobileSceneDocStore } from "../../db/syncStores/mobileSceneDocStore";
import { applyEncoded, extractPlainText } from "../../shared/serialize";
import { subscribeMobileDocReplaced } from "../../sync/mobileEngine";
import { PALETTE } from "../../theme/palette";

type LoadState = "loading" | "ready" | "error";
const sceneStore = new MobileSceneDocStore();
const EMPTY_COPY = "This scene doesn't have any prose yet.";

interface SceneContent { paragraphs: string[]; wordCount: number }
interface SceneReaderProps { sceneId: string }

function readSceneContent(base64: string | null): SceneContent {
  const doc = new Y.Doc();
  if (base64) applyEncoded(doc, base64);
  const text = extractPlainText(doc);
  const trimmed = text.trim();
  return {
    paragraphs: text.length > 0 ? text.split("\n") : [],
    wordCount: trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0,
  };
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

function ScenePage({ content }: { content: SceneContent }) {
  if (content.paragraphs.length === 0) return <Text style={styles.emptyText}>{EMPTY_COPY}</Text>;
  return <>{content.paragraphs.map((paragraph, index) => (
    <Text key={index} style={styles.paragraph}>{paragraph || " "}</Text>
  ))}</>;
}

export function SceneReader({ sceneId }: SceneReaderProps) {
  const [state, setState] = useState<LoadState>("loading");
  const [content, setContent] = useState<SceneContent>({ paragraphs: [], wordCount: 0 });
  const load = useCallback(() => {
    setState("loading");
    sceneStore.load(sceneId)
      .then((base64) => { setContent(readSceneContent(base64)); setState("ready"); })
      .catch(() => { setState("error"); });
  }, [sceneId]);
  useFocusEffect(load);
  useEffect(() => subscribeMobileDocReplaced((changedId) => {
    if (changedId === sceneId) load();
  }), [sceneId, load]);
  if (state === "loading") {
    return <CenteredMessage><ActivityIndicator color={PALETTE.accent} /></CenteredMessage>;
  }
  if (state === "error") {
    return <CenteredMessage><Text style={styles.errorText}>{"Couldn't load this scene."}</Text></CenteredMessage>;
  }
  return <ReaderContent content={content} />;
}

function ReaderContent({ content }: { content: SceneContent }) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScenePage content={content} />
      </ScrollView>
      <View style={styles.footer}>
        <Text style={styles.footerText}>{content.wordCount.toLocaleString()} words</Text>
      </View>
    </View>
  );
}

const READING_FONT = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.card },
  scrollContent: { padding: 20, paddingBottom: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  paragraph: {
    color: PALETTE.ink, fontFamily: READING_FONT, fontSize: 17,
    lineHeight: 26, marginBottom: 14,
  },
  emptyText: { color: PALETTE.inkMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  errorText: { color: PALETTE.ink, fontSize: 16, fontWeight: "600" },
  footer: {
    borderTopWidth: 1, borderTopColor: PALETTE.border,
    paddingHorizontal: 20, paddingVertical: 10, backgroundColor: PALETTE.card,
  },
  footerText: { color: PALETTE.inkFaint, fontSize: 12, fontVariant: ["tabular-nums"] },
});
