import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";

import { Icon } from "../components/Icon";

// ---------------------------------------------------------------------------
// formatActions — pure spec array, one entry per button
// ---------------------------------------------------------------------------

interface FormatAction {
  icon: "bold" | "italic" | "heading" | "quote" | "list";
  label: string;
  onClick: () => void;
  active: boolean;
}

function formatActions(editor: Editor): FormatAction[] {
  return [
    {
      icon: "bold",
      label: "Bold",
      onClick: () => { editor.chain().focus().toggleBold().run(); },
      active: editor.isActive("bold"),
    },
    {
      icon: "italic",
      label: "Italic",
      onClick: () => { editor.chain().focus().toggleItalic().run(); },
      active: editor.isActive("italic"),
    },
    {
      icon: "heading",
      label: "Heading",
      onClick: () => { editor.chain().focus().toggleHeading({ level: 2 }).run(); },
      active: editor.isActive("heading", { level: 2 }),
    },
    {
      icon: "quote",
      label: "Quote",
      onClick: () => { editor.chain().focus().toggleBlockquote().run(); },
      active: editor.isActive("blockquote"),
    },
    {
      icon: "list",
      label: "List",
      onClick: () => { editor.chain().focus().toggleBulletList().run(); },
      active: editor.isActive("bulletList"),
    },
  ];
}

// ---------------------------------------------------------------------------
// Highlight swatches — 4 muted rgba washes derived from the label-color palette
// ---------------------------------------------------------------------------

export const HIGHLIGHT_SWATCHES: { color: string; label: string }[] = [
  { color: "rgba(176,125,46,0.28)", label: "Highlight amber" },
  { color: "rgba(78,124,107,0.28)", label: "Highlight teal" },
  { color: "rgba(63,111,158,0.28)", label: "Highlight blue" },
  { color: "rgba(168,86,122,0.28)", label: "Highlight rose" },
];

const swatchBtn: React.CSSProperties = {
  width: 16, height: 16, borderRadius: "50%",
  border: "1.5px solid var(--parchment-edge)", cursor: "pointer",
  padding: 0, flexShrink: 0,
};

const swatchBtnActive: React.CSSProperties = {
  border: "1.5px solid var(--ink)",
  boxShadow: "0 0 0 1.5px var(--parchment-edge)",
};

function HighlightSwatches({ editor }: { editor: Editor }) {
  return (
    <>
      <span style={separatorStyle} />
      {HIGHLIGHT_SWATCHES.map(({ color, label }) => {
        const active = editor.isActive("highlight", { color });
        return (
          <button key={color} aria-label={label} aria-pressed={active}
            style={active ? { ...swatchBtn, ...swatchBtnActive, background: color } : { ...swatchBtn, background: color }}
            onClick={() => { editor.chain().focus().toggleHighlight({ color }).run(); }}
          />
        );
      })}
      <button aria-label="Remove highlight" style={{ ...btnBase, opacity: 0.65 }}
        onClick={() => { editor.chain().focus().unsetHighlight().run(); }}>
        <Icon name="x" style={{ width: 12, height: 12 }} />
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// AiExcludeToggle — "Hide from AI" mark button
// ---------------------------------------------------------------------------

function AiExcludeToggle({ editor }: { editor: Editor }) {
  const active = editor.isActive("aiExclude");
  return (
    <>
      <span style={separatorStyle} />
      <button
        aria-label="Hide from AI"
        aria-pressed={active}
        title="Hide from AI"
        style={active ? { ...btnBase, ...btnActive } : btnBase}
        onClick={() => { editor.chain().focus().toggleAiExclude().run(); }}
      >
        <Icon name="shieldOff" style={{ width: 14, height: 14 }} />
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// FormatButtons — presentational dark-pill toolbar (testable without selection)
// ---------------------------------------------------------------------------

// Theme-token surface (NOT --ink: that's the primary *text* token, so a pill
// painted with it inverts against the theme — light pill in dark mode).
// Mirrors the .cm context-menu surface: paper + parchment edge + shadow.
const pillStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  padding: 4,
  background: "var(--paper)",
  border: "1px solid var(--parchment-edge)",
  borderRadius: 8,
  boxShadow: "var(--shadow-lg)",
  fontFamily: "var(--font-ui)",
  whiteSpace: "nowrap",
  position: "relative",
};

const btnBase: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 5,
  display: "grid",
  placeItems: "center",
  color: "var(--ink-2)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
};

const btnActive: React.CSSProperties = {
  color: "var(--ink)",
  background: "var(--parchment)",
};

const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 16,
  background: "var(--parchment-edge)",
  margin: "0 2px",
};

const caretStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: "50%",
  transform: "translateX(-50%)",
  width: 0,
  height: 0,
  borderLeft: "5px solid transparent",
  borderRight: "5px solid transparent",
  borderTop: "5px solid var(--paper)",
};

export function FormatButtons({ editor }: { editor: Editor }) {
  const actions = formatActions(editor);
  const [bold, italic, heading, quote, list] = actions;
  const beforeSep = [bold, italic];
  const afterSep = [heading, quote, list];
  return (
    <span style={pillStyle}>
      {beforeSep.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          style={a.active ? { ...btnBase, ...btnActive } : btnBase}
          aria-label={a.label}
          aria-pressed={a.active}
        >
          <Icon name={a.icon} style={{ width: 14, height: 14 }} />
        </button>
      ))}
      <span style={separatorStyle} />
      {afterSep.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          style={a.active ? { ...btnBase, ...btnActive } : btnBase}
          aria-label={a.label}
          aria-pressed={a.active}
        >
          <Icon name={a.icon} style={{ width: 14, height: 14 }} />
        </button>
      ))}
      <HighlightSwatches editor={editor} />
      <AiExcludeToggle editor={editor} />
      <span style={caretStyle} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// FormatBubble — wraps BubbleMenu (shows on non-empty text selection)
// ---------------------------------------------------------------------------

export function FormatBubble({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu editor={editor}>
      <FormatButtons editor={editor} />
    </BubbleMenu>
  );
}
