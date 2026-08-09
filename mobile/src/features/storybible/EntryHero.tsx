import { StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Line } from "react-native-svg";

import { Icon } from "../../components";
import type { EntityWithPortrait } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { MobileTypeDef } from "./typeModel";

interface EntryHeroProps {
  entity: EntityWithPortrait;
  type: MobileTypeDef;
  role: string;
  onRename: (value: string) => void;
  onRole: (value: string) => void;
}

function HatchedPlaceholder({ accent }: { accent: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.portrait, { backgroundColor: theme.colors.parchmentDeep, borderColor: theme.colors.parchmentEdge }]}>
      <Svg height="100%" width="100%">
        {[-30, -12, 6, 24, 42, 60, 78].map((x) => <Line key={x} stroke={accent} strokeOpacity={0.18}
          strokeWidth={2} x1={x} x2={x + 70} y1={80} y2={0} />)}
      </Svg>
      <Text style={[TYPE.monoSmall, styles.portraitLabel, { color: theme.colors.ink3 }]}>portrait</Text>
    </View>
  );
}

export function EntryHero({ entity, onRename, onRole, role, type }: EntryHeroProps) {
  const theme = useTheme(); const accent = theme.label[type.accent];
  return (
    <View style={styles.hero}>
      <HatchedPlaceholder accent={accent} />
      <View style={styles.copy}>
        <View style={styles.eyebrow}><Icon color={accent} name={type.icon} size={13} />
          <Text style={[TYPE.sectionLabel, { color: accent }]}>{type.label}</Text></View>
        <TextInput defaultValue={entity.name} onEndEditing={(event) => onRename(event.nativeEvent.text)}
          placeholder="Untitled entry" placeholderTextColor={theme.colors.ink4}
          selectionColor={theme.colors.accent} style={[TYPE.entryName, styles.name, { color: theme.colors.ink }]} />
        <TextInput defaultValue={role} onEndEditing={(event) => onRole(event.nativeEvent.text)}
          placeholder="Add a role" placeholderTextColor={theme.colors.ink4}
          selectionColor={theme.colors.accent} style={[TYPE.bodySmall, styles.role, { color: theme.colors.ink2 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", gap: 15, alignItems: "flex-start" },
  portrait: { width: 64, height: 80, borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden", justifyContent: "flex-end" },
  portraitLabel: { position: "absolute", alignSelf: "center", bottom: 6, fontSize: 8.5 }, copy: { flex: 1, minWidth: 0, paddingTop: 2 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 6 }, name: { minHeight: 40, paddingVertical: 2, paddingHorizontal: 0, marginTop: 2 },
  role: { minHeight: 36, paddingVertical: 3, paddingHorizontal: 0 },
});
