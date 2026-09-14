/**
 * Row actions shared by the dashboard's recent-orders table and the orders list:
 * print the A4 bill and send it on WhatsApp. Both need the full order document,
 * which the list rows don't carry, so each fetches on demand.
 */

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { useShop } from "@/hooks/use-shop";
import { useCurrency } from "@/hooks/use-currency";
import { openWhatsAppTextOnly } from "@/lib/whatsappShare";
import type { Order } from "@/types/order";
import type { Shop } from "@/types/shop";

export function buildReceiptShopInfo(shop: Shop, currencySymbol: string) {
    const location = shop.location;
    return {
        name: shop.name || "LaundryBill",
        phone: shop.phone,
        address: location?.address ? `${location.address}, ${location.city || ""} ${location.pincode || ""}` : undefined,
        gstNumber: shop.gstNumber,
        countryCode: shop.settings?.countryCode,
        currencySymbol,
        currencyCode: shop.settings?.currency,
        receiptTerms: shop.settings?.receiptTerms,
        showTracking: shop.settings?.trackingEnabled !== false,
        logoUrl: shop.settings?.receiptShowLogo === false ? undefined : shop.logo,
        upiId: shop.bankDetails?.upiId,
        paymentLink: shop.bankDetails?.paymentLink,
        showPaymentQr: shop.settings?.receiptPaymentQr !== false,
    };
}

export function useOrderRowActions() {
    const { shopId } = useAuth();
    const { shop } = useShop();
    const { currencySymbol } = useCurrency();

    const loadOrder = async (id: string): Promise<Order | null> => {
        if (!shopId) return null;
        const snap = await getDoc(doc(db, "shops", shopId, "orders", id));
        return snap.exists() ? ({ id: snap.id, ...(snap.data() as object) } as Order) : null;
    };

    const printOrder = async (id: string) => {
        if (!shop) return;
        const win = window.open("", "_blank"); // opened before any await so popup blockers allow it
        try {
            const order = await loadOrder(id);
            if (!order) { win?.close(); return; }
            const m = await import("@/lib/generateReceipt");
            const blob = await m.getReceiptBlob(order, buildReceiptShopInfo(shop, currencySymbol));
            const url = URL.createObjectURL(blob);
            if (win) win.location.href = url; else window.open(url, "_blank");
        } catch (e) { win?.close(); console.error("print receipt", e); }
    };

    const whatsappOrder = async (id: string) => {
        try {
            const order = await loadOrder(id);
            if (order) openWhatsAppTextOnly(order, shop || undefined, currencySymbol);
        } catch (e) { console.error("whatsapp", e); }
    };

    return { printOrder, whatsappOrder };
}
