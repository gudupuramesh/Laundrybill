/**
 * Order Detail View (Shared Component)
 * 
 * Reusable component showing the full order details with Green Gradient Header.
 * Used by:
 * 1. OrderDetailPage (Mobile/Standalone route)
 * 2. OrderDetailPanel (Desktop right-pane split view)
 */

import { useState, useEffect, useContext, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SeenOnlineOrdersContext } from "@/hooks/use-seen-online-orders";
import { LSpinner, LActionSheet, LSelect } from "@/components/laundry";
import { useOrder, useOrderMutations } from "@/hooks/use-orders";
import { useCustomer } from "@/hooks/use-customers";
import { useAvailableAgents } from "@/hooks/use-available-agents";
import { StatusUpdateSheet } from "./StatusUpdateSheet";
import { PaymentCollectionSheet } from "./PaymentCollectionSheet";
import { CancelOrderSheet } from "./CancelOrderSheet";
import { DeleteOrderSheet } from "./DeleteOrderSheet";
import { useAuth } from "@/features/auth";
import { TagGeneratorModal } from "@/features/plant-app/components/TagGeneratorModal";
import { Check, ChevronLeft, CircleCheck, Clock, Download, Edit, Globe, Mail, MapPin, MessageCircle, MoreVertical, Package, Phone, Printer, QrCode, RefreshCw, Shirt, Tag, Trash2, CalendarDays, Image as ImageIcon, ChevronDown, FileText, UserRound } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { generateOrderReceipt } from "@/lib/generateReceipt";
import { isAndroidPrintEnv } from "@/lib/receipt-print";
import { useReceiptPrint } from "@/context/ReceiptPrintContext";
import { openWhatsAppTextOnly, shareReceiptPdfViaWhatsApp } from "@/lib/whatsappShare";
import { useShop } from "@/hooks/use-shop";
import { groupOrderItemsByCategory } from "@/lib/order-item-groups";
import { getCountryByCurrency } from "@/config/countries";
import { useCurrency } from "@/hooks/use-currency";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useIsMobile } from "@/hooks/use-mobile";
import type { OrderStatus, DeliveryType, OrderItem } from "@/types/order";
import { mapLegacyDeliveryType, STATUS_LABELS, getItemProgress } from "@/types/order";

const MONO = "'IBM Plex Mono'";
const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
const tintFor = (s: string) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; };
const card: CSSProperties = { background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };
const secLbl: CSSProperties = { fontSize: 15, fontWeight: 700, letterSpacing: "-.01em", color: "var(--c-text)", marginBottom: 14, textTransform: "none" };
const hdrBtnOld: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "8px 12px" };

const STATUS_TINT: Record<OrderStatus, string> = {
    pending: "c-slate", processing: "c-info", ready: "c-primary", ready_for_pickup: "c-primary",
    out_for_delivery: "c-cyan", picked_up: "c-success", delivered: "c-success",
    pickup_scheduled: "c-warning", pickup_completed: "c-violet", partially_delivered: "c-warning", cancelled: "c-error",
};
const TYPE_TINT: Record<DeliveryType, string> = { delivery_home: "c-success", pickup_store: "c-info", pickup_home: "c-violet" };


interface OrderDetailViewProps {
    orderId: string;
    onBack?: () => void;
    isEmbedded?: boolean; // True if used in split view (removes PageWrapper padding logic if needed)
}

