import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon, type IconName } from "../Icon";

// ── Types ──────────────────────────────────────────────────────────────────

export interface MenuItemSep {
  type: "sep";
}

export interface MenuItemLabel {
  type: "label";
  text: string;
}

export interface MenuItemAction {
  type?: never;
  label: string;
  /** Icon name from the shared Icon set. */
  icon?: IconName;
  /** CSS color string applied to the icon glyph (overrides the default neutral). */
  iconColor?: string;
  /** A CSS color string rendered as a color swatch (e.g. "#ff0000"). */
  swatch?: string;
  /** Show a checkmark tick on the right side. */
  tick?: boolean;
  /** Short hint text shown on the right side. */
  right?: string;
  /** Whether this is a destructive/danger action (red styling). */
  danger?: boolean;
  onClick?: () => void;
  submenu?: MenuItem[];
}

export type MenuItem = MenuItemSep | MenuItemLabel | MenuItemAction;

export interface MenuDescriptor {
  /** Requested X position in viewport coordinates. */
  x: number;
  /** Requested Y position in viewport coordinates. */
  y: number;
  items: MenuItem[];
}

export interface ContextMenuProps {
  menu: MenuDescriptor | null;
  onClose: () => void;
}

// ── ActionItem ─────────────────────────────────────────────────────────────

interface ActionItemProps {
  item: MenuItemAction;
  index: number;
  openSub: number;
  onOpenSub: (i: number) => void;
  onClose: () => void;
}

/** Leading visual for a menu item: color swatch, colored icon glyph, or spacer. */
function LeadingGlyph({ item }: { item: MenuItemAction }) {
  if (item.swatch) return <span className="swatch" style={{ background: item.swatch }} />;
  if (item.icon) {
    return (
      <Icon
        name={item.icon}
        className="ic"
        style={item.iconColor ? { color: item.iconColor } : undefined}
      />
    );
  }
  return <span style={{ width: 15 }} />;
}

function ActionItem({ item, index, openSub, onOpenSub, onClose }: ActionItemProps) {
  const hasSub = Array.isArray(item.submenu) && item.submenu.length > 0;

  const handleClick = () => {
    if (hasSub) return;
    item.onClick?.();
    onClose();
  };

  return (
    <button
      className={"cm-item" + (item.danger ? " danger" : "")}
      onMouseEnter={() => onOpenSub(hasSub ? index : -1)}
      onClick={handleClick}
    >
      <LeadingGlyph item={item} />
      <span>{item.label}</span>
      {item.tick && <Icon name="check" className="tick" style={{ width: 15, height: 15 }} />}
      {item.right && <span className="right">{item.right}</span>}
      {hasSub && <Icon name="chevRight" className="chev" style={{ width: 14, height: 14 }} />}
      {hasSub && openSub === index && (
        <div className="cm cm-sub" onClick={(e) => e.stopPropagation()}>
          <MenuItems items={item.submenu!} onClose={onClose} />
        </div>
      )}
    </button>
  );
}

// ── MenuItems ──────────────────────────────────────────────────────────────

interface MenuItemsProps {
  items: MenuItem[];
  onClose: () => void;
}

function MenuItems({ items, onClose }: MenuItemsProps) {
  const [openSub, setOpenSub] = useState(-1);

  return (
    <>
      {items.map((it, i) => {
        if (it.type === "sep") return <div key={i} className="cm-sep" />;
        if (it.type === "label") return <div key={i} className="cm-label">{it.text}</div>;
        return (
          <ActionItem
            key={i}
            item={it as MenuItemAction}
            index={i}
            openSub={openSub}
            onOpenSub={setOpenSub}
            onClose={onClose}
          />
        );
      })}
    </>
  );
}

// ── ContextMenu ────────────────────────────────────────────────────────────

export function ContextMenu({ menu, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu ? menu.x : 0, top: menu ? menu.y : 0 });

  // Viewport-edge correction: clamp the menu so it stays fully on screen.
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const pad = 10;
    let left = menu.x;
    let top = menu.y;
    if (left + r.width + pad > window.innerWidth) left = window.innerWidth - r.width - pad;
    if (top + r.height + pad > window.innerHeight) top = Math.max(pad, window.innerHeight - r.height - pad);
    setPos({ left, top });
  }, [menu]);

  // Close on Escape key.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, onClose]);

  if (!menu) return null;

  // Portal to <body> so the fixed-positioned menu escapes any ancestor that
  // establishes a containing block for position:fixed (e.g. .insp-group carries
  // an identity transform from its entrance animation — even matrix(1,0,0,1,0,0)
  // re-bases fixed coords, which threw the picker ~1000px off-screen).
  return createPortal(
    <>
      <div
        className="cm-backdrop"
        onMouseDown={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        className="cm"
        ref={ref}
        style={{ left: pos.left, top: pos.top }}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItems items={menu.items} onClose={onClose} />
      </div>
    </>,
    document.body,
  );
}
