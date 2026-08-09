import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { RADIUS } from "../theme/tokens";
import { buildHeatMapGrid, type HeatMapDay } from "./HeatMap.logic";

export interface HeatMapProps { days: readonly HeatMapDay[]; today?: Date; cellSize?: number }

function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
}

export function HeatMap({ cellSize = 18, days, today = new Date() }: HeatMapProps) {
  const theme = useTheme();
  const cells = buildHeatMapGrid(days, today);
  return (
    <View accessibilityLabel="Three week writing streak" style={styles.grid}>
      {chunks(cells, 7).map((week) => (
        <View key={week[0]?.date} style={styles.row}>
          {week.map((cell) => (
            <View
              accessibilityLabel={`${cell.date}: ${cell.value}`}
              key={cell.date}
              style={{
                width: cellSize, height: cellSize, borderRadius: RADIUS.xs,
                backgroundColor: cell.value > 0 ? theme.colors.accent : theme.colors.parchmentDeep,
                opacity: cell.value > 0 ? Math.max(0.25, Math.min(1, cell.value)) : 1,
                borderWidth: cell.isToday ? 1.5 : 0,
                borderColor: theme.colors.ink2,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 5 },
  row: { flexDirection: "row", gap: 5 },
});
