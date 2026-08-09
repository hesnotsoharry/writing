import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, Card, Meter, SectionLabel, Toggle } from "../../components";
import { SCENE_EXCERPT_CHARS } from "../../shared/aiContext";
import type { Folder, Scene } from "../../shared/binderStore";
import type { Entity } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { AiCtxConfig, ContextScreenState } from "./aiContextModel";

export function CurrentSceneCard({ onReviewHidden, state }: {
  onReviewHidden?(): void; state: ContextScreenState;
}) {
  const theme = useTheme();
  const sent = state.assembled.sceneExcerpt.length;
  return <View style={styles.section}>
    <SectionLabel>This scene</SectionLabel>
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />
        <Text style={[TYPE.bodySmallStrong, styles.grow, { color: theme.colors.ink }]}>{state.currentScene?.title ?? state.assembled.sceneTitle}</Text>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{state.currentScene?.word_count ?? 0}w</Text>
      </View>
      <Meter progress={sent / SCENE_EXCERPT_CHARS} height={5} />
      <View style={styles.between}>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{sent.toLocaleString()} of {SCENE_EXCERPT_CHARS.toLocaleString()} characters sent</Text>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{state.assembled.sceneExcerptTruncated ? "capped" : "within cap"}</Text>
      </View>
      {onReviewHidden ? <Pressable accessibilityLabel="Review prose hidden from AI"
        accessibilityRole="button" onPress={onReviewHidden}
        style={({ pressed }) => [styles.between, pressed && styles.pressed]}>
        <Text style={[TYPE.meta, { color: theme.colors.ink2 }]}>{state.hiddenRunsInScene} runs hidden from AI in this scene</Text>
        <Text style={[TYPE.meta, { color: theme.colors.accent }]}>Review</Text>
      </Pressable> : <Text style={[TYPE.meta, { color: theme.colors.ink2 }]}>
        {state.hiddenRunsInScene} runs hidden from AI in this scene
      </Text>}
    </Card>
  </View>;
}

function SelectionBox({ checked }: { checked: boolean }) {
  const theme = useTheme();
  return <View style={[styles.check, { backgroundColor: checked ? theme.colors.accent : theme.colors.paper,
    borderColor: checked ? theme.colors.accent : theme.colors.parchmentEdge }]}> 
    {checked ? <Text style={[TYPE.meta, { color: theme.colors.paper }]}>✓</Text> : null}
  </View>;
}

export function OtherScenes({ config, currentId, scenes, onToggle }: {
  config: AiCtxConfig; currentId?: string; scenes: Scene[]; onToggle(id: string): void;
}) {
  const theme = useTheme();
  const others = scenes.filter((scene) => scene.id !== currentId);
  return <View style={styles.section}>
    <SectionLabel>Other scenes</SectionLabel>
    {others.length === 0 ? <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>No other scenes in this project.</Text> : null}
    {others.map((scene) => {
      const checked = config.extraSceneIds.includes(scene.id);
      return <Pressable key={scene.id} accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: scene.excludeFromAi }}
        disabled={scene.excludeFromAi} onPress={() => { onToggle(scene.id); }}
        style={[styles.listRow, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }, scene.excludeFromAi && styles.dim]}> 
        <Text style={[TYPE.bodySmall, styles.grow, { color: theme.colors.ink }]}>{scene.title}</Text>
        {scene.excludeFromAi ? <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>excluded</Text> : <SelectionBox checked={checked} />}
      </Pressable>;
    })}
  </View>;
}

export function BibleEntries({ config, entities, onToggle }: {
  config: AiCtxConfig; entities: Entity[]; onToggle(name: string): void;
}) {
  const theme = useTheme();
  return <View style={styles.section}>
    <SectionLabel>Bible entries</SectionLabel>
    {entities.length === 0 ? <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>No Story Bible entries are linked to this scene.</Text> : null}
    {entities.map((entity) => {
      const persistent = entity.exclude_from_ai === true;
      const enabled = !persistent && !config.offEntityNames.includes(entity.name);
      return <View key={entity.id} style={[styles.listRow, { backgroundColor: theme.colors.paper,
        borderColor: theme.colors.line }, persistent && styles.dim]}> 
        <Avatar name={entity.name} entityType={entity.type} size={26} />
        <View style={styles.grow}>
          <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>{entity.name}</Text>
          <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{persistent ? "Never shared" : enabled ? "first 200 characters of notes" : "off for this question"}</Text>
        </View>
        <SelectionBox checked={enabled} />
        {!persistent ? <Pressable accessibilityLabel={`Toggle ${entity.name}`} onPress={() => { onToggle(entity.name); }} style={StyleSheet.absoluteFill} /> : null}
      </View>;
    })}
  </View>;
}

function nextBoundary(current: string | null, folders: Folder[]): string | null {
  const choices: Array<string | null> = [null, ...folders.map((folder) => folder.id)];
  const index = choices.indexOf(current);
  return choices[(index + 1) % choices.length] ?? null;
}

export function ContextOptions({ config, folders, onChange }: {
  config: AiCtxConfig; folders: Folder[]; onChange(config: AiCtxConfig): void;
}) {
  const theme = useTheme();
  const boundary = folders.find((folder) => folder.id === config.boundary)?.title ?? "No boundary";
  return <View style={styles.section}>
    <Card style={styles.optionCard}>
      <Toggle label="About this manuscript" description="Genre, tone, house style"
        value={config.about} onChange={(about) => { onChange({ ...config, about }); }} />
    </Card>
    <Pressable accessibilityRole="button" onPress={() => { onChange({ ...config,
      boundary: nextBoundary(config.boundary, folders) }); }}
      style={[styles.listRow, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}> 
      <View style={styles.grow}>
        <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>Don&apos;t spoil past</Text>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>Reads as if it hasn&apos;t passed this point</Text>
      </View>
      <Text style={[TYPE.bodySmallStrong, { color: theme.colors.accent }]}>{boundary}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 6 }, card: { gap: 11 }, optionCard: { paddingVertical: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 9 }, grow: { flex: 1 },
  between: { flexDirection: "row", justifyContent: "space-between" }, dot: { width: 8, height: 8, borderRadius: 4 },
  listRow: { minHeight: 50, borderWidth: 1, borderRadius: RADIUS.lg, padding: 11,
    flexDirection: "row", alignItems: "center", gap: 10, overflow: "hidden" },
  check: { width: 22, height: 22, borderWidth: 1, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.58 },
  pressed: { opacity: 0.58 },
});
