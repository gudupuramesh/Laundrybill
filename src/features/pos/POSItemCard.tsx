/**
 * POS Item Card — catalog item tile for the billing portal.
 * Image (or initial fallback) · name · price/unit · Express toggle · Add to List.
 */

import { useState } from "react";
import { Zap, Plus, Check } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/types/inventory";
import { getTranslatedItemName, getTranslatedUnit } from "@/lib/inventory-translations";
import { useTranslation } from "react-i18next";

interface POSItemCardProps {
    item: InventoryItem;
    cartQuantity: number;
    /** add with the current express flag; for weight items the caller opens the detail sheet */
    onAdd: (item: InventoryItem, express: boolean) => void;
}

export function POSItemCard({ item, cartQuantity, onAdd }: POSItemCardProps) {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const [express, setExpress] = useState(false);
    const inCart = cartQuantity > 0;
    const unitLabel = getTranslatedUnit(item.pricingType === "piece" ? "piece" : item.pricingType);
    const name = getTranslatedItemName(item.name);
    const price = express ? item.basePrice * (item.expressMultiplier || 1.5) : item.basePrice;

    return (
        <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            {/* Image / fallback */}
            <div className="relative h-28 w-full overflow-hidden bg-muted">
                {item.imageUrl ? (
                    <img src={item.imageUrl} alt={name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center" style={{ background: "hsl(var(--primary) / 0.06)" }}>
                        <span className="text-3xl font-extrabold" style={{ color: "hsl(var(--primary))" }}>
                            {name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}
                {inCart && (
                    <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow">
                        {cartQuantity}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="text-sm font-bold text-foreground leading-snug line-clamp-2">{name}</p>
                <div className="flex items-baseline justify-between">
                    <span className="text-base font-extrabold text-primary">{formatAmount(price)}</span>
                    <span className="text-[11px] font-medium text-muted-foreground">{t('pos.per', 'per')} {unitLabel}</span>
                </div>

                {/* Express toggle — prominent chip */}
                <button
                    type="button"
                    onClick={() => setExpress((v) => !v)}
                    aria-pressed={express}
                    className={cn(
                        "flex items-center justify-between rounded-lg border px-2.5 py-1.5 transition-colors",
                        express ? "border-warning bg-warning/10" : "border-border bg-background hover:border-warning/40"
                    )}
                >
                    <span className={cn("flex items-center gap-1.5 text-xs font-bold", express ? "text-warning" : "text-muted-foreground")}>
                        <Zap className="h-3.5 w-3.5" fill={express ? "currentColor" : "none"} />
                        {t('pos.express', 'Express')} ({item.expressMultiplier || 1.5}x)
                    </span>
                    <span className={cn(
                        "relative h-5 w-10 shrink-0 rounded-full border transition-colors",
                        express ? "border-warning bg-warning" : "border-border bg-muted"
                    )}>
                        <span className={cn(
                            "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all",
                            express ? "left-[22px]" : "left-1"
                        )} />
                    </span>
                </button>

                {/* Add to list */}
                <button
                    type="button"
                    onClick={() => onAdd(item, express)}
                    className={cn(
                        "mt-auto flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition-colors",
                        inCart
                            ? "bg-primary text-primary-foreground hover:bg-primary-dark"
                            : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                    )}
                >
                    {inCart ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {inCart ? t('pos.added', 'Added') : t('pos.addToList', 'Add to List')}
                </button>
            </div>
        </div>
    );
}
