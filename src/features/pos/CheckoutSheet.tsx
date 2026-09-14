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
    LSmartImageUploader,
    type LSmartImageUploaderRef,
} from "@/components/laundry";
import { useAuth } from "@/features/auth";
import { useCart } from "./useCart";
import { useCurrency } from "@/hooks/use-currency";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ImageMetadata } from "@/types/image-upload";
import type { DeliveryType } from "@/types/order";
import { useInventory } from "@/hooks/use-inventory";
import { useCreateOrder, useOrderMutations, useOrder } from "@/hooks/use-orders";
import { useCustomers, useCustomer } from "@/hooks/use-customers";
import { useShop } from "@/hooks/use-shop";
import { useCartShopOverride } from "@/features/pos/CartShopOverrideContext";
import type { PublicCoupon } from "@/types/shop";
import { useAvailableAgents } from "@/hooks/use-available-agents";
import { Timestamp } from "firebase/firestore";
import { addDays, format } from "date-fns";
import { Store, Truck, Home, FileText, Check, Shirt, MapPin, Phone, CalendarDays, ChevronDown, ArrowLeft, ScanLine, Settings, Banknote, Smartphone, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTranslatedItemName, getTranslatedCategoryName, isWeightUnit } from "@/lib/inventory-translations";
import { useStaffAuthOptional } from "@/features/staff-app/StaffAuthContext";
import { useDriverAuthOptional } from "@/features/driver-app/DriverAuthContext";
import { useDeliverySettings } from "@/hooks/use-delivery-settings";
import { useShopLimits } from "@/hooks/use-shop-limits";

