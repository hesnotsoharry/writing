import type { CSSProperties, MouseEvent } from "react";

import type { SceneStatus } from "../lib/status";
import { STATUS_META } from "../lib/status";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";

// ---------------------------------------------------------------------------
// StatusGlyph — canonical per-status symbol for use app-wide.
// Replaces all inline dot/check branches. Color comes from STATUS_META.dot;
// icon comes from STATUS_META.icon (circleOpen / list / pencil / rotate / check).
// ---------------------------------------------------------------------------

interface StatusGlyphProps {
  status: SceneStatus;
  size?: number;
  onClick?: (e: MouseEvent) => void;
  className?: string;
}

const baseWrap: CSSProperties = { display: "inline-flex", flexShrink: 0 };

export function StatusGlyph({ status, size = 12, onClick, className }: StatusGlyphProps) {
  const meta = STATUS_META[status];
  const iconStyle: CSSProperties = { width: size, height: size };

  if (onClick) {
    return (
      <span
        className={className}
        style={{ ...baseWrap, color: meta.dot, cursor: "pointer" }}
        role="button"
        title={`${meta.label} · click to change`}
        onClick={onClick}
      >
        <Icon name={meta.icon as IconName} style={iconStyle} />
      </span>
    );
  }
  return (
    <span
      className={className}
      style={{ ...baseWrap, color: meta.dot }}
      title={meta.label}
    >
      <Icon name={meta.icon as IconName} style={iconStyle} />
    </span>
  );
}
