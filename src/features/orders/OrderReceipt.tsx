/**
 * Order Receipt Component
 *
 * Printable receipt with QR code for order tracking.
 * Items grouped by service type (Wash & Iron, Ironing, etc.).
 */

import type { Order } from "@/types/order";
import { getTrackingUrl, getQRCodeUrl } from "@/lib/qr-code";
import { QRCodeSVG } from "qrcode.react";
import { buildPaymentQrTarget } from "@/lib/payment-qr";
import { groupOrderItemsByCategory } from "@/lib/order-item-groups";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/use-currency";
import { getTaxIdLabel } from "@/config/countries";

interface OrderReceiptProps {
    order: Order;
    shopName: string;
    shopAddress: string;
    shopPhone: string;
    /** Tax registration number (GSTIN/TRN) — printed in the header when set. */
    gstNumber?: string;
    /** ISO country code — picks the tax-reg label + UAE "TAX INVOICE" title. */
    countryCode?: string;
    /** Owner-configured Terms & Conditions printed at the bottom of the receipt. */
    receiptTerms?: string;
    /** false hides the tracking QR + "Track online" line (shop settings.trackingEnabled). */
    showTracking?: boolean;
    /** Shop logo URL — printed centered above the shop name. */
    logoUrl?: string;
    /** UPI ID — printed as a scan-to-pay QR when a balance is due. */
    upiId?: string;
    /** Payment page URL — the pay-QR fallback when no UPI ID is set. */
    paymentLink?: string;
    /** false hides the scan-to-pay QR (shop settings.receiptPaymentQr). */
    showPaymentQr?: boolean;
}

