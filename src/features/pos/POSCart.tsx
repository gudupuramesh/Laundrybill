/**
 * POS "Current order" cart — 1000% to the design system (POS Order.dc.html):
 * customer row · category-grouped lines (icon, mono price, inline express,
 * stepper or kg input, line total) · Subtotal / Express surcharge / VAT / Total · Checkout.
 */

import { useState } from "react";
import { Shirt, Plus, Minus, ShoppingBag, ChevronUp, ChevronDown } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useIsMobile } from "@/hooks/use-mobile";
import { getTranslatedItemName, isWeightUnit } from "@/lib/inventory-translations";
import type { useCart } from "./useCart";

type CartApi = ReturnType<typeof useCart>;

const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
function tintFor(categoryId?: string): string {
    let h = 0;
    for (const ch of categoryId || "x") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return TINTS[h % TINTS.length];
}
const MONO = "'IBM Plex Mono'";

export function POSCart({ cart, onCheckout, onOpenCustomer }: { cart: CartApi; onCheckout: () => void; onOpenCustomer: () => void }) {
    const { formatAmount } = useCurrency();
    const isMobile = useIsMobile();
    const [expanded, setExpanded] = useState(false);
    const items = cart.items;
    const empty = items.length === 0;

    // group by category (preserve insertion order of categories)
    const order: string[] = [];
    const byCat = new Map<string, typeof items>();
    for (const it of items) {
        const cat = it.service.categoryName || "Other";
        if (!byCat.has(cat)) { byCat.set(cat, []); order.push(cat); }
        byCat.get(cat)!.push(it);
    }

    // DS totals: subtotal (base), express surcharge, VAT, delivery, total
    const subtotal = items.reduce((s, i) => s + i.service.basePrice * i.quantity, 0);
    const expressSurcharge = items.reduce((s, i) => s + (i.express ? (i.unitPrice - i.service.basePrice) * i.quantity : 0), 0);
    const anyExpress = expressSurcharge > 0;
    const discount = cart.discountAmount || 0;
    const taxRate = cart.taxSettings?.rate ?? 0;
    const taxOn = !!cart.taxSettings?.enabled && cart.taxEnabled;
    const vat = taxOn ? Math.max(0, subtotal - discount + expressSurcharge) * (taxRate / 100) : 0;
    const delivery = cart.deliveryCharge || 0;
    const total = subtotal - discount + expressSurcharge + vat + delivery;

    const custName = cart.customerName || "Walk-in customer";
    const custMeta = cart.customerPhone || "Tap to add a customer";
    const initials = (cart.customerName || "WC").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

    // ── Mobile, collapsed: a sticky bottom bar (tap the summary to expand the full cart, or checkout directly)
    if (isMobile && !expanded) {
        return (
            <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(64px + env(safe-area-inset-bottom, 0px))", zIndex: 40, background: "var(--c-surface)", borderTop: "1px solid var(--c-border)", boxShadow: "0 -3px 16px rgba(0,0,0,0.10)", padding: "10px 12px", display: "flex", alignItems: "center", gap: 9 }}>
                <button onClick={() => setExpanded(true)} style={{ flex: 1, minWidth: 0, cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 11, textAlign: "left", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 11, padding: "8px 12px" }}>
                    <span style={{ position: "relative", width: 34, height: 34, flex: "none", borderRadius: 9, background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ShoppingBag size={18} strokeWidth={1.9} />
                        {!empty && <span style={{ position: "absolute", top: -6, right: -6, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 9, background: "var(--c-primary)", color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: MONO, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--c-surface)" }}>{items.length}</span>}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 11, color: "var(--c-text-3)", lineHeight: 1.2 }}>{empty ? "No items yet" : "View order"}</span>
                        <span style={{ display: "block", fontSize: 16, fontWeight: 700, fontFamily: MONO, lineHeight: 1.25 }}>{formatAmount(total)}</span>
                    </span>
                    <ChevronUp size={17} style={{ flex: "none", color: "var(--c-text-3)" }} />
                </button>
                <button onClick={onCheckout} disabled={empty} style={{ cursor: empty ? "not-allowed" : "pointer", font: "inherit", fontSize: 14.5, fontWeight: 700, color: "#fff", background: empty ? "var(--c-border-strong)" : "var(--c-primary)", border: 0, borderRadius: 11, padding: "13px 18px", whiteSpace: "nowrap", boxShadow: empty ? "none" : "var(--sh-sm)" }}>Checkout</button>
            </div>
        );
    }

    const overlay = isMobile; // mobile + expanded → full-screen sheet; desktop → 392px side panel
    return (
        <aside style={overlay
            ? { position: "fixed", inset: 0, zIndex: 50, background: "var(--c-surface)", display: "flex", flexDirection: "column", minHeight: 0 }
            : { width: 392, flex: "none", background: "var(--c-surface)", borderLeft: "1px solid var(--c-border)", display: "flex", flexDirection: "column", minHeight: 0 }}>
            {/* header */}
            <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 10 }}>
                {overlay && <button onClick={() => setExpanded(false)} aria-label="Back to products" style={{ cursor: "pointer", width: 32, height: 32, flex: "none", marginLeft: -4, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "transparent", border: 0 }}><ChevronDown size={22} /></button>}
                <div style={{ fontSize: 15, fontWeight: 700 }}>Current order</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", padding: "2px 9px", borderRadius: 20, fontFamily: MONO }}>{items.length}</span>
                {!empty && <button onClick={() => cart.clearCart()} style={{ marginLeft: "auto", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, color: "var(--c-error)", background: "transparent", border: 0 }}>Clear</button>}
            </div>

            {/* customer row */}
            <button onClick={onOpenCustomer} style={{ cursor: "pointer", font: "inherit", textAlign: "left", width: "100%", padding: "12px 18px", border: 0, borderBottom: "1px solid var(--c-border)", background: "var(--c-surface)", display: "flex", alignItems: "center", gap: 11 }}>
                <span style={{ width: 36, height: 36, flex: "none", borderRadius: "50%", background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>{initials}</span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{custName}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{custMeta}</div></div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", borderRadius: 7, padding: "6px 11px" }}>{cart.customerName ? "Change" : "Add"}</span>
            </button>

            {/* lines / empty */}
            {empty ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--c-text-3)", padding: 30 }}>
                    <span style={{ width: 58, height: 58, borderRadius: "50%", background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBag size={28} strokeWidth={1.7} /></span>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-text-2)" }}>No items yet</div><div style={{ fontSize: 12, marginTop: 2 }}>Tap products to add them to the order</div></div>
                </div>
            ) : (
                <div style={{ flex: 1, overflow: "auto", padding: "6px 12px 10px", minHeight: 0 }}>
                    {order.map((cat) => {
                        const lines = byCat.get(cat)!;
                        const ref = tintFor(lines[0]?.service.categoryId);
                        const sub = lines.reduce((s, l) => s + l.total, 0);
                        const pcs = lines.filter((l) => !isWeightUnit(l.service.pricingType)).reduce((s, l) => s + l.quantity, 0);
                        const kgs = lines.filter((l) => isWeightUnit(l.service.pricingType)).reduce((s, l) => s + l.quantity, 0);
                        const qtyLabel = [pcs ? `${pcs} pcs` : "", kgs ? `${kgs.toFixed(1)} kg` : ""].filter(Boolean).join(" · ");
                        return (
                            <div key={cat} style={{ marginTop: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px 7px" }}>
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--${ref})` }} />
                                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--c-text-2)" }}>{cat}</span>
                                    <span style={{ fontSize: 10.5, color: "var(--c-text-3)", fontFamily: MONO }}>{qtyLabel}</span>
                                    <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--c-text-2)" }}>{formatAmount(sub)}</span>
                                </div>
                                <div style={{ border: "1px solid var(--c-border)", borderRadius: 11, overflow: "hidden" }}>
                                    {lines.map((l) => {
                                        const lref = tintFor(l.service.categoryId);
                                        const isKg = isWeightUnit(l.service.pricingType);
                                        return (
                                            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderBottom: "1px solid var(--c-border)", background: "var(--c-surface)" }}>
                                                <span style={{ width: 38, height: 38, flex: "none", borderRadius: 8, overflow: "hidden", background: `var(--${lref}-soft)`, color: `var(--${lref})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{l.service.imageUrl ? <img src={l.service.imageUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Shirt size={20} strokeWidth={1.6} />}</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getTranslatedItemName(l.service.name)}</div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
                                                        <span style={{ fontSize: 11, color: "var(--c-text-3)", fontFamily: MONO }}>{formatAmount(l.service.basePrice)} {isKg ? "/ kg" : "/ pc"}</span>
                                                        <button onClick={() => cart.toggleItemExpress(l.id)} aria-pressed={l.express} title={l.express ? "Express priority on" : "Make express"}
                                                            style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 2, fontSize: 8.5, fontWeight: 700, letterSpacing: ".02em", lineHeight: 1, padding: "2px 5px", borderRadius: 4, border: 0, background: l.express ? "var(--c-warning-soft)" : "var(--c-surface-2)", color: l.express ? "var(--c-warning)" : "var(--c-text-3)", opacity: l.express ? 1 : 0.8 }}>⚡ EXP</button>
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
                                                    {isKg ? (
                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "5px 8px", background: "var(--c-surface)" }}>
                                                            <input value={l.quantity} inputMode="decimal" aria-label="Weight in kilograms"
                                                                onChange={(e) => { const n = parseFloat(e.target.value); cart.updateItem(l.id, { quantity: isNaN(n) || n < 0 ? 0 : Math.round(n * 10) / 10 }); }}
                                                                style={{ width: 38, border: 0, outline: "none", padding: 0, background: "transparent", fontFamily: MONO, fontWeight: 700, fontSize: 13, textAlign: "right", color: "var(--c-text)" }} />
                                                            <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>kg</span>
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => (l.quantity <= 1 ? cart.removeItem(l.id) : cart.updateItem(l.id, { quantity: l.quantity - 1 }))} aria-label="Decrease" style={{ cursor: "pointer", width: 27, height: 27, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 7 }}><Minus size={13} strokeWidth={2.6} /></button>
                                                            <span style={{ minWidth: 22, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 13 }}>{l.quantity}</span>
                                                            <button onClick={() => cart.updateItem(l.id, { quantity: l.quantity + 1 })} aria-label="Increase" style={{ cursor: "pointer", width: 27, height: 27, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 7 }}><Plus size={13} strokeWidth={2.6} /></button>
                                                        </>
                                                    )}
                                                </div>
                                                <span style={{ width: 54, textAlign: "right", fontFamily: MONO, fontWeight: 600, fontSize: 13 }}>{formatAmount(l.total)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* totals */}
            <div style={{ borderTop: "1px solid var(--c-border)", padding: overlay ? "14px 18px calc(16px + env(safe-area-inset-bottom, 0px))" : "14px 18px 16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                    <Row label="Subtotal" value={formatAmount(subtotal)} />
                    {discount > 0 && <Row label="Discount" value={`−${formatAmount(discount)}`} color="var(--c-success)" />}
                    {anyExpress && <Row label="Express surcharge" value={`+${formatAmount(expressSurcharge)}`} color="var(--c-warning)" />}
                    {vat > 0 && <Row label={`VAT (${taxRate}%)`} value={formatAmount(vat)} />}
                    {delivery > 0 && <Row label="Delivery" value={formatAmount(delivery)} />}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 9, marginTop: 3, borderTop: "1px solid var(--c-border)" }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
                        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 19 }}>{formatAmount(total)}</span>
                    </div>
                </div>
                <button onClick={() => { setExpanded(false); onCheckout(); }} disabled={empty} style={{ width: "100%", marginTop: 14, cursor: empty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: empty ? "var(--c-border-strong)" : "var(--c-primary)", border: 0, borderRadius: 11, padding: 14, boxShadow: "var(--sh-sm)" }}>
                    Checkout <span style={{ fontFamily: MONO }}>· {formatAmount(total)}</span>
                </button>
            </div>
        </aside>
    );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", color: color || undefined }}>
            <span style={{ color: color || "var(--c-text-2)" }}>{label}</span>
            <span style={{ fontFamily: MONO, color: color || undefined }}>{value}</span>
        </div>
    );
}
