import { StyleSheet, Text, TextInput, View } from "react-native";

import type { IconName } from "../../components";
import { Icon } from "../../components";
import type { MergedSection } from "../../shared/fullEntryDefs";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";

export function EntrySections({ sections, onSave }: {
  sections: MergedSection[]; onSave: (key: string, value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.sections}>
      {sections.map((section) => (
        <View key={section.key}>
          <View style={styles.heading}><Icon color={theme.colors.ink3} name={section.icon as IconName} size={14} />
            <Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>{section.label}</Text></View>
          <TextInput defaultValue={section.text} multiline onEndEditing={(event) => onSave(section.key, event.nativeEvent.text)}
            placeholder={`No ${section.label.toLocaleLowerCase()} yet.`} placeholderTextColor={theme.colors.ink4}
            selectionColor={theme.colors.accent} style={[TYPE.proseBody, styles.input, { color: theme.colors.ink }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { marginTop: 18, gap: 15 }, heading: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4 },
  input: { minHeight: 48, paddingHorizontal: 0, paddingVertical: 4, textAlignVertical: "top" },
});
