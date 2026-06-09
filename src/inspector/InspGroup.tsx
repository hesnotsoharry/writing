/**
 * InspGroup — collapsible inspector section wrapper.
 * Collapse state persisted in localStorage key `wn-insp-{gkey}`.
 * Canon: design-reference/inspector.jsx InspGroup.
 */
import type { ReactNode } from "react";
import { useState } from "react";

import type { IconName } from "../components/Icon";
import { Icon } from "../components/Icon";

export interface InspGroupProps {
  gkey: string;
  icon: IconName;
  label: string;
  action?: ReactNode;
  defaultOpen?: boolean;
  children?: ReactNode;
}

// ── localStorage helpers (extracted to keep InspGroup under the 40-line limit) ──

function readStored(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore — localStorage unavailable (e.g. private browsing restriction)
  }
}

// ── InspGroup ──────────────────────────────────────────────────────────────────

export function InspGroup({
  gkey, icon, label, action, defaultOpen = true, children,
}: InspGroupProps) {
  const storeKey = `wn-insp-${gkey}`;
  const [open, setOpen] = useState(() => readStored(storeKey, defaultOpen));

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      writeStored(storeKey, next);
      return next;
    });
  };

  return (
    <div className={"insp-group" + (open ? "" : " is-collapsed")}>
      <div
        className="insp-label insp-label--toggle"
        role="button"
        aria-expanded={open}
        onClick={toggle}
      >
        <Icon
          name="chevDown"
          className={"insp-caret" + (open ? "" : " closed")}
          style={{ width: 12, height: 12 }}
        />
        <Icon name={icon} className="ic" /> {label}
        {action && (
          <span className="insp-act" onClick={(e) => e.stopPropagation()}>
            {action}
          </span>
        )}
      </div>
      {open && children}
    </div>
  );
}
