import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";

import type { RootStackParamList } from "../../navigation/AppNavigator";
import { SceneEditorHost } from "./SceneEditorHost";
import { SceneReader } from "./SceneReader";

type Props = NativeStackScreenProps<RootStackParamList, "Scene">;

export function SceneScreen({ route }: Props) {
  const { sceneId } = route.params;
  return (
    <View style={styles.screen}>
      <SceneReader sceneId={sceneId} />
      <SceneEditorHost key={sceneId} sceneId={sceneId} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
