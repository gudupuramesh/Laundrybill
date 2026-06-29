import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';

const FRAME = 230;

/**
 * Shared QR scanner UI (camera + permission + framing + rescan). Used by both
 * the agent ScanScreen and the plant PlantScanScreen — they differ only in how
 * a scanned code is looked up and where it navigates, so each passes its own
 * `onResult(raw, reset)`. Call `reset()` to re-arm the scanner (e.g. after a
 * "not found" alert); if you navigate away instead, no reset is needed.
 */
export function QrScanner({
  title,
  instruction,
  permissionTitle = 'Scan QR codes',
  permissionBody = 'Laundrybill needs the camera only to scan order QR tags. Scanning just reads the code — no photo or video is taken or stored.',
  onResult,
  onBack,
}: {
  title: string;
  instruction: string;
  permissionTitle?: string;
  permissionBody?: string;
  onResult: (raw: string, reset: () => void) => void;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const lastRef = useRef('');

  const reset = () => {
    setScanned(false);
    lastRef.current = '';
  };

  const handle = (result: BarcodeScanningResult) => {
    if (scanned) return;
    const raw = result.data?.trim();
    if (!raw || raw === lastRef.current) return;
    lastRef.current = raw;
    setScanned(true);
    onResult(raw, reset);
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permWrap}>
        <View style={styles.permIcon}>
          <MaterialIcons name="qr-code-scanner" size={36} color={colors.primary} />
        </View>
        <Text style={styles.permTitle}>{permissionTitle}</Text>
        <Text style={styles.permBody}>{permissionBody}</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handle}
      />
      <View style={styles.overlay}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8, flexDirection: 'row', alignItems: 'center' }]}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={{ paddingRight: 10 }}>
              <MaterialIcons name="chevron-left" size={28} color="#fff" />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.topTitle}>{title}</Text>
        </View>
        <View style={styles.center}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.instruction}>{instruction}</Text>
          {scanned && (
            <TouchableOpacity style={styles.rescan} onPress={reset}>
              <MaterialIcons name="refresh" size={18} color="#fff" />
              <Text style={styles.rescanText}>Scan again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1322' },
  overlay: { ...StyleSheet.absoluteFillObject },
  topBar: { paddingHorizontal: 18, paddingBottom: 8 },
  topTitle: { fontFamily: fonts.bold, fontSize: 17, color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  frame: { width: FRAME, height: FRAME },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: colors.mint },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  instruction: { fontFamily: fonts.semibold, fontSize: 13, color: '#9fb0c9', textAlign: 'center', marginTop: 22 },
  rescan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  rescanText: { fontFamily: fonts.semibold, fontSize: 14, color: '#fff' },
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: colors.background },
  permIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  permTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, textAlign: 'center' },
  permBody: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  permBtn: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, paddingHorizontal: 28, marginTop: 8 },
  permBtnText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
});
