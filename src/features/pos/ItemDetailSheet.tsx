/**
 * Item Detail Sheet
 * 
 * Configure item before adding to cart — premium popup design.
 */

import { useState, useEffect } from "react";
import {
    LResponsiveDialog,
    LQuantityStepper,
    LToggle,
    LTextArea,
    LButton,
    LAmount,
} from "@/components/laundry";
import type { InventoryItem } from "@/types/inventory";
import { Zap, Clock, ShoppingBag, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isWeightUnit, getTranslatedUnit, getTranslatedItemName } from "@/lib/inventory-translations";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

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

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title=""
            size="sm"
            snapPoints={[0.75]}
        >
            <div className="space-y-5">
                {/* Item Header with gradient */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/8 via-primary/3 to-card border border-primary/10 p-5">
                    <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-[0.04] pointer-events-none select-none">
                        {weighed ? <Scale className="h-24 w-24 text-primary" /> : <ShoppingBag className="h-24 w-24 text-primary" />}
                    </div>
                    <div className="flex items-start justify-between gap-3 relative z-10">
                        <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-extrabold text-foreground tracking-tight">{name}</h3>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-2xl font-extrabold text-primary tabular-nums">{formatAmount(unitPrice)}</span>
                                <span className="text-xs font-semibold text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
                                    {t('pos.per', 'per')} {unitLabel}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-card/80 border border-border/60 rounded-xl px-3 py-1.5 shadow-sm shrink-0">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-bold text-foreground tabular-nums">{turnaroundDays} {t('pos.days', 'days')}</span>
                        </div>
                    </div>
                </div>

                {/* Quantity / Weight Input */}
                <div className="rounded-xl border border-border bg-background p-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">
                        {weighed ? `${t('pos.enterWeight', 'Enter Weight')} (${unitLabel})` : t('pos.quantity', 'Quantity')}
                    </label>
                    {weighed ? (
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={weightText}
                                    onChange={(e) => onWeightChange(e.target.value)}
                                    placeholder="0"
                                    className="w-full h-12 rounded-xl border border-border bg-card px-4 text-xl font-extrabold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all tabular-nums"
                                />
                            </div>
                            <span className="text-base font-bold text-primary bg-primary/8 px-4 py-3 rounded-xl shrink-0">{unitLabel}</span>
                        </div>
                    ) : (
                        <LQuantityStepper
                            value={quantity}
                            onChange={setQuantity}
                            min={1}
                            max={99}
                            size="lg"
                        />
                    )}
                </div>

                {/* Express Toggle */}
                <button
                    type="button"
                    onClick={() => setExpress((v) => !v)}
                    className={cn(
                        "w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer",
                        express
                            ? "border-warning/30 bg-warning/5 shadow-sm shadow-warning/5"
                            : "border-border bg-background hover:border-warning/20 hover:bg-warning/[0.02]"
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                            express ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
                        )}>
                            <Zap className="h-4.5 w-4.5" fill={express ? "currentColor" : "none"} />
                        </div>
                        <div className="text-left">
                            <p className={cn("text-sm font-bold transition-colors", express ? "text-warning" : "text-foreground")}>
                                {t('pos.expressDelivery', 'Express Delivery')}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-medium">
                                +{Math.round((item.expressMultiplier - 1) * 100)}% • {t('pos.readyIn24h', 'Ready in 24 hours')}
                            </p>
                        </div>
                    </div>
                    <span className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                        express ? "bg-warning" : "bg-muted-foreground/20"
                    )}>
                        <span className={cn(
                            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200",
                            express ? "left-[22px]" : "left-0.5"
                        )} />
                    </span>
                </button>

                {/* Notes */}
                <LTextArea
                    label={t('pos.specialInstructions', 'Special Instructions (optional)')}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('pos.specialInstructionsPlaceholder', 'e.g., Handle with care, stain on front...')}
                    minRows={2}
                />

                {/* Total & Add Button */}
                <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-primary/5 to-card border border-primary/10 p-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('pos.total', 'Total')}</p>
                        <p className="text-2xl font-extrabold text-primary tabular-nums mt-0.5">{formatAmount(total)}</p>
                    </div>
                    <LButton
                        variant="primary"
                        size="lg"
                        onClick={handleAdd}
                        disabled={quantity <= 0}
                        className="rounded-xl px-8 font-extrabold shadow-sm shadow-primary/10 cursor-pointer"
                    >
                        {t('pos.addToCart', 'Add to Cart')}
                    </LButton>
                </div>
            </div>
        </LResponsiveDialog>
    );
}