export function OrderReceipt({ order, shopName, shopAddress, shopPhone, gstNumber, countryCode, receiptTerms, showTracking = true, logoUrl, upiId, paymentLink, showPaymentQr }: OrderReceiptProps) {
    const { formatAmount } = useCurrency();
    const qrUrl = getQRCodeUrl(order.trackingId || order.id, 150);
    // Scan-to-pay QR takes the QR slot when a balance is due (tracking stays as the link line).
    const payTarget = buildPaymentQrTarget({ shopName, upiId, paymentLink, showPaymentQr }, order.financials?.balance || 0, order.publicId);

    // UAE FTA: a VAT-registered shop's invoice must be titled "Tax Invoice".
    const isTaxInvoice = (countryCode || "").toUpperCase() === "AE" && !!gstNumber;
    const fin = order.financials;
    // Zero-charged compliance line on a TAX INVOICE is always "VAT (0%)" — the stored
    // tax name (e.g. GST from before a country switch) only applies when tax was charged.
    const hasTax = (fin.taxAmount || 0) > 0;
    const taxLabel = `${hasTax ? (fin.taxName || (isTaxInvoice ? "VAT" : "Tax")) : "VAT"}${fin.taxRate ? ` (${fin.taxRate}%)` : isTaxInvoice ? " (0%)" : ""}`;

    return (
        <div className="bg-white p-6 max-w-[300px] font-mono text-sm text-black" id="receipt">
            {/* Header */}
            <div className="text-center mb-4">
                {logoUrl && (
                    <img src={logoUrl} alt="" className="mx-auto mb-2 max-h-16 max-w-[140px] object-contain" />
                )}
                <h1 className="font-bold text-lg">{shopName}</h1>
                <p className="text-xs text-gray-600">{shopAddress}</p>
                <p className="text-xs text-gray-600">Tel: {shopPhone}</p>
                {gstNumber && (
                    <p className="text-xs text-gray-600">{getTaxIdLabel(countryCode)}: {gstNumber}</p>
                )}
                {isTaxInvoice && (
                    <p className="font-bold tracking-widest mt-1">TAX INVOICE</p>
                )}
            </div>

            <div className="border-t border-dashed border-gray-400 my-3" />

            {/* Order Info */}
            <div className="mb-3">
                <div className="flex justify-between">
                    <span>Order #:</span>
                    <span className="font-bold">{order.publicId}</span>
                </div>
                <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{format(order.createdAt.toDate(), "dd/MM/yyyy HH:mm")}</span>
                </div>
                <div className="flex justify-between">
                    <span>Customer:</span>
                    <span>{order.customerName}</span>
                </div>
                <div className="flex justify-between">
                    <span>Phone:</span>
                    <span>{order.customerPhone}</span>
                </div>
            </div>

            <div className="border-t border-dashed border-gray-400 my-3" />

            {/* Items – grouped by service type */}
            <div className="mb-3">
                {groupOrderItemsByCategory(order.items, (i) => i.categoryName || "").map(({ categoryName, items: groupItems }) => (
                    <div key={categoryName}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2 mb-1">
                            {categoryName === "Others" ? "Other" : categoryName}
                        </p>
                        {groupItems.map((item, index) => (
                            <div key={index} className="flex justify-between mb-1">
                                <span>
                                    {item.serviceName} x{item.quantity}{item.pieceCount ? ` (${item.pieceCount} pcs)` : ""}
                                </span>
                                <span>{formatAmount(item.total)}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="border-t border-dashed border-gray-400 my-3" />

            {/* Totals */}
            <div className="mb-3">
                <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatAmount(order.financials.subtotal)}</span>
                </div>
                {order.financials.discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                        <span>Discount:</span>
                        <span>-{formatAmount(order.financials.discountAmount)}</span>
                    </div>
                )}
                {(order.financials.expressCharge || 0) > 0 && (
                    <div className="flex justify-between">
                        <span>Express:</span>
                        <span>{formatAmount(order.financials.expressCharge)}</span>
                    </div>
                )}
                {order.financials.deliveryCharge > 0 && (
                    <div className="flex justify-between">
                        <span>Delivery:</span>
                        <span>{formatAmount(order.financials.deliveryCharge)}</span>
                    </div>
                )}
                {((order.financials.taxAmount || 0) > 0 || isTaxInvoice) && (
                    <div className="flex justify-between">
                        <span>{taxLabel}:</span>
                        <span>{formatAmount(order.financials.taxAmount || 0)}</span>
                    </div>
                )}
                <div className="flex justify-between font-bold text-base mt-1">
                    <span>TOTAL:</span>
                    <span>{formatAmount(order.financials.total)}</span>
                </div>
            </div>

            <div className="border-t border-dashed border-gray-400 my-3" />

            {/* Payment */}
            <div className="mb-3">
                <div className="flex justify-between">
                    <span>Paid:</span>
                    <span>{formatAmount(order.financials.amountPaid)}</span>
                </div>
                {order.financials.balance > 0 && (
                    <div className="flex justify-between font-bold text-red-600">
                        <span>Balance Due:</span>
                        <span>{formatAmount(order.financials.balance)}</span>
                    </div>
                )}
            </div>

            <div className="border-t border-dashed border-gray-400 my-3" />

            {/* Expected Delivery */}
            <div className="text-center mb-3">
                <p className="text-xs text-gray-600">Expected Ready By:</p>
                <p className="font-bold">
                    {format(order.expectedDelivery.toDate(), "EEE, MMM d, yyyy")}
                </p>
            </div>

            {/* Scan-to-pay QR when a balance is due; else the tracking QR (if enabled) */}
            {payTarget ? (
                <div className="text-center mb-3">
                    <p className="text-xs font-bold mb-1">SCAN TO PAY</p>
                    <QRCodeSVG value={payTarget} size={110} className="mx-auto" />
                    <p className="text-xs font-bold mt-1">Pay balance: {formatAmount(order.financials.balance)}</p>
                    {(upiId || "").trim() && <p className="text-[10px] text-gray-600">UPI: {(upiId || "").trim()}</p>}
                </div>
            ) : showTracking && (
                <div className="text-center mb-3">
                    <img src={qrUrl} alt="Track Order QR" className="mx-auto" />
                    <p className="text-xs text-gray-600 mt-1">Scan to track your order</p>
                </div>
            )}

            <div className="border-t border-dashed border-gray-400 my-3" />

            {/* Terms & Conditions (owner-configured) */}
            {receiptTerms && receiptTerms.trim() && (
                <>
                    <div className="mb-3">
                        <p className="text-[10px] font-bold text-gray-700 uppercase tracking-wide mb-1">Terms &amp; Conditions</p>
                        <p className="text-[10px] text-gray-600 whitespace-pre-line leading-snug">{receiptTerms.trim()}</p>
                    </div>
                    <div className="border-t border-dashed border-gray-400 my-3" />
                </>
            )}

            {/* Footer */}
            <div className="text-center text-xs text-gray-600">
                <p>Thank you for choosing {shopName}!</p>
                {showTracking && (
                    <p className="mt-1">
                        Track online: {getTrackingUrl(order.trackingId || order.id).replace("https://", "")}
                    </p>
                )}
            </div>
        </div>
    );
}

// Print function
export function printReceipt() {
    const receipt = document.getElementById("receipt");
    if (!receipt) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Receipt</title>
                <style>
                    body { 
                        font-family: 'Courier New', monospace; 
                        font-size: 12px;
                        margin: 0;
                        padding: 10px;
                        color: black;
                    }
                    @media print {
                        body { 
                            width: 80mm; 
                            height: auto; 
                            overflow: visible; 
                        }
                        div {
                            page-break-inside: auto;
                        }
                    }
                </style>
            </head>
            <body>
                ${receipt.innerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}
