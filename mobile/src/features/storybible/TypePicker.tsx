import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components";
import type { CustomEntityType } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { BUILTIN_TYPE_KEYS, resolveMobileType } from "./typeModel";

export function TypePicker({ customTypes, onCustom, onSelect, selected }: {
  customTypes: CustomEntityType[]; selected: string; onSelect: (type: string) => void; onCustom: () => void;
}) {
  const theme = useTheme();
  const types = [...BUILTIN_TYPE_KEYS, ...customTypes.map((custom) => custom.id)];
  return (
    <View>
      <Text style={[TYPE.sectionLabel, styles.heading, { color: theme.colors.ink3 }]}>Type</Text>
      <View style={styles.grid}>
        {types.map((key) => {
          const type = resolveMobileType(key, customTypes); const active = selected === key;
          return <Pressable key={key} onPress={() => onSelect(key)} style={[styles.tile, {
            backgroundColor: theme.colors.paper,
            borderColor: active ? theme.label[type.accent] : theme.colors.line,
            borderWidth: active ? 1.5 : 1,
          }]}><Icon color={theme.label[type.accent]} name={type.icon} size={19} />
            <Text numberOfLines={1} style={[TYPE.meta, styles.label, { color: theme.colors.ink }]}>{type.label}</Text></Pressable>;
        })}
      </View>
      <Pressable onPress={onCustom} style={[styles.custom, { borderColor: theme.colors.parchmentEdge }]}>
        <Icon color={theme.colors.ink3} name="plus" size={15} />
        <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink3 }]}>Make a custom type</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: 10 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "31.5%", minHeight: 68, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", padding: 6 },
  label: { fontFamily: TYPE.bodySmallStrong.fontFamily, marginTop: 5 }, custom: { minHeight: HIT_SLOP_MIN, marginTop: 10, borderWidth: 1,
    borderStyle: "dashed", borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
});
