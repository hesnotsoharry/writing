import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { IconName } from "../../components";
import { Icon, ICON_PATHS, PrimaryButton, Screen, SecondaryButton, Sheet, TextField } from "../../components";
import { getStoryBibleStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import { CT_ICONS, CT_PALETTE, type CtColor } from "../../shared/customTypeDefs";
import type { StoryBibleStore } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";

type Props = NativeStackScreenProps<RootStackParamList, "CustomType">;

function mobileIcons(): IconName[] {
  return (CT_ICONS as readonly string[]).filter((icon): icon is IconName => icon in ICON_PATHS);
}

function ChoiceIcon({ active, icon, onPress }: { active: boolean; icon: IconName; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityLabel={`Use ${icon} icon`} onPress={onPress} style={[styles.iconChoice, {
    backgroundColor: theme.colors.paper, borderColor: active ? theme.colors.accent : theme.colors.line,
    borderWidth: active ? 1.5 : 1,
  }]}><Icon color={active ? theme.colors.accent : theme.colors.ink2} name={icon} size={18} /></Pressable>;
}

function AccentChoice({ active, color, onPress }: { active: boolean; color: CtColor; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityLabel={`Use ${color} accent`} onPress={onPress} style={styles.swatchTarget}>
    <View style={[styles.swatch, { backgroundColor: theme.label[color] }, active && { borderColor: theme.colors.paper, borderWidth: 3 }]} />
  </Pressable>;
}

function Preview({ color, icon, name }: { color: CtColor; icon: IconName; name: string }) {
  const theme = useTheme(); const label = name.trim() || "Custom type";
  return <View style={[styles.previewBox, { backgroundColor: theme.colors.parchmentDeep }]}>
    <Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>Preview</Text>
    <View style={[styles.previewRow, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}>
      <View style={[styles.previewIcon, { backgroundColor: theme.labelTint[color] }]}><Icon color={theme.label[color]} name={icon} size={16} /></View>
      <View><Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>The Kittiwake</Text>
        <Text style={[TYPE.metaSmall, styles.previewType, { color: theme.label[color] }]}>{label}</Text></View>
    </View>
  </View>;
}

function CustomTypeForm({ navigation, projectId }: { navigation: Props["navigation"]; projectId: string }) {
  const theme = useTheme(); const [store, setStore] = useState<StoryBibleStore | null>(null);
  const icons = mobileIcons(); const [name, setName] = useState(""); const [icon, setIcon] = useState<IconName>(icons[0] ?? "circleOpen"); const [color, setColor] = useState<CtColor>(CT_PALETTE[0]);
  useEffect(() => { void getStoryBibleStore().then(setStore); }, []);
  const create = () => {
    if (!store || !name.trim()) return;
    void store.createCustomType({ projectId, name: name.trim(), icon, color }).then(() => navigation.goBack());
  };
  return <View style={styles.form}>
    <Text style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>New custom type</Text>
    <Text style={[TYPE.meta, styles.subtitle, { color: theme.colors.ink3 }]}>For the things this book has that the six built-ins don’t</Text>
    <TextField label="Name" onChangeText={setName} placeholder="Vessel" value={name} />
    <Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>Icon</Text>
    <View style={styles.iconGrid}>{icons.map((item) => <ChoiceIcon active={item === icon} icon={item} key={item} onPress={() => setIcon(item)} />)}</View>
    <Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>Accent</Text>
    <View style={styles.swatches}>{CT_PALETTE.map((item) => <AccentChoice active={item === color} color={item} key={item} onPress={() => setColor(item)} />)}</View>
    <Preview color={color} icon={icon} name={name} />
    <View style={styles.actions}><SecondaryButton onPress={() => navigation.goBack()}>Cancel</SecondaryButton>
      <PrimaryButton disabled={!store || !name.trim()} onPress={create}>Create type</PrimaryButton></View>
  </View>;
}

export function CustomTypeScreen({ navigation, route }: Props) {
  const theme = useTheme();
  return <Screen contentStyle={[styles.screen, { backgroundColor: theme.colors.paper }]}>
    <View style={styles.backdropCopy}><Text style={[TYPE.prose, { color: theme.colors.ink }]}>The tide went out further than it had any right to.</Text></View>
    <Sheet designHeight={724} onDismiss={() => navigation.goBack()} open scrollable>
      <CustomTypeForm navigation={navigation} projectId={route.params.projectId} />
    </Sheet>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, backdropCopy: { padding: 24 }, form: { gap: 13, paddingTop: 4, paddingBottom: 16 }, subtitle: { marginTop: -10, marginBottom: 4 },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, iconChoice: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 4 }, swatchTarget: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
  swatch: { width: 34, height: 34, borderRadius: RADIUS.pill }, previewBox: { borderRadius: RADIUS.lg, padding: 14, gap: 10 },
  previewRow: { minHeight: 54, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 11 },
  previewIcon: { width: 30, height: 30, borderRadius: 7, alignItems: "center", justifyContent: "center" }, previewType: { textTransform: "uppercase", letterSpacing: 0.4, marginTop: 1 },
  actions: { flexDirection: "row", gap: 8 },
});
