import { CameraView, useCameraPermissions } from "expo-camera";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";

import { decodeMasterKey, parsePairPayload } from "../../shared/keys";
import { setSyncMasterKey } from "../../sync/mobileKeyStorage";
import { markDeviceJoined } from "../../sync/mobileSyncRole";
import { PALETTE } from "../../theme/palette";

// Duplicated literal, not shared: the same production relay default as
// src/sync/engineDefaults.ts's `DEFAULT_RELAY_URL`, but that module pulls in
// Tauri-only SQLite classes — forbidden on mobile (S4 blueprint portable-
// boundary rule). Manual pairing-string entry has no QR `relay` param to
// read, so it falls back to this constant, matching desktop's own default.
const FALLBACK_RELAY_URL = "wss://sync.writersnook.app";

const SCAN_ERROR = "That code doesn't look like a WritersNook pairing code. Try scanning again.";
const MANUAL_ERROR = "That pairing string doesn't look right. Check it and try again.";

type Mode = "camera" | "manual";
type Phase = "idle" | "success" | "error";

interface PairScreenProps {
  /**
   * TODO(S5): start the mobile SyncEngine here once mobile/src/sync/mobileEngine.ts
   * exists (S4 blueprint step 5 — "Scene read plus sync-down"). Called once,
   * after the key is in SecureStore and sync_role='joined' is in app_meta,
   * with the relay URL the pairing code carried (QR) or the fallback
   * default (manual entry).
   */
  onPairedSuccessfully?: (relayUrl: string) => void;
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

/**
 * S4 step 4: scan the desktop's pairing QR (or paste its pairing string),
 * store the sync master key in SecureStore, and mark this device joined.
 * Never logs the scanned payload or pairing string — both carry the raw key.
 */
export function PairScreen({ onPairedSuccessfully }: PairScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>("camera");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState(SCAN_ERROR);
  const [manualValue, setManualValue] = useState("");
  const scannedRef = useRef(false);

  const finishPairing = useCallback(async (masterKey: Uint8Array, relayUrl: string) => {
    await setSyncMasterKey(masterKey);
    await markDeviceJoined();
    setPhase("success");
    onPairedSuccessfully?.(relayUrl);
  }, [onPairedSuccessfully]);

  const handleBarcodeScanned = useCallback((result: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    try {
      const { masterKey, relayUrl } = parsePairPayload(result.data);
      void finishPairing(masterKey, relayUrl);
    } catch {
      setErrorMessage(SCAN_ERROR);
      setPhase("error");
      scannedRef.current = false;
    }
  }, [finishPairing]);

  const submitManual = useCallback(() => {
    try {
      const masterKey = decodeMasterKey(manualValue.trim());
      void finishPairing(masterKey, FALLBACK_RELAY_URL);
    } catch {
      setErrorMessage(MANUAL_ERROR);
      setPhase("error");
    }
  }, [manualValue, finishPairing]);

  const retryScanning = useCallback(() => {
    setPhase("idle");
    setMode("camera");
  }, []);

  if (phase === "success") {
    return (
      <CenteredMessage>
        <Text style={styles.successTitle}>Paired</Text>
        <Text style={styles.explainer}>Your writing will appear here after the first sync.</Text>
      </CenteredMessage>
    );
  }

  if (mode === "manual") {
    return (
      <View style={styles.screen}>
        {phase === "error" && <Text style={styles.errorText} role="alert">{errorMessage}</Text>}
        <ManualEntry
          value={manualValue}
          onChange={setManualValue}
          onSubmit={submitManual}
          onUseCamera={retryScanning}
          disabled={!manualValue.trim()}
        />
      </View>
    );
  }

  if (!permission) return <CenteredMessage><ActivityIndicator color={PALETTE.accent} /></CenteredMessage>;

  if (!permission.granted) {
    return (
      <CenteredMessage>
        <Text style={styles.explainer}>
          WritersNook needs camera access to scan your desktop&apos;s pairing code.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => { void requestPermission(); }}>
          <Text style={styles.primaryButtonText}>Allow camera access</Text>
        </Pressable>
        <Pressable onPress={() => setMode("manual")}>
          <Text style={styles.linkText}>Enter pairing code manually instead</Text>
        </Pressable>
      </CenteredMessage>
    );
  }

  return (
    <View style={styles.screen}>
      {phase === "error"
        ? (
          <CenteredMessage>
            <Text style={styles.errorText} role="alert">{errorMessage}</Text>
            <Pressable style={styles.primaryButton} onPress={retryScanning}>
              <Text style={styles.primaryButtonText}>Scan again</Text>
            </Pressable>
            <Pressable onPress={() => setMode("manual")}>
              <Text style={styles.linkText}>Enter pairing code manually instead</Text>
            </Pressable>
          </CenteredMessage>
        )
        : (
          <>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            <Text style={styles.explainer}>Point your camera at the QR code on your desktop.</Text>
            <Pressable onPress={() => setMode("manual")}>
              <Text style={styles.linkText}>Enter pairing code manually instead</Text>
            </Pressable>
          </>
        )}
    </View>
  );
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
