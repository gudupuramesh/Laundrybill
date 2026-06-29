/**
 * ESC/POS command builder for Bluetooth thermal printers — no native deps.
 *
 * Builds the raw byte stream for a 50×60mm QR tag: shop name, a QR code rendered
 * by the printer's NATIVE QR engine (GS ( k — crisper + scans better than a
 * downscaled bitmap), the service name, a count/index line, and the order+customer
 * meta line, followed by a configurable feed and an optional cut.
 *
 * The QR payload stays ASCII (`orderId` or `orderId:index`) so the in-app scanner
 * still resolves printed tags.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export interface TagRow {
    shopName: string;
    qrData: string;   // ASCII payload: `orderId` (service tag) or `orderId:index` (item tag)
    service: string;  // service name (headline)
    line2: string;    // count/index line, e.g. "3 items" or "2/5"
    meta: string;     // "#publicId · customer"
}

export interface TagOptions {
    qrModuleSize?: number;  // QR dot size 1..16 (default 8 ≈ a ~30mm QR at 203dpi)
    feedLines?: number;     // blank lines fed after each tag (default 4)
    cut?: boolean;          // cut paper between tags (default false — many BT printers lack a cutter)
}

// Encode a string to printer bytes (default Latin code page). Non-encodable → '?'.
function encodeText(s: string): number[] {
    const out: number[] = [];
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        out.push(c <= 0xff ? c : 0x3f); // '?'
    }
    return out;
}

const init = (): number[] => [ESC, 0x40];                          // ESC @  (reset)
const align = (n: 0 | 1 | 2): number[] => [ESC, 0x61, n];          // ESC a n (0 left, 1 center, 2 right)
const bold = (on: boolean): number[] => [ESC, 0x45, on ? 1 : 0];   // ESC E n
const size = (w: number, h: number): number[] => [GS, 0x21, ((w & 0x0f) << 4) | (h & 0x0f)]; // GS ! n
const feed = (n: number): number[] => [ESC, 0x64, Math.max(0, Math.min(255, n))];            // ESC d n
const cutCmd = (): number[] => [GS, 0x56, 0x00];                   // GS V 0 (full cut)

function textLine(s: string): number[] {
    return [...encodeText(s), LF];
}

// QR code via GS ( k (cn = 49). Sets model 2, module size, EC level M, stores data, prints.
function qr(data: string, moduleSize: number): number[] {
    const bytes = encodeText(data);
    const cmd: number[] = [];
    // fn 65 — select model 2
    cmd.push(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // fn 67 — module size
    cmd.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.max(1, Math.min(16, moduleSize)));
    // fn 69 — error correction level (49 = M)
    cmd.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    // fn 80 — store data (pL pH count cn,fn,m + data = bytes.length + 3)
    const storeLen = bytes.length + 3;
    cmd.push(GS, 0x28, 0x6b, storeLen & 0xff, (storeLen >> 8) & 0xff, 0x31, 0x50, 0x30, ...bytes);
    // fn 81 — print the stored symbol
    cmd.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return cmd;
}

export function buildTagCommands(rows: TagRow[], opts: TagOptions = {}): Uint8Array {
    const moduleSize = opts.qrModuleSize ?? 8;
    const feedLines = opts.feedLines ?? 4;
    const doCut = !!opts.cut;
    const out: number[] = [];

    rows.forEach((row) => {
        out.push(...init());
        out.push(...align(1)); // center everything
        if (row.shopName) out.push(...bold(true), ...textLine(row.shopName), ...bold(false));
        out.push(...qr(row.qrData, moduleSize), LF);
        // service name — bold, double size
        out.push(...bold(true), ...size(1, 1), ...textLine(row.service), ...size(0, 0), ...bold(false));
        if (row.line2) out.push(...bold(true), ...textLine(row.line2), ...bold(false));
        if (row.meta) out.push(...textLine(row.meta));
        out.push(...feed(feedLines));
        if (doCut) out.push(...cutCmd());
        out.push(...align(0)); // reset alignment for safety
    });

    return Uint8Array.from(out);
}

// A single canned tag for the "Test print" button.
export function buildTestTag(shopName: string, opts: TagOptions = {}): Uint8Array {
    return buildTagCommands(
        [{
            shopName: shopName || 'LaundryBill',
            qrData: 'TEST',
            service: 'Test Print',
            line2: '50 x 60 mm',
            meta: 'Printer connected OK',
        }],
        opts,
    );
}
