import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ProjectBinderScreen } from "../features/binder/ProjectBinderScreen";
import { ProjectListScreen } from "../features/binder/ProjectListScreen";
import { PALETTE } from "../theme/palette";

export type RootStackParamList = {
  ProjectList: undefined;
  ProjectBinder: { projectId: string; projectTitle: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * S4 step 3: native-stack shell for the read-only binder browse —
 * ProjectList -> ProjectBinder (per project). No WebView, no sync
 * dependency (S4 blueprint step 3). Header/background styling matches the
 * parchment palette already established in App.tsx.
 */
export function AppNavigator() {
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
    </Stack.Navigator>
  );
}
