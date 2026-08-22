import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Icon, IconButton, Screen, Segmented, Topbar } from "../../components";
import { KEYBOARD_BOTTOM_OFFSET } from "../../components/keyboard";
import { getBinderStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import type { SceneStatus } from "../../shared/binderStore";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { buildCorkGroups, getCardLayout, reorderPreview } from "./corkboardModel";
import { CorkCard } from "./CorkCard";
import { useCorkboardData } from "./useCorkboardData";
import { useCorkDrag } from "./useCorkDrag";

type Props = NativeStackScreenProps<RootStackParamList, "Corkboard">;
const COLUMN_OPTIONS = [{ label: "1", value: "1" }, { label: "2", value: "2" }] as const;

interface CorkGroupProps {
  group: ReturnType<typeof buildCorkGroups>[number];
  columns: 1 | 2;
  cardWidth: number;
  activeId: string | null;
  entities: ReturnType<typeof useCorkboardData>["entities"];
  onActivate: (id: string) => void;
  onReload: () => void;
}

function commitStatus(sceneId: string, status: SceneStatus, reload: () => void) {
  void getBinderStore().then((store) => store.setSceneStatus(sceneId, status)).then(reload);
}

function commitSynopsis(sceneId: string, synopsis: string, reload: () => void) {
  void getBinderStore().then((store) => store.setSceneSynopsis(sceneId, synopsis || null)).then(reload);
}

function CorkGroupView(props: CorkGroupProps) {
  const theme = useTheme();
  const [ordered, setOrdered] = useState(props.group.scenes);
  if (ordered.map(({ id }) => id).join() !== props.group.scenes.map(({ id }) => id).join()
    && new Set(ordered.map(({ id }) => id)).size !== props.group.scenes.length) setOrdered(props.group.scenes);
  // Same numbers the drop math has always used, so where a card lands is unchanged.
  const geometry = useMemo(() => ({
    columns: props.columns, cardWidth: props.cardWidth,
    gutter: props.columns === 1 ? 16 : 12, rowHeight: props.columns === 1 ? 180 : 220,
  }), [props.cardWidth, props.columns]);
  const { id: groupId } = props.group;
  const { onReload } = props;
  const onReorder = useCallback((sceneId: string, toIndex: number) => {
    setOrdered((current) => reorderPreview(current, sceneId, toIndex));
    void getBinderStore().then((store) => store.moveScene(sceneId, groupId, toIndex)).then(onReload);
  }, [groupId, onReload]);
  const drag = useCorkDrag({ geometry, onReorder, scenes: ordered });
  return (
    <View>
      <View style={styles.groupHeader}><Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>{props.group.title}</Text><View style={[styles.rule, { backgroundColor: theme.colors.parchmentEdge }]} /></View>
      <View style={[styles.cardGrid, { gap: props.columns === 1 ? 16 : 12 }]}>
        {ordered.map((scene, index) => <CorkCard
          active={props.activeId === scene.id} drag={drag} entities={props.entities[scene.id] ?? []} index={index} key={scene.id}
          onActivate={() => props.onActivate(scene.id)}
          onStatus={(status) => commitStatus(scene.id, status, props.onReload)}
          onSynopsis={(value) => commitSynopsis(scene.id, value, props.onReload)} scene={scene} width={props.cardWidth}
        />)}
      </View>
    </View>
  );
}

function Footer({ onNew }: { onNew: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.footer}>
      <Pressable onPress={onNew} style={[styles.newCard, { backgroundColor: theme.colors.paper, borderColor: theme.colors.parchmentEdge }]}><Icon color={theme.colors.ink2} name="plus" size={16} /><Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink2 }]}>New card</Text></Pressable>
      <Text style={[styles.hint, { color: theme.colors.ink3 }]}>Long-press a card to drag it to a new place</Text>
    </View>
  );
}

function CorkboardBody({ navigation, projectId }: Pick<Props, "navigation"> & { projectId: string }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [columnsValue, setColumnsValue] = useState<"1" | "2">("1");
  const [activeId, setActiveId] = useState<string | null>(null);
  const data = useCorkboardData(projectId);
  const columns = Number(columnsValue) as 1 | 2;
  const layout = getCardLayout(width, columns);
  const groups = useMemo(() => buildCorkGroups(data.folders, data.scenes), [data.folders, data.scenes]);
  const onNew = () => {
    const folderId = data.folders[0]?.id ?? null;
    void getBinderStore().then((store) => store.createScene({ projectId, folderId, title: "Untitled scene" })).then(data.reload);
  };
  return (
    <Screen contentStyle={[styles.screen, { backgroundColor: theme.colors.parchmentDeep }]}>
      <Topbar leading={<IconButton icon="chevLeft" label="Back" onPress={navigation.goBack} />} title="Corkboard" trailing={<View style={styles.segment}><Segmented onChange={setColumnsValue} options={COLUMN_OPTIONS} value={columnsValue} /></View>} />
      {data.loading ? <ActivityIndicator color={theme.colors.accent} style={styles.loading} /> : <KeyboardAwareScrollView bottomOffset={KEYBOARD_BOTTOM_OFFSET} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {!data.bibleAvailable && <View style={[styles.bibleUnavailable, { borderColor: theme.colors.parchmentEdge }]}><Icon color={theme.colors.ink3} name="info" size={16} /><Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>Story Bible unavailable — entity chips are hidden.</Text></View>}
        {groups.map((group) => <CorkGroupView activeId={activeId} cardWidth={layout.cardWidth} columns={columns} entities={data.entities} group={group} key={group.id ?? "short"} onActivate={setActiveId} onReload={data.reload} />)}
      </KeyboardAwareScrollView>}
      <Footer onNew={onNew} />
    </Screen>
  );
}

export function CorkboardScreen({ navigation, route }: Props) {
  return <CorkboardBody navigation={navigation} projectId={route.params.projectId} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, segment: { width: 104 }, loading: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 18, gap: 20 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth }, cardGrid: { flexDirection: "row", flexWrap: "wrap" },
  footer: { minHeight: 72, paddingHorizontal: 18, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  newCard: { minHeight: HIT_SLOP_MIN, flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  hint: { ...TYPE.metaSmall, maxWidth: 150 },
  bibleUnavailable: { minHeight: HIT_SLOP_MIN, borderWidth: 1, borderRadius: RADIUS.md, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 },
});
