/**
 * Checkout (Order Review) — full-page review + confirm, mirroring the owner app's
 * OrderReviewScreen: customer card → services grouped by category → summary →
 * notes → damage photos → expected-delivery (±) → delivery type + area + agent +
 * Unpaid/Paid → bottom Place Order bar. Payment is a simple Unpaid/Paid status
 * (amountPaid = total when Paid), exactly like the owner app.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    LTextArea,
    LSelect,
    LAvatar,
    LSmartImageUploader,
    type LSmartImageUploaderRef,
} from "@/components/laundry";
import { cn } from "@/lib/utils";
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
import { ChevronLeft, Store, Truck, Home, Calendar, Minus, Plus, Tag, Receipt, StickyNote, ShoppingBag, ArrowRight, User, FileText, Check, AlertCircle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTranslatedItemName } from "@/lib/inventory-translations";
import { useStaffAuthOptional } from "@/features/staff-app/StaffAuthContext";
import { useDeliverySettings } from "@/hooks/use-delivery-settings";
import { useShopLimits } from "@/hooks/use-shop-limits";

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
        setSelectedAgentId("");
    };
    const handleAgentChange = (value: string) => {
        if (value === "__NEW__") { navigate("/manage-staff?new=true"); return; }
        setSelectedAgentId(value);
    };

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

    const deliveryTypes: { value: DeliveryType; label: string; Icon: typeof Store }[] = [
        { value: "pickup_store", label: t("pos.shopPickup", "Shop Pickup"), Icon: Store },
        { value: "delivery_home", label: t("pos.homeDelivery", "Home Delivery"), Icon: Truck },
        { value: "pickup_home", label: t("pos.pickupFromHome", "Pickup from Home"), Icon: Home },
    ];

    return (
        <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-4 lg:px-6">
            {/* Header Banner */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-primary/[0.02] to-card rounded-2xl border border-primary/10 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border text-muted-foreground transition-all duration-300 hover:border-primary hover:text-primary active:scale-95 shadow-sm cursor-pointer"
                        title={t("common.back")}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                            {isEditMode ? t("checkout.updateOrderTitle", "Update Order") : t("checkout.orderReview", "Order Review")}
                        </h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {isEditMode ? t("checkout.reviewAndUpdate", "Review and modify your order configuration") : t("checkout.verifyCart", "Verify cart items, delivery details, and confirm payment status")}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-extrabold text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                        POS Portal
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_390px] lg:items-start">
                {/* LEFT — order details */}
                <div className="space-y-5">
                    {/* Customer Selection State */}
                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="relative">
                                <LAvatar name={cart.customerName || cart.customerPhone || "?"} size="lg" className="border-2 border-primary/20" />
                                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-sm ring-2 ring-card">
                                    <User className="h-3 w-3" />
                                </span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-extrabold uppercase tracking-wider text-primary/80">Customer Details</p>
                                <p className="truncate text-base font-extrabold text-foreground mt-0.5">{cart.customerName || t("customer.guest", "Guest")}</p>
                                <p className="truncate text-sm font-semibold text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                    {cart.customerPhone}
                                </p>
                            </div>
                        </div>
                        {!isEditMode && (
                            <button 
                                onClick={onClose} 
                                className="shrink-0 rounded-xl bg-muted px-4 py-2 text-xs font-extrabold text-primary transition-all duration-200 hover:bg-primary hover:text-white cursor-pointer active:scale-95"
                            >
                                {t("common.edit", "Change").toUpperCase()}
                            </button>
                        )}
                    </div>

                    {/* Services grouped by category */}
                    {categoryGroups.map((group, gi) => (
                        <div key={`${group.name}-${gi}`} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:shadow-md">
                            <div className="flex items-center justify-between border-b border-border/80 bg-gradient-to-r from-primary/5 via-primary/[0.01] to-transparent px-5 py-3">
                                <div className="flex items-center gap-2.5 text-primary">
                                    <div className="rounded-lg bg-primary/10 p-1.5">
                                        <ShoppingBag className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-extrabold uppercase tracking-wider">
                                        {group.name}
                                    </span>
                                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                                        {group.items.length} {group.items.length === 1 ? t("orders.item", "item") : t("orders.items", "items")}
                                    </span>
                                </div>
                                <span className="text-base font-extrabold text-primary tabular-nums">{formatAmount(Math.round(group.subtotal))}</span>
                            </div>
                            <div className="divide-y divide-border/60">
                                {group.items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-foreground flex items-center gap-2">
                                                {getTranslatedItemName(item.service.name)}
                                                {item.express && (
                                                    <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-warning uppercase tracking-wide" style={{ background: "hsl(var(--warning) / 0.12)" }}>
                                                        ⚡ {t("pos.express", "Express")}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs font-semibold text-muted-foreground mt-1 flex items-center gap-1.5">
                                                <span className="rounded bg-muted px-1.5 py-0.5">{item.quantity} {item.service.pricingType === "piece" ? "pcs" : item.service.pricingType}</span>
                                                <span>·</span>
                                                <span>{formatAmount(item.unitPrice)} {t("checkout.each", "ea.")}</span>
                                            </p>
                                            {item.notes && (
                                                <p className="text-xs text-muted-foreground bg-muted/50 border border-dashed border-border rounded-lg px-2.5 py-1.5 mt-2 italic flex items-center gap-1.5">
                                                    <StickyNote className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                                                    "{item.notes}"
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-sm font-extrabold text-foreground tabular-nums">{formatAmount(item.total)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Summary */}
                    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                        <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2 pb-2 border-b border-border">
                            <Receipt className="h-4 w-4 text-primary" />
                            Order Bill Details
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-muted-foreground">{t("pos.subtotal", "Subtotal")}</span>
                                <span className="font-bold text-foreground tabular-nums">{formatAmount(cart.subtotal)}</span>
                            </div>
                            
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                                    <Tag className="h-4 w-4 text-success" />
                                    {t("pos.applyDiscount", "Discount (₹)")}
                                </span>
                                <input
                                    type="number"
                                    min={0}
                                    value={cart.discountValue || ""}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        if (!v || v <= 0) cart.setDiscount(undefined, undefined);
                                        else cart.setDiscount("flat", v);
                                    }}
                                    placeholder="0"
                                    className="w-28 rounded-xl border border-border bg-background px-3 py-1.5 text-right text-sm font-bold text-foreground outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            {cart.discountAmount > 0 && (
                                <div className="flex items-center justify-between text-xs bg-success/5 border border-success/10 rounded-xl px-3 py-2">
                                    <span className="font-bold text-success flex items-center gap-1">
                                        <Check className="h-3 w-3" />
                                        {t("checkout.discountApplied", "Discount applied")}
                                    </span>
                                    <span className="font-extrabold text-success tabular-nums">-{formatAmount(cart.discountAmount)}</span>
                                </div>
                            )}

                            {cart.taxSettings?.enabled && cart.taxEnabled && cart.taxAmount > 0 && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                                        <Receipt className="h-4 w-4 text-muted-foreground/75" />
                                        {cart.taxName || "GST"} ({cart.taxRate}%)
                                    </span>
                                    <span className="font-bold text-foreground tabular-nums">+{formatAmount(cart.taxAmount)}</span>
                                </div>
                            )}

                            {cart.deliveryCharge > 0 && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                                        <Truck className="h-4 w-4 text-muted-foreground/75" />
                                        {t("pos.deliveryCharge", "Delivery Charge")}
                                    </span>
                                    <span className="font-bold text-foreground tabular-nums">+{formatAmount(cart.deliveryCharge)}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                                <span className="text-base font-extrabold text-foreground">{t("pos.grandTotal", "Grand Total")}</span>
                                <span className="text-xl font-extrabold text-primary tabular-nums">{formatAmount(cart.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4.5 shadow-sm transition-all duration-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
                        <StickyNote className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <input
                            value={cart.deliveryNotes || ""}
                            onChange={(e) => cart.setDelivery(cart.deliveryType, cart.deliveryAddress, e.target.value, cart.deliveryCharge)}
                            placeholder={t("checkout.addNote", "Add internal staff notes (e.g. stains, special requests)")}
                            className="flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/70"
                        />
                    </div>

                    {/* Damage photos */}
                    {shopId && canUploadDamagePhotos && (
                        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="text-sm font-extrabold text-foreground flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    {t("checkout.damageStainPhotos", "Damage / Stain Photos")}
                                </p>
                                <span className="text-xs font-semibold text-muted-foreground">Optional</span>
                            </div>
                            <LSmartImageUploader
                                ref={damagePhotoUploaderRef}
                                folder="damage-photos"
                                shopId={shopId}
                                value={damagePhotoMetadata}
                                onChange={setDamagePhotoMetadata}
                                maxFiles={5}
                                showStats
                                deferUpload
                            />
                        </div>
                    )}
                </div>{/* /LEFT */}

                {/* RIGHT — delivery, payment & confirm */}
                <div className="space-y-5 lg:sticky lg:top-6">
                    {/* Expected delivery / Ready Date */}
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-md">
                        <div className="flex items-center gap-4">
                            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <div className="absolute inset-0 rounded-xl bg-primary/10 animate-pulse-soft" />
                                <Calendar className="h-6 w-6 z-10" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                                    {cart.deliveryType === "pickup_store" ? t("checkout.expectedReady", "Expected Ready") : t("checkout.expectedDelivery", "Expected Delivery")}
                                </p>
                                <p className="text-base font-extrabold text-foreground mt-0.5">{formatDate(expectedDate)}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <button
                                type="button"
                                onClick={() => { const d = new Date(expectedDate); d.setDate(d.getDate() - 1); if (d >= new Date(new Date().toDateString())) setExpectedDate(d); }}
                                className="flex items-center justify-center gap-1.5 h-10 rounded-xl border border-border font-extrabold text-primary bg-muted/30 transition-all duration-200 hover:bg-muted hover:border-primary/30 active:scale-95 cursor-pointer"
                            >
                                <Minus className="h-4 w-4" />
                                <span>1 Day</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { const d = new Date(expectedDate); d.setDate(d.getDate() + 1); setExpectedDate(d); }}
                                className="flex items-center justify-center gap-1.5 h-10 rounded-xl border border-border font-extrabold text-primary bg-muted/30 transition-all duration-200 hover:bg-muted hover:border-primary/30 active:scale-95 cursor-pointer"
                            >
                                <Plus className="h-4 w-4" />
                                <span>1 Day</span>
                            </button>
                        </div>
                    </div>

                    {/* Delivery & Payment Form */}
                    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                        <div>
                            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("mobile.deliveryTypeLabel", "Delivery Type")}</p>
                            <div className="grid grid-cols-3 gap-2">
                                {deliveryTypes.map(({ value, label, Icon }) => {
                                    const active = cart.deliveryType === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => cart.setDelivery(value)}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-extrabold transition-all duration-200 cursor-pointer active:scale-95 shadow-sm",
                                                active 
                                                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary shadow-primary/5" 
                                                    : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/30"
                                            )}
                                        >
                                            <Icon className={cn("h-5 w-5", active ? "text-primary scale-110" : "text-muted-foreground/75")} />
                                            <span className="text-center leading-tight text-[11px]">{label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {isHomeType && (
                            <div className="pt-2">
                                <LTextArea
                                    label={cart.deliveryType === "delivery_home" ? t("checkout.deliveryAddress", "Delivery Address") : t("checkout.pickupAddress", "Pickup Address")}
                                    value={cart.deliveryAddress || ""}
                                    onChange={(e) => cart.setDelivery(cart.deliveryType, e.target.value, cart.deliveryNotes, cart.deliveryCharge)}
                                    placeholder={t("checkout.enterFullAddress", "Enter full delivery address…")}
                                    minRows={2}
                                    className="rounded-xl border border-border"
                                />
                            </div>
                        )}

                        {isHomeType && deliverySettings.serviceAreas?.length > 0 && (
                            <div className="pt-2">
                                <LSelect label={t("checkout.serviceArea", "Service Area")} value={selectedArea} onChange={handleAreaChange} options={areaOptions} />
                            </div>
                        )}
                        {isHomeType && canHaveAgents && (
                            <div className="pt-2">
                                <LSelect
                                    label={t("checkout.assignAgent", "Assign Delivery Agent")}
                                    value={selectedAgentId}
                                    onChange={handleAgentChange}
                                    options={agentOptions}
                                    disabled={deliverySettings.serviceAreas?.length > 0 && !selectedArea}
                                />
                            </div>
                        )}

                        {/* Payment Status */}
                        <div className="pt-3 border-t border-border/80">
                            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t("checkout.paymentStatus", "Payment Status")}</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPaymentStatus("unpaid")}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 transition-all duration-200 cursor-pointer active:scale-95",
                                        paymentStatus === "unpaid" 
                                            ? "border-destructive bg-destructive/5 text-destructive ring-1 ring-destructive" 
                                            : "border-border bg-card text-muted-foreground hover:border-destructive/30 hover:bg-destructive/5"
                                    )}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <AlertCircle className="h-4 w-4" />
                                        <span className="font-extrabold text-sm">{t("checkout.unpaid", "Unpaid")}</span>
                                    </div>
                                    <span className="text-[10px] font-bold opacity-85 uppercase tracking-wide">Collect on Delivery</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentStatus("paid")}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 transition-all duration-200 cursor-pointer active:scale-95",
                                        paymentStatus === "paid" 
                                            ? "border-success bg-success/5 text-success ring-1 ring-success" 
                                            : "border-border bg-card text-muted-foreground hover:border-success/30 hover:bg-success/5"
                                    )}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <Check className="h-4 w-4" />
                                        <span className="font-extrabold text-sm">{t("checkout.paid", "Paid")}</span>
                                    </div>
                                    <span className="text-[10px] font-bold opacity-85 uppercase tracking-wide">Paid in Full</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Place Order CTA Card */}
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                        <button
                            type="button"
                            onClick={handlePlaceOrder}
                            disabled={placing || cart.items.length === 0}
                            className="group flex w-full items-center justify-between gap-4 rounded-xl bg-primary px-5 py-4 text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        >
                            <div className="text-left">
                                <span className="block text-[10px] font-extrabold uppercase tracking-widest opacity-80">{cart.items.length} {t("mobile.items", "items").toUpperCase()}</span>
                                <span className="block text-xl font-black mt-0.5">{formatAmount(cart.total)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-extrabold">
                                <span>{placing ? t("common.loading", "Please wait…") : (isEditMode ? t("checkout.updateOrder", "Update Order") : t("checkout.placeOrder", "Confirm & Place"))}</span>
                                {!placing && <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />}
                            </div>
                        </button>
                    </div>
                </div>{/* /RIGHT */}
            </div>{/* /grid */}
        </div>
    );
}
