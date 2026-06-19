/**
 * POS catalog item card — 1000% to the design system (POS Order.dc.html):
 * category-tinted hero + line icon + qty badge · name · mono price · inline
 * express toggle · Add to List / stepper / Edit Weight. One line per item.
 */

import { useState, type CSSProperties } from "react";
import { Shirt, Plus, Minus, Pencil } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import type { InventoryItem } from "@/types/inventory";
import type { CartItem } from "./useCart";
import { getTranslatedItemName, getTranslatedUnit, isWeightUnit } from "@/lib/inventory-translations";
import { useTranslation } from "react-i18next";

interface POSItemCardProps {
    item: InventoryItem;
    cartItems: CartItem[];
    onAdd: (item: InventoryItem, express: boolean) => void;
    onUpdateQuantity: (itemId: string, newQty: number) => void;
    onRemoveItem: (itemId: string) => void;
    onToggleExpress: (itemId: string) => void;
}

const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
function tintFor(categoryId?: string): string {
    let h = 0;
    for (const ch of categoryId || "x") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return TINTS[h % TINTS.length];
}

export function POSItemCard({ item, cartItems, onAdd, onUpdateQuantity, onRemoveItem, onToggleExpress }: POSItemCardProps) {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const [pendingExpress, setPendingExpress] = useState(false);

    const isKg = isWeightUnit(item.pricingType);
    const line = cartItems.find((i) => i.service.id === item.id);
    const qty = line?.quantity ?? 0;
    const inCart = qty > 0;
    const express = inCart ? !!line?.express : pendingExpress;

    const name = getTranslatedItemName(item.name);
    const unitLabel = getTranslatedUnit(item.pricingType === "piece" ? "piece" : item.pricingType);
    const ref = tintFor(item.categoryId);
    const soft = `${ref}-soft`;

    const toggleExpress = () => { if (inCart && line) onToggleExpress(line.id); else setPendingExpress((v) => !v); };
    const expFg = express ? "var(--c-warning)" : "var(--c-text-3)";

    return (
        <div style={{ display: "flex", flexDirection: "column", background: "var(--c-surface)", border: `1.5px solid ${inCart ? "var(--c-primary)" : "var(--c-border)"}`, borderRadius: 13, overflow: "hidden", boxShadow: "var(--sh-sm)", position: "relative" }}>
            {/* hero */}
            <div style={{ aspectRatio: "1.5 / 1", background: `var(--${soft})`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                {item.imageUrl ? (
                    <img src={item.imageUrl} alt={name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                    <Shirt size={40} strokeWidth={1.6} />
                )}
                {inCart && (
                    <span style={{ position: "absolute", top: 8, right: 8, minWidth: 22, height: 22, padding: "0 6px", borderRadius: 11, background: "var(--c-primary)", color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "'IBM Plex Mono'", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--sh-sm)" }}>{isKg ? qty.toFixed(1) : qty}</span>
                )}
            </div>

            {/* body */}
            <div style={{ padding: "10px 11px 11px", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                <div>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
                        <span style={{ fontFamily: "'IBM Plex Mono'", fontWeight: 700, fontSize: 15, color: "var(--c-primary)" }}>{formatAmount(item.basePrice)}</span>
                        <span style={{ fontSize: 10.5, color: "var(--c-text-3)" }}>{t("pos.per", "per")} {unitLabel}</span>
                    </div>
                </div>

                {/* express toggle row */}
                <button type="button" onClick={toggleExpress} aria-pressed={express}
                    style={{ cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", borderRadius: 8, border: 0, background: express ? "var(--c-warning-soft)" : "var(--c-surface-2)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={expFg}><path d="M13 2 4 14h7l-2 8 9-12h-7l2-8Z" /></svg>
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", color: expFg }}>{t("pos.express", "EXPRESS")}</span>
                    <span style={{ marginLeft: "auto", position: "relative", width: 34, height: 19, borderRadius: 20, background: express ? "var(--c-warning)" : "var(--c-border-strong)", flex: "none" }}>
                        <span style={{ position: "absolute", top: 2, left: 2, width: 15, height: 15, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)", transition: "transform .15s", transform: express ? "translateX(15px)" : "translateX(0)" }} />
                    </span>
                </button>

                {/* action: stepper (pc in cart) · edit weight (kg in cart) · add */}
                {inCart && !isKg ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--c-border-strong)", borderRadius: 9, padding: 3 }}>
                        <button type="button" onClick={() => (qty <= 1 ? onRemoveItem(line!.id) : onUpdateQuantity(line!.id, qty - 1))} aria-label="Decrease" style={stepBtn("var(--c-text-2)")}><Minus size={14} strokeWidth={2.6} /></button>
                        <span style={{ fontFamily: "'IBM Plex Mono'", fontWeight: 700, fontSize: 14 }}>{qty}</span>
                        <button type="button" onClick={() => onUpdateQuantity(line!.id, qty + 1)} aria-label="Increase" style={stepBtn("var(--c-primary)")}><Plus size={14} strokeWidth={2.6} /></button>
                    </div>
                ) : inCart && isKg ? (
                    <button type="button" onClick={() => onAdd(item, express)}
                        style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: 9 }}>
                        <Pencil size={14} />{t("pos.editWeight", "Edit Weight")}
                    </button>
                ) : (
                    <button type="button" onClick={() => onAdd(item, express)}
                        style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, font: "inherit", fontSize: 12.5, fontWeight: 600, color: "var(--c-primary)", background: "transparent", border: 0, padding: 6 }}>
                        <Plus size={14} strokeWidth={2.2} />{t("pos.addToList", "Add to List")}
                    </button>
                )}
            </div>
        </div>
    );
}

function stepBtn(color: string): CSSProperties {
    return { cursor: "pointer", width: 30, height: 28, display: "flex", alignItems: "center", justifyContent: "center", font: "inherit", color, background: "transparent", border: 0, borderRadius: 7 };
}
