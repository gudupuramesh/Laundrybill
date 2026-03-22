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
