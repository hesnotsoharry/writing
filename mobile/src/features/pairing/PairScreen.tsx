import { CameraView, useCameraPermissions } from "expo-camera";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";

import { Icon, PrimaryButton, Screen } from "../../components";
import { parseMobilePairingInput } from "../../sync/mobilePairing";
import { useTheme } from "../../theme/ThemeProvider";
import { LIGHT, RADIUS, SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { persistPairing } from "./pairPersistence";

const SCAN_ERROR = "That code doesn't look like a WritersNook pairing code. Try scanning again.";
const MANUAL_ERROR = "That pairing string doesn't look right. Check it and try again.";
const PERSIST_ERROR = "Could not save pairing on this device. Try again.";

type Mode = "camera" | "manual";
type Phase = "idle" | "success" | "error";

interface PairScreenProps {
  /**
   * S4 step 5: wired by App.tsx (via AppNavigator) to start the mobile
   * SyncEngine (mobile/src/sync/mobileEngine.ts). Called once, after the key
   * is in SecureStore, sync_role='joined' is in app_meta, and any QR relay
   * override has been persisted for the engine start.
   */
  onPairedSuccessfully?: () => void;
}

interface PairingState {
  errorMessage: string;
  handleBarcodeScanned: (result: { data: string }) => void;
  manualValue: string;
  mode: Mode;
  permission: ReturnType<typeof useCameraPermissions>[0];
  phase: Phase;
  requestPermission: ReturnType<typeof useCameraPermissions>[1];
  retryScanning: () => void;
  setManualValue: (value: string) => void;
  setMode: (mode: Mode) => void;
  submitManual: () => void;
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

function ManualEntry({
  value, onChange, onSubmit, onUseCamera, disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onUseCamera: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.manualWrap}>
      <Text style={[TYPE.body, { color: theme.colors.ink2 }]}>Paste the pairing string shown on your desktop.</Text>
      <TextInput
        style={[styles.input, TYPE.mono, { color: theme.colors.ink, backgroundColor: theme.colors.paper, borderColor: theme.colors.parchmentEdge }]}
        value={value}
        onChangeText={onChange}
        placeholder="Pairing string"
        placeholderTextColor={theme.colors.ink4}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Pairing string"
      />
      <PrimaryButton disabled={disabled} onPress={onSubmit}>Connect this device</PrimaryButton>
      <Pressable onPress={onUseCamera}>
        <Text style={[styles.linkText, { color: theme.colors.accent }]}>Scan a QR code instead</Text>
      </Pressable>
    </View>
  );
}

function usePairing(onPairedSuccessfully?: () => void): PairingState {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>("camera");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState(SCAN_ERROR);
  const [manualValue, setManualValue] = useState("");
  const scannedRef = useRef(false);
  const finishPairing = useCallback(async (key: Uint8Array, url: string | null, deviceName: string | null) => {
    try {
      await persistPairing(key, url, deviceName, () => { setPhase("success"); onPairedSuccessfully?.(); });
    } catch {
      setErrorMessage(PERSIST_ERROR); setPhase("error"); scannedRef.current = false;
    }
  }, [onPairedSuccessfully]);
  const handleBarcodeScanned = useCallback((result: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    try {
      const { deviceName, masterKey, relayUrl } = parseMobilePairingInput(result.data);
      void finishPairing(masterKey, relayUrl, deviceName ?? null);
    } catch {
      setErrorMessage(SCAN_ERROR); setPhase("error"); scannedRef.current = false;
    }
  }, [finishPairing]);
  const submitManual = useCallback(() => {
    try {
      const { deviceName, masterKey, relayUrl } = parseMobilePairingInput(manualValue);
      void finishPairing(masterKey, relayUrl, deviceName ?? null);
    } catch { setErrorMessage(MANUAL_ERROR); setPhase("error"); }
  }, [finishPairing, manualValue]);
  const retryScanning = useCallback(() => { scannedRef.current = false; setPhase("idle"); setMode("camera"); }, []);
  const switchMode = useCallback((next: Mode) => { scannedRef.current = false; setPhase("idle"); setMode(next); }, []);
  return {
    errorMessage, handleBarcodeScanned, manualValue, mode, permission, phase,
    requestPermission, retryScanning, setManualValue, setMode: switchMode, submitManual,
  };
}

function PermissionPrompt({ onAllow, onManual }: { onAllow: () => void; onManual: () => void }) {
  const theme = useTheme();
  return (
    <CenteredMessage>
      <Text style={[styles.explainer, { color: theme.colors.ink2 }]}>
        WritersNook needs camera access to scan your desktop&apos;s pairing code.
      </Text>
      <PrimaryButton onPress={onAllow}>Allow camera access</PrimaryButton>
      <Pressable onPress={onManual}>
        <Text style={[styles.linkText, { color: theme.colors.accent }]}>Enter pairing code manually instead</Text>
      </Pressable>
    </CenteredMessage>
  );
}

function CameraMode({ pairing }: { pairing: PairingState }) {
  const theme = useTheme();
  if (!pairing.permission) {
    return <CenteredMessage><ActivityIndicator color={theme.colors.accent} /></CenteredMessage>;
  }
  if (!pairing.permission.granted) {
    return <PermissionPrompt
      onAllow={() => { void pairing.requestPermission(); }}
      onManual={() => pairing.setMode("manual")}
    />;
  }
  if (pairing.phase === "error") {
    return (
      <CenteredMessage>
        <Text style={[styles.errorText, { color: theme.colors.danger }]} role="alert">{pairing.errorMessage}</Text>
        <PrimaryButton onPress={pairing.retryScanning}>Scan again</PrimaryButton>
        <Pressable onPress={() => pairing.setMode("manual")}>
          <Text style={[styles.linkText, { color: theme.colors.accent }]}>Enter pairing code manually instead</Text>
        </Pressable>
      </CenteredMessage>
    );
  }
  return (
    <View style={styles.cameraStack}>
      <View style={styles.cameraFrame}><CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={pairing.handleBarcodeScanned} />
        <View pointerEvents="none" style={styles.brackets}>{[styles.tl, styles.tr, styles.bl, styles.br].map((corner, index) =>
          <View key={index} style={[styles.corner, corner, { borderColor: LIGHT.colors.paper }]} />)}</View>
        <Text style={[styles.scanning, { color: LIGHT.colors.paper }]}>Looking for a pairing code…</Text>
      </View>
      <Pressable onPress={() => pairing.setMode("manual")}>
        <Text style={[styles.linkText, { color: theme.colors.accent }]}>Enter the code by hand instead</Text>
      </Pressable>
    </View>
  );
}

function PairingHeader() {
  const theme = useTheme();
  return <><View style={styles.steps}><View style={[styles.step, { backgroundColor: theme.colors.accent }]} /><View style={[styles.step, { backgroundColor: theme.colors.accent }]} /><View style={[styles.step, { backgroundColor: theme.colors.parchmentEdge }]} />
    <Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>Step 2 of 3</Text></View>
    <Text style={[TYPE.screenTitle, styles.title, { color: theme.colors.ink }]}>Point this at your desktop</Text>
    <Text style={[TYPE.body, styles.intro, { color: theme.colors.ink2 }]}>On your computer, open <Text style={TYPE.bodyStrong}>Settings → Sync</Text> and choose “Pair a phone”. A code will appear.</Text></>;
}

function ShieldNote() {
  const theme = useTheme();
  return <View style={[styles.shield, { backgroundColor: theme.colors.parchmentDeep }]}><Icon color={theme.colors.ink3} name="shield" size={15} />
    <Text style={[TYPE.metaSmall, styles.shieldCopy, { color: theme.colors.ink2 }]}>The code carries an encryption key. Your writing syncs end-to-end encrypted and never sits readable on a server.</Text></View>;
}

/**
 * S4 step 4: scan the desktop's pairing QR (or paste its pairing string),
 * store the sync master key in SecureStore, and mark this device joined.
 * Never logs the scanned payload or pairing string — both carry the raw key.
 */
export function PairScreen({ onPairedSuccessfully }: PairScreenProps) {
  const theme = useTheme();
  const pairing = usePairing(onPairedSuccessfully);
  if (pairing.phase === "success") {
    return (
      <CenteredMessage>
        <Text style={[TYPE.cardTitle, { color: theme.colors.ink }]}>Paired</Text>
        <Text style={[styles.explainer, { color: theme.colors.ink2 }]}>Your writing will appear here after the first sync.</Text>
      </CenteredMessage>
    );
  }

  if (pairing.mode === "manual") {
    // scroll: the pairing-string input sits in the bottom half of the screen, where the
    // software keyboard would otherwise cover it. No flex:1 on the content style here —
    // Screen's own flexGrow:1 fills the viewport while still letting content grow/scroll.
    return (
      <Screen scroll contentStyle={styles.manualScreen}><PairingHeader />
        {pairing.phase === "error" && (
          <Text style={[styles.errorText, { color: theme.colors.danger }]} role="alert">{pairing.errorMessage}</Text>
        )}
        <ManualEntry
          value={pairing.manualValue}
          onChange={pairing.setManualValue}
          onSubmit={pairing.submitManual}
          onUseCamera={pairing.retryScanning}
          disabled={!pairing.manualValue.trim()}
        />
        <ShieldNote /></Screen>
    );
  }
  return <Screen contentStyle={styles.screen}><PairingHeader /><CameraMode pairing={pairing} /><ShieldNote /></Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  manualScreen: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  center: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14,
  },
  steps: { flexDirection: "row", alignItems: "center", gap: 9 }, step: { width: 22, height: 2 },
  title: { marginTop: 16 }, intro: { marginTop: 10, lineHeight: 24 },
  cameraStack: { flex: 1, minHeight: 0, marginTop: 24, gap: 13 },
  cameraFrame: { flex: 1, minHeight: 260, borderRadius: 18, overflow: "hidden", backgroundColor: "transparent" },
  camera: { position: "absolute", inset: 0 }, brackets: { position: "absolute", inset: 0 },
  corner: { position: "absolute", width: 38, height: 38, borderWidth: 3 },
  tl: { left: 44, top: 44, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { right: 44, top: 44, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { left: 44, bottom: 44, borderRightWidth: 0, borderTopWidth: 0 },
  br: { right: 44, bottom: 44, borderLeftWidth: 0, borderTopWidth: 0 },
  scanning: { ...TYPE.meta, position: "absolute", bottom: 18, left: 0, right: 0, textAlign: "center" },
  explainer: { ...TYPE.bodySmall, textAlign: "center" },
  errorText: { ...TYPE.bodySmall, textAlign: "center" },
  linkText: { ...TYPE.bodySmallStrong, textAlign: "center", minHeight: 44, textAlignVertical: "center" },
  manualWrap: { marginTop: SPACE.s6, gap: 12 },
  input: {
    borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: 12, paddingVertical: 12,
  },
  shield: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12, borderRadius: RADIUS.lg, marginTop: 13 },
  shieldCopy: { flex: 1, lineHeight: 16 },
});
