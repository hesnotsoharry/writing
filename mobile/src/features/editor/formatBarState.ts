import type { EditorSelectionState } from "./editorUiProtocol";

export interface FormatBarState {
  boldActive: boolean;
  italicActive: boolean;
  blockquoteActive: boolean;
  aiExcluded: boolean;
  hasRange: boolean;
}

export const EMPTY_FORMAT_BAR_STATE: FormatBarState = {
  boldActive: false, italicActive: false, blockquoteActive: false,
  aiExcluded: false, hasRange: false,
};

export function deriveFormatBarState(selection: EditorSelectionState | null): FormatBarState {
  if (!selection) return EMPTY_FORMAT_BAR_STATE;
  return {
    boldActive: selection.bold,
    italicActive: selection.italic,
    blockquoteActive: selection.blockquote,
    aiExcluded: selection.aiExcluded,
    hasRange: !selection.collapsed && selection.to > selection.from,
  };
}
