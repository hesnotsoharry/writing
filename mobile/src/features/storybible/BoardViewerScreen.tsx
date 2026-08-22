import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type * as Y from "yjs";

import { Icon, Screen } from "../../components";
import { mobileLocalWrites } from "../../db/mobileLocalWriteBridge";
import { getBoardsStore, getStoryBibleStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import type { Entity } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { BoardCanvas } from "./BoardCanvas";
import type { BoardCardDraft, LinkTarget } from "./BoardCardSheet";
import { BoardCardSheet } from "./BoardCardSheet";
import { addBoardCard, decodeBoardDoc, deleteBoardCard, encodeBoardDoc, setBoardCardText, toggleBoardConnection } from "./boardEdits";
import type { BoardCard, BoardViewModel } from "./boardModel";
import { decodeBoard } from "./boardModel";

type Props = NativeStackScreenProps<RootStackParamList, "BoardViewer">;
interface BoardMeta { id: string; title: string }

function useBoard(projectId: string, boardId?: string) {
  const [meta, setMeta] = useState<BoardMeta | null>(null); const [model, setModel] = useState<BoardViewModel>({ cards: [], connections: [] });
  const [entities, setEntities] = useState<Entity[]>([]); const [nonce, setNonce] = useState(0);
  useEffect(() => { void Promise.all([getBoardsStore(), getStoryBibleStore()]).then(async ([boards, bible]) => {
    let list = await boards.list(projectId);
    // Self-heal: a project synced in before board bootstrap existed (or one
    // born on a device that skipped it) can have zero board rows. Rather than
    // a distinct empty state, seed the default board on demand — the same
    // move desktop's own binder makes when it opens Brainstorm on an empty list.
    if (list.length === 0) { await boards.ensureDefaultBoard(projectId); list = await boards.list(projectId); }
    const board = list.find((item) => item.id === boardId) ?? list[0];
    const loadedEntities = await bible.listEntities(projectId);
    setEntities(loadedEntities);
    if (board) { setMeta({ id: board.id, title: board.title }); setModel(decodeBoard(await boards.docs.load(board.id))); }
  }); }, [boardId, nonce, projectId]);
  return { entities, meta, model, reload: useCallback(() => { setNonce((value) => value + 1); }, []) };
}

/**
 * Read → mutate → write-back of one board doc.
 *
 * The doc itself replicates through the sync engine's board-doc channel, which
 * reads `board_docs` on its sweep; the notify is the same local-write signal
 * every other mobile store raises so the boards row travels with the edit.
 */
async function commitBoardEdit(boardId: string, projectId: string, mutate: (doc: Y.Doc) => void): Promise<void> {
  const boards = await getBoardsStore();
  const doc = decodeBoardDoc(await boards.docs.load(boardId));
  mutate(doc);
  await boards.docs.save(boardId, encodeBoardDoc(doc));
  mobileLocalWrites.notify({ domain: "boards", projectId, rowId: boardId, deleted: false });
}

/**
 * Edits are read-modify-write over one base64 blob, so two of them in flight at
 * once would lose the first. Tapping through the sheet quickly is enough to
 * overlap them, so they queue.
 */
let boardWrites: Promise<unknown> = Promise.resolve();
function queueBoardEdit(boardId: string, projectId: string, mutate: (doc: Y.Doc) => void): Promise<unknown> {
  boardWrites = boardWrites.catch(() => undefined).then(() => commitBoardEdit(boardId, projectId, mutate));
  return boardWrites;
}

function AddCardButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityLabel="New card" onPress={onPress}
    style={[styles.addCard, { backgroundColor: theme.colors.accent }]}>
    <Icon color={theme.colors.paper} name="plus" size={15} />
    <Text style={[TYPE.bodySmallStrong, { color: theme.colors.paper }]}>Card</Text>
  </Pressable>;
}

function BoardHeader({ cardCount, onAdd, onBack, title }: {
  title: string; cardCount: number; onBack: () => void; onAdd: (() => void) | null;
}) {
  const theme = useTheme();
  return <View style={styles.header}>
    <Pressable accessibilityLabel="Back" onPress={onBack} style={styles.back}>
      <Icon color={theme.colors.ink3} name="chevLeft" size={20} />
    </Pressable>
    <View style={styles.headerCopy}>
      <Text numberOfLines={1} style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>{title}</Text>
      <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>Brainstorm board · {cardCount} cards</Text>
    </View>
    {/* Hidden until the board has loaded — an add with no board id is a no-op. */}
    {onAdd ? <AddCardButton onPress={onAdd} /> : null}
  </View>;
}

