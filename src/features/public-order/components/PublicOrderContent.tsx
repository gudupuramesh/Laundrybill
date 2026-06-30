/**
 * Public Order Content — POS-style, mobile-first booking.
 *
 * Two tabs that mirror the mobile app:
 *  • Book Pickup (quick): estimated weight + pieces, date strip, slot, address,
 *    contact → books a 0-item order (isQuickOrder) priced by the shop at intake.
 *  • Price Calculator: POS-style item rows with +/- steppers + a sticky bottom
 *    bar → pickup details dialog → itemised order with a real total.
 *
 * The shop header/hero is rendered by PublicOrderHero in the page wrapper.
 * All order logic (cart, slots, geocoding, order creation) is preserved.
 */

import { useState, useEffect, useMemo, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import {
    LOrderSummary,
    useLToast,
} from "@/components/laundry";
import { useInventoryForShop } from "../hooks/use-inventory-for-shop";
import { usePublicCart } from "../hooks/use-public-cart";
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
import { MapPin, User, Clock, Loader2, Plus, Minus, Star, Info, Search, CalendarClock, ClipboardList, Check, ChevronLeft } from "lucide-react";
import { getTranslatedItemName, getTranslatedUnit, isWeightUnit } from "@/lib/inventory-translations";
import { format } from "date-fns";
import { formatCurrencyValue } from "@/hooks/use-currency";
import { getCountry, getCountryByCurrency, COUNTRIES } from "@/config/countries";
import { useNavigate } from "react-router-dom";
import { forwardGeocode } from "@/lib/geocoding";
import type { PublicDeliveryAddress } from "../hooks/use-public-cart";

const MONO = "'IBM Plex Mono'";
const TINTS = ["c-primary", "c-violet", "c-cyan", "c-info", "c-success", "c-warning"];
const tintFor = (s: string) => TINTS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];

const WEIGHT_OPTS = ["< 5 kg", "5–10 kg", "> 10 kg"];
const PIECES_OPTS = ["1–5 pcs", "6–10 pcs", "> 10 pcs"];

type OrderMode = "quick" | "select";

interface PublicOrderContentProps {
    shop: Shop;
    onOrderingActive?: (active: boolean) => void;
    onCheckoutOpenChange?: (open: boolean) => void;
    onCartHasItemsChange?: (hasItems: boolean) => void;
}