export function OrderDetailView({ orderId, onBack }: OrderDetailViewProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    // Shared across the owner app, staff app (/staff/*) and agent portal (/agent/*) — edit must stay in-context.
    const isStaffApp = location.pathname.startsWith('/staff');
    const isAgentApp = location.pathname.startsWith('/agent');
    const { markSeen } = useContext(SeenOnlineOrdersContext);
    const { order, loading } = useOrder(orderId);
    const { customer: custStats } = useCustomer(order?.customerId || "");
    const { shop } = useShop();
    const { currencySymbol, formatAmount } = useCurrency();
    const { reassignAgent, updateItemProgress } = useOrderMutations();
    const { agents } = useAvailableAgents();
    const { hasFeature } = useShopLimits();
    const { triggerReceiptPrint } = useReceiptPrint();
    const isMobile = useIsMobile();

    // Mark online order as seen when viewed (so Orders badge count goes down)
    useEffect(() => {
        if (order?.orderSource === "online" && order?.id && markSeen) {
            markSeen(order.id);
        }
    }, [order?.id, order?.orderSource, markSeen]);

    // Per-item status (partial delivery / mark processed)
    const [deliverMode, setDeliverMode] = useState(false);
    const [deliverDraft, setDeliverDraft] = useState<Record<number, number>>({}); // line index → pieces to deliver now
    const [procOpen, setProcOpen] = useState<number | null>(null);                // line with an open process-qty stepper
    const [procQty, setProcQty] = useState(1);                                    // pieces to process in the open stepper
    const [itemBusy, setItemBusy] = useState(false);

    // Sheet states
    const [statusSheetOpen, setStatusSheetOpen] = useState(false);
    const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
    const [actionSheetOpen, setActionSheetOpen] = useState(false);
    const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
    const [deleteSheetOpen, setDeleteSheetOpen] = useState(false);
    const [tagModalOpen, setTagModalOpen] = useState(false);
    // Permanent delete: shop owner or manager (see canDeleteOrder below).
    const { role } = useAuth();
    const isOwner = role === "admin" && !location.pathname.startsWith("/staff") && !location.pathname.startsWith("/agent");
    // Permanent delete: the shop owner, plus a MANAGER in the staff portal —
    // same pair the owner/Team apps expose and the Firestore rules allow.
    const canDeleteOrder = isOwner || (role === "manager" && !location.pathname.startsWith("/agent"));
    const [reassigning, setReassigning] = useState(false);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[50vh]">
                <LSpinner size="lg" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">{t('orders.notFound')}</p>
                {onBack && (
                    <button onClick={onBack} style={{ marginTop: 16, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 8, padding: "8px 14px" }}>
                        {t('orders.backToOrders')}
                    </button>
                )}
            </div>
        );
    }

    const canUpdateStatus = ["pending", "processing", "ready", "ready_for_pickup", "out_for_delivery", "pickup_scheduled", "pickup_completed"].includes(order.status);
    const canEdit = ["pending", "processing", "ready", "ready_for_pickup", "out_for_delivery", "picked_up", "pickup_scheduled"].includes(order.status);
    const canCancel = order.status !== "cancelled" && order.status !== "delivered" && order.status !== "picked_up";
    const hasBalance = order.financials.balance > 0;

    // WhatsApp chat handler - opens WhatsApp with order details (no PDF)
    const handleWhatsAppChat = () => {
        if (!order) return;
        openWhatsAppTextOnly(order, shop || undefined, currencySymbol);
    };

    // Share the actual PDF bill to WhatsApp (share sheet on phones; download + chat on desktop)
    const handleWhatsAppPdf = async () => {
        if (!order || !shop) return;
        const location = shop.location;
        const shopInfo = {
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
        try {
            const m = await import("@/lib/generateReceipt");
            const blob = await m.getReceiptBlob(order, shopInfo);
            await shareReceiptPdfViaWhatsApp({ order, shop, blob, fileName: m.getReceiptFileName(order) });
        } catch (e) {
            console.error("WhatsApp PDF share failed:", e);
        }
    };

    // Print receipt handler
    // Download receipt handler
    const handleDownloadReceipt = async () => {
        if (order && shop) {
            const location = shop.location;
            await generateOrderReceipt(order, {
                name: shop.name || "LaundryBill",
                phone: shop.phone,
                address: location?.address ? `${location.address}, ${location.city || ''} ${location.pincode || ''}` : undefined,
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
            });
        }
    };

    // Print/Preview receipt handler (Android: window.print() for native dialog; else PDF in new tab).
    // format: "a4" for a full-page bill, "thermal" for the 80mm POS-roll layout.
    const handlePrintPreview = async (format: "a4" | "thermal" = "a4") => {
        if (!order || !shop) return;
        const location = shop.location;
        const shopInfo = {
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
        if (format === "a4" && isAndroidPrintEnv()) {
            triggerReceiptPrint(order, shopInfo);
            return;
        }
        // Open the tab synchronously (before any await) so popup blockers allow it.
        const win = window.open("", "_blank");
        try {
            const blob = await import("@/lib/generateReceipt").then(m =>
                format === "thermal" ? m.getThermalReceiptBlob(order, shopInfo) : m.getReceiptBlob(order, shopInfo));
            const url = URL.createObjectURL(blob);
            if (win) win.location.href = url; else window.open(url, "_blank");
        } catch (error) {
            win?.close();
            console.error("Failed to generate receipt preview", error);
        }
    };

    // Edit order handler - navigate to New Order page with order ID
    const handleEdit = () => {
        if (canEdit && order) {
            // Navigate to the new-order page in edit mode, in-context per portal.
            const newOrderBase = isAgentApp ? '/agent/orders/new' : isStaffApp ? '/staff/orders/new' : '/new-order';
            navigate(`${newOrderBase}?edit=${order.id}`);
        }
    };

    // Calculate progress step index for the 4-step display (0–3 = current step, 4 = all done).
    // Must match getProgressSteps() so we don't show "Delivered" until status is actually delivered.
    const getProgressStep = () => {
        if (order.status === "cancelled") return -1;
        const deliveryType = mapLegacyDeliveryType(order.deliveryType);
        const steps = getProgressSteps();

        // Map order status to display step index (0 = first step, steps.length = all completed).
        if (deliveryType === "pickup_store") {
            const map: Record<OrderStatus, number> = {
                pending: 0,
                processing: 1,
                ready_for_pickup: 2,
                picked_up: steps.length, // all done
                ready: 2,
                out_for_delivery: 3,
                delivered: steps.length,
                pickup_scheduled: 0,
                pickup_completed: 1,
                partially_delivered: 2, // some collected, rest still at the shop
                cancelled: -1,
            };
            return map[order.status] ?? 0;
        }

        // delivery_home and pickup_home: 4 steps = Order Placed, Processing, Ready, Delivered
        const map: Record<OrderStatus, number> = {
            pending: 0,
            pickup_scheduled: 0,
            pickup_completed: 1,
            processing: 1,
            ready: 2,
            ready_for_pickup: 2,
            out_for_delivery: 3,
            delivered: steps.length, // all done – only then show Delivered as completed
            picked_up: steps.length,
            partially_delivered: 3, // some delivered, the rest not yet
            cancelled: -1,
        };
        return map[order.status] ?? 0;
    };

    // Get steps for progress stepper - always show 4 universal steps
    const getProgressSteps = () => {
        const deliveryType = mapLegacyDeliveryType(order.deliveryType);

        // Use universal steps that make sense for all types + Plant workflow
        // This ensures steps align even when Plant changes statuses
        if (deliveryType === "pickup_store") {
            return [
                { id: "pending", label: t('orders.steps.placed') },
                { id: "processing", label: t('orders.steps.processing') },
                { id: "ready_for_pickup", label: t('orders.steps.readyForPickup') },
                { id: "picked_up", label: t('orders.steps.pickedUp') },
            ];
        }

        // For Home Delivery and Pickup from Home
        return [
            { id: "pending", label: t('orders.steps.placed') },
            { id: "processing", label: t('orders.steps.processing') },
            { id: "ready", label: t('orders.steps.ready') },
            { id: "delivered", label: t('orders.steps.delivered') },
        ];
    };

    // Helper for status labels
    const getStatusLabel = (status: OrderStatus) => {
        switch (status) {
            case 'pending': return t('orders.steps.placed');
            case 'processing': return t('orders.steps.processing');
            case 'ready_for_pickup': return t('orders.steps.readyForPickup');
            case 'picked_up': return t('orders.steps.pickedUp');
            case 'ready': return t('orders.steps.ready');
            case 'delivered': return t('orders.steps.delivered');
            case 'cancelled': return t('orders.cancelled');
            case 'pickup_scheduled': return t('orders.scheduledPickup');
            case 'pickup_completed': return t('orders.steps.pickedUp');
            case 'out_for_delivery': return t('dashboard.outForDelivery');
            default: return (status as string).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        }
    };

    const dtype = mapLegacyDeliveryType(order.deliveryType);
    const stRef = STATUS_TINT[order.status] || 'c-slate';
    const tyRef = TYPE_TINT[dtype];
    const isHome = dtype === 'delivery_home' || dtype === 'pickup_home';
    const steps = getProgressSteps();
    const curStep = getProgressStep();
    const placedAt = order.createdAt?.toDate?.();
    void tyRef; void placedAt; void tintFor;
    const f = order.financials;
    const taxLabel = f.taxName || shop?.settings?.tax?.name || getCountryByCurrency(shop?.settings?.currency || "INR").taxName;
    const hasPhotos = (order.damagePhotoUrls && order.damagePhotoUrls.length > 0) || !!order.pickupPhoto || !!order.deliveryPhoto || !!order.plantPhoto || !!order.items?.some((i) => i.damages?.length);

    // ── Per-piece progress (partial delivery / per-item processing) ──
    // Pro+/Business feature: Pro stays on the standard order-level status update
    // (which cascades to items), with no per-item controls.
    const itemTracking = hasFeature("itemTracking");
    const itemsEditable = itemTracking && order.status !== "cancelled";
    const orderDone = order.status === "delivered" || order.status === "picked_up";
    // Progress per line, with legacy fallback: a completed order with no counters = fully delivered.
    const progressOf = (it: OrderItem) => {
        const p = getItemProgress(it);
        if (it.processedQty === undefined && it.deliveredQty === undefined && orderDone) return { qty: p.qty, processed: p.qty, delivered: p.qty };
        return p;
    };
    const lineProg = order.items.map(progressOf);
    const anyProcessable = itemsEditable && lineProg.some((p) => p.processed < p.qty);
    // Only PROCESSED pieces can be handed over — deliverable = processed − delivered.
    const anyDeliverable = itemsEditable && lineProg.some((p) => p.delivered < p.processed);
    const totalPieces = lineProg.reduce((a, p) => a + p.qty, 0);
    const deliveredPieces = lineProg.reduce((a, p) => a + p.delivered, 0);
    const draftPieces = Object.values(deliverDraft).reduce((a: number, n) => a + (n || 0), 0);

    const runProgress = async (updates: { index: number; processed?: number; delivered?: number }[]) => {
        if (!updates.length || itemBusy) return;
        setItemBusy(true);
        try {
            await updateItemProgress(order.id, updates);
            setDeliverMode(false); setDeliverDraft({}); setProcOpen(null);
        } catch (e) {
            console.error("Failed to update item progress:", e);
        } finally {
            setItemBusy(false);
        }
    };
    // Process n MORE pieces of a line (absolute processed = current + n).
    const processMore = (i: number, n: number) => runProgress([{ index: i, processed: Math.min(lineProg[i].qty, lineProg[i].processed + n) }]);
    const processAll = () => runProgress(order.items.map((_, i) => ({ index: i, processed: lineProg[i].qty })).filter((_, i) => lineProg[i].processed < lineProg[i].qty));
    // Enter deliver mode: prefill each line with the pieces that are PROCESSED but not
    // yet delivered (processed − delivered). Unprocessed pieces can't be handed over.
    const enterDeliver = () => {
        const draft: Record<number, number> = {};
        lineProg.forEach((p, i) => { const rem = p.processed - p.delivered; if (rem > 0) draft[i] = rem; });
        setDeliverDraft(draft); setDeliverMode(true); setProcOpen(null);
    };
    const confirmDeliver = () => runProgress(
        Object.entries(deliverDraft).filter(([, n]) => (n || 0) > 0)
            .map(([i, n]) => ({ index: Number(i), delivered: Math.min(lineProg[Number(i)].processed, lineProg[Number(i)].delivered + (n || 0)) }))
    );
    const setDraft = (i: number, n: number) => setDeliverDraft((d) => ({ ...d, [i]: Math.max(0, Math.min(lineProg[i].processed - lineProg[i].delivered, n)) }));

    // Per-line pill (shows piece counts for multi-piece lines).
    const pillFor = (p: { qty: number; processed: number; delivered: number }): { label: string; fg: string; bg: string } => {
        const PEND = { fg: "var(--c-text-3)", bg: "var(--c-surface-2)" };
        const PROC = { fg: "var(--c-info)", bg: "var(--c-info-soft)" };
        const DELIV = { fg: "var(--c-success)", bg: "var(--c-success-soft)" };
        const PART = { fg: "var(--c-warning)", bg: "var(--c-warning-soft)" };
        if (p.delivered >= p.qty && p.qty > 0) return { label: t("orders.itemDelivered", "Delivered"), ...DELIV };
        if (p.delivered > 0) return { label: `${p.delivered}/${p.qty} ${t("orders.itemDelivered", "Delivered")}`, ...PART };
        if (p.processed >= p.qty && p.qty > 0) return { label: t("orders.itemProcessed", "Processed"), ...PROC };
        if (p.processed > 0) return { label: `${p.processed}/${p.qty} ${t("orders.itemProcessed", "Processed")}`, ...PART };
        return { label: t("orders.itemPending", "Pending"), ...PEND };
    };
    const miniBtn: CSSProperties = { cursor: "pointer", width: 24, height: 24, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border-strong)", borderRadius: 6, lineHeight: 1 };
    const Row = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginTop: 10 }}>
            <span style={{ color: 'var(--ds-text-3)', flex: 'none', display: 'inline-flex' }}>{icon}</span>
            <span style={{ color: 'var(--ds-text-2)' }}>{label}</span>
            <span style={{ marginLeft: 'auto', fontWeight: 600, textAlign: 'right' }}>{value}</span>
        </div>
    );
    const hdrBtn: CSSProperties = { cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--ds-text)', background: 'var(--ds-card)', border: '1px solid var(--ds-border)', borderRadius: 10, padding: '9px 14px' };
    void hdrBtnOld;
    const stepTime = (id: string) => { const ev = order.timeline?.find((e) => e.status === id); return ev ? format(ev.timestamp.toDate(), 'h:mm a') : '—'; };
    const photoThumb: CSSProperties = { display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--c-border)' };

    return (
        <div className="lb-ds" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--ds-bg)' }}>
                {/* header */}
                <header className="lb-ds" style={{ position: 'sticky', top: 0, zIndex: 5, flex: 'none', minHeight: 66, background: 'var(--ds-card)', borderBottom: '1px solid var(--ds-border)', display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '10px 14px' : '12px 22px' }}>
                    {onBack && <button onClick={onBack} aria-label={t('common.back', 'Back')} style={{ cursor: 'pointer', width: 36, height: 36, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ds-text-2)', background: 'var(--ds-card)', border: '1px solid var(--ds-border)', borderRadius: 10 }}><ChevronLeft size={18} /></button>}
                    <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>#{order.publicId}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 7, background: `var(--${stRef}-soft)`, color: `var(--${stRef})`, whiteSpace: 'nowrap' }}>{STATUS_LABELS[order.status]}</span>
                    <div style={{ flex: 1 }} />
                    <div className="lb-thin" style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>
                                                <button onClick={handleWhatsAppChat} style={hdrBtn}><MessageCircle size={16} style={{ color: 'var(--ds-whatsapp)' }} />{t('orders.whatsapp', 'WhatsApp')}</button>
                        <button onClick={handleWhatsAppPdf} title={t('orders.whatsappPdfHint', 'Send the PDF bill on WhatsApp — on desktop it downloads and opens the chat to attach')} style={hdrBtn}><FileText size={16} />{t('orders.whatsappPdf', 'PDF bill')}</button>
                        {canEdit && <button onClick={handleEdit} style={hdrBtn}><Edit size={16} />{t('common.edit', 'Edit')}</button>}
                        <button onClick={() => handlePrintPreview("a4")} style={hdrBtn}><Printer size={16} />{t('orders.printA4', 'Print A4')}</button>
                        <button onClick={() => handlePrintPreview("thermal")} title={t('orders.printThermalHint', 'POS thermal printer receipt (80mm roll)')} style={hdrBtn}><Printer size={16} />{t('orders.printThermal', 'Print 80 mm')}</button>
                        {canUpdateStatus && (
                            <button onClick={() => setStatusSheetOpen(true)} style={{ ...hdrBtn, color: '#fff', background: 'var(--ds-blue)', border: 0, boxShadow: 'var(--ds-shadow)', padding: '9px 0 9px 14px', gap: 0 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingRight: 12 }}><RefreshCw size={16} />{t('orders.updateStatus', 'Update Status')}</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 10px', borderLeft: '1px solid rgba(255,255,255,.35)', alignSelf: 'stretch' }}><ChevronDown size={16} /></span>
                            </button>
                        )}
                        <button onClick={() => setActionSheetOpen(true)} aria-label="More actions" style={{ cursor: 'pointer', width: 40, height: 40, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ds-text-2)', background: 'var(--ds-card)', border: '1px solid var(--ds-border)', borderRadius: 10 }}><MoreVertical size={17} /></button>
                    </div>
                </header>

                <div style={{ padding: isMobile ? '16px 14px 40px' : '20px 22px 40px' }}>
                    {/* Online booking estimate — what the customer told us at booking (priced at pickup) */}
                    {order.orderSource === 'online' && (order.estimatedWeight || order.estimatedPieces) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '11px 16px', marginBottom: 16, borderRadius: 12, background: 'var(--c-cyan-soft)' }}>
                            <Globe size={15} style={{ color: 'var(--c-cyan)', flex: 'none' }} />
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-text-2)' }}>{t('orders.customerEstimate', 'Customer estimate')}</span>
                            {order.estimatedWeight && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-text)', background: 'var(--c-surface)', border: '1px solid var(--c-border)', padding: '3px 10px', borderRadius: 20 }}>{order.estimatedWeight}</span>}
                            {order.estimatedPieces && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-text)', background: 'var(--c-surface)', border: '1px solid var(--c-border)', padding: '3px 10px', borderRadius: 20 }}>{order.estimatedPieces}</span>}
                            <span style={{ fontSize: 11.5, color: 'var(--c-text-3)', marginLeft: 'auto' }}>{t('orders.pricedAtPickup', 'Priced at pickup')}</span>
                        </div>
                    )}

                    <div className="lb-row" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                        {/* LEFT */}
                        <div style={{ flex: 1.7, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* order progress */}
                        {order.status !== 'cancelled' && (
                            <div style={{ ...card, padding: isMobile ? '18px 10px 16px' : '18px 26px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>{t('orders.orderProgress', 'Order progress')}</span>
                                    {order.expectedDelivery && (
                                        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--c-text-2)' }}>
                                            {dtype === 'delivery_home' ? t('orders.expectedDelivery', 'Expected delivery') : t('orders.expectedReady', 'Expected ready')}: <b style={{ color: 'var(--c-text)' }}>{format(order.expectedDelivery.toDate(), 'EEE d MMM')}</b>
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex' }}>
                                    {steps.map((st, i) => {
                                        const done = i < curStep, cur = i === curStep, active = done || cur;
                                        return (
                                            <div key={st.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                                {i > 0 && <div style={{ position: 'absolute', top: 19, left: 'calc(-50% + 21px)', right: 'calc(50% + 21px)', height: 3, borderRadius: 2, background: i <= curStep ? 'var(--ds-blue)' : 'var(--ds-border)' }} />}
                                                <span style={{ position: 'relative', zIndex: 1, width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, background: active ? 'var(--ds-blue)' : 'var(--ds-card)', color: active ? '#fff' : 'var(--ds-text-3)', border: `2px solid ${active ? 'var(--ds-blue)' : 'var(--ds-border)'}` }}>{active ? <Check size={19} strokeWidth={2.6} /> : i + 1}</span>
                                                <span style={{ marginTop: 12, fontSize: 13.5, fontWeight: 600, color: active ? 'var(--ds-text)' : 'var(--ds-text-3)' }}>{st.label}</span>
                                                <span style={{ marginTop: 4, fontSize: 12, color: 'var(--ds-text-3)' }}>{i <= curStep ? stepTime(st.id) : '—'}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                            {/* items */}
                            <div style={{ ...card, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: '1px solid var(--c-border)', flexWrap: 'wrap' }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>{t('orders.items', 'Items')}</div>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-primary)', background: 'var(--c-primary-soft)', padding: '2px 8px', borderRadius: 20 }}>{order.items.reduce((a, it) => a + it.quantity, 0)}</span>
                                    {deliveredPieces > 0 && deliveredPieces < totalPieces && (
                                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-warning)', background: 'var(--c-warning-soft)', padding: '2px 8px', borderRadius: 20 }}>{t('orders.piecesDelivered', '{{done}}/{{total}} pieces delivered', { done: deliveredPieces, total: totalPieces })}</span>
                                    )}
                                    <div style={{ flex: 1 }} />
                                    {anyProcessable && !deliverMode && (
                                        <button disabled={itemBusy} onClick={processAll} style={{ cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--c-info)', background: 'var(--c-info-soft)', border: '1px solid var(--c-info)', borderRadius: 8, padding: '5px 10px', opacity: itemBusy ? 0.6 : 1 }}>
                                            <Check size={13} />{t('orders.markAllProcessed', 'All processed')}
                                        </button>
                                    )}
                                    {anyDeliverable && (
                                        <button disabled={itemBusy} onClick={() => (deliverMode ? (setDeliverMode(false), setDeliverDraft({})) : enterDeliver())} style={{ cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: deliverMode ? 'var(--c-text-2)' : '#fff', background: deliverMode ? 'var(--c-surface)' : 'var(--c-primary)', border: deliverMode ? '1px solid var(--c-border-strong)' : '1px solid var(--c-primary)', borderRadius: 8, padding: '5px 10px', opacity: itemBusy ? 0.6 : 1 }}>
                                            {deliverMode ? t('common.cancel', 'Cancel') : <><Package size={13} />{t('orders.deliverItems', 'Deliver items')}</>}
                                        </button>
                                    )}
                                </div>
                                {deliverMode && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: 'var(--c-primary-soft)', borderBottom: '1px solid var(--c-border)', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-primary)' }}>{t('orders.setDeliverQty', 'Set how many pieces of each line the customer is taking')}</span>
                                        <div style={{ flex: 1 }} />
                                        <button disabled={draftPieces === 0 || itemBusy} onClick={confirmDeliver} style={{ cursor: draftPieces ? 'pointer' : 'default', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: '#fff', background: draftPieces ? 'var(--c-primary)' : 'var(--c-border-strong)', border: 0, borderRadius: 8, padding: '6px 13px', opacity: itemBusy ? 0.6 : 1 }}>
                                            {t('orders.deliverSelected', 'Deliver selected')}{draftPieces ? ` (${draftPieces})` : ''}
                                        </button>
                                    </div>
                                )}
                                {groupOrderItemsByCategory(order.items, (it) => it.categoryName || 'Other').map((group) => (
                                    <div key={group.categoryName}>
                                        <div style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: 'var(--ds-text-2)', background: 'var(--ds-table-head)', borderBottom: '1px solid var(--ds-divider)' }}>{group.categoryName}</div>
                                        {group.items.map((it) => {
                                            const gi = order.items.indexOf(it);
                                            const p = lineProg[gi];
                                            const pill = pillFor(p);
                                            const deliverRem = p.processed - p.delivered;   // only PROCESSED pieces can be handed over
                                            const procRem = p.qty - p.processed;            // pieces still to process
                                            const awaitingProcess = deliverMode && deliverRem === 0 && p.delivered < p.qty; // nothing to deliver yet
                                            const draft = deliverDraft[gi] ?? 0;
                                            const stepOpen = procOpen === gi;
                                            return (
                                                <div key={`${it.id}-${gi}`} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 20px', borderBottom: '1px solid var(--ds-divider)', background: deliverMode && draft > 0 ? 'var(--ds-blue-soft)' : undefined }}>
                                                    <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 8, background: 'var(--ds-muted-surface)', color: 'var(--ds-text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shirt size={17} strokeWidth={1.6} /></span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                            {it.serviceName}
                                                            {(itemTracking || p.processed > 0 || p.delivered > 0) && <span style={{ fontSize: 9.5, fontWeight: 700, color: pill.fg, background: pill.bg, padding: '2px 7px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '.03em' }}>{pill.label}</span>}
                                                        </div>
                                                        {it.notes && <div style={{ fontSize: 12.5, color: 'var(--ds-text-2)', fontStyle: 'italic', marginTop: 3 }}>{it.notes}</div>}
                                                    </div>

                                                    {/* Deliver mode, but this line has no processed-yet-undelivered pieces */}
                                                    {awaitingProcess && (
                                                        <span style={{ flex: 'none', fontSize: 11, color: 'var(--c-text-3)', fontStyle: 'italic' }}>{t('orders.processFirst', 'Not processed yet')}</span>
                                                    )}

                                                    {/* Deliver mode: per-line qty stepper for how many the customer takes */}
                                                    {deliverMode && deliverRem > 0 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                                                            {p.qty > 1 ? <>
                                                                <button onClick={() => setDraft(gi, draft - 1)} style={miniBtn}>−</button>
                                                                <span style={{ minWidth: 34, textAlign: 'center', fontFamily: MONO, fontSize: 13, fontWeight: 700 }}>{draft}<span style={{ color: 'var(--c-text-3)', fontWeight: 400 }}>/{deliverRem}</span></span>
                                                                <button onClick={() => setDraft(gi, draft + 1)} style={miniBtn}>＋</button>
                                                            </> : (
                                                                <input type="checkbox" checked={draft > 0} onChange={(e) => setDraft(gi, e.target.checked ? 1 : 0)} style={{ width: 18, height: 18, accentColor: 'var(--c-primary)', cursor: 'pointer' }} />
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Process controls (not in deliver mode) */}
                                                    {!deliverMode && itemsEditable && procRem > 0 && (
                                                        p.qty > 1 && stepOpen ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                                                                <button onClick={() => setProcQty(Math.max(1, procQty - 1))} style={miniBtn}>−</button>
                                                                <span style={{ minWidth: 34, textAlign: 'center', fontFamily: MONO, fontSize: 13, fontWeight: 700 }}>{Math.min(procQty, procRem)}<span style={{ color: 'var(--c-text-3)', fontWeight: 400 }}>/{procRem}</span></span>
                                                                <button onClick={() => setProcQty(Math.min(procRem, procQty + 1))} style={miniBtn}>＋</button>
                                                                <button disabled={itemBusy} onClick={() => processMore(gi, Math.min(procQty, procRem))} style={{ ...miniBtn, width: 'auto', padding: '0 8px', color: 'var(--c-info)', background: 'var(--c-info-soft)', borderColor: 'var(--c-info)', fontSize: 12 }}>{t('orders.process', 'Process')}</button>
                                                            </div>
                                                        ) : (
                                                            <button disabled={itemBusy} onClick={() => { if (p.qty > 1) { setProcOpen(gi); setProcQty(procRem); } else { processMore(gi, procRem); } }} title={t('orders.markProcessed', 'Mark processed')} style={{ cursor: 'pointer', flex: 'none', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-info)', background: 'var(--c-info-soft)', border: '1px solid var(--c-info)', borderRadius: 7, opacity: itemBusy ? 0.6 : 1 }}>
                                                                <Check size={14} />
                                                            </button>
                                                        )
                                                    )}

                                                    <span style={{ fontSize: 13, color: 'var(--ds-text-2)', whiteSpace: 'nowrap' }}>
                                                        {(() => { const kg = !!it.pieceCount || /kg/i.test(String((it as { pricingType?: string }).pricingType || '')); return kg ? `${it.quantity} kg${it.pieceCount ? ` · ${it.pieceCount} ${t('orders.pieces', 'pcs')}` : ''} × ${formatAmount(it.unitPrice)}` : `${it.quantity} × ${formatAmount(it.unitPrice)}`; })()}
                                                        {it.express && <span> · {t('pos.express', 'Express')}</span>}
                                                    </span>
                                                    <span style={{ width: 84, textAlign: 'right', fontWeight: 600, fontSize: 14 }}>{formatAmount(it.total)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                                <div style={{ padding: '14px 20px 16px', display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13.5, background: 'var(--ds-table-head)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ds-text-2)' }}>{t('pos.subtotal', 'Subtotal')}</span><span>{formatAmount(f.subtotal)}</span></div>
                                    {f.discountAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--c-success)' }}><span>{f.couponCode ? `${t('checkout.coupon', 'Coupon')} ${f.couponCode}` : t('checkout.discount', 'Discount')}</span><span style={{ fontFamily: MONO }}>−{formatAmount(f.discountAmount)}</span></div>}
                                    {(f.pointsRedeemed || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--c-success)' }}><span>{t('orders.pointsRedeemedLabel', 'Points redeemed')}</span><span style={{ fontFamily: MONO }}>−{formatAmount(f.pointsRedeemed || 0)}</span></div>}
                                    {(order.loyalty?.earnedPoints || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--c-warning)' }}><span>{t('orders.pointsEarnedLabel', 'Cashback earned')}</span><span style={{ fontFamily: MONO }}>+{order.loyalty!.earnedPoints} {t('orders.pts', 'pts')}</span></div>}
                                    {(f.taxAmount || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ds-text-2)' }}>{taxLabel} ({f.taxRate}%)</span><span>{formatAmount(f.taxAmount || 0)}</span></div>}
                                    {(f.deliveryCharge || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ds-text-2)' }}>{t('pos.deliveryCharge', 'Delivery charge')}</span><span>{formatAmount(f.deliveryCharge)}</span></div>}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4, borderTop: '1px solid var(--ds-border)' }}><span style={{ fontWeight: 700, fontSize: 16 }}>{t('pos.total', 'Total')}</span><span style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.01em' }}>{formatAmount(f.total)}</span></div>
                                </div>
                            </div>

                            {/* photos — each captioned with type + who added it and when */}
                            {hasPhotos && (() => {
                                const metaFor = (url?: string | null) => (url && order.photoMeta?.find((m) => m.url === url)) || null;
                                const roleLabel = (r: string) => ({ owner: t('orders.roleOwner', 'Owner'), manager: t('orders.roleManager', 'Manager'), staff: t('orders.roleStaff', 'Staff'), agent: t('orders.roleAgent', 'Delivery agent'), plant: t('orders.rolePlant', 'Plant') } as Record<string, string>)[r] || r;
                                const caption = (url: string | null | undefined, typeLabel: string) => {
                                    const m = metaFor(url);
                                    return (
                                        <div style={{ width: 84, marginTop: 4 }}>
                                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-2)', lineHeight: 1.3 }}>{typeLabel}</div>
                                            {m && <div style={{ fontSize: 9.5, color: 'var(--c-text-3)', lineHeight: 1.35 }}>{m.byName} ({roleLabel(m.byRole)})<br />{m.at?.toDate ? format(m.at.toDate(), 'MMM d, h:mm a') : ''}</div>}
                                        </div>
                                    );
                                };
                                const thumb = (url: string, alt: string) => (
                                    <img src={url} alt={alt} style={{ height: 84, width: 84, objectFit: 'cover', display: 'block' }} />
                                );
                                return (
                                    <div style={{ ...card, padding: '18px 20px' }}>
                                        <div style={{ ...secLbl, display: 'flex', alignItems: 'center', gap: 7 }}><ImageIcon size={14} />{t('orders.photos', 'Order photos')}</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                            {order.damagePhotoUrls?.map((url, i) => (
                                                <div key={`d${i}`}>
                                                    <a href={url} target="_blank" rel="noopener noreferrer" style={photoThumb}>{thumb(url, `Damage ${i + 1}`)}</a>
                                                    {caption(url, t('orders.photoDamage', 'Damage / stain'))}
                                                </div>
                                            ))}
                                            {order.pickupPhoto && (
                                                <div>
                                                    <a href={order.pickupPhoto} target="_blank" rel="noopener noreferrer" style={photoThumb}>{thumb(order.pickupPhoto, 'Pickup proof')}</a>
                                                    {caption(order.pickupPhoto, t('orders.photoPickup', 'Pickup proof'))}
                                                </div>
                                            )}
                                            {order.deliveryPhoto && (
                                                <div>
                                                    <a href={order.deliveryPhoto} target="_blank" rel="noopener noreferrer" style={photoThumb}>{thumb(order.deliveryPhoto, 'Delivery proof')}</a>
                                                    {caption(order.deliveryPhoto, t('orders.photoDelivery', 'Delivery proof'))}
                                                </div>
                                            )}
                                            {order.plantPhoto && (
                                                <div>
                                                    <a href={order.plantPhoto} target="_blank" rel="noopener noreferrer" style={photoThumb}>{thumb(order.plantPhoto, 'Plant photo')}</a>
                                                    {caption(order.plantPhoto, t('orders.photoPlant', 'Plant processing'))}
                                                </div>
                                            )}
                                            {order.items?.flatMap((it, idx) => (it.damages || []).filter((d) => d.photoUrl).map((d, i) => (
                                                <div key={`i${idx}-${i}`}>
                                                    <a href={d.photoUrl!} target="_blank" rel="noopener noreferrer" style={photoThumb}>{thumb(d.photoUrl!, d.description || 'Damage')}</a>
                                                    {caption(d.photoUrl, d.description || t('orders.photoDamage', 'Damage / stain'))}
                                                </div>
                                            )))}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* timeline */}
                            <div style={{ ...card, padding: '18px 20px' }}>
                                <div style={{ ...secLbl, marginBottom: 18 }}>{t('orders.timeline', 'Timeline')}</div>
                                {(order.timeline || []).map((event, index, arr) => {
                                    const last = index === arr.length - 1;
                                    return (
                                        <div key={event.id || index} style={{ display: 'flex', gap: 13 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                                                <span style={{ width: 12, height: 12, marginTop: 4, borderRadius: '50%', background: index === 0 ? 'var(--ds-blue)' : 'var(--ds-blue)', opacity: index === 0 ? 1 : .55, flex: 'none' }} />
                                                {!last && <span style={{ width: 2, flex: 1, background: 'var(--ds-border)', minHeight: 14 }} />}
                                            </div>
                                            <div style={{ flex: 1, paddingBottom: last ? 2 : 16 }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                                                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 132 }}>{getStatusLabel(event.status)}</span>
                                                    <span style={{ fontSize: 12.5, color: 'var(--ds-text-2)' }}>{format(event.timestamp.toDate(), 'd MMM, h:mm a')}</span>
                                                    {event.staffName && <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ds-text-2)' }}>{t('orders.by', 'by')} {event.staffName}</span>}
                                                </div>
                                                {event.notes && <div style={{ fontSize: 12, color: 'var(--c-text-3)', marginTop: 2 }}>{event.notes}</div>}
                                            </div>
                                        </div>
                                    );
                                })}
                                {order.staffId && <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--c-border)', fontSize: 11, fontWeight: 600, color: 'var(--c-text-3)' }}>{t('orders.createdBy', 'Created by')} <span style={{ color: 'var(--c-text)' }}>{order.staffName || 'Staff'}</span></div>}
                            </div>
                        </div>

                        {/* RIGHT */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* customer */}
                            <div style={{ ...card, padding: '18px 20px' }}>
                                <div style={secLbl}>{t('customer.title', 'Customer')}</div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                    <span style={{ width: 52, height: 52, flex: 'none', borderRadius: 26, background: 'var(--ds-blue-soft)', color: 'var(--ds-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 19 }}>{(order.customerName || '?').trim()[0]?.toUpperCase()}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-.01em' }}>{order.customerName || t('customer.guest', 'Guest')}</div>
                                        {/* Fall back to email when the customer has no phone (email-only customers). */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13, color: 'var(--ds-text-2)' }}>
                                            {order.customerPhone ? <Phone size={14} style={{ flex: 'none', color: 'var(--ds-text-3)' }} /> : <Mail size={14} style={{ flex: 'none', color: 'var(--ds-text-3)' }} />}
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.customerPhone || order.customerEmail || '—'}</span>
                                        </div>
                                        {(order.deliveryAddress || order.customerAddress) && (
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 6, fontSize: 13, color: 'var(--ds-text-2)' }}>
                                                <MapPin size={14} style={{ flex: 'none', marginTop: 2, color: 'var(--ds-text-3)' }} />
                                                <span>{order.deliveryAddress || order.customerAddress}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
                                        {order.customerPhone && (
                                            <button onClick={() => window.open(`tel:${order.customerPhone}`)} style={{ cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--ds-blue)', background: 'var(--ds-card)', border: '1px solid var(--ds-border)', borderRadius: 10, padding: '9px 16px' }}>
                                                <Phone size={15} />{t('orders.call', 'Call')}
                                            </button>
                                        )}
                                        {order.customerPhone && (
                                            <button onClick={handleWhatsAppChat} style={{ cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--ds-whatsapp)', background: 'var(--ds-card)', border: '1px solid var(--ds-border)', borderRadius: 10, padding: '9px 16px' }}>
                                                <MessageCircle size={15} />{t('orders.whatsapp', 'WhatsApp')}
                                            </button>
                                        )}
                                        {!order.customerPhone && order.customerEmail && (
                                            <button onClick={() => window.open(`mailto:${order.customerEmail}`)} style={{ cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--ds-blue)', background: 'var(--ds-card)', border: '1px solid var(--ds-border)', borderRadius: 10, padding: '9px 16px' }}>
                                                <Mail size={15} />{t('common.email', 'Email')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {custStats && (custStats.totalOrders > 0 || custStats.totalSpent > 0) && (
                                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--ds-divider)', fontSize: 12.5, color: 'var(--ds-text-2)' }}>
                                        <b style={{ color: 'var(--ds-text)' }}>{custStats.totalOrders}</b> {t('orders.ordersLower', 'orders')} · <b style={{ color: 'var(--ds-text)' }}>{formatAmount(custStats.totalSpent)}</b> {t('orders.lifetime', 'lifetime')}
                                    </div>
                                )}
                            </div>

                            {/* delivery & route */}
                            {(isHome || order.expectedDelivery) && (
                                <div style={{ ...card, padding: '18px 20px' }}>
                                    <div style={secLbl}>{isHome ? t('orders.deliveryRoute', 'Delivery & route') : t('orders.fulfilment', 'Fulfilment')}</div>
                                    {isHome && order.deliveryAddress && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}><span style={{ color: 'var(--c-text-3)', flex: 'none', marginTop: 1 }}><MapPin size={16} /></span><span style={{ fontSize: 13, color: 'var(--c-text-2)' }}>{order.deliveryAddress}</span></div>}
                                    {dtype === 'pickup_home' && order.scheduledPickupDate && <Row icon={<CalendarDays size={16} />} label={t('orders.pickupDate', 'Pickup date')} value={format(order.scheduledPickupDate.toDate(), 'd MMM, yyyy')} />}
                                    {order.scheduledPickupTime && <Row icon={<Clock size={16} />} label={t('orders.pickupSlot', 'Pickup slot')} value={order.scheduledPickupTime} />}
                                    {order.expectedDelivery && <Row icon={<CalendarDays size={16} />} label={dtype === 'delivery_home' ? t('orders.expectedDelivery', 'Delivery date') : t('orders.expectedReady', 'Ready by')} value={format(order.expectedDelivery.toDate(), 'd MMM, yyyy')} />}
                                    {order.deliverySlot && <Row icon={<Clock size={16} />} label={t('orders.deliverySlot', 'Delivery slot')} value={order.deliverySlot} />}
                                    {order.deliveryArea && <Row icon={<MapPin size={16} />} label={t('checkout.serviceArea', 'Service area')} value={order.deliveryArea} />}
                                    {order.deliveryNotes && (
                                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--c-border)' }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 5 }}>{t('orders.orderNotes', 'Order notes')}</div>
                                            <div style={{ fontSize: 13, color: 'var(--c-text-2)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>{order.deliveryNotes}</div>
                                        </div>
                                    )}
                                    {isHome && (
                                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--c-border)' }}>
                                            {order.status !== 'delivered' && order.status !== 'cancelled' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span style={{ color: 'var(--ds-text-3)', display: 'inline-flex' }}><UserRound size={16} /></span>
                                                    <span style={{ fontSize: 13, color: 'var(--ds-text-2)', whiteSpace: 'nowrap' }}>{t('orders.assignedAgent', 'Assigned agent')}</span>
                                                    <div style={{ flex: 1, minWidth: 0, marginLeft: 'auto', maxWidth: 260 }}>
                                                        <LSelect value={order.assignedAgentId || ''} onChange={async (value: string) => { if (reassigning) return; setReassigning(true); try { const a = agents.find((x) => x.id === value); await reassignAgent(order.id, value || null, a?.name || null); } catch (e) { console.error(e); } finally { setReassigning(false); } }} options={[{ value: '', label: t('orders.selectAgent', 'Select Agent') }, ...agents.map((a) => ({ value: a.id, label: `${a.name} ${a.isOnline ? '🟢' : '⚪'}` }))]} disabled={reassigning} />
                                                    </div>
                                                    {reassigning && <LSpinner size="sm" />}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--c-success)' }} />{order.assignedAgentName || t('orders.noAgentAssigned', 'No agent')}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* payment */}
                            <div style={{ ...card, padding: '18px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 13 }}>
                                    <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>{t('checkout.payment', 'Payment')}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ds-text-2)' }}>{t('pos.total', 'Total')}</span><span style={{ fontWeight: 600 }}>{formatAmount(f.total)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ds-text-2)' }}>{t('orders.paid', 'Paid')}</span><span style={{ fontWeight: 600 }}>{formatAmount(f.amountPaid)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 2, borderTop: '1px dashed var(--ds-border)' }}><span style={{ fontWeight: 700, fontSize: 14.5, color: hasBalance ? 'var(--ds-negative)' : 'var(--ds-st-ready)' }}>{t('orders.balanceDue', 'Balance due')}</span><span style={{ fontWeight: 700, fontSize: 17, color: hasBalance ? 'var(--ds-negative)' : 'var(--ds-st-ready)' }}>{formatAmount(f.balance)}</span></div>
                                </div>
                                {hasBalance && <button onClick={() => setPaymentSheetOpen(true)} style={{ width: '100%', marginTop: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, font: 'inherit', fontSize: 14, fontWeight: 600, color: '#fff', background: 'var(--ds-tile-green)', border: 0, borderRadius: 10, padding: 12, boxShadow: 'var(--ds-shadow)' }}>{t('orders.collectPayment', 'Collect Payment')}</button>}
                                {(order.payments || []).length > 0 && (
                                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {(order.payments || []).map((pmt, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, padding: '9px 12px', borderRadius: 10, background: 'var(--ds-st-ready-bg)', color: 'var(--ds-st-ready)' }}>
                                                <CircleCheck size={15} style={{ flex: 'none' }} />
                                                <b>{formatAmount(pmt.amount || 0)}</b>
                                                <span style={{ opacity: .75 }}>· {String(pmt.method || 'cash').toUpperCase()}</span>
                                                <span style={{ marginLeft: 'auto', opacity: .75 }}>{pmt.collectedAt?.toDate ? format(pmt.collectedAt.toDate(), 'd MMM, h:mm a') : ''}</span>
                                                <ChevronDown size={15} style={{ opacity: .6 }} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* tag — scan it at the counter to open this order */}
                            {(
                                <div style={{ ...card, padding: '18px 20px' }}>
                                    <div style={secLbl}>{t('orders.tag', 'Tag')}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <span style={{ width: 80, flex: 'none', borderRadius: 10, border: '1px solid var(--ds-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 6px', background: '#fff' }}>
                                            <QrCode size={46} strokeWidth={1.2} style={{ color: 'var(--ds-text)' }} />
                                            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.02em' }}>{order.publicId}</span>
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t('orders.tagTitle', 'Order tag for customer items')}</div>
                                            <div style={{ fontSize: 12.5, color: 'var(--ds-text-2)', marginTop: 3 }}>{t('orders.tagHint', 'Scan this at your shop to open the order.')}</div>
                                        </div>
                                        <button onClick={() => setTagModalOpen(true)} style={{ flex: 'none', cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--ds-blue)', background: 'var(--ds-card)', border: '1px solid var(--ds-border)', borderRadius: 10, padding: '9px 14px' }}>
                                            <Printer size={16} />{t('orders.printTags', 'Print tag')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            {/* Sheets (wiring unchanged) */}
            <StatusUpdateSheet
                open={statusSheetOpen}
                onClose={() => setStatusSheetOpen(false)}
                order={order}
                onSuccess={order?.orderSource === "online" && markSeen ? () => markSeen(order.id) : undefined}
            />
            <PaymentCollectionSheet open={paymentSheetOpen} onClose={() => setPaymentSheetOpen(false)} order={order} />
            <LActionSheet
                open={actionSheetOpen}
                onClose={() => setActionSheetOpen(false)}
                title={t('orders.orderActions')}
                actions={[
                    // Call when there's a phone; email-only customers get an Email action instead.
                    ...(order.customerPhone
                        ? [{ id: "call", label: t('orders.callCustomer'), icon: <Phone className="h-5 w-5" />, onClick: () => window.open(`tel:${order.customerPhone}`) }]
                        : order.customerEmail
                        ? [{ id: "email", label: t('orders.emailCustomer', 'Email customer'), icon: <Mail className="h-5 w-5" />, onClick: () => window.open(`mailto:${order.customerEmail}`) }]
                        : []),
                    ...(order.customerPhone ? [{ id: "whatsapp", label: t('orders.whatsapp'), icon: <MessageCircle className="h-5 w-5" />, onClick: handleWhatsAppChat }] : []),
                    { id: "whatsapp-pdf", label: t('orders.whatsappPdf', 'WhatsApp PDF bill'), icon: <MessageCircle className="h-5 w-5" />, onClick: handleWhatsAppPdf },
                    { id: "download", label: t('orders.downloadReceipt'), icon: <Download className="h-5 w-5" />, onClick: handleDownloadReceipt },
                    { id: "print", label: t('orders.printA4', 'Print A4'), icon: <Printer className="h-5 w-5" />, onClick: () => handlePrintPreview("a4") },
                    { id: "print-thermal", label: t('orders.printThermal', 'Print 80mm (POS)'), icon: <Printer className="h-5 w-5" />, onClick: () => handlePrintPreview("thermal") },
                    { id: "tags", label: t('orders.printTags'), icon: <Tag className="h-5 w-5" />, onClick: () => { setActionSheetOpen(false); setTagModalOpen(true); } },
                    ...(canEdit ? [{ id: "edit", label: t('orders.editOrder'), icon: <Edit className="h-5 w-5" />, onClick: handleEdit }] : []),
                    ...(canCancel ? [{ id: "cancel", label: t('orders.cancelOrder'), icon: <Trash2 className="h-5 w-5" />, destructive: true, onClick: () => { setActionSheetOpen(false); setCancelSheetOpen(true); } }] : []),
                    ...(canDeleteOrder ? [{ id: "delete", label: t('orders.deleteOrder', 'Delete Order Permanently'), icon: <Trash2 className="h-5 w-5" />, destructive: true, onClick: () => { setActionSheetOpen(false); setDeleteSheetOpen(true); } }] : []),
                ]}
            />
            <CancelOrderSheet open={cancelSheetOpen} onClose={() => setCancelSheetOpen(false)} order={order} />
            {canDeleteOrder && (
                <DeleteOrderSheet
                    open={deleteSheetOpen}
                    onClose={() => setDeleteSheetOpen(false)}
                    order={order}
                    onDeleted={() => { setDeleteSheetOpen(false); navigate('/orders'); }}
                />
            )}
            <TagGeneratorModal open={tagModalOpen} onClose={() => setTagModalOpen(false)} order={order} />
        </div>
    );
}
