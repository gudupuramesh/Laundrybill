/**
 * Public Order Content — Enterprise Laundry CRM design system (Public Book).
 *
 * Single-page booking flow that mirrors the DS mockup: offer banner → hero →
 * Quick book / Full order toggle. No area-first gate — the service area is a
 * field in the form. Quick = service chips + inline details (books directly).
 * Full = POS-style select-items grid + sticky cart → checkout dialog for
 * pickup details. All real order logic (cart, slots, geocoding, order
 * creation) is preserved.
 */

import { useState, useEffect, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import {
    LResponsiveDialog,
    LTextArea,
    LOrderSummary,
    useLToast,
} from "@/components/laundry";
import { useInventoryForShop } from "../hooks/use-inventory-for-shop";
import { usePublicCart } from "../hooks/use-public-cart";
import { SlotSelector } from "./SlotSelector";
import { PublicLocationMap } from "./PublicLocationMap";
import { PublicCheckoutCoupon } from "./PublicCheckoutCoupon";
import { PublicOrderSuccessSheet } from "./PublicOrderSuccessSheet";
import { ItemDetailSheet } from "@/features/pos/ItemDetailSheet";
import { useCreatePublicOrder } from "../hooks/use-create-public-order";
import { usePublicSlotAvailability } from "../hooks/use-public-slot-availability";
import { getShopOpenStatus } from "../lib/shop-hours";
import { getDeliveryCharge } from "@/hooks/use-shop";
import type { InventoryItem } from "@/types/inventory";
import type { Shop } from "@/types/shop";
import { ShoppingBasket, MapPin, User, Clock, Loader2, Plus, Minus, Trash2, Star, Info, Shirt } from "lucide-react";
import { getTranslatedItemName, getTranslatedUnit, isWeightUnit } from "@/lib/inventory-translations";
import { format } from "date-fns";
import { formatCurrencyValue } from "@/hooks/use-currency";
import { useNavigate } from "react-router-dom";
import { forwardGeocode } from "@/lib/geocoding";
import type { PublicDeliveryAddress } from "../hooks/use-public-cart";

const MONO = "'IBM Plex Mono'";
const TINTS = ["c-primary", "c-violet", "c-cyan", "c-info", "c-success", "c-warning"];
const tintFor = (s: string) => TINTS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];

type OrderMode = "quick" | "select";

interface PublicOrderContentProps {
    shop: Shop;
    onOrderingActive?: (active: boolean) => void;
    onCheckoutOpenChange?: (open: boolean) => void;
    onCartHasItemsChange?: (hasItems: boolean) => void;
}

