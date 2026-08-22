import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { DangerButton, Icon, PrimaryButton, Sheet, TextField } from "../../components";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";

export interface BoardCardDraft {
  /** Absent when the sheet is composing a brand-new card. */
  id?: string;
  text: string;
}

export interface LinkTarget { id: string; text: string; linked: boolean }

interface BoardCardSheetProps {
  open: boolean;
  draft: BoardCardDraft | null;
  /** Every other card on the board, each flagged with whether it is already
   *  linked to this one. Empty while composing — a card must exist before
   *  anything can point at it. */
  links: LinkTarget[];
  onDismiss(): void;
  onSave(text: string): void;
  onDelete(id: string): void;
  onToggleLink(targetId: string): void;
}

function cardLabel(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed || "Empty card";
}

function LinkRow({ onToggle, target }: { target: LinkTarget; onToggle: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: target.linked }}
    onPress={onToggle} style={[styles.linkRow, { borderColor: theme.colors.parchmentEdge,
      backgroundColor: target.linked ? theme.colors.parchment : "transparent" }]}>
    <Icon color={target.linked ? theme.colors.accent : theme.colors.ink4}
      name={target.linked ? "check" : "plus"} size={15} />
    <Text numberOfLines={1} style={[TYPE.bodySmall, styles.linkText, { color: theme.colors.ink }]}>
      {cardLabel(target.text)}
    </Text>
  </Pressable>;
}

/**
 * Links are a list of toggles, not a drag between two cards.
 *
 * Desktop draws an edge by dragging from one node handle to another, which
 * needs a pointer and a canvas that is not also panning under your finger. On
 * a phone the same gesture fights the board's own pan and zoom. A list is
 * reachable one-handed, says which links already exist without reading the
 * canvas, and is undone by tapping the same row again.
 */
function LinkSection({ links, onToggle }: { links: LinkTarget[]; onToggle: (id: string) => void }) {
  const theme = useTheme();
  if (links.length === 0) return null;
  const count = links.filter((target) => target.linked).length;
  return <View style={styles.links}>
    <Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>
      Links{count > 0 ? ` · ${count}` : ""}
    </Text>
    {links.map((target) => <LinkRow key={target.id} onToggle={() => onToggle(target.id)}
      target={target} />)}
  </View>;
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
export function BoardCardSheet({
  draft, links, onDelete, onDismiss, onSave, onToggleLink, open,
}: BoardCardSheetProps) {
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
      {draft.id ? <LinkSection links={links} onToggle={onToggleLink} /> : null}
      {draft.id ? <DeleteRow id={draft.id} onDelete={onDelete} /> : null}
    </View>
  </Sheet>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 24, gap: 14 },
  hint: { lineHeight: 17 },
  links: { gap: 6 },
  linkRow: {
    minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, borderWidth: 1, borderRadius: RADIUS.md,
  },
  linkText: { flex: 1, minWidth: 0 },
});
