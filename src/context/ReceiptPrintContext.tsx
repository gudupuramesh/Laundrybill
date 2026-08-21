/**
 * Receipt print context for Android native print.
 * Renders OrderReceipt into #receipt-print-root and calls window.print()
 * so the Android app (which overrides window.print) can open the native print dialog.
 */

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { OrderReceipt } from "@/features/orders/OrderReceipt";
import type { Order } from "@/types/order";

export interface ReceiptShopInfo {
    name: string;
    address?: string;
    phone?: string;
    /** Tax registration number (GSTIN/TRN) — printed in the receipt header. */
    gstNumber?: string;
    /** ISO country code — picks the tax-reg label + UAE "TAX INVOICE" title. */
    countryCode?: string;
    /** Owner-configured Terms & Conditions printed at the bottom of the receipt. */
    receiptTerms?: string;
    /** false hides the tracking QR + link (shop settings.trackingEnabled). */
    showTracking?: boolean;
    /** Shop logo URL — printed centered at the top of the receipt. */
    logoUrl?: string;
    /** UPI ID — printed as a scan-to-pay QR when a balance is due. */
    upiId?: string;
    /** Payment page URL — the pay-QR fallback when no UPI ID is set. */
    paymentLink?: string;
    /** false hides the scan-to-pay QR (shop settings.receiptPaymentQr). */
    showPaymentQr?: boolean;
}

interface ReceiptPrintState {
    order: Order;
    shopInfo: ReceiptShopInfo;
}

interface ReceiptPrintContextValue {
    triggerReceiptPrint: (order: Order, shopInfo: ReceiptShopInfo) => void;
}

const ReceiptPrintContext = createContext<ReceiptPrintContextValue | null>(null);

const RECEIPT_PRINT_BODY_CLASS = "receipt-print";

export function ReceiptPrintProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<ReceiptPrintState | null>(null);

    const triggerReceiptPrint = useCallback((order: Order, shopInfo: ReceiptShopInfo) => {
        setState({ order, shopInfo });
    }, []);

    useEffect(() => {
        if (!state) return;

        const cleanup = () => {
            document.body.classList.remove(RECEIPT_PRINT_BODY_CLASS);
            setState(null);
        };

        const onAfterPrint = () => {
            cleanup();
            window.removeEventListener("afterprint", onAfterPrint);
        };

        window.addEventListener("afterprint", onAfterPrint);

        // Next tick so OrderReceipt is in the DOM before we print
        const raf = requestAnimationFrame(() => {
            document.body.classList.add(RECEIPT_PRINT_BODY_CLASS);
            window.print();
        });

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("afterprint", onAfterPrint);
        };
    }, [state]);

    const printRoot =
        typeof document !== "undefined" &&
        document.body &&
        createPortal(
            <div id="receipt-print-root" className="receipt-print-root" aria-hidden="true">
                {state && (
                    <OrderReceipt
                        order={state.order}
                        shopName={state.shopInfo.name}
                        shopAddress={state.shopInfo.address ?? ""}
                        shopPhone={state.shopInfo.phone ?? ""}
                        gstNumber={state.shopInfo.gstNumber}
                        countryCode={state.shopInfo.countryCode}
                        receiptTerms={state.shopInfo.receiptTerms}
                        showTracking={state.shopInfo.showTracking}
                        logoUrl={state.shopInfo.logoUrl}
                        upiId={state.shopInfo.upiId}
                        paymentLink={state.shopInfo.paymentLink}
                        showPaymentQr={state.shopInfo.showPaymentQr}
                    />
                )}
            </div>,
            document.body
        );

    return (
        <ReceiptPrintContext.Provider value={{ triggerReceiptPrint }}>
            {children}
            {printRoot}
        </ReceiptPrintContext.Provider>
    );
}

export function useReceiptPrint(): ReceiptPrintContextValue {
    const ctx = useContext(ReceiptPrintContext);
    if (!ctx) {
        throw new Error("useReceiptPrint must be used within ReceiptPrintProvider");
    }
    return ctx;
}