export function PublicOrderContent({ shop, onOrderingActive, onCheckoutOpenChange, onCartHasItemsChange }: PublicOrderContentProps) {
    const [mode, setMode] = useState<OrderMode>("quick");
    const [selectedService, setSelectedService] = useState("");
    const [selectedArea, setSelectedArea] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [itemDetailOpen, setItemDetailOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [successPublicId, setSuccessPublicId] = useState<string | null>(null);
    const [successPhone, setSuccessPhone] = useState("");
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);

    const { createOrder: createPublicOrder, loading: creatingOrder, error: createError } = useCreatePublicOrder();
    const { addToast } = useLToast();
    const navigate = useNavigate();

    const shopCurrencySymbol = shop.settings?.currencySymbol || "₹";
    const shopLocale = shop.settings?.locale || "en-IN";
    const fmt = (v: number) => formatCurrencyValue(v, shopCurrencySymbol, shopLocale);
    const deliverySettings = shop.settings?.delivery;
    const areas = (deliverySettings?.serviceAreas || []).filter((a) => a.isActive);
    const hasAreas = areas.length > 0;

    const { items, categories, loading } = useInventoryForShop(shop.id);
    const cart = usePublicCart(shop);

    const today = format(new Date(), "yyyy-MM-dd");
    const checkoutDate = cart.pickupDate || today;
    const { data: slotAvailability } = usePublicSlotAvailability(shop.publicOrdering?.slug, checkoutDate);

    const openStatus = getShopOpenStatus(shop);
    const distanceBands = (deliverySettings?.distanceFeeEnabled && Array.isArray(deliverySettings.distanceBands)) ? deliverySettings.distanceBands : [];
    const featuredCode = shop.publicOrdering?.featuredCouponCode;
    const offerText = shop.publicOrdering?.offerText?.trim();
    const offerEnabled = (shop.publicOrdering?.offerEnabled ?? !!featuredCode) && (!!offerText || !!featuredCode);
    const testimonials = shop.publicOrdering?.testimonials ?? [];

    useEffect(() => { onOrderingActive?.(false); }, [onOrderingActive]);
    useEffect(() => { onCheckoutOpenChange?.(checkoutOpen); }, [checkoutOpen, onCheckoutOpenChange]);
    const cartHasItems = cart.items.some((i) => i.quantity > 0);
    useEffect(() => { onCartHasItemsChange?.(cartHasItems); }, [cartHasItems, onCartHasItemsChange]);

    useEffect(() => {
        if (categories.length > 0 && !selectedCategory) setSelectedCategory(categories[0].id);
        if (categories.length > 0 && !selectedService) setSelectedService(categories[0].name);
    }, [categories, selectedCategory, selectedService]);

    const filteredItems = items.filter((item) => item.isActive && (!selectedCategory || item.categoryId === selectedCategory));

    const canPlaceOrder = cart.customerName.trim().length > 0 && cart.customerPhone.replace(/\D/g, "").length >= 10;

    // ----- shared order placement (quick = no items, full = cart items) -----
    const placeOrder = async (isQuick: boolean) => {
        if (!canPlaceOrder) {
            addToast({ type: "error", title: "Add your details", description: "Name and a valid phone number are required." });
            return;
        }
        if (hasAreas && !selectedArea) {
            addToast({ type: "error", title: "Select your area" });
            return;
        }
        if (deliverySettings?.enablePickupSlots && !cart.pickupSlot) {
            addToast({ type: "error", title: "Choose a pickup slot" });
            return;
        }
        const addr = cart.deliveryAddress;
        const hasLatLng = addr?.lat != null && addr?.lng != null;
        const hasManual = !!addr?.fullAddress?.trim() && !!addr?.flatNumber?.trim();
        if (!hasLatLng && !hasManual) {
            addToast({ type: "error", title: "Add your pickup address", description: "Use current location or type your address." });
            return;
        }
        if (!addr?.flatNumber?.trim()) {
            addToast({ type: "error", title: "Flat / house number is required" });
            return;
        }

        flushSync(() => setIsPlacingOrder(true));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        try {
            let effectiveAddress: PublicDeliveryAddress;
            if (hasLatLng) {
                effectiveAddress = { lat: addr.lat, lng: addr.lng, flatNumber: addr.flatNumber?.trim(), landmark: addr.landmark?.trim() || undefined, fullAddress: addr.fullAddress?.trim() || undefined };
            } else {
                const q = [addr.flatNumber?.trim(), addr.landmark?.trim(), addr.fullAddress?.trim()].filter(Boolean).join(", ");
                const geocoded = await forwardGeocode(q);
                if (!geocoded) {
                    addToast({ type: "error", title: "Could not find location", description: "Please use the map / current location, or enter a more specific address." });
                    return;
                }
                effectiveAddress = { lat: geocoded.lat, lng: geocoded.lng, flatNumber: addr.flatNumber?.trim(), landmark: addr.landmark?.trim() || undefined, fullAddress: addr.fullAddress?.trim() || undefined };
            }

            const effectiveDeliveryCharge = isQuick && cart.deliveryCharge === 0 ? getDeliveryCharge(shop.settings?.delivery, 0, "pickup_home") || 50 : cart.deliveryCharge;
            const effectiveTotal = isQuick ? effectiveDeliveryCharge : cart.total;
            const notes = isQuick && selectedService
                ? [`Service: ${selectedService}`, cart.customerNotes.trim()].filter(Boolean).join(" · ")
                : cart.customerNotes.trim() || undefined;

            const result = await createPublicOrder(shop, {
                deliveryArea: selectedArea,
                customerName: cart.customerName.trim(),
                customerPhone: cart.customerPhone,
                customerEmail: cart.customerEmail.trim() || undefined,
                items: isQuick ? [] : cart.items,
                subtotal: isQuick ? 0 : cart.subtotal,
                discountType: isQuick ? undefined : cart.discountType,
                discountValue: isQuick ? undefined : cart.discountValue,
                discountAmount: isQuick ? 0 : cart.discountAmount,
                taxAmount: isQuick ? 0 : cart.taxAmount,
                taxRate: isQuick ? 0 : cart.taxRate,
                taxName: cart.taxName,
                deliveryCharge: effectiveDeliveryCharge,
                total: effectiveTotal,
                pickupDate: cart.pickupDate || today,
                pickupSlot: cart.pickupSlot,
                deliveryAddress: effectiveAddress,
                customerNotes: notes,
                isQuickOrder: isQuick,
                deliveryBandId: cart.deliveryBandId,
            });

            if (result) {
                const placedPhone = cart.customerPhone;
                setCheckoutOpen(false);
                cart.clearCart();
                setSuccessPhone(placedPhone);
                setSuccessPublicId(result.publicId);
            } else if (createError) {
                addToast({ type: "error", title: createError });
            }
        } finally {
            setIsPlacingOrder(false);
        }
    };

    // ----- styles -----
    const fld: CSSProperties = { width: "100%", font: "inherit", fontSize: 14, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 10, padding: "11px 12px", outline: "none" };
    const lbl: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--c-text-2)" };
    const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, boxShadow: "var(--sh-md)", padding: 22 };
    const sectLbl: CSSProperties = { fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--c-text-2)" };

    const placing = isPlacingOrder || creatingOrder;

    const addressBlock = (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <PublicLocationMap
                lat={cart.deliveryAddress?.lat}
                lng={cart.deliveryAddress?.lng}
                onLocationChange={(lat, lng) => cart.setDeliveryAddress({ ...(cart.deliveryAddress || {}), lat, lng })}
                onAddressChange={(addr) => cart.setDeliveryAddressMerge({ fullAddress: addr })}
                autoGetLocationOnMount={false}
            />
            <input style={fld} placeholder="Flat / house no. / building *" value={cart.deliveryAddress?.flatNumber ?? ""} onChange={(e) => cart.setDeliveryAddressMerge({ flatNumber: e.target.value })} />
            <input style={fld} placeholder="Landmark (optional)" value={cart.deliveryAddress?.landmark ?? ""} onChange={(e) => cart.setDeliveryAddressMerge({ landmark: e.target.value })} />
            <textarea rows={2} style={{ ...fld, resize: "vertical" }} placeholder="Full address — road, area, city" value={cart.deliveryAddress?.fullAddress ?? ""} onChange={(e) => cart.setDeliveryAddressMerge({ fullAddress: e.target.value })} />
        </div>
    );

    const bandSelector = distanceBands.length > 0 ? (
        <div>
            <label style={lbl}>Delivery distance</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {distanceBands.map((b) => {
                    const on = (cart.deliveryBandId || distanceBands[0].id) === b.id;
                    return (
                        <button key={b.id} type="button" onClick={() => cart.setDeliveryBand(b.id)} style={{ cursor: "pointer", font: "inherit", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border-strong)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{b.label}</span>
                            <span style={{ fontSize: 11, fontFamily: MONO }}>{fmt(b.fee)}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    ) : null;

    const detailsInputs = (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input style={fld} placeholder="Full name *" value={cart.customerName} onChange={(e) => cart.setCustomer(e.target.value, cart.customerPhone, cart.customerEmail)} />
            <input style={fld} type="email" placeholder="Email address (optional)" value={cart.customerEmail} onChange={(e) => cart.setCustomer(cart.customerName, cart.customerPhone, e.target.value)} />
            <input style={{ ...fld, fontFamily: MONO }} inputMode="tel" placeholder="Mobile number *" value={cart.customerPhone} onChange={(e) => cart.setCustomer(cart.customerName, e.target.value, cart.customerEmail)} />
        </div>
    );

    const slotBlock = deliverySettings?.enablePickupSlots && (deliverySettings.pickupTimeSlots?.length ?? 0) > 0 && (
        <SlotSelector
            slots={deliverySettings.pickupTimeSlots || []}
            selectedDate={checkoutDate}
            selectedSlot={cart.pickupSlot}
            onDateChange={(d) => cart.setPickupSlot(d, "")}
            onSlotChange={(s) => cart.setPickupSlot(cart.pickupDate || today, s)}
            enableSlots={!!deliverySettings?.enablePickupSlots}
            slotAvailability={slotAvailability ?? undefined}
            bufferMinutes={deliverySettings?.bufferMinutes ?? 0}
        />
    );

    return (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "var(--c-bg)" }} className="lb-scroll" data-testid="public-order-page">
            <div style={{ maxWidth: mode === "select" ? 1040 : 840, margin: "0 auto", padding: "26px 20px 48px" }}>
                {/* shop closed */}
                {!openStatus.isOpen && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--c-warning-soft)", border: "1px solid var(--c-warning-soft)", color: "var(--c-warning)", borderRadius: 12, padding: "11px 14px", marginBottom: 18, fontSize: 13 }}>
                        <Clock size={16} /> Currently closed — you can still book for the next available day.
                    </div>
                )}

                {/* offer banner */}
                {offerEnabled && (
                    <div style={{ background: "linear-gradient(135deg,var(--c-primary),#11338E)", color: "#fff", borderRadius: 14, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 20, boxShadow: "var(--sh-sm)" }}>
                        <span style={{ fontSize: 20 }}>🎉</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14.5, fontWeight: 700 }}>{offerText || "Special offer for you"}</div>
                            {featuredCode && <div style={{ fontSize: 12, opacity: 0.85 }}>Apply the code at checkout</div>}
                        </div>
                        {featuredCode && <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, background: "rgba(255,255,255,.2)", padding: "6px 12px", borderRadius: 8, border: "1px dashed rgba(255,255,255,.55)", whiteSpace: "nowrap" }}>{featuredCode}</span>}
                    </div>
                )}

                {/* hero */}
                <div style={{ textAlign: "center", marginBottom: 22 }}>
                    <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-.02em", margin: "0 0 6px" }}>Book a laundry pickup</h1>
                    <p style={{ fontSize: 14.5, color: "var(--c-text-2)", margin: 0 }}>Free pickup &amp; delivery · ready in 24 hours</p>
                </div>

                {/* mode toggle */}
                <div style={{ display: "flex", gap: 6, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: 5, maxWidth: 360, margin: "0 auto 22px", boxShadow: "var(--sh-sm)" }}>
                    {([["quick", "⚡ Quick book"], ["select", "🧺 Full order"]] as const).map(([m, label]) => {
                        const on = mode === m;
                        return (
                            <button key={m} onClick={() => setMode(m)} aria-pressed={on} style={{ flex: 1, cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, padding: 10, border: 0, borderRadius: 9, background: on ? "var(--c-primary)" : "transparent", color: on ? "#fff" : "var(--c-text-3)" }}>
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* QUICK */}
                {mode === "quick" && (
                    <div style={{ maxWidth: 520, margin: "0 auto", ...card }}>
                        {categories.length > 0 && (
                            <>
                                <div style={sectLbl}>What do you need?</div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                                    {categories.map((c) => {
                                        const on = c.name === selectedService;
                                        return (
                                            <button key={c.id} onClick={() => setSelectedService(c.name)} style={{ cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "9px 14px", borderRadius: 20, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border-strong)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" }}>
                                                {c.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        <div style={sectLbl}>Your details</div>
                        <div style={{ marginBottom: 14 }}>{detailsInputs}</div>

                        {hasAreas && (
                            <div style={{ marginBottom: 14 }}>
                                <label style={lbl}>Area</label>
                                <select style={fld} value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                                    <option value="">Select your area</option>
                                    {areas.map((a) => <option key={a.id} value={a.value}>{a.value}</option>)}
                                </select>
                            </div>
                        )}

                        <div style={{ marginBottom: 14 }}>
                            <label style={lbl}>Pickup date{deliverySettings?.enablePickupSlots ? " & slot" : ""}</label>
                            {deliverySettings?.enablePickupSlots ? slotBlock : (
                                <input type="date" style={{ ...fld, fontFamily: MONO }} min={today} value={checkoutDate} onChange={(e) => cart.setPickupSlot(e.target.value, cart.pickupSlot)} />
                            )}
                        </div>

                        {bandSelector && <div style={{ marginBottom: 14 }}>{bandSelector}</div>}

                        <div style={{ marginBottom: 14 }}>
                            <label style={lbl}>Pickup address</label>
                            {addressBlock}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--c-primary-soft)", borderRadius: 10, padding: "11px 13px", marginBottom: 16 }}>
                            <Info size={17} style={{ color: "var(--c-primary)", flex: "none" }} />
                            <span style={{ fontSize: 12.5, color: "var(--c-text-2)" }}>We'll weigh &amp; price your items at pickup — pay on delivery.</span>
                        </div>

                        <button onClick={() => placeOrder(true)} disabled={placing} style={{ width: "100%", cursor: placing ? "wait" : "pointer", font: "inherit", fontSize: 16, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 12, padding: 14, boxShadow: "var(--sh-sm)", opacity: placing ? 0.7 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            {placing ? <><Loader2 size={18} className="animate-spin" /> Booking…</> : "Book pickup"}
                        </button>
                    </div>
                )}

                {/* FULL — POS select items + sticky cart */}
                {mode === "select" && (
                    <div>
                        {/* category chips — full width above, wraps so all are visible */}
                        {categories.length > 0 && (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                                {categories.map((c) => {
                                    const on = c.id === selectedCategory;
                                    return (
                                        <button key={c.id} onClick={() => setSelectedCategory(c.id)} style={{ cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: 20, whiteSpace: "nowrap", border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary)" : "var(--c-surface)", color: on ? "#fff" : "var(--c-text-2)" }}>
                                            {c.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <div style={{ flex: "1.6 1 320px", minWidth: 0 }}>
                            {/* product grid */}
                            {loading ? (
                                <div style={{ padding: 40, textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>Loading services…</div>
                            ) : filteredItems.length === 0 ? (
                                <div style={{ padding: 40, textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>No items in this category.</div>
                            ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(108px,1fr))", gap: 10 }}>
                                    {filteredItems.map((item) => {
                                        const ref = tintFor(item.categoryId);
                                        const line = cart.items.find((i) => i.service.id === item.id);
                                        const qty = line?.quantity ?? 0;
                                        const inCart = qty > 0;
                                        const isKg = isWeightUnit(item.pricingType);
                                        const name = getTranslatedItemName(item.name);
                                        const unitLabel = getTranslatedUnit(item.pricingType === "piece" ? "piece" : item.pricingType);
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => { if (isKg) { setSelectedItem(item); setItemDetailOpen(true); } else { cart.addItem(item); } }}
                                                style={{ cursor: "pointer", textAlign: "left", font: "inherit", display: "flex", flexDirection: "column", background: "var(--c-surface)", border: `1.5px solid ${inCart ? "var(--c-primary)" : "var(--c-border)"}`, borderRadius: 11, overflow: "hidden", boxShadow: "var(--sh-sm)", position: "relative", padding: 0 }}
                                            >
                                                <div style={{ aspectRatio: "1 / 1", background: `var(--${ref}-soft)`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                                                    {item.imageUrl ? <img src={item.imageUrl} alt={name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <Shirt size={26} />}
                                                    {inCart && <span style={{ position: "absolute", top: 6, right: 6, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 10, background: "var(--c-primary)", color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: MONO, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--sh-sm)" }}>{isKg ? qty.toFixed(1) : qty}</span>}
                                                </div>
                                                <div style={{ padding: "7px 9px 9px" }}>
                                                    <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                                                    <div style={{ marginTop: 2, display: "flex", alignItems: "baseline", gap: 3 }}>
                                                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13 }}>{fmt(item.basePrice)}</span>
                                                        <span style={{ fontSize: 9.5, color: "var(--c-text-3)" }}>/ {unitLabel}</span>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* cart */}
                        <div style={{ flex: "1 1 280px", minWidth: 0, position: "sticky", top: 16, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, boxShadow: "var(--sh-md)", overflow: "hidden" }}>
                            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 9 }}>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>Your order</div>
                                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", padding: "2px 8px", borderRadius: 20, fontFamily: MONO }}>{cart.items.reduce((s, i) => s + i.quantity, 0)}</span>
                            </div>
                            {cartHasItems ? (
                                <div className="lb-scroll" style={{ maxHeight: 280, overflow: "auto", padding: "6px 12px" }}>
                                    {cart.items.map((l) => {
                                        const ref = tintFor(l.service.name);
                                        return (
                                            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px" }}>
                                                <span style={{ width: 34, height: 34, flex: "none", borderRadius: 8, background: `var(--${ref}-soft)`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBasket size={16} /></span>
                                                <button onClick={() => { setSelectedItem(l.service); setItemDetailOpen(true); }} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: 0, cursor: "pointer", font: "inherit", padding: 0 }}>
                                                    <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getTranslatedItemName(l.service.name)}{l.express ? " ⚡" : ""}</div>
                                                    <div style={{ fontSize: 10.5, color: "var(--c-text-3)", fontFamily: MONO }}>{fmt(l.unitPrice)}</div>
                                                </button>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <button onClick={() => (l.quantity <= 1 ? cart.removeItem(l.id) : cart.updateItem(l.id, { quantity: l.quantity - 1 }))} aria-label="Remove" style={{ cursor: "pointer", width: 25, height: 25, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 7 }}>{l.quantity <= 1 ? <Trash2 size={12} /> : <Minus size={12} />}</button>
                                                    <span style={{ minWidth: 16, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 12.5 }}>{l.quantity}</span>
                                                    <button onClick={() => cart.updateItem(l.id, { quantity: l.quantity + 1 })} aria-label="Add" style={{ cursor: "pointer", width: 25, height: 25, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 7 }}><Plus size={12} /></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ padding: "26px 18px", textAlign: "center", color: "var(--c-text-3)", fontSize: 12.5 }}>Tap items to add them to your order</div>
                            )}
                            <div style={{ padding: "13px 16px", borderTop: "1px solid var(--c-border)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
                                    <span style={{ fontSize: 13, color: "var(--c-text-2)" }}>Estimated total</span>
                                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 18 }}>{fmt(cart.total)}</span>
                                </div>
                                <button onClick={() => { if (!cart.pickupDate) cart.setPickupSlot(today, cart.pickupSlot); setCheckoutOpen(true); }} disabled={!cartHasItems} style={{ width: "100%", cursor: cartHasItems ? "pointer" : "not-allowed", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: cartHasItems ? "var(--c-primary)" : "var(--c-border-strong)", border: 0, borderRadius: 11, padding: 13 }}>
                                    Continue to pickup
                                </button>
                            </div>
                        </div>
                        </div>
                    </div>
                )}

                {/* testimonials */}
                {testimonials.length > 0 && (
                    <div style={{ marginTop: 40 }}>
                        <div style={{ textAlign: "center", marginBottom: 16 }}>
                            <div style={{ color: "var(--c-star,#E8A317)", display: "inline-flex", gap: 2 }}>{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={16} fill="currentColor" />)}</div>
                            <div style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 4 }}>Loved by our customers</div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                            {testimonials.map((tm, i) => {
                                const ref = tintFor(tm.author || String(i));
                                return (
                                    <div key={tm.id || i} style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, padding: 18, boxShadow: "var(--sh-sm)" }}>
                                        <div style={{ color: "var(--c-star,#E8A317)", display: "inline-flex", gap: 1, marginBottom: 9 }}>{Array.from({ length: 5 }).map((_, j) => <Star key={j} size={13} fill="currentColor" />)}</div>
                                        <div style={{ fontSize: 13.5, color: "var(--c-text-2)", lineHeight: 1.6 }}>"{tm.quote}"</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                                            <span style={{ width: 32, height: 32, flex: "none", borderRadius: "50%", background: `var(--${ref}-soft)`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>{(tm.author || "?").slice(0, 1).toUpperCase()}</span>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600 }}>{tm.author}</div>
                                                {(tm.location || tm.ordersCount != null) && <div style={{ fontSize: 11, color: "var(--c-text-3)" }}>{tm.location || `${tm.ordersCount} orders`}</div>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* footer */}
                <div style={{ marginTop: 40, paddingTop: 22, borderTop: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{shop.name}</span>
                    {(shop.phone || shop.email) && <span style={{ fontSize: 12.5, color: "var(--c-text-3)" }}>· {[shop.phone, shop.email].filter(Boolean).join(" · ")}</span>}
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--c-text-3)" }}>Powered by LaundryBill</span>
                </div>
            </div>

            {/* success */}
            <PublicOrderSuccessSheet
                open={!!successPublicId}
                onClose={() => { setSuccessPublicId(null); const slug = shop.publicOrdering?.slug; if (slug) navigate(`/order/${slug}`); }}
                publicId={successPublicId || ""}
                phone={successPhone}
            />

            {/* item detail */}
            <ItemDetailSheet
                open={itemDetailOpen}
                onClose={() => { setItemDetailOpen(false); setSelectedItem(null); }}
                item={selectedItem || undefined}
                initialValues={selectedItem ? (() => { const ex = cart.items.find((i) => i.service.id === selectedItem.id); return ex ? { quantity: ex.quantity, express: ex.express, notes: ex.notes } : undefined; })() : undefined}
                onAdd={(item, qty, express, notes) => { cart.addItem(item, qty, express, notes); setItemDetailOpen(false); setSelectedItem(null); }}
            />

            {/* checkout dialog (Full order final step) */}
            <LResponsiveDialog open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Pickup details" size="lg">
                <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 18, maxHeight: "80vh", overflowY: "auto" }}>
                    {placing && (
                        <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, minHeight: 280, borderRadius: 12, background: "rgba(255,255,255,.97)" }}>
                            <Loader2 size={32} className="animate-spin" style={{ color: "var(--c-primary)" }} />
                            <div style={{ fontSize: 16, fontWeight: 700 }}>Placing your order…</div>
                            <div style={{ fontSize: 13, color: "var(--c-text-3)" }}>Please wait, don't close this window.</div>
                        </div>
                    )}

                    {/* summary */}
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Order summary</div>
                        <LOrderSummary
                            items={cart.items.map((i) => ({ id: i.id, name: getTranslatedItemName(i.service.name), categoryName: i.service.categoryName, quantity: i.quantity, price: i.unitPrice, express: i.express, processingDays: i.express ? 1 : i.service.turnaroundDays }))}
                            subtotal={cart.subtotal}
                            discount={cart.discountAmount}
                            taxAmount={cart.taxAmount}
                            taxRate={cart.taxRate}
                            taxName={cart.taxName}
                            delivery={cart.deliveryCharge}
                            total={cart.total}
                        />
                        {(shop.settings?.publicCoupons?.length ?? 0) > 0 && (
                            <div style={{ marginTop: 12 }}>
                                <PublicCheckoutCoupon
                                    shop={shop}
                                    subtotal={cart.subtotal}
                                    discountAmount={cart.discountAmount}
                                    appliedCoupon={cart.discountType ? { type: cart.discountType, value: cart.discountValue ?? 0 } : null}
                                    onApply={(type, value) => cart.setDiscount(type, value)}
                                    onRemove={() => cart.setDiscount(undefined, undefined)}
                                />
                            </div>
                        )}
                    </div>

                    {/* area */}
                    {hasAreas && (
                        <div>
                            <label style={lbl}>Service area *</label>
                            <select style={fld} value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                                <option value="">Select your area</option>
                                {areas.map((a) => <option key={a.id} value={a.value}>{a.value}</option>)}
                            </select>
                        </div>
                    )}

                    {/* distance band */}
                    {bandSelector}

                    {/* slots */}
                    {slotBlock}

                    {/* address */}
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, marginBottom: 10 }}><MapPin size={16} style={{ color: "var(--c-primary)" }} /> Pickup address</div>
                        {addressBlock}
                    </div>

                    {/* notes */}
                    <LTextArea label="Special instructions (optional)" value={cart.customerNotes} onChange={(e) => cart.setCustomerNotes(e.target.value)} placeholder="e.g. Ring the doorbell twice" rows={3} />

                    {/* contact */}
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, marginBottom: 10 }}><User size={16} style={{ color: "var(--c-primary)" }} /> Your details</div>
                        {detailsInputs}
                    </div>

                    <div style={{ display: "flex", gap: 12 }}>
                        <button onClick={() => setCheckoutOpen(false)} style={{ flex: 1, cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 11, padding: 13 }}>Back</button>
                        <button onClick={() => placeOrder(false)} disabled={placing} style={{ flex: 1.4, cursor: placing ? "wait" : "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 13, boxShadow: "var(--sh-sm)", opacity: placing ? 0.7 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            {placing ? <><Loader2 size={17} className="animate-spin" /> Placing…</> : `Place order · ${fmt(cart.total)}`}
                        </button>
                    </div>
                </div>
            </LResponsiveDialog>
        </div>
    );
}
