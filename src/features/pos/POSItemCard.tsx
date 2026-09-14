/**
 * POS catalog item card — matches the POS reference: image tile, name, "₹85 per kg",
 * an EXPRESS row with an iOS-style switch, and a footer action (Add to List ·
 * stepper · Edit weight + the chosen weight).
 */

import { useState } from "react";
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
    /** Pencil beside the price — opens the catalog price editor (same as the apps). */
    onEditPrice?: (item: InventoryItem) => void;
}

export function POSItemCard({ item, cartItems, onAdd, onUpdateQuantity, onRemoveItem, onToggleExpress, onEditPrice }: POSItemCardProps) {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const [pendingExpress, setPendingExpress] = useState(false);

    const isKg = isWeightUnit(item.pricingType);
    const line = cartItems.find((i) => i.service.id === item.id);
    const qty = line?.quantity ?? 0;
    const inCart = qty > 0;
    const express = inCart ? !!line?.express : pendingExpress;

    const name = getTranslatedItemName(item.name, item.localizedNames);
    const unitLabel = getTranslatedUnit(item.pricingType === "piece" ? "piece" : item.pricingType);

    const toggleExpress = () => { if (inCart && line) onToggleExpress(line.id); else setPendingExpress((v) => !v); };

    return (
        <div style={{ display: "flex", flexDirection: "column", background: "var(--ds-card)", border: `1px solid ${inCart ? "var(--ds-blue)" : "var(--ds-border)"}`, borderRadius: 14, overflow: "hidden" }}>
            {/* image */}
            <div style={{ margin: 10, borderRadius: 10, aspectRatio: "1.35 / 1", background: "var(--ds-muted-surface, #F3F4F6)", color: "var(--ds-text-3)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                {/* Icon is the always-present base layer; the image (when set) covers it
                    and reveals it again on a 404 — no broken-image glyph in the grid. */}
                <Shirt size={38} strokeWidth={1.5} />
                {item.imageUrl && (
                    <img
                        src={item.imageUrl}
                        alt={name}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                )}
            </div>

            {/* body */}
            <div style={{ padding: "2px 14px 12px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                <div>
                    <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 13.5, color: "var(--ds-text-2)" }}>{formatAmount(item.basePrice)} {t("pos.per", "per")} {unitLabel}</span>
                        {onEditPrice && (
                            <button type="button" onClick={() => onEditPrice(item)} aria-label={t("pos.editPrice", "Edit price")} title={t("pos.editPrice", "Edit price")}
                                style={{ cursor: "pointer", flex: "none", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text-3)", background: "transparent", border: 0, borderRadius: 6, padding: 0 }}>
                                <Pencil size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* express switch */}
                <button type="button" onClick={toggleExpress} aria-pressed={express}
                    style={{ cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 7, padding: 0, border: 0, background: "transparent" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".06em", color: "var(--ds-text-2)" }}>{t("pos.express", "EXPRESS").toUpperCase()}</span>
                    <span style={{ marginLeft: "auto", position: "relative", width: 38, height: 22, borderRadius: 20, background: express ? "var(--ds-blue)" : "#E5E7EB", flex: "none", transition: "background .15s" }}>
                        <span style={{ position: "absolute", top: 2, left: 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(16,24,40,.2)", transition: "transform .15s", transform: express ? "translateX(16px)" : "translateX(0)" }} />
                    </span>
                </button>
            </div>

            {/* footer action */}
            <div style={{ borderTop: "1px solid var(--ds-divider)", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                {inCart && !isKg ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", border: "1px solid var(--ds-border)", borderRadius: 10, overflow: "hidden" }}>
                        <button type="button" onClick={() => (qty <= 1 ? onRemoveItem(line!.id) : onUpdateQuantity(line!.id, qty - 1))} aria-label="Decrease"
                            style={{ cursor: "pointer", width: 40, height: 36, display: "flex", alignItems: "center", justifyContent: "center", font: "inherit", color: "var(--ds-text)", background: "transparent", border: 0 }}><Minus size={16} strokeWidth={2.4} /></button>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{qty}</span>
                        <button type="button" onClick={() => onUpdateQuantity(line!.id, qty + 1)} aria-label="Increase"
                            style={{ cursor: "pointer", width: 40, height: 36, display: "flex", alignItems: "center", justifyContent: "center", font: "inherit", color: "var(--ds-text)", background: "transparent", border: 0 }}><Plus size={16} strokeWidth={2.4} /></button>
                    </div>
                ) : inCart && isKg ? (
                    <>
                        <button type="button" onClick={() => onAdd(item, express)}
                            style={{ cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "9px 14px" }}>
                            {t("pos.editWeight", "Edit weight")}
                        </button>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{qty} {t("pos.kg", "kg")}</span>
                    </>
                ) : (
                    <button type="button" onClick={() => onAdd(item, express)}
                        style={{ width: "100%", cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--ds-blue)", background: "transparent", border: 0, padding: "4px 0" }}>
                        {t("pos.addToList", "Add to List")}
                    </button>
                )}
            </div>
        </div>
    );
}
