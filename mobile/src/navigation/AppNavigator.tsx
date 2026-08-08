import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ProjectBinderScreen } from "../features/binder/ProjectBinderScreen";
import { ProjectListScreen } from "../features/binder/ProjectListScreen";
import { SceneScreen } from "../features/editor/SceneScreen";
import { PairScreen } from "../features/pairing/PairScreen";
import { PALETTE } from "../theme/palette";

export type RootStackParamList = {
  ProjectList: undefined;
  ProjectBinder: { projectId: string; projectTitle: string };
  Scene: { sceneId: string; sceneTitle: string };
  Pair: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  /** S4 step 5: forwarded to PairScreen so App.tsx can start the mobile
   *  SyncEngine right after a successful pair — see PairScreen's prop doc. */
  onPairedSuccessfully?: () => void;
}

/**
 * S4 step 3: native-stack shell for the read-only binder browse —
 * ProjectList -> ProjectBinder -> Scene (per scene, read-only, S4 step 5).
 * No WebView yet — the real editor bridge arrives in S5. Header/background
 * styling matches the parchment palette already established in App.tsx.
 */
export function AppNavigator({ onPairedSuccessfully }: AppNavigatorProps) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: PALETTE.bg },
        headerTintColor: PALETTE.accent,
        headerTitleStyle: { color: PALETTE.ink, fontWeight: "600" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: PALETTE.bg },
      }}
    >
      <Stack.Screen
        name="ProjectList"
        component={ProjectListScreen}
        options={{ title: "Your writing" }}
      />
      <Stack.Screen
        name="ProjectBinder"
        component={ProjectBinderScreen}
        options={({ route }) => ({ title: route.params.projectTitle })}
      />
      <Stack.Screen
        name="Scene"
        component={SceneScreen}
        options={({ route }) => ({ title: route.params.sceneTitle })}
      />
      <Stack.Screen name="Pair" options={{ title: "Pair with desktop" }}>
        {(props) => <PairScreen {...props} onPairedSuccessfully={onPairedSuccessfully} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
