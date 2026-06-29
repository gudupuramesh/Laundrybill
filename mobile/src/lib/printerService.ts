/**
 * Bluetooth (BLE) thermal-printer transport for Laundrybill.
 *
 * Uses react-native-ble-plx (BLE works on Android AND iOS; iOS Classic Bluetooth
 * is MFi-only, so BLE is the portable path for market printers). Handles runtime
 * permissions, scanning, connecting (auto-finds a writable characteristic),
 * chunked writes (BLE MTU), persistence of the default printer (AsyncStorage),
 * and high-level printTags/testPrint built on escpos.ts.
 *
 * Requires the react-native-ble-plx native module → a dev-client rebuild.
 */

import { BleManager, Device, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { buildTagCommands, buildTestTag, type TagRow, type TagOptions } from './escpos';

const STORAGE_KEY = 'printer_default';

export interface SavedPrinter {
    id: string;
    name: string | null;
    serviceUUID?: string;
    charUUID?: string;
    // calibration
    feedLines?: number;
    qrModuleSize?: number;
    cut?: boolean;
}

export interface ScanResult {
    id: string;
    name: string | null;
    rssi: number | null;
}

// Writable-service UUID fragments commonly seen on cheap BT thermal printers.
const KNOWN_SERVICE_HINTS = ['ffe0', '18f0', 'ff00', 'ae30', '49535343', '6e400001'];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

class PrinterService {
    private manager = new BleManager();
    private device: Device | null = null;
    private serviceUUID?: string;
    private charUUID?: string;
    private scanning = false;

    // ── permissions + adapter ─────────────────────────────────────
    async requestAndroidPermissions(): Promise<boolean> {
        if (Platform.OS !== 'android') return true;
        const api = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
        try {
            if (api >= 31) {
                const res = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                ]);
                return (
                    res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === 'granted' &&
                    res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === 'granted'
                );
            }
            const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
            return res === PermissionsAndroid.RESULTS.GRANTED;
        } catch {
            return false;
        }
    }

    async ensureReady(): Promise<void> {
        const ok = await this.requestAndroidPermissions();
        if (!ok) throw new Error('Bluetooth permission denied. Enable it in Settings to use a printer.');
        const state = await this.manager.state();
        if (state === State.PoweredOn) return;
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => { sub.remove(); reject(new Error('Bluetooth is off. Turn it on and try again.')); }, 8000);
            const sub = this.manager.onStateChange((s) => {
                if (s === State.PoweredOn) { clearTimeout(timer); sub.remove(); resolve(); }
            }, true);
        });
    }

    // ── scan ──────────────────────────────────────────────────────
    scan(onDevice: (d: ScanResult) => void, onError?: (e: Error) => void): () => void {
        this.scanning = true;
        const seen = new Set<string>();
        this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
            if (error) { this.scanning = false; onError?.(new Error(error.message)); return; }
            if (!device || seen.has(device.id)) return;
            seen.add(device.id);
            onDevice({ id: device.id, name: device.name ?? device.localName ?? null, rssi: device.rssi ?? null });
        });
        return () => this.stopScan();
    }

    stopScan(): void {
        if (this.scanning) { this.manager.stopDeviceScan(); this.scanning = false; }
    }

    // ── connect ───────────────────────────────────────────────────
    async connect(deviceId: string): Promise<SavedPrinter> {
        this.stopScan();
        let dev = await this.manager.connectToDevice(deviceId, { timeout: 12000 });
        dev = await dev.discoverAllServicesAndCharacteristics();
        try { await dev.requestMTU(247); } catch { /* not all devices support MTU negotiation */ }

        // Find a writable characteristic; prefer a known printer service UUID.
        const services = await dev.services();
        let best: { svc: string; char: string } | null = null;
        let known: { svc: string; char: string } | null = null;
        for (const svc of services) {
            const chars = await svc.characteristics();
            for (const ch of chars) {
                if (ch.isWritableWithoutResponse || ch.isWritableWithResponse) {
                    const cand = { svc: svc.uuid, char: ch.uuid };
                    if (!best) best = cand;
                    const u = svc.uuid.toLowerCase();
                    if (!known && KNOWN_SERVICE_HINTS.some((h) => u.includes(h))) known = cand;
                }
            }
        }
        const pick = known || best;
        if (!pick) {
            await dev.cancelConnection().catch(() => {});
            throw new Error('No printable characteristic found. Is this a thermal printer?');
        }

        this.device = dev;
        this.serviceUUID = pick.svc;
        this.charUUID = pick.char;
        return { id: dev.id, name: dev.name ?? dev.localName ?? null, serviceUUID: pick.svc, charUUID: pick.char };
    }

    isConnected(): boolean { return !!this.device; }

    async disconnect(): Promise<void> {
        this.stopScan();
        if (this.device) { await this.device.cancelConnection().catch(() => {}); this.device = null; }
        this.serviceUUID = undefined;
        this.charUUID = undefined;
    }

    // ── chunked write ─────────────────────────────────────────────
    async write(bytes: Uint8Array): Promise<void> {
        if (!this.device || !this.serviceUUID || !this.charUUID) throw new Error('Printer not connected.');
        const CHUNK = 180; // safely under a negotiated 247-byte MTU
        for (let i = 0; i < bytes.length; i += CHUNK) {
            const slice = bytes.subarray(i, i + CHUNK);
            const b64 = Buffer.from(slice).toString('base64');
            try {
                await this.device.writeCharacteristicWithoutResponseForService(this.serviceUUID, this.charUUID, b64);
            } catch {
                // some printers only accept write-with-response
                await this.device.writeCharacteristicWithResponseForService(this.serviceUUID, this.charUUID, b64);
            }
            await sleep(20); // many BT printers need a small gap between packets
        }
    }

    // ── persistence (mirrors src/lib/i18n.ts pattern) ─────────────
    async saveDefault(p: SavedPrinter): Promise<void> {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    }
    async getDefault(): Promise<SavedPrinter | null> {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        return json ? (JSON.parse(json) as SavedPrinter) : null;
    }
    async clearDefault(): Promise<void> {
        await AsyncStorage.removeItem(STORAGE_KEY);
        await this.disconnect();
    }

    // ── high-level convenience ────────────────────────────────────
    async connectToSaved(): Promise<SavedPrinter> {
        const def = await this.getDefault();
        if (!def) throw new Error('No printer set. Open Printer Settings to connect one.');
        await this.ensureReady();
        const saved = await this.connect(def.id);
        return { ...saved, feedLines: def.feedLines, qrModuleSize: def.qrModuleSize, cut: def.cut };
    }

    async printTags(rows: TagRow[], opts?: TagOptions): Promise<void> {
        if (!this.device) await this.connectToSaved();
        await this.write(buildTagCommands(rows, opts));
    }

    async testPrint(shopName: string, opts?: TagOptions): Promise<void> {
        if (!this.device) await this.connectToSaved();
        await this.write(buildTestTag(shopName, opts));
    }

    /** Free native resources (call if you ever tear the service down). */
    destroy(): void {
        try { this.manager.destroy(); } catch { /* ignore */ }
    }
}

export const printerService = new PrinterService();
