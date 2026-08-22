import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { DangerButton, PrimaryButton, Sheet, TextField } from "../../components";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";

export interface BoardCardDraft {
  /** Absent when the sheet is composing a brand-new card. */
  id?: string;
  text: string;
}

interface BoardCardSheetProps {
  open: boolean;
  draft: BoardCardDraft | null;
  onDismiss(): void;
  onSave(text: string): void;
  onDelete(id: string): void;
}

function DeleteRow({ id, onDelete }: { id: string; onDelete: (id: string) => void }) {
  return <DangerButton onPress={() => Alert.alert(
    "Delete card?",
    "The card and any connections drawn to it are removed on every synced device.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(id) },
    ],
  )}>Delete card</DangerButton>;
}

/** Compose a new card, or retitle an existing one. Editing never moves a card. */
export function BoardCardSheet({ draft, onDelete, onDismiss, onSave, open }: BoardCardSheetProps) {
  const theme = useTheme();
  const [value, setValue] = useState(draft?.text ?? "");
  if (!draft) return null;
  return <Sheet designHeight={420} onDismiss={onDismiss} open={open} scrollable>
    <View style={styles.content}>
      <Text style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>
        {draft.id ? "Edit card" : "New card"}
      </Text>
      <Text style={[TYPE.meta, styles.hint, { color: theme.colors.ink3 }]}>
        {draft.id
          ? "Changes the card's text only — it keeps its place on the board."
          : "Lands in the next free slot of the board's grid, clear of the cards already there."}
      </Text>
      <TextField autoFocus multiline label="Card text" onChangeText={setValue}
        placeholder="What if…" value={value} />
      <PrimaryButton onPress={() => onSave(value)}>{draft.id ? "Save card" : "Add card"}</PrimaryButton>
      {draft.id ? <DeleteRow id={draft.id} onDelete={onDelete} /> : null}
    </View>
  </Sheet>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 24, gap: 14 },
  hint: { lineHeight: 17 },
});
