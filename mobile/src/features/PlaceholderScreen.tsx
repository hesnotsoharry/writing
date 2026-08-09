import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { EmptyState, Screen } from "../components";
import type { RootStackParamList } from "../navigation/routes";

export function PlaceholderScreen({ headline }: { headline: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Screen>
      <EmptyState
        actionLabel="Go back"
        headline={headline}
        icon="feather"
        onAction={() => navigation.goBack()}
        reassurance="This screen is not built yet."
      />
    </Screen>
  );
}
