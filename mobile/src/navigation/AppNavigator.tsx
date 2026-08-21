import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AiAssistantScreen, AiContextScreen, AiLimitsScreen, AiModelScreen, HiddenFromAiScreen, SelectionActionsScreen } from "../features/ai";
import { ArchiveScreen } from "../features/archive";
import { ProjectBinderScreen } from "../features/binder";
import { CorkboardScreen } from "../features/corkboard";
import { SceneScreen } from "../features/editor";
import { FocusHudScreen } from "../features/focus";
import { GoalsScreen, NewGoalScreen } from "../features/goals";
import { EmptyProjectScreen, HubScreen } from "../features/hub";
import { InboxScreen } from "../features/inbox";
import { InspectorScreen } from "../features/inspector";
import { ActivationScreen, TrialScreen } from "../features/license";
import { OutlinerScreen } from "../features/outliner";
import { PairScreen } from "../features/pairing";
import { ProjectsScreen } from "../features/projects";
import { SceneActionsScreen } from "../features/sceneactions";
import { SearchScreen } from "../features/search";
import { SettingsScreen } from "../features/settings";
import { VersionHistoryScreen } from "../features/snapshots";
import { AutoLinkPeekScreen, BibleEntryScreen, BibleListScreen, BoardViewerScreen, CustomTypeScreen, NewEntryScreen, RelationshipMapScreen } from "../features/storybible";
import { OfflineCatchUpScreen } from "../features/sync";
import { useTheme } from "../theme/ThemeProvider";
import type { RootStackParamList } from "./routes";

export type { RootStackParamList } from "./routes";

const Stack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps { onPairedSuccessfully?: () => void }

const STANDARD_SCREENS = <>
  <Stack.Screen component={ProjectsScreen} name="ProjectList" />
  <Stack.Screen component={HubScreen} name="Hub" />
  {/* Decision 0016 made the binder drawer button-only (header hamburger), so
      there is no left-edge drawer gesture left to protect and the editor keeps
      the platform's swipe-back: iOS interactive-pop, and on Android the system
      back gesture, which native-stack never hands to JS anyway. */}
  <Stack.Screen component={SceneScreen} name="Scene" />
  <Stack.Screen component={ProjectBinderScreen} name="ProjectBinder" options={({ route }) => ({ headerShown: true, title: route.params.projectTitle })} />
  <Stack.Screen component={InspectorScreen} name="Inspector" />
  <Stack.Screen component={CorkboardScreen} name="Corkboard" />
  <Stack.Screen component={OutlinerScreen} name="Outliner" />
  <Stack.Screen component={SearchScreen} name="Search" />
  <Stack.Screen component={BibleListScreen} name="BibleList" />
  <Stack.Screen component={BibleEntryScreen} name="BibleEntry" />
  <Stack.Screen component={BibleEntryScreen} name="BibleEntryScrolled" />
  <Stack.Screen component={BibleEntryScreen} name="BibleEntryLocation" />
  <Stack.Screen component={AutoLinkPeekScreen} name="AutoLinkPeek" />
  <Stack.Screen component={RelationshipMapScreen} name="RelationshipMap" />
  <Stack.Screen component={BoardViewerScreen} name="BoardViewer" />
  <Stack.Screen component={GoalsScreen} name="Goals" />
  <Stack.Screen component={VersionHistoryScreen} name="VersionHistoryEmpty" />
  <Stack.Screen component={InboxScreen} name="Inbox" />
  <Stack.Screen component={AiAssistantScreen} name="AiAssistant" />
  <Stack.Screen component={SettingsScreen} name="Settings" />
  <Stack.Screen component={FocusHudScreen} name="FocusHud" />
  <Stack.Screen component={SelectionActionsScreen} name="SelectionActions" />
  <Stack.Screen component={AiContextScreen} name="AiContext" />
  <Stack.Screen component={AiModelScreen} name="AiModel" />
  <Stack.Screen component={HiddenFromAiScreen} name="HiddenFromAi" />
  <Stack.Screen component={AiLimitsScreen} name="AiLimits" />
  <Stack.Screen component={SceneActionsScreen} name="SceneActions" />
  <Stack.Screen component={NewGoalScreen} name="NewGoal" />
  <Stack.Screen component={ArchiveScreen} name="Archive" />
  <Stack.Screen component={EmptyProjectScreen} name="EmptyProject" />
  <Stack.Screen component={OfflineCatchUpScreen} name="OfflineCatchUp" />
  <Stack.Screen component={ActivationScreen} name="Activation" />
  <Stack.Screen component={TrialScreen} name="Trial" />
  <Stack.Screen component={NewEntryScreen} name="NewEntry" />
  <Stack.Screen component={CustomTypeScreen} name="CustomType" />
  <Stack.Screen component={VersionHistoryScreen} name="SceneVersionHistory" />
</>;

export function AppNavigator({ onPairedSuccessfully }: AppNavigatorProps) {
  const theme = useTheme();
  return (
    <Stack.Navigator initialRouteName="ProjectList" screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: theme.colors.parchment },
      headerStyle: { backgroundColor: theme.colors.parchment },
      headerTintColor: theme.colors.accent,
      headerShadowVisible: false,
    }}>
      {STANDARD_SCREENS}
      <Stack.Screen name="Pair" options={{ headerShown: true, title: "Pair with desktop" }}>
        {(props) => <PairScreen {...props} onPairedSuccessfully={onPairedSuccessfully} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
