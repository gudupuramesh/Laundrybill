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
import { ChevronLeft, Store, Truck, Home, Calendar, Minus, Plus, Tag, Receipt, StickyNote, ShoppingBag, ArrowRight } from "lucide-react";
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
        <div className="mx-auto w-full max-w-6xl px-4 pb-4 pt-4 lg:px-6">
            {/* Header */}
            <div className="mb-4 flex items-center gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/70"
                    title={t("common.back")}
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h1 className="text-xl font-extrabold text-foreground">
                    {isEditMode ? t("checkout.updateOrderTitle", "Update Order") : t("checkout.orderReview", "Order Review")}
                </h1>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
                {/* LEFT — order details */}
                <div className="space-y-4">
                {/* Customer */}
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                        <LAvatar name={cart.customerName || cart.customerPhone || "?"} size="md" />
                        <div className="min-w-0">
                            <p className="truncate font-bold text-foreground">{cart.customerName || t("customer.guest", "Guest")}</p>
                            <p className="truncate text-sm text-muted-foreground">{cart.customerPhone}</p>
                        </div>
                    </div>
                    {!isEditMode && (
                        <button onClick={onClose} className="shrink-0 px-2 text-sm font-bold text-primary">
                            {t("common.edit", "Edit").toUpperCase()}
                        </button>
                    )}
                </div>

                {/* Services grouped by category */}
                {categoryGroups.map((group, gi) => (
                    <div key={`${group.name}-${gi}`} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                        <div className="flex items-center justify-between bg-primary/5 px-4 py-2.5">
                            <div className="flex items-center gap-2 text-primary">
                                <ShoppingBag className="h-4 w-4" />
                                <span className="text-xs font-extrabold uppercase tracking-wide">
                                    {group.name} · {group.items.length} {group.items.length === 1 ? t("orders.item", "item") : t("orders.items", "items")}
                                </span>
                            </div>
                            <span className="text-sm font-extrabold text-primary">{formatAmount(Math.round(group.subtotal))}</span>
                        </div>
                        <div className="divide-y divide-border">
                            {group.items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-foreground">
                                            {getTranslatedItemName(item.service.name)}
                                            {item.express && (
                                                <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-warning" style={{ background: "hsl(var(--warning) / 0.16)" }}>
                                                    {t("pos.express", "Express")}
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground">×{item.quantity} · {formatAmount(item.unitPrice)} {t("checkout.each", "ea.")}</p>
                                    </div>
                                    <span className="text-sm font-bold text-foreground">{formatAmount(item.total)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Summary */}
                <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("pos.subtotal", "Subtotal")}</span>
                        <span className="font-bold text-foreground">{formatAmount(cart.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><Tag className="h-4 w-4 text-success" />{t("pos.applyDiscount", "Discount")} (₹)</span>
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
                            className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-right text-sm font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                    {cart.discountAmount > 0 && (
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{t("checkout.discountApplied", "Discount applied")}</span>
                            <span className="font-bold text-success">-{formatAmount(cart.discountAmount)}</span>
                        </div>
                    )}
                    {cart.taxSettings?.enabled && cart.taxEnabled && cart.taxAmount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><Receipt className="h-4 w-4" />{cart.taxName || "GST"} ({cart.taxRate}%)</span>
                            <span className="font-bold text-foreground">+{formatAmount(cart.taxAmount)}</span>
                        </div>
                    )}
                    {cart.deliveryCharge > 0 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><Truck className="h-4 w-4" />{t("pos.deliveryCharge", "Delivery")}</span>
                            <span className="font-bold text-foreground">+{formatAmount(cart.deliveryCharge)}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between border-t border-border pt-3">
                        <span className="text-base font-extrabold text-foreground">{t("pos.grandTotal", "Grand Total")}</span>
                        <span className="text-lg font-extrabold text-primary">{formatAmount(cart.total)}</span>
                    </div>
                </div>

                {/* Notes */}
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <StickyNote className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <input
                        value={cart.deliveryNotes || ""}
                        onChange={(e) => cart.setDelivery(cart.deliveryType, cart.deliveryAddress, e.target.value, cart.deliveryCharge)}
                        placeholder={t("checkout.addNote", "Add a note (optional)")}
                        className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                </div>

                {/* Damage photos */}
                {shopId && canUploadDamagePhotos && (
                    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <p className="mb-2 text-sm font-bold text-foreground">{t("checkout.damageStainPhotos", "Damage / stain photos (optional)")}</p>
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
                <div className="space-y-4 lg:sticky lg:top-4">

                {/* Expected delivery */}
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <Calendar className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            {cart.deliveryType === "pickup_store" ? t("checkout.expectedReady", "Expected Ready") : t("checkout.expectedDelivery", "Expected Delivery")}
                        </p>
                        <p className="text-sm font-bold text-foreground">{formatDate(expectedDate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => { const d = new Date(expectedDate); d.setDate(d.getDate() - 1); if (d >= new Date(new Date().toDateString())) setExpectedDate(d); }}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-primary transition-colors hover:bg-muted"
                        >
                            <Minus className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => { const d = new Date(expectedDate); d.setDate(d.getDate() + 1); setExpectedDate(d); }}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-primary transition-colors hover:bg-muted"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Delivery & Payment */}
                <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("mobile.deliveryTypeLabel", "Delivery Type")}</p>
                        <div className="grid grid-cols-3 gap-2">
                            {deliveryTypes.map(({ value, label, Icon }) => {
                                const active = cart.deliveryType === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => cart.setDelivery(value)}
                                        className={cn(
                                            "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors",
                                            active ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "border-border text-muted-foreground hover:border-primary/40"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span className="text-center leading-tight">{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {isHomeType && (
                        <LTextArea
                            label={cart.deliveryType === "delivery_home" ? t("checkout.deliveryAddress", "Delivery Address") : t("checkout.pickupAddress", "Pickup Address")}
                            value={cart.deliveryAddress || ""}
                            onChange={(e) => cart.setDelivery(cart.deliveryType, e.target.value, cart.deliveryNotes, cart.deliveryCharge)}
                            placeholder={t("checkout.enterFullAddress", "Enter full address")}
                            minRows={2}
                        />
                    )}

                    {isHomeType && deliverySettings.serviceAreas?.length > 0 && (
                        <LSelect label={t("checkout.serviceArea", "Service Area")} value={selectedArea} onChange={handleAreaChange} options={areaOptions} />
                    )}
                    {isHomeType && canHaveAgents && (
                        <LSelect
                            label={t("checkout.assignAgent", "Assign Delivery Agent")}
                            value={selectedAgentId}
                            onChange={handleAgentChange}
                            options={agentOptions}
                            disabled={deliverySettings.serviceAreas?.length > 0 && !selectedArea}
                        />
                    )}

                    <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("checkout.paymentStatus", "Payment Status")}</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setPaymentStatus("unpaid")}
                                className={cn(
                                    "rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors",
                                    paymentStatus === "unpaid" ? "border-destructive bg-destructive/5 text-destructive ring-1 ring-destructive" : "border-border text-muted-foreground hover:border-destructive/40"
                                )}
                            >
                                {t("checkout.unpaid", "Unpaid")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentStatus("paid")}
                                className={cn(
                                    "rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors",
                                    paymentStatus === "paid" ? "border-success bg-success/5 text-success ring-1 ring-success" : "border-border text-muted-foreground hover:border-success/40"
                                )}
                            >
                                {t("checkout.paid", "Paid")}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Place Order */}
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <button
                        type="button"
                        onClick={handlePlaceOrder}
                        disabled={placing || cart.items.length === 0}
                        className="flex w-full items-center justify-between gap-3 rounded-xl bg-primary px-5 py-3 text-primary-foreground transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <span className="text-left">
                            <span className="block text-[11px] font-bold uppercase tracking-wide opacity-80">{cart.items.length} {t("mobile.items", "items").toUpperCase()}</span>
                            <span className="block text-lg font-extrabold">{formatAmount(cart.total)}</span>
                        </span>
                        <span className="flex items-center gap-2 text-sm font-extrabold">
                            {placing ? t("common.loading", "Please wait…") : (isEditMode ? t("checkout.updateOrder", "Update Order") : t("checkout.placeOrder", "Place Order"))}
                            {!placing && <ArrowRight className="h-5 w-5" />}
                        </span>
                    </button>
                </div>
                </div>{/* /RIGHT */}
            </div>{/* /grid */}
        </div>
    );
}
