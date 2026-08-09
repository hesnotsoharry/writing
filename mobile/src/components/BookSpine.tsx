import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useTheme } from "../theme/ThemeProvider";

export interface BookSpineProps { variant?: "project" | "hub" }

export function BookSpine({ variant = "project" }: BookSpineProps) {
  const theme = useTheme();
  const width = variant === "project" ? 44 : 26;
  const height = variant === "project" ? 56 : 33;
  const radius = variant === "project" ? 3 : 2;
  return (
    <Svg accessibilityLabel="Book" height={height} width={width}>
      <Defs>
        <LinearGradient id="spine" x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor={theme.colors.accent} />
          <Stop offset="1" stopColor={theme.colors.accentDeep} />
        </LinearGradient>
      </Defs>
      <Rect fill="url(#spine)" height={height} rx={radius} width={width} />
      <Rect fill={theme.colors.paper} height={height - 4} opacity={0.18} rx={1} width={2} x={2} y={2} />
    </Svg>
  );
}
