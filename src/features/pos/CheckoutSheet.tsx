/**
 * Checkout (Order Review) — full-page review + confirm, mirroring the owner app's
 * OrderReviewScreen: customer card → services grouped by category → summary →
 * notes → damage photos → expected-delivery (±) → delivery type + area + agent +
 * Unpaid/Paid → bottom Place Order bar. Payment is a simple Unpaid/Paid status
 * (amountPaid = total when Paid), exactly like the owner app.
 */

import { useState, useMemo, useEffect, useRef, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    LTextArea,
    LSelect,
    LSmartImageUploader,
    type LSmartImageUploaderRef,
} from "@/components/laundry";
import { useAuth } from "@/features/auth";
import { useCart } from "./useCart";
import { useCurrency } from "@/hooks/use-currency";
import type { ImageMetadata } from "@/types/image-upload";
import type { DeliveryType } from "@/types/order";
import { useInventory } from "@/hooks/use-inventory";
import { useCreateOrder, useOrderMutations } from "@/hooks/use-orders";
import { useCustomers } from "@/hooks/use-customers";
import { useAvailableAgents } from "@/hooks/use-available-agents";
import { addDays } from "date-fns";
import { Store, Truck, Home, Calendar, Minus, Plus, FileText, Check, Shirt, Mail, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTranslatedItemName, isWeightUnit } from "@/lib/inventory-translations";
import { useStaffAuthOptional } from "@/features/staff-app/StaffAuthContext";
import { useDeliverySettings } from "@/hooks/use-delivery-settings";
import { useShopLimits } from "@/hooks/use-shop-limits";

const MONO = "'IBM Plex Mono'";
const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
const tintFor = (s: string) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; };
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 13, padding: "18px 20px", boxShadow: "var(--sh-sm)" };
const secLbl: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".05em", color: "var(--c-text-3)", marginBottom: 14 };

interface CheckoutSheetProps {
    open: boolean;
    onClose: () => void;
    cart: ReturnType<typeof useCart>;
    onComplete: (orderId: string) => void;
    editOrderId?: string;
    /** Kept for API compatibility; the checkout now always renders as a full page. */
    asPage?: boolean;
}

