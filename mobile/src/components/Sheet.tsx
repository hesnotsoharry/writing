import BottomSheet, { BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { useCallback } from "react";
import { Pressable, StyleSheet, useWindowDimensions,View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/ThemeProvider";
import { RADIUS } from "../theme/tokens";
import { resolveSheetLayout } from "./Sheet.logic";
import { InSheetProvider } from "./sheetContext";

export interface SheetProps {
  children: ReactNode;
  open: boolean;
  onDismiss: () => void;
  designHeight?: number;
  scrollable?: boolean;
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

function SheetContent({ children, fillsHeight, paddingBottom, scrollable }: {
  children: ReactNode; fillsHeight: boolean; paddingBottom: number; scrollable?: boolean;
}) {
  const contentStyle = [styles.content, { paddingBottom }];
  if (scrollable) {
    return <BottomSheetScrollView
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
      style={fillsHeight ? styles.fixedContent : undefined}
    >{children}</BottomSheetScrollView>;
  }
  return <BottomSheetView style={contentStyle}>{children}</BottomSheetView>;
}

function SheetSurface({ children, designHeight, onDismiss, scrollable }: Omit<SheetProps, "open">) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const handleChange = useCallback((index: number) => { if (index < 0) onDismiss(); }, [onDismiss]);
  const layout = resolveSheetLayout(designHeight, height);
  return (
    <BottomSheet
      // A sheet is anchored to the bottom of the window, so every input in one
      // is in the half the keyboard covers. The library ships defaults that do
      // not match this app: `android_keyboardInputMode` defaults to `adjustPan`
      // while the app sets `softwareKeyboardLayoutMode: "resize"`, and under
      // that mismatch gorhom applies its own offset maths on top of a window
      // Android has already resized. Declaring `adjustResize` makes it stand
      // down and let the window resize do the work. `keyboardBlurBehavior`
      // defaults to `none`, which leaves a sheet parked at keyboard height
      // after dismissal.
      android_keyboardInputMode="adjustResize"
      backgroundStyle={[styles.background, theme.shadow.sheet, { backgroundColor: theme.colors.paper }]}
      enableDynamicSizing={layout.fixedHeight === undefined}
      enablePanDownToClose
      handleIndicatorStyle={{ backgroundColor: theme.colors.ink4 }}
      index={0}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onChange={handleChange}
      snapPoints={layout.fixedHeight === undefined ? undefined : [layout.fixedHeight]}
    >
      <InSheetProvider value={true}>
        <SheetContent fillsHeight={layout.contentFillsAvailableHeight}
          paddingBottom={Math.max(16, insets.bottom)} scrollable={scrollable}>
          {children}
        </SheetContent>
      </InSheetProvider>
    </BottomSheet>
  );
}

export function Sheet({ children, designHeight, onDismiss, open, scrollable }: SheetProps) {
  if (!open) return null;
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <SheetBackdrop onDismiss={onDismiss} />
      <SheetSurface designHeight={designHeight} onDismiss={onDismiss} scrollable={scrollable}>
        {children}
      </SheetSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", inset: 0, zIndex: 100 },
  background: { borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet },
  content: { paddingHorizontal: 20 },
  fixedContent: { flex: 1 },
});