function BoardFooter({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  return <View style={[styles.footer, { backgroundColor: theme.colors.paper, borderTopColor: theme.colors.line }]}>
    <Text style={[TYPE.meta, styles.footerText, { color: theme.colors.ink3 }]}>
      Drag to pan, pinch to zoom. Tap a card to rewrite it, link it to another card, or delete it;
      new cards take the next free slot on the grid. Moving cards stays on desktop.
    </Text>
    <Pressable onPress={onBack} style={[styles.boardsButton, { backgroundColor: theme.colors.parchment }]}>
      <Icon color={theme.colors.ink2} name="chevDown" size={14} />
      <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink2 }]}>Boards</Text>
    </Pressable>
  </View>;
}

/** Card taps: an entity card opens its Story Bible entry, anything else edits. */
function useCardEditing(boardId: string | undefined, projectId: string, reload: () => void) {
  const [draft, setDraft] = useState<BoardCardDraft | null>(null);
  const run = (mutate: (doc: Y.Doc) => void) => {
    setDraft(null);
    if (!boardId) return;
    void queueBoardEdit(boardId, projectId, mutate)
      .then(reload)
      .catch((error: unknown) => { console.error("[BoardViewer] board edit failed", error); });
  };
  return {
    draft,
    dismiss: () => { setDraft(null); },
    compose: () => { setDraft({ text: "" }); },
    edit: (card: BoardCard) => { setDraft({ id: card.id, text: card.text }); },
    save: (text: string) => run((doc) => {
      if (draft?.id) setBoardCardText(doc, draft.id, text); else addBoardCard(doc, text);
    }),
    remove: (id: string) => run((doc) => { deleteBoardCard(doc, id); }),
    // Keeps the sheet open: linking several cards in a row is the normal case,
    // and dismissing after each tap would make it four gestures instead of one.
    toggleLink: (targetId: string) => {
      const from = draft?.id;
      if (!from || !boardId) return;
      void queueBoardEdit(boardId, projectId, (doc) => { toggleBoardConnection(doc, from, targetId); })
        .then(reload)
        .catch((error: unknown) => { console.error("[BoardViewer] link toggle failed", error); });
    },
  };
}

/** The other cards on this board, each flagged with whether it is already
 *  joined to the one being edited. Entity cards are included: desktop lets an
 *  edge touch them, and excluding them here would silently differ. */
function linkTargets(model: BoardViewModel, cardId: string | undefined): LinkTarget[] {
  if (!cardId) return [];
  const linked = new Set(model.connections
    .filter((edge) => edge.from === cardId || edge.to === cardId)
    .map((edge) => edge.from === cardId ? edge.to : edge.from));
  return model.cards
    .filter((card) => card.id !== cardId)
    .map((card) => ({ id: card.id, text: card.text, linked: linked.has(card.id) }));
}

export function BoardViewerScreen({ navigation, route }: Props) {
  const theme = useTheme(); const viewport = useWindowDimensions();
  const { projectId } = route.params;
  const data = useBoard(projectId, route.params.boardId);
  const editing = useCardEditing(data.meta?.id, projectId, data.reload);
  const height = Math.max(300, viewport.height - 196);
  const byId = new Map(data.entities.map((entity) => [entity.id, entity]));
  const openCard = (card: BoardCard) => {
    const entity = card.entityRef ? byId.get(card.entityRef) : undefined;
    if (entity) { navigation.navigate("BibleEntry", { projectId, entityId: entity.id, entityType: entity.type }); return; }
    editing.edit(card);
  };
  return <Screen contentStyle={[styles.screen, { backgroundColor: theme.colors.parchmentDeep }]}>
    <BoardHeader cardCount={data.model.cards.length} onAdd={data.meta ? editing.compose : null}
      onBack={() => navigation.goBack()} title={data.meta?.title ?? "Boards"} />
    <BoardCanvas height={height} model={data.model} onOpenCard={openCard} width={viewport.width} />
    <BoardFooter onBack={() => navigation.goBack()} />
    {/* Mounted only while open so the draft text never survives a dismissal. */}
    {editing.draft ? <BoardCardSheet draft={editing.draft} key={editing.draft.id ?? "new"}
      links={linkTargets(data.model, editing.draft.id)} onDelete={editing.remove}
      onDismiss={editing.dismiss} onSave={editing.save} onToggleLink={editing.toggleLink}
      open /> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 8 },
  back: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  addCard: { minHeight: HIT_SLOP_MIN, borderRadius: RADIUS.pill, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 5 },
  footer: { minHeight: 82, borderTopWidth: 1, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  footerText: { flex: 1, lineHeight: 17 },
  boardsButton: { minHeight: HIT_SLOP_MIN, borderRadius: RADIUS.pill, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 6 },
});
