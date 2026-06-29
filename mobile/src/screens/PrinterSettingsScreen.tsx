import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Switch, Alert, Linking, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { colors, fonts, spacing, radii, shadows } from '../theme';
import { printerService, type ScanResult, type SavedPrinter } from '../lib/printerService';

/**
 * Bluetooth printer settings: scan, connect, calibrate (feed/QR size/cut), test print.
 * Uses printerService (BLE) which needs the react-native-ble-plx native module (dev-client rebuild).
 */
export default function PrinterSettingsScreen({ onBack }: { onBack: () => void }) {
    const [saved, setSaved] = useState<SavedPrinter | null>(null);
    const [scanning, setScanning] = useState(false);
    const [devices, setDevices] = useState<ScanResult[]>([]);
    const [connectingId, setConnectingId] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);
    const [feedLines, setFeedLines] = useState(4);
    const [qrSize, setQrSize] = useState(8);
    const [cut, setCut] = useState(false);
    const stopRef = useRef<null | (() => void)>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        printerService.getDefault().then((d) => {
            if (d) { setSaved(d); setFeedLines(d.feedLines ?? 4); setQrSize(d.qrModuleSize ?? 8); setCut(!!d.cut); }
        });
        return () => { stopRef.current?.(); if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    const stopScan = () => {
        stopRef.current?.();
        stopRef.current = null;
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setScanning(false);
    };

    const startScan = async () => {
        setDevices([]);
        try {
            await printerService.ensureReady();
        } catch (e: any) {
            Alert.alert('Bluetooth', e?.message || 'Bluetooth is not available.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open settings', onPress: () => Linking.openSettings() },
            ]);
            return;
        }
        setScanning(true);
        stopRef.current = printerService.scan(
            (d) => setDevices((prev) => (prev.some((x) => x.id === d.id) ? prev : [...prev, d].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999)))),
            (err) => { setScanning(false); Alert.alert('Scan error', err.message); },
        );
        timerRef.current = setTimeout(stopScan, 15000);
    };

    const connect = async (d: ScanResult) => {
        stopScan();
        setConnectingId(d.id);
        try {
            const result = await printerService.connect(d.id);
            const withCal: SavedPrinter = { ...result, feedLines, qrModuleSize: qrSize, cut };
            await printerService.saveDefault(withCal);
            setSaved(withCal);
            Alert.alert('Connected', `${result.name || 'Printer'} is now your default printer.`);
        } catch (e: any) {
            Alert.alert('Connection failed', e?.message || 'Could not connect to the printer.');
        } finally {
            setConnectingId(null);
        }
    };

    const forget = async () => {
        await printerService.clearDefault();
        setSaved(null);
    };

    const persist = async (next: Partial<SavedPrinter>) => {
        if (!saved) return;
        const merged: SavedPrinter = { ...saved, feedLines, qrModuleSize: qrSize, cut, ...next };
        setSaved(merged);
        await printerService.saveDefault(merged);
    };

    const testPrint = async () => {
        setTesting(true);
        try {
            await printerService.testPrint('Laundrybill', { feedLines, qrModuleSize: qrSize, cut });
            Alert.alert('Sent', 'A test tag was sent to the printer.');
        } catch (e: any) {
            Alert.alert('Print failed', e?.message || 'Could not print. Check the printer is on and connected.');
        } finally {
            setTesting(false);
        }
    };

    const Stepper = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) => (
        <View style={styles.stepRow}>
            <Text style={styles.stepLabel}>{label}</Text>
            <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - 1))}>
                    <MaterialIcons name="remove" size={18} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.stepValue}>{value}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.min(max, value + 1))}>
                    <MaterialIcons name="add" size={18} color={colors.primary} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <ScreenHeader title="Bluetooth Printer" onBack={onBack} />
            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Current printer */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Default printer</Text>
                    {saved ? (
                        <View style={styles.savedRow}>
                            <View style={styles.savedIcon}><MaterialIcons name="print" size={20} color={colors.primary} /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.savedName}>{saved.name || 'Printer'}</Text>
                                <Text style={styles.savedId}>{saved.id}</Text>
                            </View>
                            <TouchableOpacity onPress={forget} style={styles.forgetBtn}>
                                <Text style={styles.forgetText}>Forget</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <Text style={styles.muted}>No printer connected yet. Scan and tap one below.</Text>
                    )}
                </View>

                {/* Scan */}
                <View style={styles.card}>
                    <View style={styles.scanHeader}>
                        <Text style={styles.cardTitle}>Available printers</Text>
                        <TouchableOpacity style={styles.scanBtn} onPress={scanning ? stopScan : startScan}>
                            <MaterialIcons name={scanning ? 'stop' : 'bluetooth-searching'} size={16} color="#fff" />
                            <Text style={styles.scanBtnText}>{scanning ? 'Stop' : 'Scan'}</Text>
                        </TouchableOpacity>
                    </View>
                    {scanning && (
                        <View style={styles.scanningRow}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.muted}>  Scanning…</Text>
                        </View>
                    )}
                    {devices.length === 0 && !scanning && <Text style={styles.muted}>Tap Scan to find nearby Bluetooth printers.</Text>}
                    {devices.map((d) => {
                        const isSaved = saved?.id === d.id;
                        return (
                            <TouchableOpacity key={d.id} style={styles.deviceRow} onPress={() => connect(d)} disabled={!!connectingId}>
                                <MaterialIcons name="print" size={18} color={isSaved ? colors.primary : colors.textMuted} />
                                <View style={{ flex: 1, marginLeft: spacing.md }}>
                                    <Text style={styles.deviceName}>{d.name || 'Unknown device'}</Text>
                                    <Text style={styles.deviceId}>{d.id}{d.rssi != null ? `  ·  ${d.rssi} dBm` : ''}</Text>
                                </View>
                                {connectingId === d.id ? <ActivityIndicator size="small" color={colors.primary} />
                                    : isSaved ? <MaterialIcons name="check-circle" size={20} color={colors.success} />
                                        : <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Calibration */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Tag calibration</Text>
                    <Stepper label="Feed after tag (lines)" value={feedLines} min={0} max={20} onChange={(v) => { setFeedLines(v); persist({ feedLines: v }); }} />
                    <View style={styles.divider} />
                    <Stepper label="QR size (1–16)" value={qrSize} min={1} max={16} onChange={(v) => { setQrSize(v); persist({ qrModuleSize: v }); }} />
                    <View style={styles.divider} />
                    <View style={styles.stepRow}>
                        <Text style={styles.stepLabel}>Cut paper between tags</Text>
                        <Switch value={cut} onValueChange={(v) => { setCut(v); persist({ cut: v }); }} trackColor={{ true: colors.primary }} />
                    </View>
                    <Text style={styles.hint}>Increase feed until each tag is ~60 mm. Most cheap Bluetooth printers have no cutter — leave “Cut” off if nothing happens.</Text>
                </View>

                {/* Test */}
                <TouchableOpacity style={[styles.testBtn, (!saved || testing) && styles.testBtnDisabled]} onPress={testPrint} disabled={!saved || testing}>
                    {testing ? <ActivityIndicator color="#fff" /> : <><MaterialIcons name="print" size={18} color="#fff" /><Text style={styles.testBtnText}>  Test print</Text></>}
                </TouchableOpacity>

                <Text style={styles.footnote}>iOS only works with BLE (Bluetooth 4.0+) printers. Exact 50×60 mm labels need a label printer; on a receipt printer the size is approximate — tune the feed above.</Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
    card: { backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.card, ...shadows.cardBorder },
    cardTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, marginBottom: spacing.md },
    muted: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
    // saved
    savedRow: { flexDirection: 'row', alignItems: 'center' },
    savedIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
    savedName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
    savedId: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    forgetBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.button, backgroundColor: colors.errorBg },
    forgetText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.error },
    // scan
    scanHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.button },
    scanBtnText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
    scanningRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    deviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
    deviceName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
    deviceId: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    // calibration
    stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
    stepLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    stepBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
    stepValue: { minWidth: 28, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: colors.text },
    divider: { height: 1, backgroundColor: colors.divider },
    hint: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textMuted, marginTop: spacing.md, lineHeight: 16 },
    // test
    testBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: spacing.lg, marginBottom: spacing.lg },
    testBtnDisabled: { opacity: 0.5 },
    testBtnText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
    footnote: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textMuted, lineHeight: 16, textAlign: 'center' },
});
