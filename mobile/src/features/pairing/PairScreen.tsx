import { CameraView, useCameraPermissions } from "expo-camera";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";

import { setSyncMasterKey } from "../../sync/mobileKeyStorage";
import { parseMobilePairingInput } from "../../sync/mobilePairing";
import { setMobileRelayUrlOverride } from "../../sync/mobileRelayUrl";
import { markDeviceJoined } from "../../sync/mobileSyncRole";
import { PALETTE } from "../../theme/palette";

const SCAN_ERROR = "That code doesn't look like a WritersNook pairing code. Try scanning again.";
const MANUAL_ERROR = "That pairing string doesn't look right. Check it and try again.";

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
  return (
    <View style={styles.manualWrap}>
      <Text style={styles.explainer}>Paste the pairing string shown on your desktop.</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="Pairing string"
        placeholderTextColor={PALETTE.inkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Pairing string"
      />
      <Pressable
        style={[styles.primaryButton, disabled && styles.buttonDisabled]}
        disabled={disabled}
        onPress={onSubmit}
      >
        <Text style={styles.primaryButtonText}>Connect this device</Text>
      </Pressable>
      <Pressable onPress={onUseCamera}>
        <Text style={styles.linkText}>Scan a QR code instead</Text>
      </Pressable>
    </View>
  );
}

async function persistPairing(
  masterKey: Uint8Array,
  relayUrl: string | null,
  onSuccess: () => void,
): Promise<void> {
  await setSyncMasterKey(masterKey);
  if (relayUrl) await setMobileRelayUrlOverride(relayUrl);
  await markDeviceJoined();
  onSuccess();
}

function usePairing(onPairedSuccessfully?: () => void): PairingState {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>("camera");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState(SCAN_ERROR);
  const [manualValue, setManualValue] = useState("");
  const scannedRef = useRef(false);
  const finishPairing = useCallback((key: Uint8Array, url: string | null) => {
    void persistPairing(key, url, () => { setPhase("success"); onPairedSuccessfully?.(); });
  }, [onPairedSuccessfully]);
  const handleBarcodeScanned = useCallback((result: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    try {
      const { masterKey, relayUrl } = parseMobilePairingInput(result.data);
      finishPairing(masterKey, relayUrl);
    } catch {
      setErrorMessage(SCAN_ERROR); setPhase("error"); scannedRef.current = false;
    }
  }, [finishPairing]);
  const submitManual = useCallback(() => {
    try {
      const { masterKey, relayUrl } = parseMobilePairingInput(manualValue);
      finishPairing(masterKey, relayUrl);
    } catch { setErrorMessage(MANUAL_ERROR); setPhase("error"); }
  }, [finishPairing, manualValue]);
  const retryScanning = useCallback(() => { setPhase("idle"); setMode("camera"); }, []);
  return { errorMessage, handleBarcodeScanned, manualValue, mode, permission, phase,
    requestPermission, retryScanning, setManualValue, setMode, submitManual };
}

function PermissionPrompt({ onAllow, onManual }: { onAllow: () => void; onManual: () => void }) {
  return (
    <CenteredMessage>
      <Text style={styles.explainer}>
        WritersNook needs camera access to scan your desktop&apos;s pairing code.
      </Text>
      <Pressable style={styles.primaryButton} onPress={onAllow}>
        <Text style={styles.primaryButtonText}>Allow camera access</Text>
      </Pressable>
      <Pressable onPress={onManual}>
        <Text style={styles.linkText}>Enter pairing code manually instead</Text>
      </Pressable>
    </CenteredMessage>
  );
}

function CameraMode({ pairing }: { pairing: PairingState }) {
  if (!pairing.permission) {
    return <CenteredMessage><ActivityIndicator color={PALETTE.accent} /></CenteredMessage>;
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
        <Text style={styles.errorText} role="alert">{pairing.errorMessage}</Text>
        <Pressable style={styles.primaryButton} onPress={pairing.retryScanning}>
          <Text style={styles.primaryButtonText}>Scan again</Text>
        </Pressable>
        <Pressable onPress={() => pairing.setMode("manual")}>
          <Text style={styles.linkText}>Enter pairing code manually instead</Text>
        </Pressable>
      </CenteredMessage>
    );
  }
  return (
    <>
      <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={pairing.handleBarcodeScanned} />
      <Text style={styles.explainer}>Point your camera at the QR code on your desktop.</Text>
      <Pressable onPress={() => pairing.setMode("manual")}>
        <Text style={styles.linkText}>Enter pairing code manually instead</Text>
      </Pressable>
    </>
  );
}

/**
 * S4 step 4: scan the desktop's pairing QR (or paste its pairing string),
 * store the sync master key in SecureStore, and mark this device joined.
 * Never logs the scanned payload or pairing string — both carry the raw key.
 */
export function PairScreen({ onPairedSuccessfully }: PairScreenProps) {
  const pairing = usePairing(onPairedSuccessfully);
  if (pairing.phase === "success") {
    return (
      <CenteredMessage>
        <Text style={styles.successTitle}>Paired</Text>
        <Text style={styles.explainer}>Your writing will appear here after the first sync.</Text>
      </CenteredMessage>
    );
  }

  if (pairing.mode === "manual") {
    return (
      <View style={styles.screen}>
        {pairing.phase === "error" && (
          <Text style={styles.errorText} role="alert">{pairing.errorMessage}</Text>
        )}
        <ManualEntry
          value={pairing.manualValue}
          onChange={pairing.setManualValue}
          onSubmit={pairing.submitManual}
          onUseCamera={pairing.retryScanning}
          disabled={!pairing.manualValue.trim()}
        />
      </View>
    );
  }
  return <View style={styles.screen}><CameraMode pairing={pairing} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 14, backgroundColor: PALETTE.bg },
  center: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14,
    backgroundColor: PALETTE.bg,
  },
  camera: { flex: 1, borderRadius: 16, overflow: "hidden" },
  explainer: { color: PALETTE.inkMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  successTitle: { color: PALETTE.ink, fontSize: 22, fontWeight: "700" },
  errorText: { color: "#B0402E", fontSize: 14, textAlign: "center" },
  primaryButton: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10,
    backgroundColor: PALETTE.accent, alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: PALETTE.card, fontSize: 14, fontWeight: "600" },
  linkText: { color: PALETTE.accent, fontSize: 13, textAlign: "center", fontWeight: "600" },
  manualWrap: { gap: 12 },
  input: {
    borderWidth: 1, borderColor: PALETTE.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, color: PALETTE.ink,
    fontFamily: "monospace", backgroundColor: PALETTE.card,
  },
});
