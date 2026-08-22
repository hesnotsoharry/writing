import { StyleSheet, Text, View } from "react-native";

import { Card, Sheet, Toggle } from "../../components";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";
import type { OutlinerColumn, OutlinerColumnVisibility } from "./outlinerColumns";
import { OUTLINER_COLUMN_OPTIONS } from "./outlinerColumns";

export interface OutlinerColumnsSheetProps {
  columns: OutlinerColumnVisibility;
  open: boolean;
  onDismiss: () => void;
  onToggle: (key: OutlinerColumn) => void;
}

/** What each scene row shows. Turning the synopsis and labels off collapses the
 *  outliner into the dense triage list the desktop table is prized for. */
export function OutlinerColumnsSheet({ columns, onDismiss, onToggle, open }: OutlinerColumnsSheetProps) {
  const theme = useTheme();
  return (
    <Sheet onDismiss={onDismiss} open={open}>
      <View style={styles.content}>
        <Text style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>Columns</Text>
        <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>
          Choose what each scene row shows. The title always stays.
        </Text>
        <Card radius="small" style={styles.options}>
          {OUTLINER_COLUMN_OPTIONS.map((option) => (
            <Toggle description={option.description} key={option.key} label={option.label}
              onChange={() => { onToggle(option.key); }} value={columns[option.key]} />
          ))}
        </Card>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8, paddingTop: 4 },
  options: { gap: 18, marginTop: 4 },
});
