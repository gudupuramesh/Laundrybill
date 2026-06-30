import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii, shadows, spacing } from '../theme';
import { HelpButton } from '../components/HelpButton';

export default function ScanScreen({
  onBack,
  onScanOrder,
}: {
  onBack: () => void;
  onScanOrder: (orderId: string) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const lastScanRef = useRef<string>('');

  const handleBarCodeScanned = (result: BarcodeScanningResult) => {
    if (scanned) return;
    const data = result.data?.trim();
    if (!data || data === lastScanRef.current) return;

    lastScanRef.current = data;
    setScanned(true);

    // QR data formats:
    // 1. Order/Basket QR: just the orderId (Firestore doc ID)
    // 2. Item tag QR: "orderId:itemIndex" (e.g., "abc123:1")
    // 3. Tracking URL: "https://app.laundrybill.com/track/PUBLIC_ID"

    let orderId = '';

    // Check if it's a tracking URL
    const trackMatch = data.match(/\/track\/([^/?#]+)/);
    if (trackMatch) {
      // This is a public ID, not a Firestore doc ID — pass it through
      // The parent can resolve it or we treat it as orderId for now
      orderId = trackMatch[1];
    } else if (data.includes(':')) {
      // Item tag format: "orderId:itemIndex"
      orderId = data.split(':')[0];
    } else {
      // Plain orderId (basket QR)
      orderId = data;
    }

    if (orderId) {
      onScanOrder(orderId);
    } else {
      Alert.alert(t('mobile.invalidQrTitle'), t('mobile.invalidQrMsg'), [
        { text: t('mobile.scanAgainButton'), onPress: () => setScanned(false) },
      ]);
    }
  };

  // Permission not yet determined
  if (!permission) {
    return <View style={styles.container} />;
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.headerInner}>
            <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
              <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('mobile.scanTitleShort')}</Text>
            <HelpButton pageId="mobile_scan" />
          </View>
        </View>
        <View style={styles.permissionContainer}>
          <View style={styles.permIconBg}>
            <MaterialIcons name="qr-code-scanner" size={36} color={colors.primary} />
          </View>
          <Text style={styles.permissionTitle}>{t('mobile.scanPermissionTitle')}</Text>
          <Text style={styles.permissionSubtitle}>
            {t('mobile.scanPermissionBody')}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>{t('mobile.allowCameraAccess')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
            <Text style={styles.secondaryBtnText}>{t('mobile.notNow')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'codabar'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={[styles.header, { paddingTop: insets.top, backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={styles.headerInner}>
            <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: '#fff' }]}>{t('mobile.scanQrCodeTitle')}</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        {/* Scanner frame area */}
        <View style={styles.scanArea}>
          <View style={styles.topOverlay} />
          <View style={styles.middleRow}>
            <View style={styles.sideOverlay} />
            <View style={styles.scanFrame}>
              {/* Corner markers */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.sideOverlay} />
          </View>
          <View style={styles.bottomOverlay}>
            <Text style={styles.instruction}>
              {t('mobile.scanPointCamera')}
            </Text>
            {scanned && (
              <TouchableOpacity style={styles.rescanBtn} onPress={() => { setScanned(false); lastScanRef.current = ''; }}>
                <MaterialIcons name="refresh" size={20} color="#fff" />
                <Text style={styles.rescanText}>{t('mobile.scanAgainButton')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const FRAME_SIZE = 250;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { zIndex: 10 },
  headerInner: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 8, gap: 8 },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: fonts.bold, color: colors.primary },
  iconBtn: { padding: 8 },

  // Permission screen
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 14, backgroundColor: colors.background },
  permIconBg: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  permissionTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  permissionSubtitle: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  primaryBtn: { width: '100%', paddingVertical: 14, borderRadius: radii.button, backgroundColor: colors.primary, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.surface },
  secondaryBtn: { paddingVertical: 10 },
  secondaryBtnText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textMuted },

  // Overlay
  overlay: { ...StyleSheet.absoluteFillObject },
  scanArea: { flex: 1 },
  topOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  middleRow: { flexDirection: 'row' },
  sideOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  scanFrame: {
    width: FRAME_SIZE, height: FRAME_SIZE,
    borderWidth: 0,
  },
  bottomOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', paddingTop: 24, gap: 16,
  },
  instruction: { fontSize: 14, fontFamily: fonts.medium, color: '#fff', textAlign: 'center', paddingHorizontal: 32 },

  // Corner markers
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#fff' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },

  // Rescan
  rescanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  rescanText: { fontSize: 14, fontFamily: fonts.semibold, color: '#fff' },
});