export function PublicOrderContent({ shop, onOrderingActive, onCheckoutOpenChange, onCartHasItemsChange }: PublicOrderContentProps) {
    const [mode, setMode] = useState<OrderMode>("quick");
    const [estWeight, setEstWeight] = useState("");
    const [estPieces, setEstPieces] = useState("");
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [confirmPhone, setConfirmPhone] = useState("");
    const [search, setSearch] = useState("");
    const [selectedArea, setSelectedArea] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(""); // "" = All
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
    // Phone country defaults to the shop's country, but the customer can change it —
    // e.g. a US visitor at a UAE shop keeps their own +1 number instead of being
    // forced into +971 (which would store a broken number and break WhatsApp).
    const shopCountry = shop.settings?.countryCode ? getCountry(shop.settings.countryCode) : getCountryByCurrency(shop.settings?.currency || "INR");
    const [phoneCountryIso, setPhoneCountryIso] = useState(shopCountry.code);
    const phoneCountry = getCountry(phoneCountryIso);
    const dialCode = phoneCountry.phoneCode;
    const localPhoneDigits = phoneCountry.phoneDigits || 10;
    const deliverySettings = shop.settings?.delivery;
    const areas = (deliverySettings?.serviceAreas || []).filter((a) => a.isActive);
    const hasAreas = areas.length > 0;
    const pickupSlots = (deliverySettings?.pickupTimeSlots || []).filter((s) => s.isActive);
    const slotsEnabled = !!deliverySettings?.enablePickupSlots && pickupSlots.length > 0;

    const { items, categories, loading } = useInventoryForShop(shop.id);
    const cart = usePublicCart(shop);

    const today = format(new Date(), "yyyy-MM-dd");
    const checkoutDate = cart.pickupDate || today;
    const { data: slotAvailability } = usePublicSlotAvailability(shop.publicOrdering?.slug, checkoutDate);

    const openStatus = getShopOpenStatus(shop);
    const featuredCode = shop.publicOrdering?.featuredCouponCode;
    const offerText = shop.publicOrdering?.offerText?.trim();
    const offerEnabled = (shop.publicOrdering?.offerEnabled ?? !!featuredCode) && (!!offerText || !!featuredCode);
    const testimonials = shop.publicOrdering?.testimonials ?? [];
    const minOrderValue = shop.publicOrdering?.minOrderValue || 0;
    // Enforced only on the Price Calculator (priced items). Book Pickup is priced at intake, so it's informational there.
    const belowMin = minOrderValue > 0 && cart.total < minOrderValue;

    // next 6 days for the date strip
    const dateCards = useMemo(() => Array.from({ length: 6 }, (_, i) => {
        const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
        return {
            value: format(d, "yyyy-MM-dd"),
            dow: i === 0 ? "TODAY" : i === 1 ? "TMRW" : format(d, "EEE").toUpperCase(),
            day: format(d, "d"),
            mon: format(d, "MMM").toUpperCase(),
        };
    }), []);

    useEffect(() => { onOrderingActive?.(false); }, [onOrderingActive]);
    useEffect(() => { onCheckoutOpenChange?.(checkoutOpen); }, [checkoutOpen, onCheckoutOpenChange]);
    const cartHasItems = cart.items.some((i) => i.quantity > 0);
    useEffect(() => { onCartHasItemsChange?.(cartHasItems); }, [cartHasItems, onCartHasItemsChange]);

    // default pickup date = today (once)
    useEffect(() => { if (!cart.pickupDate) cart.setPickupSlot(today, cart.pickupSlot); /* eslint-disable-next-line */ }, []);

    const filteredItems = items.filter((item) =>
        item.isActive &&
        (!selectedCategory || item.categoryId === selectedCategory) &&
        (!search.trim() || getTranslatedItemName(item.name).toLowerCase().includes(search.trim().toLowerCase()))
    );

    // Only categories that actually have active items — avoids empty tabs (e.g. "Iron")
    // that show nothing when selected, and powers the Book Pickup service chips.
    const activeCategories = useMemo(
        () => categories.filter((c) => items.some((it) => it.isActive && it.categoryId === c.id)),
        [categories, items]
    );

    const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);
    const canPlaceOrder = cart.customerName.trim().length > 0 && cart.customerPhone.replace(/\D/g, "").length >= localPhoneDigits;

    const placeOrder = async (isQuick: boolean) => {
        if (!canPlaceOrder) {
            addToast({ type: "error", title: "Add your details", description: "Name and a valid phone number are required." });
            return;
        }
        if (confirmPhone.trim() && confirmPhone.replace(/\D/g, "") !== cart.customerPhone.replace(/\D/g, "")) {
            addToast({ type: "error", title: "Phone numbers don't match" });
            return;
        }
        if (hasAreas && !selectedArea) {
            addToast({ type: "error", title: "Select your area" });
            return;
        }
        if (slotsEnabled && !cart.pickupSlot) {
            addToast({ type: "error", title: "Choose a pickup time" });
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
            addToast({ type: "error", title: "Flat / building number is required" });
            return;
        }

        flushSync(() => setIsPlacingOrder(true));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        try {
            let effectiveAddress: PublicDeliveryAddress;
            if (hasLatLng) {
                effectiveAddress = { lat: addr.lat, lng: addr.lng, flatNumber: addr.flatNumber?.trim(), landmark: addr.landmark?.trim() || undefined, fullAddress: addr.fullAddress?.trim() || undefined };
            } else {
                // Typed address — try to geocode for a map pin, but DON'T block the order if it fails.
                const q = [addr.flatNumber?.trim(), addr.landmark?.trim(), addr.fullAddress?.trim()].filter(Boolean).join(", ");
                const geocoded = await forwardGeocode(q).catch(() => null);
                effectiveAddress = geocoded
                    ? { lat: geocoded.lat, lng: geocoded.lng, flatNumber: addr.flatNumber?.trim(), landmark: addr.landmark?.trim() || undefined, fullAddress: addr.fullAddress?.trim() || undefined }
                    : { flatNumber: addr.flatNumber?.trim(), landmark: addr.landmark?.trim() || undefined, fullAddress: addr.fullAddress?.trim() || undefined };
            }

            const effectiveDeliveryCharge = isQuick && cart.deliveryCharge === 0 ? getDeliveryCharge(shop.settings?.delivery, 0, "pickup_home") || 50 : cart.deliveryCharge;
            const effectiveTotal = isQuick ? effectiveDeliveryCharge : cart.total;

            const result = await createPublicOrder(shop, {
                deliveryArea: selectedArea,
                customerName: cart.customerName.trim(),
                customerPhone: cart.customerPhone,
                phoneCountryCode: dialCode,
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
                customerNotes: cart.customerNotes.trim() || undefined,
                isQuickOrder: isQuick,
                deliveryBandId: cart.deliveryBandId,
                estimatedWeight: isQuick ? (estWeight || undefined) : undefined,
                estimatedPieces: isQuick ? (estPieces || undefined) : undefined,
                requestedServices: isQuick && selectedServices.length ? selectedServices : undefined,
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
    const fld: CSSProperties = { width: "100%", font: "inherit", fontSize: 14, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 12, padding: "13px 14px", outline: "none" };
    const sectLbl: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 9, color: "var(--c-text-3)" };
    const cardStyle: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, boxShadow: "var(--sh-sm)", padding: 18 };
    const placing = isPlacingOrder || creatingOrder;

    const chipGroup = (opts: string[], value: string, onPick: (v: string) => void) => (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {opts.map((o) => {
                const on = o === value;
                return (
                    <button key={o} type="button" onClick={() => onPick(on ? "" : o)} style={{ cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, padding: "11px 4px", borderRadius: 12, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border-strong)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" }}>{o}</button>
                );
            })}
        </div>
    );

    const dateStrip = (
        <div className="lb-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {dateCards.map((d) => {
                const on = checkoutDate === d.value;
                return (
                    <button key={d.value} type="button" onClick={() => cart.setPickupSlot(d.value, cart.pickupSlot)} style={{ cursor: "pointer", font: "inherit", flex: "none", width: 72, padding: "10px 0", borderRadius: 14, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border-strong)"}`, background: on ? "var(--c-primary)" : "var(--c-surface)", color: on ? "#fff" : "var(--c-text-2)", textAlign: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>{d.dow}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: MONO, lineHeight: 1.2 }}>{d.day}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>{d.mon}</div>
                    </button>
                );
            })}
        </div>
    );

    const slotChips = slotsEnabled ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {pickupSlots.map((s) => {
                const val = (s.value || "").trim();
                const on = cart.pickupSlot === val;
                const avail = (slotAvailability as Record<string, { remaining?: number } | undefined> | null | undefined)?.[val];
                const full = !!avail && typeof avail.remaining === "number" && avail.remaining <= 0;
                return (
                    <button key={s.id || val} type="button" disabled={full} onClick={() => cart.setPickupSlot(checkoutDate, val)} style={{ cursor: full ? "not-allowed" : "pointer", font: "inherit", fontSize: 13, fontWeight: 600, padding: "10px 15px", borderRadius: 12, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border-strong)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: full ? "var(--c-text-3)" : on ? "var(--c-primary)" : "var(--c-text-2)", opacity: full ? 0.5 : 1 }}>{val}{full ? " · full" : ""}</button>
                );
            })}
        </div>
    ) : null;

    const addressBlock = (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <PublicLocationMap
                lat={cart.deliveryAddress?.lat}
                lng={cart.deliveryAddress?.lng}
                onLocationChange={(lat, lng) => cart.setDeliveryAddress({ ...(cart.deliveryAddress || {}), lat, lng })}
                onAddressChange={(addr) => cart.setDeliveryAddressMerge({ fullAddress: addr })}
                autoGetLocationOnMount={false}
            />
            <input style={fld} placeholder="Flat / Building No. / Floor *" value={cart.deliveryAddress?.flatNumber ?? ""} onChange={(e) => cart.setDeliveryAddressMerge({ flatNumber: e.target.value })} />
            <input style={fld} placeholder="Road / Street / Area Name *" value={cart.deliveryAddress?.fullAddress ?? ""} onChange={(e) => cart.setDeliveryAddressMerge({ fullAddress: e.target.value })} />
        </div>
    );

    const phoneFieldWrap: CSSProperties = { flex: 1, minWidth: 0, display: "flex", alignItems: "stretch", border: "1px solid var(--c-border-strong)", borderRadius: 12, overflow: "hidden", background: "var(--c-surface)" };
    const dialPrefix: CSSProperties = { display: "flex", alignItems: "center", padding: "0 11px", background: "var(--c-surface-2)", color: "var(--c-text-2)", fontFamily: MONO, fontSize: 13.5, fontWeight: 600, borderRight: "1px solid var(--c-border)", whiteSpace: "nowrap" };
    const dialSelect: CSSProperties = { appearance: "none", WebkitAppearance: "none", MozAppearance: "none", border: 0, borderRight: "1px solid var(--c-border)", background: "var(--c-surface-2)", color: "var(--c-text-2)", fontFamily: MONO, fontSize: 13.5, fontWeight: 600, padding: "0 8px", cursor: "pointer", outline: "none", flex: "none" } as CSSProperties;
    const phoneInput: CSSProperties = { flex: 1, minWidth: 0, font: "inherit", fontFamily: MONO, fontSize: 14, color: "var(--c-text)", background: "transparent", border: 0, padding: "13px 12px", outline: "none" };
    // 🇦🇪-style flag from an ISO-3166 alpha-2 code (regional indicator symbols).
    const flagEmoji = (iso: string) => (iso || "").toUpperCase().replace(/[A-Z]/g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
    const contactBlock = (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input style={fld} placeholder="Full Name *" value={cart.customerName} onChange={(e) => cart.setCustomer(e.target.value, cart.customerPhone, cart.customerEmail)} />
            <div style={{ display: "flex", gap: 10 }}>
                <div style={phoneFieldWrap}>
                    <select style={dialSelect} value={phoneCountryIso} onChange={(e) => setPhoneCountryIso(e.target.value)} aria-label="Country code" title="Country code">
                        {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{flagEmoji(c.code)} {c.phoneCode}</option>)}
                    </select>
                    <input style={phoneInput} inputMode="tel" placeholder="Phone Number *" value={cart.customerPhone} onChange={(e) => cart.setCustomer(cart.customerName, e.target.value.replace(/[^\d]/g, ""), cart.customerEmail)} />
                </div>
                <div style={phoneFieldWrap}>
                    <span style={dialPrefix}>{dialCode}</span>
                    <input style={phoneInput} inputMode="tel" placeholder="Confirm Phone *" value={confirmPhone} onChange={(e) => setConfirmPhone(e.target.value.replace(/[^\d]/g, ""))} />
                </div>
            </div>
        </div>
    );

    // category tabs (All + categories) for the Price Calculator
    const categoryTabs = (
        <div className="lb-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {[{ id: "", name: "All" }, ...activeCategories].map((c) => {
                const on = c.id === selectedCategory;
                return (
                    <button key={c.id || "all"} onClick={() => setSelectedCategory(c.id)} style={{ cursor: "pointer", font: "inherit", flex: "none", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 20, whiteSpace: "nowrap", border: `1.5px solid ${on ? "var(--c-text)" : "var(--c-border-strong)"}`, background: on ? "var(--c-text)" : "var(--c-surface)", color: on ? "#fff" : "var(--c-text-2)" }}>{c.name}</button>
                );
            })}
        </div>
    );

    return (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "var(--c-bg)" }} className="lb-scroll" data-testid="public-order-page">
            <div style={{ maxWidth: 560, margin: "0 auto", padding: "18px 16px 120px" }}>
                {/* closed banner */}
                {!openStatus.isOpen && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--c-warning-soft)", border: "1px solid var(--c-warning-soft)", color: "var(--c-warning)", borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 13 }}>
                        <Clock size={16} /> Currently closed — you can still book for the next available day.
                    </div>
                )}

                {/* offer banner */}
                {offerEnabled && (
                    <div style={{ background: "linear-gradient(135deg,var(--c-primary),#11338E)", color: "#fff", borderRadius: 14, padding: "12px 15px", display: "flex", alignItems: "center", gap: 12, marginBottom: 14, boxShadow: "var(--sh-sm)" }}>
                        <span style={{ fontSize: 20 }}>🎉</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{offerText || "Special offer for you"}</div>
                            {featuredCode && <div style={{ fontSize: 12, opacity: 0.85 }}>Apply the code at checkout</div>}
                        </div>
                        {featuredCode && <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, background: "rgba(255,255,255,.2)", padding: "6px 12px", borderRadius: 8, border: "1px dashed rgba(255,255,255,.55)", whiteSpace: "nowrap" }}>{featuredCode}</span>}
                    </div>
                )}

                {!(mode === "select" && checkoutOpen) && (<>
                {/* tab toggle */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    {([["quick", "Book Pickup", CalendarClock], ["select", "Price Calculator", ClipboardList]] as const).map(([m, label, Icon]) => {
                        const on = mode === m;
                        return (
                            <button key={m} onClick={() => setMode(m)} aria-pressed={on} style={{ flex: 1, cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 700, padding: "12px 8px", border: `1.5px solid ${on ? "var(--c-text)" : "var(--c-border)"}`, borderRadius: 14, background: on ? "var(--c-surface)" : "var(--c-surface-2)", color: on ? "var(--c-text)" : "var(--c-text-3)", boxShadow: on ? "var(--sh-sm)" : undefined, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                                <Icon size={17} /> {label}
                            </button>
                        );
                    })}
                </div>

                {/* info banner */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, padding: "12px 14px", marginBottom: 16, boxShadow: "var(--sh-sm)" }}>
                    <span style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Info size={16} /></span>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--c-text-2)" }}>Pay on delivery</span>
                    <span style={{ fontSize: 12.5, color: "var(--c-text-3)", textAlign: "right" }}>Weighed &amp; priced at pickup</span>
                </div>

                {/* minimum order value */}
                {minOrderValue > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -6, marginBottom: 16, padding: "9px 14px", borderRadius: 12, background: "var(--c-warning-soft)", color: "var(--c-warning)", fontSize: 12.5, fontWeight: 600 }}>
                        <Info size={14} style={{ flex: "none" }} /> Minimum order {fmt(minOrderValue)}
                    </div>
                )}
                </>)}

                {/* ───────── BOOK PICKUP (quick) ───────── */}
                {mode === "quick" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {activeCategories.length > 0 && (
                            <div style={cardStyle}>
                                <div style={sectLbl}>What services do you need?</div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {activeCategories.map((c) => {
                                        const on = selectedServices.includes(c.name);
                                        return (
                                            <button key={c.id} type="button" onClick={() => setSelectedServices((prev) => on ? prev.filter((x) => x !== c.name) : [...prev, c.name])} style={{ cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, padding: "10px 15px", borderRadius: 20, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border-strong)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                {on && <Check size={14} />}{c.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div style={cardStyle}>
                            <div style={sectLbl}>Estimated weight</div>
                            {chipGroup(WEIGHT_OPTS, estWeight, setEstWeight)}
                            <div style={{ ...sectLbl, marginTop: 18 }}>Estimated pieces</div>
                            {chipGroup(PIECES_OPTS, estPieces, setEstPieces)}
                        </div>

                        <div style={cardStyle}>
                            <div style={sectLbl}>Select pickup date</div>
                            {dateStrip}
                            {slotsEnabled && (<><div style={{ ...sectLbl, marginTop: 18 }}>Preferred time</div>{slotChips}</>)}
                        </div>

                        {hasAreas && (
                            <div style={cardStyle}>
                                <div style={sectLbl}>Service area</div>
                                <select style={fld} value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                                    <option value="">Select your area</option>
                                    {areas.map((a) => <option key={a.id} value={a.value}>{a.value}</option>)}
                                </select>
                            </div>
                        )}

                        <div style={cardStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, ...sectLbl }}><MapPin size={14} /> Pickup address</div>
                            {addressBlock}
                        </div>

                        <div style={cardStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, ...sectLbl }}><User size={14} /> Contact details</div>
                            {contactBlock}
                            <div style={{ marginTop: 10 }}>
                                <textarea rows={2} style={{ ...fld, resize: "vertical" }} placeholder="Special Instructions (Optional)" value={cart.customerNotes} onChange={(e) => cart.setCustomerNotes(e.target.value)} />
                            </div>
                        </div>

                        <button onClick={() => placeOrder(true)} disabled={placing} style={{ width: "100%", cursor: placing ? "wait" : "pointer", font: "inherit", fontSize: 16, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 14, padding: 15, boxShadow: "var(--sh-md)", opacity: placing ? 0.7 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            {placing ? <><Loader2 size={18} className="animate-spin" /> Booking…</> : "Schedule Pickup →"}
                        </button>
                    </div>
                )}

                {/* ───────── PRICE CALCULATOR (itemised) ───────── */}
                {mode === "select" && !checkoutOpen && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ ...cardStyle, padding: 16 }}>
                            <div style={{ fontSize: 17, fontWeight: 800 }}>Price Calculator</div>
                            <div style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 2, marginBottom: 14 }}>Select items to view prices.</div>
                            <div style={{ position: "relative", marginBottom: 14 }}>
                                <Search size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                                <input style={{ ...fld, paddingLeft: 38, background: "var(--c-surface-2)" }} placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
                            </div>
                            {categoryTabs}
                        </div>

                        {loading ? (
                            <div style={{ padding: 40, textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>Loading services…</div>
                        ) : filteredItems.length === 0 ? (
                            <div style={{ padding: 40, textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>No items found.</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {filteredItems.map((item) => {
                                    const line = cart.items.find((i) => i.service.id === item.id);
                                    const qty = line?.quantity ?? 0;
                                    const isKg = isWeightUnit(item.pricingType);
                                    const name = getTranslatedItemName(item.name);
                                    const unitLabel = getTranslatedUnit(item.pricingType === "piece" ? "piece" : item.pricingType);
                                    const dec = () => { if (qty <= 0 || !line) return; if (isKg) { setSelectedItem(item); setItemDetailOpen(true); } else { qty <= 1 ? cart.removeItem(line.id) : cart.updateItem(line.id, { quantity: qty - 1 }); } };
                                    const inc = () => { if (isKg) { setSelectedItem(item); setItemDetailOpen(true); } else { cart.addItem(item); } };
                                    return (
                                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--c-surface)", border: `1px solid ${qty > 0 ? "var(--c-primary)" : "var(--c-border)"}`, borderRadius: 14, padding: "13px 14px", boxShadow: "var(--sh-sm)" }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                {item.categoryName && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)" }}>{item.categoryName}</div>}
                                                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                                                <div style={{ marginTop: 2, display: "flex", alignItems: "baseline", gap: 3 }}>
                                                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13.5, color: "var(--c-primary)" }}>{fmt(item.basePrice)}</span>
                                                    <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>/ {unitLabel}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "none" }}>
                                                <button onClick={dec} disabled={qty <= 0} aria-label="Remove" style={{ cursor: qty <= 0 ? "default" : "pointer", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: qty <= 0 ? "var(--c-text-3)" : "var(--c-text)", background: "var(--c-surface)", border: "1.5px solid var(--c-border-strong)", borderRadius: "50%", opacity: qty <= 0 ? 0.5 : 1 }}><Minus size={16} /></button>
                                                <span style={{ minWidth: 26, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 15 }}>{isKg ? (qty ? qty.toFixed(1) : 0) : qty}</span>
                                                <button onClick={inc} aria-label="Add" style={{ cursor: "pointer", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-primary)", background: "var(--c-surface)", border: "1.5px solid var(--c-primary)", borderRadius: "50%" }}><Plus size={16} /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* sticky cart bar — shows on item add; opens the checkout step (no popup) */}
                        {cartHasItems && (
                            <div style={{ position: "sticky", bottom: 0, marginTop: 4, display: "flex", flexDirection: "column", gap: 8, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, boxShadow: "var(--sh-md)", padding: "12px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", color: "var(--c-text-3)" }}>{cartCount} ITEM{cartCount === 1 ? "" : "S"} ADDED</div>
                                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: MONO }}>{fmt(cart.total)}</div>
                                    </div>
                                    <button onClick={() => { if (!cart.pickupDate) cart.setPickupSlot(today, cart.pickupSlot); setCheckoutOpen(true); window.scrollTo({ top: 0, behavior: "auto" }); }} disabled={belowMin} style={{ cursor: belowMin ? "not-allowed" : "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: belowMin ? "var(--c-border-strong)" : "var(--c-primary)", border: 0, borderRadius: 12, padding: "13px 22px", display: "inline-flex", alignItems: "center", gap: 8 }}>Schedule Pickup →</button>
                                </div>
                                {belowMin && <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--c-warning)" }}>Add {fmt(minOrderValue - cart.total)} more to reach the minimum order of {fmt(minOrderValue)}.</div>}
                            </div>
                        )}
                    </div>
                )}

                {/* ───────── CHECKOUT STEP (Price Calculator → pickup details, full page, no popup) ───────── */}
                {mode === "select" && checkoutOpen && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 2 }}>
                            <button onClick={() => setCheckoutOpen(false)} aria-label="Back" style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 10, padding: "9px 13px" }}><ChevronLeft size={16} /> Back</button>
                            <div style={{ fontSize: 17, fontWeight: 800 }}>Pickup details</div>
                        </div>

                        <div style={cardStyle}>
                            <div style={{ ...sectLbl, marginBottom: 12 }}>Order summary</div>
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

                        {hasAreas && (
                            <div style={cardStyle}>
                                <div style={sectLbl}>Service area *</div>
                                <select style={fld} value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
                                    <option value="">Select your area</option>
                                    {areas.map((a) => <option key={a.id} value={a.value}>{a.value}</option>)}
                                </select>
                            </div>
                        )}

                        <div style={cardStyle}>
                            <div style={sectLbl}>Select pickup date</div>
                            {dateStrip}
                            {slotsEnabled && (<><div style={{ ...sectLbl, marginTop: 18 }}>Preferred time</div>{slotChips}</>)}
                        </div>

                        <div style={cardStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, ...sectLbl }}><MapPin size={14} /> Pickup address</div>
                            {addressBlock}
                        </div>

                        <div style={cardStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, ...sectLbl }}><User size={14} /> Contact details</div>
                            {contactBlock}
                            <div style={{ marginTop: 10 }}>
                                <textarea rows={2} style={{ ...fld, resize: "vertical" }} placeholder="Special Instructions (Optional)" value={cart.customerNotes} onChange={(e) => cart.setCustomerNotes(e.target.value)} />
                            </div>
                        </div>

                        {belowMin && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--c-warning-soft)", color: "var(--c-warning)", fontSize: 12.5, fontWeight: 600 }}>
                                <Info size={14} style={{ flex: "none" }} /> Add {fmt(minOrderValue - cart.total)} more to reach the minimum order of {fmt(minOrderValue)}.
                            </div>
                        )}

                        <button onClick={() => placeOrder(false)} disabled={placing || belowMin} style={{ width: "100%", cursor: (placing || belowMin) ? "not-allowed" : "pointer", font: "inherit", fontSize: 16, fontWeight: 700, color: "#fff", background: belowMin ? "var(--c-border-strong)" : "var(--c-primary)", border: 0, borderRadius: 14, padding: 15, boxShadow: "var(--sh-md)", opacity: placing ? 0.7 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            {placing ? <><Loader2 size={18} className="animate-spin" /> Placing…</> : `Schedule Pickup · ${fmt(cart.total)}`}
                        </button>
                    </div>
                )}

                {/* testimonials */}
                {testimonials.length > 0 && (
                    <div style={{ marginTop: 34 }}>
                        <div style={{ textAlign: "center", marginBottom: 14 }}>
                            <div style={{ color: "var(--c-star,#E8A317)", display: "inline-flex", gap: 2 }}>{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={15} fill="currentColor" />)}</div>
                            <div style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 4 }}>Loved by our customers</div>
                        </div>
                        <div style={{ display: "grid", gap: 12 }}>
                            {testimonials.slice(0, 3).map((tm, i) => {
                                const ref = tintFor(tm.author || String(i));
                                return (
                                    <div key={tm.id || i} style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, padding: 16, boxShadow: "var(--sh-sm)" }}>
                                        <div style={{ fontSize: 13.5, color: "var(--c-text-2)", lineHeight: 1.6 }}>"{tm.quote}"</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                                            <span style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: `var(--${ref}-soft)`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>{(tm.author || "?").slice(0, 1).toUpperCase()}</span>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{tm.author}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* footer */}
                <div style={{ marginTop: 30, paddingTop: 18, borderTop: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{shop.name}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--c-text-3)" }}>Powered by LaundryBill</span>
                </div>
            </div>

            {/* success */}
            <PublicOrderSuccessSheet
                open={!!successPublicId}
                onClose={() => { setSuccessPublicId(null); const slug = shop.publicOrdering?.slug; if (slug) navigate(`/${slug}`); }}
                publicId={successPublicId || ""}
                phone={successPhone}
            />

            {/* item detail (weight items) */}
            <ItemDetailSheet
                open={itemDetailOpen}
                onClose={() => { setItemDetailOpen(false); setSelectedItem(null); }}
                item={selectedItem || undefined}
                initialValues={selectedItem ? (() => { const ex = cart.items.find((i) => i.service.id === selectedItem.id); return ex ? { quantity: ex.quantity, express: ex.express, notes: ex.notes } : undefined; })() : undefined}
                onAdd={(item, qty, express, notes) => { cart.addItem(item, qty, express, notes); setItemDetailOpen(false); setSelectedItem(null); }}
            />

        </div>
    );
}
