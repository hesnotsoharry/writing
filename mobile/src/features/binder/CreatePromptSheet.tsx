import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, Icon, ListRow, PrimaryButton, SectionLabel, Sheet, TextField } from "../../components";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";
import {
  buildFolderChoices,
  commitCreatePrompt,
  type CreateFolderOption,
  type CreateKind,
  type CreatePromptResult,
  defaultTitleFor,
  type FolderChoice,
  resolveTargetFolderId,
} from "./createPromptModel";

export interface CreatePromptSheetProps {
  open: boolean;
  kind: CreateKind;
  folders: readonly CreateFolderOption[];
  impliedFolderId?: string | null;
  onDismiss: () => void;
  onConfirm: (result: CreatePromptResult) => void;
}

function FolderPicker({ choices, onSelect, selectedId }: {
  choices: FolderChoice[]; onSelect: (id: string | null) => void; selectedId: string | null;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chapter}>
      <SectionLabel>Chapter</SectionLabel>
      <Card radius="small" style={styles.choices}>
        {choices.map((choice) => (
          <ListRow key={choice.id ?? "short-pieces"} onPress={() => { onSelect(choice.id); }}
            title={choice.title}
            trailing={choice.id === selectedId
              ? <Icon color={theme.colors.accent} name="check" size={16} /> : undefined} />
        ))}
      </Card>
    </View>
  );
}

const HEADLINE: Record<CreateKind, string> = { scene: "New scene", chapter: "New chapter", project: "New project" };
const FIELD_LABEL: Record<CreateKind, string> = {
  scene: "Scene title", chapter: "Chapter title", project: "Project title",
};
const CONFIRM_LABEL: Record<CreateKind, string> = {
  scene: "Create scene", chapter: "Create chapter", project: "Create project",
};

function CreatePromptForm(props: Omit<CreatePromptSheetProps, "onDismiss" | "open">) {
  const theme = useTheme();
  const fallback = defaultTitleFor(props.kind);
  const knownIds = props.folders.map(({ id }) => id);
  const [title, setTitle] = useState(fallback);
  const [folderId, setFolderId] = useState(
    () => resolveTargetFolderId({ impliedId: props.impliedFolderId, knownIds }),
  );
  const commit = (): void => {
    props.onConfirm(commitCreatePrompt({
      kind: props.kind, titleInput: title, impliedFolderId: props.impliedFolderId,
      pickedFolderId: folderId, knownIds,
    }));
  };
  return (
    <View style={styles.content}>
      <Text style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>{HEADLINE[props.kind]}</Text>
      <TextField autoFocus label={FIELD_LABEL[props.kind]}
        onChangeText={setTitle} onSubmitEditing={commit} returnKeyType="done"
        selectTextOnFocus value={title} />
      {props.kind === "scene" && <FolderPicker choices={buildFolderChoices(props.folders)}
        onSelect={setFolderId} selectedId={folderId} />}
      <PrimaryButton onPress={commit}>{CONFIRM_LABEL[props.kind]}</PrimaryButton>
    </View>
  );
}

export function CreatePromptSheet(props: CreatePromptSheetProps) {
  const height = props.kind === "scene" ? 520 : 280;
  return (
    <Sheet designHeight={height} onDismiss={props.onDismiss} open={props.open} scrollable>
      <CreatePromptForm folders={props.folders} impliedFolderId={props.impliedFolderId}
        kind={props.kind} onConfirm={props.onConfirm} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 24, gap: 16 },
  chapter: { gap: 8 },
  choices: { paddingVertical: 4, paddingHorizontal: 8 },
});
