import BottomSheet from "@gorhom/bottom-sheet";
import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { useCallback } from "react";
import { Pressable, StyleSheet, useWindowDimensions,View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/ThemeProvider";
import { RADIUS } from "../theme/tokens";
import { resolveSheetHeight } from "./Sheet.logic";

export interface SheetProps {
  children: ReactNode;
  open: boolean;
  onDismiss: () => void;
  designHeight?: number;
}

function SheetBackdrop({ onDismiss }: { onDismiss: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityLabel="Dismiss sheet" onPress={onDismiss} style={StyleSheet.absoluteFill}>
      <BlurView intensity={8} style={StyleSheet.absoluteFill} tint={theme.name}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.scrim }]} />
      </BlurView>
    </Pressable>
  );
}

function SheetSurface({ children, designHeight, onDismiss }: Omit<SheetProps, "open">) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const handleChange = useCallback((index: number) => { if (index < 0) onDismiss(); }, [onDismiss]);
  const fixedHeight = designHeight === undefined ? undefined : resolveSheetHeight(designHeight, height);
  return (
    <BottomSheet
      backgroundStyle={[styles.background, theme.shadow.sheet, { backgroundColor: theme.colors.paper }]}
      enableDynamicSizing={fixedHeight === undefined}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: theme.colors.ink4 }}
      index={0}
      onChange={handleChange}
      snapPoints={fixedHeight === undefined ? undefined : [fixedHeight]}
    >
      <View style={[styles.content, { paddingBottom: Math.max(16, insets.bottom) }]}>{children}</View>
    </BottomSheet>
  );
}

export function Sheet({ children, designHeight, onDismiss, open }: SheetProps) {
  if (!open) return null;
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <SheetBackdrop onDismiss={onDismiss} />
      <SheetSurface designHeight={designHeight} onDismiss={onDismiss}>{children}</SheetSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", inset: 0, zIndex: 100 },
  background: { borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet },
  content: { paddingHorizontal: 20 },
});
