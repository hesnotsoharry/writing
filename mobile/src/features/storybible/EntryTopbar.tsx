import { StyleSheet, Text, View } from "react-native";

import { IconButton } from "../../components";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";
import { TypeAvatar } from "./TypeAvatar";
import type { MobileTypeDef } from "./typeModel";

export function EntryTopbar({ compact, name, type, onBack, onDelete }: {
  compact: boolean; name: string; type: MobileTypeDef; onBack: () => void; onDelete: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.root, { borderBottomColor: theme.colors.lineSoft }]}>
      <IconButton icon="chevLeft" label="Back to Story Bible" onPress={onBack} />
      <View style={[styles.crumb, compact && styles.compactCrumb]}>{compact ? <TypeAvatar name={name} size={22} type={type} /> : null}
        <Text numberOfLines={1} style={[compact ? TYPE.bodySmallStrong : TYPE.metaSmall, styles.crumbText, { color: compact ? theme.colors.ink : theme.colors.ink3 }]}>
          {compact ? name : `Story Bible / ${type.label}s / ${name}`}
        </Text></View>
      <IconButton color={theme.colors.danger} icon="trash" label={`Delete ${name}`} onPress={onDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  crumb: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  compactCrumb: { flexDirection: "row", alignItems: "center", gap: 7 }, crumbText: { flex: 1 },
});
