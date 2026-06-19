/**
 * Item Detail Sheet
 * 
 * Configure item before adding to cart — premium popup design.
 */

import { useState, useEffect } from "react";
import {
    LResponsiveDialog,
    LQuantityStepper,
    LTextArea,
} from "@/components/laundry";
import type { InventoryItem } from "@/types/inventory";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isWeightUnit, getTranslatedUnit, getTranslatedItemName } from "@/lib/inventory-translations";
import { useCurrency } from "@/hooks/use-currency";

const MONO = "'IBM Plex Mono'";

interface ItemDetailSheetProps {
    open: boolean;
    onClose: () => void;
    item?: InventoryItem;
    onAdd: (
        item: InventoryItem,
        quantity: number,
        express: boolean,
        notes?: string
    ) => void;
    initialValues?: {
        quantity: number;
        express: boolean;
        notes?: string;
    };
}

export function ItemDetailSheet({
    open,
    onClose,
    item,
    onAdd,
    initialValues,
}: ItemDetailSheetProps) {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const [quantity, setQuantity] = useState(1);
    const [weightText, setWeightText] = useState("1");
    const [express, setExpress] = useState(false);
    const [notes, setNotes] = useState("");

    // Reset state when item changes
    useEffect(() => {
        if (open) {
            const q = initialValues?.quantity || 1;
            setQuantity(q);
            setWeightText(String(q));
            setExpress(initialValues?.express || false);
            setNotes(initialValues?.notes || "");
        }
    }, [open, item?.id, initialValues]);

    if (!item) return null;

    const weighed = isWeightUnit(item.pricingType);
    const unitLabel = getTranslatedUnit(item.pricingType);
    const name = getTranslatedItemName(item.name);

    // Decimal weight entry (e.g. 2.5 kg) for weight/area units.
    const onWeightChange = (raw: string) => {
        const normalized = raw.replace(",", ".");
        if (normalized !== "" && !/^\d*\.?\d*$/.test(normalized)) return;
        setWeightText(normalized);
        const parsed = parseFloat(normalized);
        if (!Number.isNaN(parsed) && parsed >= 0) setQuantity(parsed);
    };

    const unitPrice = express ? item.basePrice * item.expressMultiplier : item.basePrice;
    const total = quantity * unitPrice;
    const turnaroundDays = express ? 1 : item.turnaroundDays;

    const handleAdd = () => {
        onAdd(item, quantity, express, notes || undefined);
    };

    const expressPct = Math.round((item.expressMultiplier - 1) * 100);

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title=""
            size="sm"
            snapPoints={[0.75]}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingBottom: 16, borderBottom: "1px solid var(--c-border)" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.01em" }}>{name}</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                            <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: "var(--c-primary)" }}>{formatAmount(unitPrice)}</span>
                            <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t("pos.per", "per")} {unitLabel}</span>
                        </div>
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flex: "none", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 20, padding: "5px 11px" }}>
                        <Clock size={13} style={{ color: "var(--c-text-3)" }} />
                        <span style={{ fontFamily: MONO }}>{turnaroundDays}</span> {t("pos.days", "days")}
                    </span>
                </div>

                {/* quantity / weight */}
                <div style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 11, padding: "14px 16px" }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 11 }}>
                        {weighed ? `${t("pos.enterWeight", "Enter Weight")} (${unitLabel})` : t("pos.quantity", "Quantity")}
                    </label>
                    {weighed ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={weightText}
                                onChange={(e) => onWeightChange(e.target.value)}
                                placeholder="0"
                                style={{ flex: 1, height: 48, fontFamily: MONO, fontSize: 20, fontWeight: 700, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 10, padding: "0 14px", outline: "none" }}
                            />
                            <span style={{ flex: "none", fontSize: 15, fontWeight: 700, color: "var(--c-primary)", background: "var(--c-primary-soft)", borderRadius: 10, padding: "13px 16px" }}>{unitLabel}</span>
                        </div>
                    ) : (
                        <LQuantityStepper value={quantity} onChange={setQuantity} min={1} max={99} size="lg" />
                    )}
                </div>

                {/* express toggle */}
                <button type="button" onClick={() => setExpress((v) => !v)} aria-pressed={express}
                    style={{ width: "100%", cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 11, border: `1px solid ${express ? "var(--c-warning)" : "var(--c-border)"}`, background: express ? "var(--c-warning-soft)" : "var(--c-surface)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ width: 36, height: 36, flex: "none", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: express ? "var(--c-warning)" : "var(--c-surface-2)", color: express ? "#fff" : "var(--c-text-3)" }}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h7l-2 8 9-12h-7l2-8Z" /></svg>
                        </span>
                        <div style={{ textAlign: "left" }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: express ? "var(--c-warning)" : "var(--c-text)" }}>{t("pos.expressDelivery", "Express Delivery")}</div>
                            <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 1 }}>+{expressPct}% • {t("pos.readyIn24h", "Ready in 24 hours")}</div>
                        </div>
                    </div>
                    <span style={{ position: "relative", width: 44, height: 25, flex: "none", borderRadius: 20, background: express ? "var(--c-warning)" : "var(--c-border-strong)" }}>
                        <span style={{ position: "absolute", top: 3, left: 3, width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)", transition: "transform .15s", transform: express ? "translateX(19px)" : "translateX(0)" }} />
                    </span>
                </button>

                {/* notes */}
                <LTextArea
                    label={t("pos.specialInstructions", "Special Instructions (optional)")}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("pos.specialInstructionsPlaceholder", "e.g., Handle with care, stain on front...")}
                    minRows={2}
                />

                {/* total + add */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 11, padding: "12px 16px" }}>
                    <div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)" }}>{t("pos.total", "Total")}</div>
                        <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: "var(--c-primary)", marginTop: 2 }}>{formatAmount(total)}</div>
                    </div>
                    <button onClick={handleAdd} disabled={quantity <= 0}
                        style={{ cursor: quantity <= 0 ? "not-allowed" : "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 10, padding: "13px 26px", boxShadow: "var(--sh-sm)", opacity: quantity <= 0 ? 0.5 : 1 }}>
                        {t("pos.addToCart", "Add to Cart")}
                    </button>
                </div>
            </div>
        </LResponsiveDialog>
    );
}
