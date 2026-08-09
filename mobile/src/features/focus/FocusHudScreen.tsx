import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../../components";
import type { RootStackParamList } from "../../navigation/routes";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";
import { FocusHud } from "./FocusHud";
import { useFocusSettings } from "./focusSettings";

type Props = NativeStackScreenProps<RootStackParamList, "FocusHud">;

export function FocusHudScreen({ navigation }: Props) {
  const theme = useTheme(); const focus = useFocusSettings();
  return <Screen contentStyle={styles.screen}><View style={styles.prose}>
    <Text style={[TYPE.prose, { color: theme.colors.ink, opacity: 0.35 }]}>The tide went out further than it had any right to, and the road showed itself.</Text>
    <Text style={[TYPE.prose, { color: theme.colors.ink }]}>So she walked. The sand held under her boots, wet and grainy and colder than she expected.</Text>
    <Text style={[TYPE.prose, { color: theme.colors.ink, opacity: 0.35 }]}>Behind her, Hallow Quay shrank to a line of grey teeth.</Text></View>
    <FocusHud onExit={navigation.goBack} onUpdate={focus.update} sceneTitle="The river" settings={focus.settings} wordCount={612} /></Screen>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, prose: { paddingHorizontal: 24, paddingTop: 70, gap: 24 } });
