/**
 * Scan-to-pay QR for receipts.
 *
 * When an order still has a balance due, the printed bill carries a QR the
 * customer can scan to pay: a upi://pay deep link built from the shop's UPI ID
 * (bankDetails.upiId), or the shop's payment link when no UPI ID is set.
 * settings.receiptPaymentQr === false turns the QR off everywhere.
 */

export interface PaymentQrSource {
    shopName?: string;
    /** bankDetails.upiId — preferred; encodes a upi://pay intent with the amount. */
    upiId?: string;
    /** bankDetails.paymentLink — fallback target when no UPI ID is set. */
    paymentLink?: string;
    /** false hides the scan-to-pay QR (shop settings.receiptPaymentQr). */
    showPaymentQr?: boolean;
}

/** The string the QR encodes, or null when no payment QR should print. */
export function buildPaymentQrTarget(src: PaymentQrSource, balance: number, orderRef: string): string | null {
    if (src.showPaymentQr === false) return null;
    if (!balance || balance <= 0) return null; // nothing due — no point printing a pay QR
    const upi = (src.upiId || "").trim();
    if (upi) {
        // UPI deep link (NPCI spec). cu is always INR — UPI is an India-only rail.
        return `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(src.shopName || "Shop")}` +
            `&am=${balance.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${orderRef}`)}`;
    }
    const link = (src.paymentLink || "").trim();
    return link || null;
}