export function CheckoutSheet({ onClose, cart, onComplete, editOrderId }: CheckoutSheetProps) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const { shopId } = useAuth();
    const { allCategories } = useInventory();

    const isEditMode = !!editOrderId;
    const isHomeType = cart.deliveryType === "delivery_home" || cart.deliveryType === "pickup_home";

    // Expected delivery = today + max turnaround (editable via ±)
    const maxTurnaroundDays = useMemo(() => {
        if (cart.items.length === 0) return 2;
        return Math.max(...cart.items.map((i) => {
            const itemTurnaround = i.service.turnaroundDays || 2;
            const category = allCategories.find((c) => c.id === i.service.categoryId);
            const categoryTurnaround = category?.turnaroundDays || 2;
            return Math.max(itemTurnaround, categoryTurnaround);
        }));
    }, [cart.items, allCategories]);
    const minExpectedDate = useMemo(() => addDays(new Date(), maxTurnaroundDays), [maxTurnaroundDays]);
    const [expectedDate, setExpectedDate] = useState<Date>(minExpectedDate);
    const [scheduledPickupDate] = useState<Date>(new Date());
    useEffect(() => {
        setExpectedDate(minExpectedDate);
    }, [minExpectedDate]);

    // Payment: Unpaid / Paid (owner app model)
    const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "paid">("unpaid");
    const amountPaid = paymentStatus === "paid" ? cart.total : 0;

    const { createOrder, loading } = useCreateOrder();
    const { updateOrder } = useOrderMutations();
    const { addAddress } = useCustomers();
    const [updating, setUpdating] = useState(false);
    const [saveNewAddress] = useState(true);
    const [selectedAgentId, setSelectedAgentId] = useState<string>("");
    // Whether staff manually picked an agent — if so, stop auto-assigning until
    // the area changes again (lets them override, including "No agent").
    const [agentTouched, setAgentTouched] = useState(false);
    const [selectedArea, setSelectedArea] = useState<string>("");
    const [damagePhotoMetadata, setDamagePhotoMetadata] = useState<ImageMetadata[]>([]);
    const damagePhotoUploaderRef = useRef<LSmartImageUploaderRef>(null);
    const placing = loading || updating;

    const { settings: deliverySettings } = useDeliverySettings();

    const { hasFeature, checkLimit, loading: limitsLoading } = useShopLimits();
    const canUploadDamagePhotos = hasFeature("damagePhotos");
    const agentLimit = checkLimit("maxDeliveryAgents", 0).limit;
    const canHaveAgents = !limitsLoading && (agentLimit === -1 || (typeof agentLimit === "number" && agentLimit > 0));

    // Auto-select first service area
    useEffect(() => {
        if (deliverySettings.serviceAreas?.length > 0 && !selectedArea) {
            const firstActive = deliverySettings.serviceAreas.find((a) => a.isActive);
            if (firstActive) setSelectedArea(firstActive.value);
        }
    }, [deliverySettings.serviceAreas, selectedArea]);

    // Clear area/agent when not a home delivery / pickup-from-home order
    const areaAgentUiActive = isHomeType;
    useEffect(() => {
        if (!areaAgentUiActive || !canHaveAgents) { if (selectedAgentId) setSelectedAgentId(""); }
        if (!areaAgentUiActive) { if (selectedArea) setSelectedArea(""); }
    }, [areaAgentUiActive, canHaveAgents, selectedAgentId, selectedArea]);

    const filterArea = useMemo(() => {
        if (selectedArea && deliverySettings.serviceAreas?.length > 0) return selectedArea;
        const addr = cart.deliveryAddress || "";
        return (addr.split(",").map((p) => p.trim())[0]) || "";
    }, [selectedArea, deliverySettings.serviceAreas, cart.deliveryAddress]);
    const { agents } = useAvailableAgents({ area: filterArea });
    const selectedAgent = useMemo(() => agents.find((a) => a.id === selectedAgentId), [agents, selectedAgentId]);

    const areaOptions = useMemo(() => [
        { value: "", label: t("checkout.selectArea", "Select area...") },
        ...deliverySettings.serviceAreas.filter((a) => a.isActive).map((a) => ({ value: a.value, label: a.value })),
        { value: "__NEW__", label: t("common.addNewRequest", "+ Add New Area") },
    ], [deliverySettings.serviceAreas, t]);
    const agentOptions = useMemo(() => [
        { value: "", label: t("checkout.noAgent", "No agent assigned") },
        ...agents.map((a) => ({ value: a.id, label: `${a.name}${a.isOnline ? " 🟢" : " ⚪"}` })),
        { value: "__NEW__", label: t("common.addNewRequest", "+ Add New Agent") },
    ], [agents, t]);

    const handleAreaChange = (value: string) => {
        if (value === "__NEW__") { navigate("/inventory?tab=service-areas"); return; }
        setSelectedArea(value);
        // New area → clear and let auto-assign pick an agent serving it.
        setSelectedAgentId("");
        setAgentTouched(false);
    };
    const handleAgentChange = (value: string) => {
        if (value === "__NEW__") { navigate("/manage-staff?new=true"); return; }
        setSelectedAgentId(value);
        setAgentTouched(true);
    };

    // Auto-assign a delivery agent once an area is selected, if one serves it.
    // Prefers an online agent; respects a manual override (agentTouched).
    useEffect(() => {
        if (!isHomeType || !canHaveAgents || agentTouched) return;
        if (deliverySettings.serviceAreas?.length > 0 && !selectedArea) return;
        if (selectedAgentId && agents.some((a) => a.id === selectedAgentId)) return;
        if (agents.length > 0) {
            const pick = agents.find((a) => a.isOnline) || agents[0];
            setSelectedAgentId(pick.id);
        }
    }, [agents, selectedArea, isHomeType, canHaveAgents, agentTouched, selectedAgentId, deliverySettings.serviceAreas]);

    // Staff context
    const location = useLocation();
    const isStaffRoute = location.pathname.startsWith("/staff");
    const staffAuth = useStaffAuthOptional();
    const staff = staffAuth?.staff;

    const isNewAddress = cart.deliveryType !== "pickup_store" && cart.deliveryAddress && cart.customerId && !cart.isGuest &&
        !cart.customerAddresses?.some((a) => a.address.toLowerCase().trim() === cart.deliveryAddress?.toLowerCase().trim());
    const isFirstAddress = !cart.customerAddresses || cart.customerAddresses.length === 0;

    // Services grouped by category (owner-app style)
    const categoryGroups = useMemo(() => {
        const map: Record<string, { name: string; subtotal: number; items: typeof cart.items }> = {};
        cart.items.forEach((item) => {
            const key = item.service.categoryId || "other";
            if (!map[key]) map[key] = { name: item.service.categoryName || t("mobile.categoryOther", "Other"), subtotal: 0, items: [] };
            map[key].items.push(item);
            map[key].subtotal += item.total;
        });
        return Object.values(map);
    }, [cart.items, t]);

    const formatDate = (d: Date) =>
        d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

    const handlePlaceOrder = async () => {
        if (isEditMode && editOrderId) {
            setUpdating(true);
            try {
                await updateOrder(editOrderId, {
                    items: cart.items.map((item, index) => ({
                        id: `item-${item.service.id}-${index}`,
                        serviceId: item.service.id,
                        serviceName: item.service.name,
                        categoryId: item.service.categoryId,
                        categoryName: item.service.categoryName,
                        quantity: item.quantity,
                        unit: item.service.pricingType,
                        unitPrice: item.unitPrice,
                        total: item.total,
                        express: item.express,
                        notes: item.notes,
                        damages: item.damages,
                        expressMultiplier: item.service.expressMultiplier,
                    })),
                    financials: {
                        subtotal: cart.subtotal,
                        discountType: cart.discountType,
                        discountValue: cart.discountValue,
                        discountAmount: cart.discountAmount,
                        expressCharge: cart.expressCharge,
                        deliveryCharge: cart.deliveryCharge,
                        taxAmount: cart.taxAmount,
                        taxRate: cart.taxRate,
                        taxName: cart.taxName,
                        total: cart.total,
                        amountPaid,
                    },
                    deliveryType: cart.deliveryType,
                    deliveryAddress: cart.deliveryAddress,
                    deliveryArea: selectedArea,
                    deliveryNotes: cart.deliveryNotes,
                    expectedDelivery: expectedDate,
                    scheduledPickupDate: isHomeType ? scheduledPickupDate : undefined,
                });
                setUpdating(false);
                onComplete(editOrderId);
            } catch (error) {
                console.error("Failed to update order:", error);
                setUpdating(false);
            }
            return;
        }

        // Create new order — upload damage photos first if any
        let finalDamageUrls: string[] | undefined;
        if (damagePhotoMetadata.length > 0) {
            try {
                const finalMeta = await damagePhotoUploaderRef.current?.uploadPendingImages?.();
                finalDamageUrls = finalMeta?.map((m) => m.url).filter(Boolean) as string[] | undefined;
            } catch (e) {
                console.error("Failed to upload damage photos:", e);
            }
        }
        const order = await createOrder({
            customerId: cart.customerId,
            customerName: cart.customerName || "Guest",
            customerPhone: cart.customerPhone || "",
            isGuest: cart.isGuest,
            items: cart.items.map((item, index) => ({
                id: `item-${item.service.id}-${index}`,
                serviceId: item.service.id,
                serviceName: item.service.name,
                categoryId: item.service.categoryId,
                categoryName: item.service.categoryName,
                quantity: item.quantity,
                unit: item.service.pricingType,
                unitPrice: item.unitPrice,
                total: item.total,
                express: item.express,
                notes: item.notes,
                damages: item.damages,
                expressMultiplier: item.service.expressMultiplier,
            })),
            damagePhotoUrls: (finalDamageUrls && finalDamageUrls.length > 0) ? finalDamageUrls : undefined,
            financials: {
                subtotal: cart.subtotal,
                discountType: cart.discountType,
                discountValue: cart.discountValue,
                discountAmount: cart.discountAmount,
                expressCharge: cart.expressCharge,
                deliveryCharge: cart.deliveryCharge,
                taxAmount: cart.taxAmount,
                taxRate: cart.taxRate,
                taxName: cart.taxName,
                total: cart.total,
                amountPaid,
            },
            deliveryType: cart.deliveryType,
            deliveryAddress: cart.deliveryAddress,
            deliveryArea: selectedArea,
            deliveryNotes: cart.deliveryNotes,
            expectedDelivery: expectedDate,
            scheduledPickupDate: isHomeType ? scheduledPickupDate : undefined,
            paymentMethod: "cash",
            staffId: isStaffRoute ? staff?.id : undefined,
            staffName: isStaffRoute ? staff?.name : undefined,
            assignedAgentId: isHomeType ? (selectedAgentId || undefined) : undefined,
            assignedAgentName: isHomeType ? (selectedAgent?.name || undefined) : undefined,
        });

        if (order) {
            if (cart.customerId && cart.deliveryAddress && !cart.isGuest) {
                if (isFirstAddress || (isNewAddress && saveNewAddress)) {
                    await addAddress(cart.customerId, cart.deliveryAddress);
                }
            }
            onComplete(order.id);
        }
    };

    const deliveryTypes: { value: DeliveryType; label: string; Icon: typeof Store; hint: string }[] = [
        { value: "pickup_store", label: t("pos.shopPickup", "Shop Pickup"), Icon: Store, hint: t("checkout.inStore", "In-store") },
        { value: "delivery_home", label: t("pos.homeDelivery", "Home Delivery"), Icon: Truck, hint: t("checkout.toAddress", "To address") },
        { value: "pickup_home", label: t("pos.pickupFromHome", "Pickup from Home"), Icon: Home, hint: t("checkout.fromHome", "From home") },
    ];

    const custRef = tintFor(cart.customerName || cart.customerPhone || "?");
    const custAddress = cart.deliveryAddress || cart.customerAddresses?.find((a) => a.isDefault)?.address || cart.customerAddresses?.[0]?.address || "—";

    return (
        <div className="lb-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", background: "var(--c-bg)", height: "calc(100vh - 56px)" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
                <button onClick={onClose} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "transparent", border: 0, marginBottom: 14 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                    {t("checkout.backToItems", "Back to items")}
                </button>
                <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.01em", marginBottom: 16 }}>
                    {isEditMode ? t("checkout.updateOrderTitle", "Update Order") : t("checkout.checkout", "Checkout")}
                </div>

                <div className="co-grid" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    {/* form */}
                    <div style={{ flex: 1.5, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                        {/* customer */}
                        <div style={card}>
                            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", color: "var(--c-text-3)" }}>{t("checkout.customer", "CUSTOMER")}</span>
                                {!isEditMode && (
                                    <button onClick={onClose} style={{ marginLeft: "auto", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 7, padding: "5px 11px" }}>{t("common.change", "Change")}</button>
                                )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: custAddress !== "—" ? 14 : 0 }}>
                                <span style={{ width: 46, height: 46, flex: "none", borderRadius: 12, background: `var(--${custRef}-soft)`, color: `var(--${custRef})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 600 }}>{(cart.customerName || "G").slice(0, 2).toUpperCase()}</span>
                                <div><div style={{ fontSize: 16, fontWeight: 700 }}>{cart.customerName || t("customer.guest", "Guest")}</div><div style={{ fontSize: 12.5, color: "var(--c-text-3)", fontFamily: MONO }}>{cart.customerPhone || "—"}</div></div>
                            </div>
                            {(custAddress !== "—" || (isHomeType && selectedArea)) && (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                                    {isHomeType && selectedArea && (
                                        <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><span style={{ color: "var(--c-text-3)", marginTop: 1 }}><MapPin size={15} /></span><div><div style={{ fontSize: 10.5, color: "var(--c-text-3)" }}>{t("checkout.serviceArea", "Service area")}</div><div style={{ fontSize: 12.5 }}>{selectedArea}</div></div></div>
                                    )}
                                    {custAddress !== "—" && (
                                        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 9, alignItems: "flex-start" }}><span style={{ color: "var(--c-text-3)", marginTop: 1 }}><Mail size={15} style={{ display: "none" }} /><Home size={15} /></span><div><div style={{ fontSize: 10.5, color: "var(--c-text-3)" }}>{t("checkout.address", "Address")}</div><div style={{ fontSize: 12.5 }}>{custAddress}</div></div></div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* fulfilment */}
                        <div style={card}>
                            <div style={secLbl}>{t("checkout.fulfilment", "FULFILMENT")}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                                {deliveryTypes.map(({ value, label, Icon, hint }) => {
                                    const on = cart.deliveryType === value;
                                    return (
                                        <button key={value} onClick={() => cart.setDelivery(value)} style={{ cursor: "pointer", font: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", borderRadius: 11, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" }}>
                                            <Icon size={20} />
                                            <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: "center" }}>{label}</span>
                                            <span style={{ fontSize: 11, fontFamily: MONO, color: "var(--c-text-3)" }}>{hint}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {/* ready by (turnaround-driven, ± day) */}
                            <div style={{ marginTop: 14 }}>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{cart.deliveryType === "pickup_store" ? t("checkout.expectedReady", "Ready by") : t("checkout.expectedDelivery", "Delivery by")}</label>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--c-border-strong)", borderRadius: 9, padding: "8px 10px", background: "var(--c-surface)" }}>
                                    <Calendar size={16} style={{ color: "var(--c-text-3)" }} />
                                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{formatDate(expectedDate)}</span>
                                    <button type="button" onClick={() => { const d = new Date(expectedDate); d.setDate(d.getDate() - 1); if (d >= new Date(new Date().toDateString())) setExpectedDate(d); }} aria-label="Earlier" style={stepBtn}><Minus size={15} /></button>
                                    <button type="button" onClick={() => { const d = new Date(expectedDate); d.setDate(d.getDate() + 1); setExpectedDate(d); }} aria-label="Later" style={stepBtn}><Plus size={15} /></button>
                                </div>
                            </div>
                            {isHomeType && (
                                <div style={{ marginTop: 14 }}>
                                    <LTextArea
                                        label={cart.deliveryType === "delivery_home" ? t("checkout.deliveryAddress", "Delivery Address") : t("checkout.pickupAddress", "Pickup Address")}
                                        value={cart.deliveryAddress || ""}
                                        onChange={(e) => cart.setDelivery(cart.deliveryType, e.target.value, cart.deliveryNotes, cart.deliveryCharge)}
                                        placeholder={t("checkout.enterFullAddress", "Enter full delivery address…")}
                                        minRows={2}
                                    />
                                </div>
                            )}
                            {isHomeType && deliverySettings.distanceFeeEnabled && (deliverySettings.distanceBands?.length ?? 0) > 0 && (
                                <div style={{ marginTop: 14 }}>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t("checkout.deliveryDistance", "Delivery distance")}</label>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        {(deliverySettings.distanceBands ?? []).map((b) => {
                                            const on = (cart.deliveryBandId || deliverySettings.distanceBands?.[0]?.id) === b.id;
                                            return (
                                                <button key={b.id} type="button" onClick={() => cart.setDeliveryBand(b.id)} style={{ cursor: "pointer", font: "inherit", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border-strong)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" }}>
                                                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{b.label}</span>
                                                    <span style={{ fontSize: 11, fontFamily: MONO }}>{formatAmount(b.fee)}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {isHomeType && deliverySettings.serviceAreas?.length > 0 && (
                                <div style={{ marginTop: 14 }}>
                                    <LSelect label={t("checkout.serviceArea", "Service Area")} value={selectedArea} onChange={handleAreaChange} options={areaOptions} />
                                </div>
                            )}
                            {isHomeType && canHaveAgents && (
                                <div style={{ marginTop: 14 }}>
                                    <LSelect label={t("checkout.assignAgent", "Assign Delivery Agent")} value={selectedAgentId} onChange={handleAgentChange} options={agentOptions} disabled={deliverySettings.serviceAreas?.length > 0 && !selectedArea} />
                                </div>
                            )}
                        </div>

                        {/* payment */}
                        <div style={card}>
                            <div style={secLbl}>{t("checkout.payment", "PAYMENT")}</div>
                            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                                <div><div style={{ fontSize: 13, fontWeight: 600 }}>{t("checkout.collectNow", "Collect payment now")}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{t("checkout.markPaid", "Mark this order as paid")}</div></div>
                                <button role="switch" aria-checked={paymentStatus === "paid"} onClick={() => setPaymentStatus(paymentStatus === "paid" ? "unpaid" : "paid")} aria-label="Collect payment now" style={{ position: "relative", cursor: "pointer", width: 44, height: 25, border: 0, borderRadius: 20, flex: "none", background: paymentStatus === "paid" ? "var(--c-success)" : "var(--c-border-strong)" }}>
                                    <span style={{ position: "absolute", top: 3, left: 3, width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)", transition: "transform .15s", transform: paymentStatus === "paid" ? "translateX(19px)" : "translateX(0)" }} />
                                </button>
                            </label>
                        </div>

                        {/* notes */}
                        <div style={card}>
                            <div style={{ ...secLbl, marginBottom: 12 }}>{t("checkout.orderNotes", "ORDER NOTES")}</div>
                            <textarea value={cart.deliveryNotes || ""} onChange={(e) => cart.setDelivery(cart.deliveryType, cart.deliveryAddress, e.target.value, cart.deliveryCharge)} rows={3}
                                placeholder={t("checkout.notesPlaceholder", "Stain details, folding preference, gate code…")}
                                style={{ width: "100%", font: "inherit", fontSize: 13.5, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 10, padding: "11px 12px", resize: "vertical", outline: "none" }} />
                        </div>

                        {/* damage photos (gated paid feature) */}
                        {shopId && canUploadDamagePhotos && (
                            <div style={card}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: ".05em", color: "var(--c-text-3)" }}><FileText size={14} />{t("checkout.damageStainPhotos", "DAMAGE / STAIN PHOTOS")}</span>
                                    <span style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{t("common.optional", "Optional")}</span>
                                </div>
                                <LSmartImageUploader ref={damagePhotoUploaderRef} folder="damage-photos" shopId={shopId} value={damagePhotoMetadata} onChange={setDamagePhotoMetadata} maxFiles={5} showStats deferUpload />
                            </div>
                        )}
                    </div>

                    {/* summary */}
                    <div style={{ flex: 1, minWidth: 0, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 13, boxShadow: "var(--sh-sm)", position: "sticky", top: 0 }}>
                        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--c-border)", fontSize: 14, fontWeight: 700 }}>{t("checkout.orderSummary", "Order summary")}</div>
                        <div className="lb-scroll" style={{ maxHeight: 440, overflow: "auto", padding: "6px 14px" }}>
                            {categoryGroups.map((group, gi) => {
                                const gRef = tintFor(group.name);
                                return (
                                    <div key={`${group.name}-${gi}`} style={{ padding: "8px 0 4px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 2px 6px" }}>
                                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: `var(--${gRef})` }} />
                                            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--c-text-2)" }}>{group.name}</span>
                                        </div>
                                        {group.items.map((item) => {
                                            const lRef = tintFor(item.service.categoryId || item.service.name);
                                            const qty = isWeightUnit(item.service.pricingType) ? item.quantity.toFixed(1) : item.quantity;
                                            return (
                                                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "7px 2px" }}>
                                                    <span style={{ width: 34, height: 34, flex: "none", borderRadius: 8, overflow: "hidden", background: `var(--${lRef}-soft)`, color: `var(--${lRef})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{item.service.imageUrl ? <img src={item.service.imageUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Shirt size={16} />}</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                            <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getTranslatedItemName(item.service.name)}</span>
                                                            {item.express && <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".03em", color: "var(--c-warning)", background: "var(--c-warning-soft)", padding: "2px 5px", borderRadius: 4, whiteSpace: "nowrap" }}>⚡ EXP</span>}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: "var(--c-text-3)", fontFamily: MONO, marginTop: 1 }}>{qty} × {formatAmount(item.unitPrice)}</div>
                                                    </div>
                                                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13 }}>{formatAmount(item.total)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--c-border)", display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--c-text-2)" }}>{t("pos.subtotal", "Subtotal")}</span><span style={{ fontFamily: MONO }}>{formatAmount(cart.subtotal)}</span></div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ color: "var(--c-text-2)" }}>{t("pos.applyDiscount", "Discount")}</span>
                                <input type="number" min={0} value={cart.discountValue || ""} onChange={(e) => { const v = parseFloat(e.target.value); if (!v || v <= 0) cart.setDiscount(undefined, undefined); else cart.setDiscount("flat", v); }} placeholder="0"
                                    style={{ width: 90, font: "inherit", fontFamily: MONO, fontSize: 13, textAlign: "right", color: "var(--c-success)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 7, padding: "5px 9px", outline: "none" }} />
                            </div>
                            {cart.expressCharge > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--c-warning)" }}><span>{t("checkout.expressSurcharge", "Express surcharge")}</span><span style={{ fontFamily: MONO }}>+{formatAmount(cart.expressCharge)}</span></div>}
                            {cart.taxSettings?.enabled && cart.taxEnabled && cart.taxAmount > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--c-text-2)" }}>{cart.taxName || "VAT"} ({cart.taxRate}%)</span><span style={{ fontFamily: MONO }}>{formatAmount(cart.taxAmount)}</span></div>}
                            {cart.deliveryCharge > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--c-text-2)" }}>{t("pos.deliveryCharge", "Delivery")}</span><span style={{ fontFamily: MONO }}>{formatAmount(cart.deliveryCharge)}</span></div>}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, marginTop: 3, borderTop: "1px solid var(--c-border)" }}><span style={{ fontWeight: 700, fontSize: 15 }}>{t("pos.grandTotal", "Total")}</span><span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 20 }}>{formatAmount(cart.total)}</span></div>
                        </div>
                        <div style={{ padding: "0 18px 18px" }}>
                            <button onClick={handlePlaceOrder} disabled={placing || cart.items.length === 0}
                                style={{ width: "100%", cursor: placing ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 14, boxShadow: "var(--sh-sm)", opacity: placing || cart.items.length === 0 ? 0.6 : 1 }}>
                                {!placing && <Check size={18} />}
                                {placing ? t("common.loading", "Please wait…") : (isEditMode ? t("checkout.updateOrder", "Update order") : t("checkout.placeOrder", "Place order"))}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const stepBtn: CSSProperties = { cursor: "pointer", width: 30, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 7 };
