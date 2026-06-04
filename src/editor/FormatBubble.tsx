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
// FormatButtons — presentational dark-pill toolbar (testable without selection)
// ---------------------------------------------------------------------------

const pillStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  padding: 4,
  background: "var(--ink)",
  borderRadius: 8,
  boxShadow: "var(--shadow-md)",
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
  color: "rgba(255,255,255,0.85)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
};

const btnActive: React.CSSProperties = {
  color: "rgba(255,255,255,1)",
  background: "rgba(255,255,255,0.14)",
};

const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 16,
  background: "rgba(255,255,255,0.18)",
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
  borderTop: "5px solid var(--ink)",
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
