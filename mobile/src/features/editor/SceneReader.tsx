import { useFocusEffect } from "@react-navigation/native";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, View,
} from "react-native";
import * as Y from "yjs";

import { MobileSceneDocStore } from "../../db/syncStores/mobileSceneDocStore";
import { applyEncoded, extractPlainText } from "../../shared/serialize";
import { subscribeMobileDocReplaced } from "../../sync/mobileEngine";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";

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
  const theme = useTheme();
  if (content.paragraphs.length === 0) {
    return <Text style={[styles.emptyText, { color: theme.colors.ink3 }]}>{EMPTY_COPY}</Text>;
  }
  return <>{content.paragraphs.map((paragraph, index) => (
    <Text key={index} style={[styles.paragraph, { color: theme.colors.ink }]}>{paragraph || " "}</Text>
  ))}</>;
}

export function SceneReader({ sceneId }: SceneReaderProps) {
  const theme = useTheme();
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
    return <CenteredMessage><ActivityIndicator color={theme.colors.accent} /></CenteredMessage>;
  }
  if (state === "error") {
    return <CenteredMessage><Text style={[styles.errorText, { color: theme.colors.ink }]}>{"Couldn't load this scene."}</Text></CenteredMessage>;
  }
  return <ReaderContent content={content} />;
}

function ReaderContent({ content }: { content: SceneContent }) {
  const theme = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.paper }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScenePage content={content} />
      </ScrollView>
      <View style={[styles.footer, { borderColor: theme.colors.line, backgroundColor: theme.colors.paper }]}>
        <Text style={[styles.footerText, { color: theme.colors.ink4 }]}>{content.wordCount.toLocaleString()} words</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  paragraph: {
    ...TYPE.prose,
    lineHeight: 26, marginBottom: 14,
  },
  emptyText: { ...TYPE.proseBody, textAlign: "center" },
  errorText: { ...TYPE.bodyStrong },
  footer: {
    borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 10,
  },
  footerText: { ...TYPE.meta, fontVariant: ["tabular-nums"] },
});
