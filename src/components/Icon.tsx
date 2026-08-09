import type { CSSProperties } from "react";

import { ICON_PATHS, type IconName } from "./iconPaths";

export type { IconName } from "./iconPaths";
export { ICON_PATHS } from "./iconPaths";

interface IconProps {
  name: IconName;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, className, style }: IconProps) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || "" }}
    />
  );
}
