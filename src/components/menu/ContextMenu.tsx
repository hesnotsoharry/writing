import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
      {item.swatch ? (
        <span className="swatch" style={{ background: item.swatch }} />
      ) : item.icon ? (
        <Icon name={item.icon} className="ic" />
      ) : (
        <span style={{ width: 15 }} />
      )}
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

  return (
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
    </>
  );
}