const card: CSSProperties = { background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, padding: "20px 22px", boxShadow: "0 1px 2px rgba(16,24,40,.04)" };
const cardTitle: CSSProperties = { fontSize: 17, fontWeight: 600, letterSpacing: "-.01em", marginBottom: 18 };

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
    const { formatAmount, currencySymbol } = useCurrency();
    const { shopId } = useAuth();
    const { allCategories } = useInventory();
    const isMobile = useIsMobile();

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
    useEffect(() => {
        setExpectedDate(minExpectedDate);
    }, [minExpectedDate]);

    // Pickup date + pickup/delivery time slots (required for home orders).
    const [pickupDateStr, setPickupDateStr] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
    const [pickupSlot, setPickupSlot] = useState<string>("");
    const [deliverySlot, setDeliverySlot] = useState<string>("");
    const [slotError, setSlotError] = useState<string | null>(null);
    // Parse YYYY-MM-DD as a LOCAL date (new Date("YYYY-MM-DD") is UTC midnight).
    const scheduledPickupDate = useMemo(() => {
        const [y, m, d] = pickupDateStr.split("-").map(Number);
        return y && m && d ? new Date(y, m - 1, d) : new Date();
    }, [pickupDateStr]);

    // Payment: Full / Partial / Pay later + method (Cash · UPI · Card).
    const [payMode, setPayMode] = useState<"full" | "partial" | "later">("later");
    const [payNowStr, setPayNowStr] = useState("");
    const [payMethod, setPayMethod] = useState<"cash" | "upi" | "card">("cash");
    const [payError, setPayError] = useState<string | null>(null);
    useEffect(() => { setPayError(null); }, [payMode, payNowStr]);
    const [addressEditing, setAddressEditing] = useState(false);
    const [discountMode, setDiscountMode] = useState<"percent" | "flat">(cart.discountType === "flat" ? "flat" : "percent");
    const payNow = Math.min(cart.total, Math.max(0, parseFloat(payNowStr) || 0));
    const newAmountPaid = payMode === "full" ? cart.total : payMode === "partial" ? payNow : 0;

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

    // Active time-slot options (shop-configured; defaults exist for every shop).
    const pickupSlotOptions = useMemo(() => (deliverySettings.pickupTimeSlots || []).filter((s) => s.isActive), [deliverySettings.pickupTimeSlots]);
    const deliverySlotOptions = useMemo(() => (deliverySettings.deliveryTimeSlots || []).filter((s) => s.isActive), [deliverySettings.deliveryTimeSlots]);
    const needsPickupSlot = cart.deliveryType === "pickup_home" && pickupSlotOptions.length > 0;
    const needsDeliverySlot = isHomeType && deliverySlotOptions.length > 0;

    // Edit mode: prefill pickup date + slots from the existing order.
    const { order: editingOrder } = useOrder(editOrderId || "");
    const amountPaid = newAmountPaid;
    const payPrefilled = useRef(false);
    useEffect(() => {
        if (!isEditMode || !editingOrder || payPrefilled.current) return;
        payPrefilled.current = true;
        const paid = editingOrder.financials?.amountPaid || 0;
        const total = editingOrder.financials?.total || 0;
        if (paid > 0 && paid >= total) setPayMode("full");
        else if (paid > 0) { setPayMode("partial"); setPayNowStr(String(paid)); }
        else setPayMode("later");
        const m = editingOrder.paymentMethod;
        if (m === "cash" || m === "upi" || m === "card") setPayMethod(m);
    }, [isEditMode, editingOrder]);
    const slotsPrefilled = useRef(false);
    useEffect(() => {
        if (!isEditMode || !editingOrder || slotsPrefilled.current) return;
        slotsPrefilled.current = true;
        if (editingOrder.scheduledPickupDate?.toDate) setPickupDateStr(format(editingOrder.scheduledPickupDate.toDate(), "yyyy-MM-dd"));
        if (editingOrder.scheduledPickupTime) setPickupSlot(editingOrder.scheduledPickupTime);
        if (editingOrder.deliverySlot) setDeliverySlot(editingOrder.deliverySlot);
    }, [isEditMode, editingOrder]);

    // Selecting slots clears the inline error.
    useEffect(() => { setSlotError(null); }, [pickupSlot, deliverySlot, cart.deliveryType]);

    const { hasFeature, checkLimit, loading: limitsLoading } = useShopLimits();
    const canUploadDamagePhotos = hasFeature("damagePhotos");

    // ── Offers (coupon codes) + loyalty points (Pro+/Business) ──
    const overrideShop = useCartShopOverride();
    const { shop: authShop } = useShop();
    const posShop = overrideShop ?? authShop;
    const canOffers = hasFeature("offers");
    const loyaltyCfg = posShop?.settings?.loyalty;
    const canLoyalty = hasFeature("loyalty") && !!loyaltyCfg?.enabled;
    const [couponInput, setCouponInput] = useState("");
    const [couponError, setCouponError] = useState<string | null>(null);
    const { customer: posCustomer } = useCustomer(cart.customerId || "");
    const pointsBalance = Math.max(0, Math.round(posCustomer?.loyaltyPoints || 0));
    // Redeem cap: customer's balance, limited to maxRedeemPercent of the pre-points payable.
    const prePointsPayable = cart.total + (cart.pointsRedeemed || 0);
    const redeemCap = Math.min(
        pointsBalance,
        Math.floor((prePointsPayable * Math.min(100, Math.max(1, loyaltyCfg?.maxRedeemPercent || 100))) / 100)
    );

    const applyCouponCode = () => {
        const code = couponInput.trim().toUpperCase();
        if (!code) return;
        const coupons: PublicCoupon[] = posShop?.settings?.publicCoupons ?? [];
        const coupon = coupons.find((c) => c.code?.toUpperCase() === code);
        if (!coupon) { setCouponError(t("pos.couponNotFound", "Coupon not found")); return; }
        if (coupon.active === false) { setCouponError(t("pos.couponInactive", "This coupon is paused")); return; }
        if (coupon.startsAt && new Date(coupon.startsAt + "T00:00:00") > new Date()) {
            setCouponError(t("pos.couponNotStarted", "This coupon starts on {{d}}", { d: coupon.startsAt })); return;
        }
        if (coupon.expiresAt && new Date(coupon.expiresAt + "T23:59:59") < new Date()) {
            setCouponError(t("pos.couponExpired", "This coupon has expired")); return;
        }
        if (coupon.minOrder && coupon.minOrder > 0 && cart.subtotal < coupon.minOrder) {
            setCouponError(t("pos.couponMinOrder", "Minimum order {{amt}} required", { amt: formatAmount(coupon.minOrder) })); return;
        }
        setCouponError(null);
        cart.applyCoupon(coupon.code, coupon.type, coupon.value);
        setCouponInput("");
    };
    const agentLimit = checkLimit("maxDeliveryAgents", 0).limit;
    const canHaveAgents = !limitsLoading && (agentLimit === -1 || (typeof agentLimit === "number" && agentLimit > 0));

    // Auto-select a service area — only for home pickup / delivery. (Doing it for
    // shop pickup too made this effect and the "clear when not home" effect below
    // undo each other every render, so the area kept flickering.) Prefer the
    // customer's own area when it is one of the shop's service areas.
    useEffect(() => {
        if (!isHomeType || selectedArea || !(deliverySettings.serviceAreas?.length > 0)) return;
        const active = deliverySettings.serviceAreas.filter((a) => a.isActive);
        const own = posCustomer?.area && active.find((a) => a.value.toLowerCase() === String(posCustomer.area).toLowerCase());
        const pick = own || active[0];
        if (pick) setSelectedArea(pick.value);
    }, [deliverySettings.serviceAreas, selectedArea, isHomeType, posCustomer?.area]);

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

    // Staff / agent context (this sheet is reused by the staff app and the agent portal).
    const location = useLocation();
    const isStaffRoute = location.pathname.startsWith("/staff");
    const isAgentRoute = location.pathname.startsWith("/agent");
    const staffAuth = useStaffAuthOptional();
    const staff = staffAuth?.staff;
    const driverAuth = useDriverAuthOptional();
    const agent = driverAuth?.agent;

    const isNewAddress = cart.deliveryType !== "pickup_store" && cart.deliveryAddress && cart.customerId && !cart.isGuest &&
        !cart.customerAddresses?.some((a) => a.address.toLowerCase().trim() === cart.deliveryAddress?.toLowerCase().trim());
    const isFirstAddress = !cart.customerAddresses || cart.customerAddresses.length === 0;



    const handlePlaceOrder = async () => {
        if (payMode === "partial" && (payNow <= 0 || payNow >= cart.total)) {
            setPayError(t("checkout.partialInvalid", "Enter an amount between 0 and the total"));
            return;
        }
        // Home orders must carry their pickup/delivery scheduling info.
        if (needsPickupSlot && !pickupSlot) {
            setSlotError(t("checkout.pickupSlotRequired", "Please select a pickup time slot"));
            return;
        }
        if (needsDeliverySlot && !deliverySlot) {
            setSlotError(t("checkout.deliverySlotRequired", "Please select a delivery time slot"));
            return;
        }
        if (cart.deliveryType === "pickup_home" && !pickupDateStr) {
            setSlotError(t("checkout.pickupDateRequired", "Please select a pickup date"));
            return;
        }

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
                        ...(item.pieceCount ? { pieceCount: item.pieceCount } : {}),
                        notes: item.notes,
                        damages: item.damages,
                        expressMultiplier: item.service.expressMultiplier,
                    })),
                    financials: {
                        subtotal: cart.subtotal,
                        discountType: cart.discountType,
                        discountValue: cart.discountValue,
                        discountAmount: cart.discountAmount,
                        couponCode: cart.couponCode || null,
                        expressCharge: cart.expressCharge,
                        deliveryCharge: cart.deliveryCharge,
                        taxAmount: cart.taxAmount,
                        taxRate: cart.taxRate,
                        taxName: cart.taxName,
                        total: cart.total,
                        // Until the order's collected amount has been loaded into the
                        // payment card, keep what is stored instead of zeroing it.
                        amountPaid: payPrefilled.current ? amountPaid : (editingOrder?.financials?.amountPaid ?? 0),
                    },
                    deliveryType: cart.deliveryType,
                    deliveryAddress: cart.deliveryAddress,
                    deliveryArea: selectedArea,
                    deliveryNotes: cart.deliveryNotes,
                    expectedDelivery: expectedDate,
                    scheduledPickupDate: cart.deliveryType === "pickup_home" ? scheduledPickupDate : undefined,
                    pickupSlot: cart.deliveryType === "pickup_home" ? pickupSlot : "",
                    deliverySlot: isHomeType ? deliverySlot : "",
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
            customerEmail: cart.customerEmail || null,
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
                ...(item.pieceCount ? { pieceCount: item.pieceCount } : {}),
                notes: item.notes,
                damages: item.damages,
                expressMultiplier: item.service.expressMultiplier,
            })),
            damagePhotoUrls: (finalDamageUrls && finalDamageUrls.length > 0) ? finalDamageUrls : undefined,
            photoMeta: (finalDamageUrls && finalDamageUrls.length > 0)
                ? finalDamageUrls.map((url) => ({
                    url,
                    byName: isAgentRoute ? (agent?.name || "Agent") : isStaffRoute ? (staff?.name || "Staff") : (posShop?.name || "Owner"),
                    byRole: isAgentRoute ? "agent" : isStaffRoute ? "staff" : "owner",
                    at: Timestamp.now(),
                }))
                : undefined,
            financials: {
                subtotal: cart.subtotal,
                discountType: cart.discountType,
                discountValue: cart.discountValue,
                discountAmount: cart.discountAmount,
                couponCode: cart.couponCode || null,
                pointsRedeemed: cart.pointsRedeemed || 0,
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
            scheduledPickupDate: cart.deliveryType === "pickup_home" ? scheduledPickupDate : undefined,
            pickupSlot: cart.deliveryType === "pickup_home" ? (pickupSlot || undefined) : undefined,
            deliverySlot: isHomeType ? (deliverySlot || undefined) : undefined,
            paymentMethod: amountPaid > 0 ? payMethod : "cash",
            staffId: isAgentRoute ? agent?.id : (isStaffRoute ? staff?.id : undefined),
            staffName: isAgentRoute ? agent?.name : (isStaffRoute ? staff?.name : undefined),
            // An agent who creates the order is the assigned agent (auto-assign to self).
            assignedAgentId: isAgentRoute ? (agent?.id || undefined) : (isHomeType ? (selectedAgentId || undefined) : undefined),
            assignedAgentName: isAgentRoute ? (agent?.name || undefined) : (isHomeType ? (selectedAgent?.name || undefined) : undefined),
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
        { value: "pickup_store", label: t("checkout.shopPickup", "Shop pickup"), Icon: Store, hint: t("checkout.youPickUp", "You'll pick up") },
        { value: "pickup_home", label: t("checkout.homePickup", "Home pickup"), Icon: Truck, hint: t("checkout.wePickUp", "We'll pick up") },
        { value: "delivery_home", label: t("checkout.homeDeliveryShort", "Home delivery"), Icon: Home, hint: t("checkout.weDeliver", "We'll deliver") },
    ];

    const custAddress = cart.deliveryAddress || cart.customerAddresses?.find((a) => a.isDefault)?.address || cart.customerAddresses?.[0]?.address || "";
    const custArea = posCustomer?.area || custAddress;
    const balanceDue = Math.max(0, cart.total - amountPaid);
    const expectedStr = format(expectedDate, "yyyy-MM-dd");
    const setExpectedFromStr = (v: string) => {
        const [y, m, d] = v.split("-").map(Number);
        if (y && m && d) setExpectedDate(new Date(y, m - 1, d));
    };

    /** Bordered date box with an invisible native picker on top — opens the OS calendar. */
    const DateBox = ({ label, value, onChange, min }: { label: string; value: string; onChange: (v: string) => void; min?: string }) => {
        const [y, m, d] = value.split("-").map(Number);
        const shown = y && m && d ? format(new Date(y, m - 1, d), "EEE d MMM") : "—";
        return (
            <label style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", border: "1px solid var(--ds-border)", borderRadius: 12, background: "var(--ds-card)", cursor: "pointer" }}>
                <CalendarDays size={20} style={{ color: "var(--ds-text-2)", flex: "none" }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ds-text-2)" }}>{label}</span>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 600, marginTop: 1 }}>{shown}</span>
                </span>
                <ChevronDown size={18} style={{ color: "var(--ds-text-2)" }} />
                <input type="date" value={value} min={min} onChange={(e) => onChange(e.target.value)} aria-label={label}
                    onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* unsupported */ } }}
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
            </label>
        );
    };

    const SlotChips = ({ label, options, value, onChange }: { label: string; options: { value: string }[]; value: string; onChange: (v: string) => void }) => (
        <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-text-2)", marginBottom: 10 }}>{label}</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {options.map((o) => {
                    const on = value === o.value;
                    return (
                        <button key={o.value} type="button" onClick={() => onChange(o.value)}
                            style={{ cursor: "pointer", font: "inherit", fontSize: 14.5, fontWeight: 600, minWidth: 104, padding: "10px 20px", borderRadius: 10, border: `1px solid ${on ? "var(--ds-blue)" : "var(--ds-border)"}`, background: on ? "var(--ds-blue)" : "var(--ds-card)", color: on ? "#fff" : "var(--ds-text)" }}>{o.value}</button>
                    );
                })}
            </div>
        </div>
    );

    const fieldLbl: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--ds-text-2)", marginBottom: 8 };
    const selectStyle: CSSProperties = { width: "100%", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12, padding: "12px 14px", outline: "none", cursor: "pointer" };

    const methodTiles: { id: "cash" | "upi" | "card"; label: string; icon: React.ReactNode }[] = [
        { id: "cash", label: t("checkout.cash", "Cash"), icon: <Banknote size={22} style={{ color: "var(--ds-tile-green)" }} /> },
        { id: "upi", label: "UPI", icon: <Smartphone size={20} style={{ color: "var(--ds-tile-orange)" }} /> },
        { id: "card", label: t("checkout.card", "Card"), icon: <CreditCard size={20} style={{ color: "var(--ds-text-2)" }} /> },
    ];

    return (
        <div className="lb-ds" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--ds-bg)", height: "calc(100vh - 56px)" }}>
            {/* header — back · title · step indicator · scan + settings */}
            <header style={{ flex: "none", display: "flex", alignItems: "center", gap: 16, padding: isMobile ? "12px 14px" : "14px 22px", background: "var(--ds-card)", borderBottom: "1px solid var(--ds-border)" }}>
                <button onClick={onClose} aria-label={t("checkout.backToItems", "Back to items")} style={{ cursor: "pointer", width: 42, height: 42, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 11 }}><ArrowLeft size={19} /></button>
                <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>{isEditMode ? t("checkout.updateOrderTitle", "Update order") : t("checkout.reviewOrder", "Review order")}</span>
                {!isMobile && (
                    <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
                        {[
                            { n: 1, label: t("checkout.stepItems", "Items"), state: "done" },
                            { n: 2, label: t("checkout.stepReview", "Review"), state: "current" },
                            { n: 3, label: t("checkout.stepDone", "Done"), state: "todo" },
                        ].map((st, i) => (
                            <div key={st.n} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                {i > 0 && <span style={{ width: 28, height: 1, background: "var(--ds-border)" }} />}
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ width: 34, height: 34, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, background: st.state === "current" ? "var(--ds-blue)" : "var(--ds-card)", color: st.state === "current" ? "#fff" : "var(--ds-text)", border: `1px solid ${st.state === "current" ? "var(--ds-blue)" : "var(--ds-border)"}` }}>{st.n}</span>
                                    <span style={{ fontSize: 15, fontWeight: 600, color: st.state === "current" ? "var(--ds-blue)" : "var(--ds-text)" }}>{st.label}</span>
                                    {st.state === "done" && <Check size={17} strokeWidth={2.6} style={{ color: "var(--ds-tile-green)" }} />}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
                {isMobile && <div style={{ flex: 1 }} />}
                {!isMobile && (
                    <>
                        <button onClick={() => navigate(isStaffRoute ? "/staff/scan" : "/scan")} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 10, fontSize: 14.5, fontWeight: 600, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12, padding: "10px 16px" }}>
                            <ScanLine size={18} />{t("pos.scanTag", "Scan a tag")}
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ds-text-3)", background: "var(--ds-table-head)", border: "1px solid var(--ds-border)", borderRadius: 6, padding: "1px 6px" }}>F3</span>
                        </button>
                        <button onClick={() => navigate("/settings")} aria-label={t("common.settings", "Settings")} style={{ cursor: "pointer", width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text-2)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12 }}><Settings size={19} /></button>
                    </>
                )}
            </header>

            <div className="lb-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                <div style={{ padding: isMobile ? "16px 14px calc(92px + env(safe-area-inset-bottom, 0px))" : "18px 22px 28px", display: "flex", flexDirection: isMobile ? "column" : "row", gap: 18, alignItems: isMobile ? "stretch" : "flex-start" }}>
                    {/* LEFT */}
                    <div style={{ flex: 1.45, minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
                        {/* customer */}
                        <div style={card}>
                            <div style={cardTitle}>{t("checkout.customerTitle", "Customer")}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                <span style={{ width: 52, height: 52, flex: "none", borderRadius: "50%", background: "var(--ds-blue-soft)", color: "var(--ds-blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 600 }}>{(cart.customerName || "G").trim()[0]?.toUpperCase()}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 17, fontWeight: 600 }}>{cart.customerName || t("customer.guest", "Guest")}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 6, fontSize: 13.5, color: "var(--ds-text)" }}>
                                        {(cart.customerPhone || cart.customerEmail) && <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Phone size={15} style={{ color: "var(--ds-text-2)" }} />{cart.customerPhone || cart.customerEmail}</span>}
                                        {custArea && <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><MapPin size={15} style={{ color: "var(--ds-text-2)" }} />{custArea}</span>}
                                    </div>
                                </div>
                                {!isEditMode && (
                                    <button onClick={onClose} style={{ flex: "none", cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "10px 36px" }}>{t("common.change", "Change")}</button>
                                )}
                            </div>
                        </div>

                        {/* order type + scheduling */}
                        <div style={card}>
                            <div style={cardTitle}>{t("checkout.orderType", "Order type")}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
                                {deliveryTypes.map(({ value, label, Icon, hint }) => {
                                    const on = cart.deliveryType === value;
                                    return (
                                        <button key={value} type="button" onClick={() => cart.setDelivery(value)}
                                            style={{ cursor: "pointer", font: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "18px 8px 16px", borderRadius: 12, border: `${on ? 2 : 1}px solid ${on ? "var(--ds-blue)" : "var(--ds-border)"}`, background: "var(--ds-card)", margin: on ? 0 : 1 }}>
                                            <Icon size={26} strokeWidth={1.7} style={{ color: on ? "var(--ds-blue)" : "var(--ds-text-2)" }} />
                                            <span style={{ fontSize: 15, fontWeight: 600, marginTop: 4, color: on ? "var(--ds-blue)" : "var(--ds-text)" }}>{label}</span>
                                            <span style={{ fontSize: 13, color: "var(--ds-text-2)" }}>{hint}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 26 }}>
                                {/* pickup scheduling (Home pickup) */}
                                {cart.deliveryType === "pickup_home" && (
                                    <>
                                        <DateBox label={t("checkout.pickupDate", "Pickup date")} value={pickupDateStr} min={format(new Date(), "yyyy-MM-dd")} onChange={setPickupDateStr} />
                                        {pickupSlotOptions.length > 0 && <SlotChips label={t("checkout.pickupSlot", "Pickup slot")} options={pickupSlotOptions} value={pickupSlot} onChange={setPickupSlot} />}
                                    </>
                                )}

                                {/* delivery / ready date */}
                                {isHomeType ? (
                                    <DateBox label={t("checkout.deliveryDate", "Delivery date")} value={expectedStr} min={format(new Date(), "yyyy-MM-dd")} onChange={setExpectedFromStr} />
                                ) : (
                                    <DateBox label={t("checkout.expectedReadyLbl", "Expected ready")} value={expectedStr} min={format(new Date(), "yyyy-MM-dd")} onChange={setExpectedFromStr} />
                                )}
                                {isHomeType && deliverySlotOptions.length > 0 && (
                                    <SlotChips label={t("checkout.deliverySlot", "Delivery slot")} options={deliverySlotOptions} value={deliverySlot} onChange={setDeliverySlot} />
                                )}

                                {/* address */}
                                {isHomeType && (
                                    addressEditing || !cart.deliveryAddress ? (
                                        <div>
                                            <label style={fieldLbl}>{cart.deliveryType === "delivery_home" ? t("checkout.deliveryAddressLbl", "Delivery address") : t("checkout.pickupAddressLbl", "Pickup address")}</label>
                                            <textarea autoFocus={addressEditing} value={cart.deliveryAddress || ""} rows={2}
                                                onChange={(e) => cart.setDelivery(cart.deliveryType, e.target.value, cart.deliveryNotes, cart.deliveryCharge)}
                                                onBlur={() => { if (cart.deliveryAddress) setAddressEditing(false); }}
                                                placeholder={t("checkout.enterFullAddress", "Enter full delivery address…")}
                                                style={{ width: "100%", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12, padding: "12px 14px", resize: "vertical", outline: "none" }} />
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", border: "1px solid var(--ds-border)", borderRadius: 12 }}>
                                            <MapPin size={20} style={{ color: "var(--ds-text-2)", flex: "none" }} />
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ds-text-2)" }}>{cart.deliveryType === "delivery_home" ? t("checkout.deliveryAddressLbl", "Delivery address") : t("checkout.pickupAddressLbl", "Pickup address")}</span>
                                                <span style={{ display: "block", fontSize: 14.5, marginTop: 2 }}>{cart.deliveryAddress}</span>
                                            </span>
                                            <button type="button" onClick={() => setAddressEditing(true)} style={{ cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--ds-blue)", background: "transparent", border: 0 }}>{t("common.edit", "Edit")}</button>
                                        </div>
                                    )
                                )}

                                {/* distance bands */}
                                {isHomeType && deliverySettings.distanceFeeEnabled && (deliverySettings.distanceBands?.length ?? 0) > 0 && (
                                    <div>
                                        <div style={fieldLbl}>{t("checkout.deliveryDistance", "Delivery distance")}</div>
                                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                            {(deliverySettings.distanceBands ?? []).map((b) => {
                                                const on = (cart.deliveryBandId || deliverySettings.distanceBands?.[0]?.id) === b.id;
                                                return (
                                                    <button key={b.id} type="button" onClick={() => cart.setDeliveryBand(b.id)}
                                                        style={{ cursor: "pointer", font: "inherit", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "9px 16px", borderRadius: 10, border: `1px solid ${on ? "var(--ds-blue)" : "var(--ds-border)"}`, background: on ? "var(--ds-blue-soft)" : "var(--ds-card)", color: on ? "var(--ds-blue)" : "var(--ds-text)" }}>
                                                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{b.label}</span>
                                                        <span style={{ fontSize: 12.5, color: "var(--ds-text-2)" }}>{formatAmount(b.fee)}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* service area + agent */}
                                {isHomeType && (deliverySettings.serviceAreas?.length > 0 || canHaveAgents) && (
                                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                                        {deliverySettings.serviceAreas?.length > 0 && (
                                            <div>
                                                <label style={fieldLbl}>{t("checkout.serviceArea", "Service area")}</label>
                                                <select value={selectedArea} onChange={(e) => handleAreaChange(e.target.value)} style={selectStyle}>
                                                    {areaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        {canHaveAgents && (
                                            <div>
                                                <label style={fieldLbl}>{t("checkout.assignedAgent", "Assigned agent")}</label>
                                                <select value={selectedAgentId} onChange={(e) => handleAgentChange(e.target.value)} disabled={deliverySettings.serviceAreas?.length > 0 && !selectedArea} style={selectStyle}>
                                                    {agentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {slotError && <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--ds-negative)" }}>{slotError}</p>}

                                {/* notes */}
                                <div>
                                    <label style={fieldLbl}>{t("checkout.notesOptional", "Notes for this order (optional)")}</label>
                                    <textarea value={cart.deliveryNotes || ""} maxLength={200} rows={4}
                                        onChange={(e) => cart.setDelivery(cart.deliveryType, cart.deliveryAddress, e.target.value, cart.deliveryCharge)}
                                        placeholder={t("checkout.notesPlaceholder2", "Stain details, folding preference, gate code…")}
                                        style={{ width: "100%", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12, padding: "13px 14px", resize: "vertical", outline: "none" }} />
                                    <div style={{ textAlign: "right", fontSize: 13, color: "var(--ds-text-2)", marginTop: 6 }}>{(cart.deliveryNotes || "").length} / 200</div>
                                </div>
                            </div>
                        </div>

                        {/* damage photos (gated paid feature) */}
                        {shopId && canUploadDamagePhotos && (
                            <div style={card}>
                                <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                                    <span style={{ ...cardTitle, marginBottom: 0, display: "inline-flex", alignItems: "center", gap: 8 }}><FileText size={17} />{t("checkout.damagePhotosTitle", "Damage / stain photos")}</span>
                                    <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--ds-text-2)" }}>{t("common.optional", "Optional")}</span>
                                </div>
                                <LSmartImageUploader ref={damagePhotoUploaderRef} folder="damage-photos" shopId={shopId} value={damagePhotoMetadata} onChange={setDamagePhotoMetadata} maxFiles={5} showStats deferUpload />
                            </div>
                        )}
                    </div>

                    {/* RIGHT */}
                    <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : undefined, display: "flex", flexDirection: "column", gap: 18, position: isMobile ? "static" : "sticky", top: 0 }}>
                        {/* order summary */}
                        <div style={card}>
                            <div style={cardTitle}>{t("checkout.orderSummary", "Order summary")}</div>
                            <div>
                                {(() => {
                        const groups: { key: string; name: string; lines: typeof cart.items }[] = [];
                        cart.items.forEach((x) => {
                            const key = x.service.categoryId || x.service.categoryName || "other";
                            let g = groups.find((y) => y.key === key);
                            if (!g) { g = { key, name: getTranslatedCategoryName(x.service.categoryName || t("pos.otherCategory", "Other"), x.service.categoryId), lines: [] }; groups.push(g); }
                            g.lines.push(x);
                        });
                        return groups;
                    })().map((grp) => (
                                <div key={grp.key}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, padding: "7px 12px", background: "var(--ds-table-head)", border: "1px solid var(--ds-divider)", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                                        <span>{grp.name}</span>
                                        <span style={{ marginLeft: "auto", fontWeight: 500, color: "var(--ds-text-2)" }}>{formatAmount(grp.lines.reduce((sum, x) => sum + x.total, 0))}</span>
                                    </div>
                                {grp.lines.map((item, i) => {
                                    const isKg = isWeightUnit(item.service.pricingType);
                                    const meta = isKg
                                        ? `${item.quantity} ${t("pos.kg", "kg")}${item.pieceCount ? `  ·  ${item.pieceCount} ${t("orders.pieces", "pcs")}` : ""}`
                                        : `× ${item.quantity}`;
                                    return (
                                        <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "12px 0", borderTop: i ? "1px solid var(--ds-divider)" : undefined }}>
                                            <span style={{ width: 42, height: 42, flex: "none", borderRadius: 11, overflow: "hidden", background: "var(--ds-blue-soft)", color: "var(--ds-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                {item.service.imageUrl ? <img src={item.service.imageUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Shirt size={20} strokeWidth={1.7} />}
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getTranslatedItemName(item.service.name, item.service.localizedNames)}</div>
                                                <div style={{ fontSize: 13.5, color: "var(--ds-text-2)", marginTop: 4 }}>{meta}{item.express ? `  ·  ${t("pos.expressLabel", "Express")}` : ""}</div>
                                                {item.notes && <div style={{ fontSize: 13.5, color: "var(--ds-text-2)", fontStyle: "italic", marginTop: 6 }}>{item.notes}</div>}
                                            </div>
                                            <span style={{ fontSize: 15, flex: "none" }}>{formatAmount(item.total)}</span>
                                        </div>
                                    );
                                })}
                                </div>
                                ))}
                            </div>

                            {/* discount */}
                            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "14px 0 18px", borderTop: "1px solid var(--ds-divider)", borderBottom: "1px solid var(--ds-divider)" }}>
                                <span style={{ fontSize: 14.5, color: "var(--ds-text-2)", width: 64, flex: "none" }}>{t("pos.discount", "Discount")}</span>
                                {cart.couponCode ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ds-positive)", background: "var(--ds-st-ready-bg)", padding: "5px 11px", borderRadius: 7 }}>{cart.couponCode} · −{formatAmount(cart.discountAmount)}</span>
                                        <button type="button" onClick={() => cart.removeCoupon()} aria-label="Remove coupon" style={{ cursor: "pointer", border: 0, background: "transparent", color: "var(--ds-text-3)", fontSize: 18, lineHeight: 1 }}>×</button>
                                    </span>
                                ) : (
                                    <div style={{ flex: 1, display: "flex", alignItems: "center", border: "1px solid var(--ds-border)", borderRadius: 11, overflow: "hidden" }}>
                                        <input type="number" min={0} value={cart.discountValue || ""} placeholder={t("checkout.enterDiscount", "Enter discount")}
                                            onChange={(e) => { const v = parseFloat(e.target.value); if (!v || v <= 0) cart.setDiscount(undefined, undefined); else cart.setDiscount(discountMode, discountMode === "percent" ? Math.min(100, v) : v); }}
                                            style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "transparent", border: 0, padding: "11px 13px", outline: "none" }} />
                                        <span style={{ display: "flex", gap: 4, padding: 4, borderLeft: "1px solid var(--ds-border)" }}>
                                            {(["percent", "flat"] as const).map((m) => (
                                                <button key={m} type="button" onClick={() => { setDiscountMode(m); if (cart.discountValue) cart.setDiscount(m, m === "percent" ? Math.min(100, cart.discountValue) : cart.discountValue); }}
                                                    style={{ cursor: "pointer", font: "inherit", width: 40, height: 34, fontSize: 14.5, fontWeight: 600, borderRadius: 8, border: `1px solid ${discountMode === m ? "var(--ds-blue)" : "transparent"}`, background: discountMode === m ? "var(--ds-blue-soft)" : "transparent", color: discountMode === m ? "var(--ds-blue)" : "var(--ds-text)" }}>
                                                    {m === "percent" ? "%" : currencySymbol}
                                                </button>
                                            ))}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* coupon (offers) */}
                            {canOffers && !cart.couponCode && (posShop?.settings?.publicCoupons?.length || 0) > 0 && (
                                <div style={{ padding: "12px 0", borderBottom: "1px solid var(--ds-divider)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                                        <span style={{ fontSize: 14.5, color: "var(--ds-text-2)", width: 64, flex: "none" }}>{t("pos.coupon", "Coupon")}</span>
                                        <input value={couponInput} onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }} placeholder="SAVE10"
                                            style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 14, textTransform: "uppercase", border: "1px solid var(--ds-border)", borderRadius: 11, padding: "10px 13px", outline: "none" }} />
                                        <button type="button" onClick={applyCouponCode} disabled={!couponInput.trim()}
                                            style={{ cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "10px 16px", opacity: couponInput.trim() ? 1 : 0.5 }}>{t("pos.applyCoupon", "Apply")}</button>
                                    </div>
                                    {couponError && <div style={{ textAlign: "right", fontSize: 12.5, color: "var(--ds-negative)", marginTop: 5 }}>{couponError}</div>}
                                </div>
                            )}

                            {/* loyalty */}
                            {canLoyalty && !isEditMode && cart.customerId && !cart.isGuest && pointsBalance > 0 && (
                                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--ds-divider)", fontSize: 14 }}>
                                    <span style={{ color: "var(--ds-text-2)" }}>{t("pos.redeemPoints", "Redeem points")} <span style={{ fontSize: 12.5, color: "var(--ds-text-3)" }}>· {t("pos.pointsBalance", "{{n}} available", { n: pointsBalance })}</span></span>
                                    <input type="number" min={0} max={redeemCap} value={cart.pointsRedeemed || ""} placeholder="0"
                                        onChange={(e) => { const v = Math.floor(Number(e.target.value) || 0); cart.setPointsRedeemed(Math.min(redeemCap, Math.max(0, v))); }}
                                        style={{ marginLeft: "auto", width: 96, font: "inherit", fontSize: 14, textAlign: "right", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "8px 11px", outline: "none" }} />
                                </div>
                            )}

                            {/* totals */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 13, fontSize: 14.5, padding: "18px 0 0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ds-text-2)" }}>{t("pos.subtotal", "Subtotal")}</span><span>{formatAmount(cart.subtotal)}</span></div>
                                {cart.discountAmount > 0 && !cart.couponCode && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ds-text-2)" }}>{t("pos.discount", "Discount")}</span><span style={{ color: "var(--ds-positive)" }}>−{formatAmount(cart.discountAmount)}</span></div>}
                                {(cart.pointsRedeemed || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ds-text-2)" }}>{t("pos.pointsApplied", "Points applied")}</span><span style={{ color: "var(--ds-positive)" }}>−{formatAmount(cart.pointsRedeemed || 0)}</span></div>}
                                {cart.expressCharge > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ds-text-2)" }}>{t("checkout.expressSurcharge", "Express surcharge")}</span><span>{formatAmount(cart.expressCharge)}</span></div>}
                                {cart.taxSettings?.enabled && cart.taxEnabled && cart.taxAmount > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ds-text-2)" }}>{cart.taxName || "Tax"} ({cart.taxRate}%)</span><span>{formatAmount(cart.taxAmount)}</span></div>}
                                {cart.deliveryCharge > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ds-text-2)" }}>{t("pos.deliveryCharge", "Delivery")}</span><span>{formatAmount(cart.deliveryCharge)}</span></div>}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 18, marginTop: 6, borderTop: "1px solid var(--ds-divider)" }}>
                                    <span style={{ fontWeight: 700, fontSize: 18 }}>{t("pos.total", "Total")}</span>
                                    <span style={{ fontWeight: 700, fontSize: 28, letterSpacing: "-.02em" }}>{formatAmount(cart.total)}</span>
                                </div>
                            </div>
                            {canLoyalty && !isEditMode && cart.customerId && !cart.isGuest && (() => {
                                const willEarn = loyaltyCfg?.mode === "fixed"
                                    ? Math.max(0, Math.round(loyaltyCfg?.earnFixed || 0))
                                    : Math.max(0, Math.round((cart.total * (loyaltyCfg?.earnPercent || 0)) / 100));
                                return willEarn > 0 ? <div style={{ marginTop: 10, fontSize: 13, color: "var(--ds-text-2)" }}>{t("pos.willEarnPoints", "Customer earns {{n}} points when fully paid", { n: willEarn })}</div> : null;
                            })()}
                        </div>

                        {/* payment */}
                        {(
                            <div style={card}>
                                <div style={cardTitle}>{t("checkout.payment", "Payment")}</div>
                                <div style={{ display: "inline-flex", border: "1px solid var(--ds-border)", borderRadius: 11, overflow: "hidden" }}>
                                    {([
                                        ["full", t("checkout.payFull", "Full")],
                                        ["partial", t("checkout.payPartial", "Partial")],
                                        ["later", t("checkout.payLater", "Pay later")],
                                    ] as const).map(([id, label], i) => (
                                        <button key={id} type="button" onClick={() => setPayMode(id)}
                                            style={{ cursor: "pointer", font: "inherit", minWidth: 122, fontSize: 14.5, fontWeight: 600, padding: "11px 20px", border: 0, borderLeft: i ? "1px solid var(--ds-border)" : 0, background: payMode === id ? "var(--ds-blue-soft)" : "var(--ds-card)", color: payMode === id ? "var(--ds-blue)" : "var(--ds-text)", boxShadow: payMode === id ? "inset 0 -2px 0 var(--ds-blue)" : undefined }}>{label}</button>
                                    ))}
                                </div>

                                {payMode === "partial" && (
                                    <div style={{ marginTop: 16 }}>
                                        <label style={fieldLbl}>{t("checkout.payNow", "Pay now")}</label>
                                        <div style={{ display: "flex", alignItems: "center", width: 264, maxWidth: "100%", border: "1px solid var(--ds-border)", borderRadius: 11, overflow: "hidden" }}>
                                            <span style={{ padding: "0 14px", alignSelf: "stretch", display: "flex", alignItems: "center", borderRight: "1px solid var(--ds-border)", color: "var(--ds-text-2)", background: "var(--ds-table-head)" }}>{currencySymbol}</span>
                                            <input autoFocus value={payNowStr} inputMode="decimal" onChange={(e) => setPayNowStr(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
                                                style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 15, color: "var(--ds-text)", background: "var(--ds-card)", border: 0, padding: "11px 13px", outline: "none" }} />
                                        </div>
                                    </div>
                                )}

                                {payMode !== "later" && (
                                    <div style={{ marginTop: 16 }}>
                                        <div style={fieldLbl}>{t("checkout.paymentMethod", "Payment method")}</div>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                                            {methodTiles.map((m) => {
                                                const on = payMethod === m.id;
                                                return (
                                                    <button key={m.id} type="button" onClick={() => setPayMethod(m.id)}
                                                        style={{ position: "relative", cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderRadius: 11, border: `${on ? 2 : 1}px solid ${on ? "var(--ds-blue)" : "var(--ds-border)"}`, margin: on ? 0 : 1, background: "var(--ds-card)", fontSize: 14.5, fontWeight: 500, color: "var(--ds-text)" }}>
                                                        {m.icon}{m.label}
                                                        {on && <span style={{ position: "absolute", top: -8, right: -8, width: 20, height: 20, borderRadius: "50%", background: "var(--ds-blue)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--ds-card)" }}><Check size={11} strokeWidth={3.2} /></span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {payError && <div style={{ marginTop: 12, fontSize: 13.5, fontWeight: 600, color: "var(--ds-negative)" }}>{payError}</div>}

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
                                    <span style={{ fontSize: 14.5, fontWeight: 500, color: balanceDue > 0 ? "var(--ds-negative)" : "var(--ds-positive)" }}>{balanceDue > 0 ? t("orders.balanceDue", "Balance due") : t("checkout.paidInFull", "Paid in full")}</span>
                                    <span style={{ fontSize: 17, fontWeight: 600, color: balanceDue > 0 ? "var(--ds-negative)" : "var(--ds-positive)" }}>{formatAmount(balanceDue)}</span>
                                </div>
                            </div>
                        )}

                        <button onClick={handlePlaceOrder} disabled={placing || cart.items.length === 0}
                            style={{ width: "100%", cursor: placing ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, font: "inherit", fontSize: 18, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 12, padding: "19px 18px", opacity: placing || cart.items.length === 0 ? 0.6 : 1 }}>
                            {placing ? t("common.loading", "Please wait…") : <>{isEditMode ? t("checkout.updateOrder", "Update order") : t("checkout.placeOrder", "Place order")}<span>·</span><span>{formatAmount(cart.total)}</span></>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
