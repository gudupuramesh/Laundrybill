/**
 * POS "Current order" cart — 1000% to the design system (POS Order.dc.html):
 * customer row · category-grouped lines (icon, mono price, inline express,
 * stepper or kg input, line total) · Subtotal / Express surcharge / VAT / Total · Checkout.
 */

import { useState } from "react";
import { Shirt, Plus, Minus, ShoppingBag, ChevronUp, ChevronDown, MoreVertical, Tag, Truck, Bookmark, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { useIsMobile } from "@/hooks/use-mobile";
import { getTranslatedItemName, getTranslatedCategoryName, isWeightUnit } from "@/lib/inventory-translations";
import type { useCart } from "./useCart";

type CartApi = ReturnType<typeof useCart>;

const MONO = "'IBM Plex Mono'";

export function POSCart({ cart, onCheckout, onOpenCustomer, onHold }: { cart: CartApi; onCheckout: () => void; onOpenCustomer: () => void; onHold?: () => void }) {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const isMobile = useIsMobile();
    const [expanded, setExpanded] = useState(false);
    const items = cart.items;
    const empty = items.length === 0;

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
    const custMeta = cart.customerPhone || cart.customerEmail || "Tap to add a customer";
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

    const overlay = isMobile; // mobile + expanded → full-screen sheet; desktop → side panel
    return (
        <aside className="lb-ds" style={overlay
            ? { position: "fixed", inset: 0, zIndex: 50, background: "var(--ds-card)", display: "flex", flexDirection: "column", minHeight: 0 }
            : { width: 430, flex: "none", margin: "16px 16px 16px 0", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04)", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            {/* header */}
            <div style={{ padding: overlay ? "15px 18px" : "20px 22px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                {overlay && <button onClick={() => setExpanded(false)} aria-label="Back to products" style={{ cursor: "pointer", width: 32, height: 32, flex: "none", marginLeft: -4, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text-2)", background: "transparent", border: 0 }}><ChevronDown size={22} /></button>}
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.01em" }}>{t("pos.currentOrder", "Current order")}</div>
            </div>

            {/* customer row */}
            <div style={{ padding: overlay ? "0 18px 12px" : "0 22px 14px" }}>
                <button onClick={onOpenCustomer} style={{ cursor: "pointer", font: "inherit", textAlign: "left", width: "100%", padding: "12px 14px", border: "1px solid var(--ds-border)", borderRadius: 12, background: "var(--ds-card)", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 36, height: 36, flex: "none", borderRadius: "50%", background: "var(--ds-blue-soft)", color: "var(--ds-blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>{initials}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <b style={{ fontWeight: 600 }}>{custName}</b>
                        <span style={{ color: "var(--ds-text-2)" }}> · {custMeta}</span>
                    </span>
                    <span style={{ flex: "none", fontSize: 14, fontWeight: 600, color: "var(--ds-blue)" }}>{cart.customerName ? t("common.change", "Change") : t("common.add", "Add")}</span>
                </button>
            </div>

            {/* lines / empty */}
            {empty ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--ds-text-3)", padding: 30 }}>
                    <span style={{ width: 58, height: 58, borderRadius: "50%", background: "var(--ds-table-head)", display: "flex", alignItems: "center", justifyContent: "center" }}><ShoppingBag size={28} strokeWidth={1.7} /></span>
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ds-text-2)" }}>{t("pos.noItemsYet", "No items yet")}</div>
                        <div style={{ fontSize: 13, marginTop: 2 }}>{t("pos.tapToAdd", "Tap products to add them to the order")}</div>
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, overflow: "auto", padding: overlay ? "0 18px" : "0 22px", minHeight: 0 }}>
                    {(() => {
                        const groups: { key: string; name: string; lines: typeof items }[] = [];
                        items.forEach((x) => {
                            const key = x.service.categoryId || x.service.categoryName || "other";
                            let g = groups.find((y) => y.key === key);
                            if (!g) { g = { key, name: getTranslatedCategoryName(x.service.categoryName || t("pos.otherCategory", "Other"), x.service.categoryId), lines: [] }; groups.push(g); }
                            g.lines.push(x);
                        });
                        return groups;
                    })().map((grp) => (
                    <div key={grp.key}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px -6px 0", padding: "7px 10px", background: "var(--ds-table-head)", borderRadius: 7, fontSize: 13, fontWeight: 600, color: "var(--ds-text)" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{grp.name}</span>
                            <span style={{ marginLeft: "auto", fontWeight: 500, color: "var(--ds-text-2)" }}>{formatAmount(grp.lines.reduce((sum, x) => sum + x.total, 0))}</span>
                        </div>
                    {grp.lines.map((l) => {
                        const isKg = isWeightUnit(l.service.pricingType);
                        const meta = isKg
                            ? `${l.quantity} ${t("pos.kg", "kg")}${l.pieceCount ? ` · ${l.pieceCount} ${t("orders.pieces", "pcs")}` : ""} × ${formatAmount(l.service.basePrice)}`
                            : `${l.quantity} × ${formatAmount(l.service.basePrice)}`;
                        return (
                            <div key={l.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--ds-divider)" }}>
                                <span style={{ width: 36, height: 36, flex: "none", borderRadius: "50%", overflow: "hidden", background: "var(--ds-table-head)", color: "var(--ds-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {l.service.imageUrl ? <img src={l.service.imageUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Shirt size={18} strokeWidth={1.7} />}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getTranslatedItemName(l.service.name, l.service.localizedNames)}</div>
                                    <div style={{ fontSize: 13.5, color: "var(--ds-text-2)", marginTop: 3 }}>
                                        {meta}{l.express ? ` · ${t("pos.expressLabel", "Express")}` : ""}
                                    </div>
                                    {l.notes && <div style={{ fontSize: 13, color: "var(--ds-text-2)", fontStyle: "italic", marginTop: 3 }}>{l.notes}</div>}
                                    {/* stepper / weight entry stays available for quick edits */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                                        {isKg ? (
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--ds-border)", borderRadius: 9, padding: "5px 9px" }}>
                                                <input value={l.quantity} inputMode="decimal" aria-label="Weight in kilograms"
                                                    onChange={(e) => { const n = parseFloat(e.target.value); cart.updateItem(l.id, { quantity: isNaN(n) || n < 0 ? 0 : Math.round(n * 10) / 10 }); }}
                                                    style={{ width: 38, border: 0, outline: "none", padding: 0, background: "transparent", fontWeight: 600, fontSize: 13.5, textAlign: "right", color: "var(--ds-text)" }} />
                                                <span style={{ fontSize: 12.5, color: "var(--ds-text-3)" }}>{t("pos.kg", "kg")}</span>
                                            </span>
                                        ) : (
                                            <span style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--ds-border)", borderRadius: 9, overflow: "hidden" }}>
                                                <button onClick={() => (l.quantity <= 1 ? cart.removeItem(l.id) : cart.updateItem(l.id, { quantity: l.quantity - 1 }))} aria-label="Decrease" style={{ cursor: "pointer", width: 30, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text)", background: "transparent", border: 0 }}><Minus size={14} strokeWidth={2.4} /></button>
                                                <span style={{ minWidth: 22, textAlign: "center", fontWeight: 600, fontSize: 13.5 }}>{l.quantity}</span>
                                                <button onClick={() => cart.updateItem(l.id, { quantity: l.quantity + 1 })} aria-label="Increase" style={{ cursor: "pointer", width: 30, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text)", background: "transparent", border: 0 }}><Plus size={14} strokeWidth={2.4} /></button>
                                            </span>
                                        )}
                                        <button onClick={() => cart.toggleItemExpress(l.id)} aria-pressed={l.express}
                                            style={{ cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 7, border: `1px solid ${l.express ? "var(--ds-blue)" : "var(--ds-border)"}`, background: l.express ? "var(--ds-blue-soft)" : "var(--ds-card)", color: l.express ? "var(--ds-blue)" : "var(--ds-text-2)" }}>
                                            {t("pos.expressLabel", "Express")}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
                                    <span style={{ fontWeight: 600, fontSize: 15 }}>{formatAmount(l.total)}</span>
                                    <button onClick={() => cart.removeItem(l.id)} aria-label={t("common.remove", "Remove")} title={t("common.remove", "Remove")}
                                        style={{ cursor: "pointer", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text-3)", background: "transparent", border: 0 }}><MoreVertical size={17} /></button>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                    ))}
                </div>
            )}

            {/* totals */}
            <div style={{ padding: overlay ? "14px 18px calc(16px + env(safe-area-inset-bottom, 0px))" : "16px 22px 20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: 14.5, paddingTop: 4 }}>
                    <Row label={t("pos.subtotal", "Subtotal")} value={formatAmount(subtotal)} />
                    <Row label={t("pos.discount", "Discount")} icon={<Tag size={15} />} value={`${discount > 0 ? "−" : ""}${formatAmount(discount)}`} color={discount > 0 ? "var(--ds-positive)" : "var(--ds-blue)"} />
                    {anyExpress && <Row label={t("pos.expressSurcharge", "Express surcharge")} value={`+${formatAmount(expressSurcharge)}`} />}
                    {vat > 0 && <Row label={`${cart.taxSettings?.name || t("pos.tax", "Tax")} (${taxRate}%)`} value={formatAmount(vat)} />}
                    {delivery > 0 && <Row label={t("pos.deliveryCharge", "Delivery")} icon={<Truck size={15} />} value={formatAmount(delivery)} />}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, marginTop: 4, borderTop: "1px solid var(--ds-border)" }}>
                        <span style={{ fontWeight: 700, fontSize: 17 }}>{t("pos.total", "Total")}</span>
                        <span style={{ fontWeight: 700, fontSize: 26, letterSpacing: "-.02em" }}>{formatAmount(total)}</span>
                    </div>
                </div>
                <button onClick={() => { setExpanded(false); onCheckout(); }} disabled={empty}
                    style={{ width: "100%", marginTop: 16, cursor: empty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, font: "inherit", fontSize: 16, fontWeight: 600, color: "#fff", background: empty ? "#C7CDD6" : "var(--ds-blue)", border: 0, borderRadius: 12, padding: "16px 18px" }}>
                    {t("pos.checkout", "Checkout")} <span>· {formatAmount(total)}</span>
                </button>
                {!empty && (
                    <div style={{ display: "flex", alignItems: "center", marginTop: 16 }}>
                        {onHold && (
                            <button onClick={onHold} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 9, fontSize: 14.5, fontWeight: 600, color: "var(--ds-blue)", background: "transparent", border: 0, padding: 0 }}>
                                <Bookmark size={17} />{t("pos.holdOrder", "Hold order")}
                            </button>
                        )}
                        <button onClick={() => cart.clearCart()} style={{ marginLeft: "auto", cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 9, fontSize: 14.5, fontWeight: 600, color: "var(--ds-negative)", background: "transparent", border: 0, padding: 0 }}>
                            <Trash2 size={17} />{t("common.clear", "Clear")}
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}

function Row({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ds-text-2)" }}>{label}{icon && <span style={{ color: "var(--ds-text-3)", display: "inline-flex" }}>{icon}</span>}</span>
            <span style={{ color: color || undefined, fontWeight: color ? 600 : 400 }}>{value}</span>
        </div>
    );
}
