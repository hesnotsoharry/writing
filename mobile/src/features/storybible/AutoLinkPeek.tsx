import { Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton, SecondaryButton } from "../../components";
import type { CustomEntityType, Entity } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { Rect, Size } from "./autolinkPlacement";
import { placeAutoLinkPeek } from "./autolinkPlacement";
import { TypeAvatar } from "./TypeAvatar";
import { resolveMobileType } from "./typeModel";

const PEEK_SIZE: Size = { width: 314, height: 126 };

export interface AutoLinkPeekProps {
  anchor: Rect;
  viewport: Size;
  entity: Entity;
  customTypes?: CustomEntityType[];
  onDismiss: () => void;
  onOpenEntry: () => void;
  onFindMentions: () => void;
}

function Caret({ above, left }: { above: boolean; left: number }) {
  const theme = useTheme();
  return <View style={[styles.caret, { left, backgroundColor: theme.colors.paper, borderColor: theme.colors.parchmentEdge },
    above ? styles.caretBelow : styles.caretAbove]} />;
}

export function AutoLinkPeek({ anchor, customTypes = [], entity, onDismiss, onFindMentions,
  onOpenEntry, viewport }: AutoLinkPeekProps) {
  const theme = useTheme(); const position = placeAutoLinkPeek(anchor, PEEK_SIZE, viewport);
  const type = resolveMobileType(entity.type, customTypes);
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable accessibilityLabel="Dismiss entity peek" onPress={onDismiss} style={StyleSheet.absoluteFill} />
      <View style={[styles.popover, theme.shadow.raised, {
        backgroundColor: theme.colors.paper, borderColor: theme.colors.parchmentEdge,
        left: position.left, top: position.top,
      }]}>
        <Caret above={position.above} left={position.caretX - 6} />
        <View style={styles.head}><TypeAvatar name={entity.name} size={44} type={type} />
          <View style={styles.copy}><Text numberOfLines={1} style={[TYPE.bodyStrong, styles.name, { color: theme.colors.ink }]}>{entity.name}</Text>
            <Text style={[TYPE.metaSmall, styles.type, { color: theme.label[type.accent] }]}>{type.label}</Text></View></View>
        <View style={[styles.actions, { borderTopColor: theme.colors.lineSoft }]}>
          <PrimaryButton onPress={onOpenEntry} style={styles.button}>Open entry</PrimaryButton>
          <SecondaryButton onPress={onFindMentions} style={styles.button}>Find mentions</SecondaryButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  popover: { position: "absolute", width: PEEK_SIZE.width, minHeight: PEEK_SIZE.height, borderWidth: 1, borderRadius: RADIUS.card, padding: 14 },
  caret: { position: "absolute", width: 12, height: 12, borderLeftWidth: 1, borderTopWidth: 1, transform: [{ rotate: "45deg" }] },
  caretAbove: { top: -7 }, caretBelow: { bottom: -7, transform: [{ rotate: "225deg" }] },
  head: { flexDirection: "row", alignItems: "center", gap: 12 }, copy: { flex: 1, minWidth: 0 }, name: { fontSize: 16 },
  type: { fontFamily: TYPE.bodySmallStrong.fontFamily, textTransform: "uppercase", letterSpacing: 0.45, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginTop: 13, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth },
  button: { flex: 1 },
});
