// Pure Yjs board-doc helpers (yjs only, no Tauri-bearing imports) — mobile
// reuses desktop's own mutations so the two clients cannot drift on the
// board schema (plain-JSON `cards` entries + top-level `card-<id>` fragments).
export {
  createBoardCard,
  getCardFragment,
  getCardText,
  plainTextToCardFragment,
  removeCard,
  removeConnectionsForCard,
} from "@writersnook/features/brainstorm/boardDoc";
