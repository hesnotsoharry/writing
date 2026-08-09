import type { ReactNode } from "react";
import type { ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme/ThemeProvider";

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle">;
}

export function Screen({ children, contentStyle, scroll = false, scrollProps }: ScreenProps) {
  const theme = useTheme();
  const background = { backgroundColor: theme.colors.parchment };
  if (scroll) {
    return (
      <SafeAreaView style={[styles.safe, background]}>
        <ScrollView
          {...scrollProps}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return <SafeAreaView style={[styles.safe, background]}><View style={[styles.content, contentStyle]}>{children}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1 },
});
