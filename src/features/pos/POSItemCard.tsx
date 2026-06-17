import { useState } from "react";
import { Zap, Plus, Minus, Edit2 } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
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
}

export function POSItemCard({ item, cartItems, onAdd, onUpdateQuantity, onRemoveItem }: POSItemCardProps) {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const [express, setExpress] = useState(false);
    
    const isWeight = isWeightUnit(item.pricingType);
    const matchedCartItem = cartItems.find(
        (i) => i.service.id === item.id && i.express === express
    );
    const cartQuantity = matchedCartItem ? matchedCartItem.quantity : 0;
    const inCart = cartQuantity > 0;

    const unitLabel = getTranslatedUnit(item.pricingType === "piece" ? "piece" : item.pricingType);
    const name = getTranslatedItemName(item.name);
    const price = express ? item.basePrice * (item.expressMultiplier || 1.5) : item.basePrice;

    // Total quantity in cart (across both express & normal) for showing general badge
    const totalQtyInCart = cartItems
        .filter((i) => i.service.id === item.id)
        .reduce((sum, i) => sum + i.quantity, 0);

    const handleIncrement = () => {
        if (matchedCartItem) {
            onUpdateQuantity(matchedCartItem.id, matchedCartItem.quantity + 1);
        } else {
            onAdd(item, express);
        }
    };

    const handleDecrement = () => {
        if (matchedCartItem) {
            if (matchedCartItem.quantity <= 1) {
                onRemoveItem(matchedCartItem.id);
            } else {
                onUpdateQuantity(matchedCartItem.id, matchedCartItem.quantity - 1);
            }
        }
    };

    return (
        <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            {/* Image / fallback */}
            <div className="relative h-20 w-full overflow-hidden bg-muted">
                {item.imageUrl ? (
                    <img 
                        src={item.imageUrl} 
                        alt={name} 
                        className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105" 
                        loading="lazy" 
                    />
                ) : (
                    <div 
                        className="flex h-full w-full items-center justify-center transition-colors duration-300 group-hover:bg-primary/10" 
                        style={{ background: "hsl(var(--primary) / 0.06)" }}
                    >
                        <span className="text-3xl font-extrabold transition-transform duration-300 group-hover:scale-110" style={{ color: "hsl(var(--primary))" }}>
                            {name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}
                {totalQtyInCart > 0 && (
                    <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow ring-2 ring-card animate-pulse-soft">
                        {totalQtyInCart}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="text-xs font-bold text-foreground truncate">{name}</p>
                
                <div className="flex items-baseline justify-between">
                    <span className="text-base font-extrabold text-primary tabular-nums">{formatAmount(price)}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground">{t('pos.per', 'per')} {unitLabel}</span>
                </div>

                {/* Express toggle — prominent chip */}
                <button
                    type="button"
                    onClick={() => setExpress((v) => !v)}
                    aria-pressed={express}
                    className={cn(
                        "flex items-center justify-between rounded-lg border px-2 py-1.5 transition-all duration-200 cursor-pointer",
                        express 
                            ? "border-warning/30 bg-warning/5 text-warning shadow-sm shadow-warning/5" 
                            : "border-border bg-background hover:border-warning/30 hover:bg-warning/5/10"
                    )}
                >
                    <span className={cn("flex items-center gap-1.5 text-[10px] font-bold transition-colors uppercase tracking-wider", express ? "text-warning" : "text-muted-foreground")}>
                        <Zap className="h-3 w-3" fill={express ? "currentColor" : "none"} />
                        {t('pos.express', 'Express')}
                    </span>
                    <span className={cn(
                        "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
                        express ? "bg-warning" : "bg-muted-foreground/20"
                    )}>
                        <span className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200",
                            express ? "left-[18px]" : "left-0.5"
                        )} />
                    </span>
                </button>

                {/* Bottom Actions: Stepper or Add button */}
                <div className="mt-auto pt-2">
                    {inCart && !isWeight ? (
                        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-1">
                            <button
                                type="button"
                                onClick={handleDecrement}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-card text-primary shadow-sm hover:bg-primary hover:text-primary-foreground transition-all duration-150 active:scale-95 cursor-pointer"
                            >
                                <Minus className="h-4 w-4" />
                            </button>
                            <span className="text-sm font-extrabold text-primary tabular-nums px-2">
                                {cartQuantity}
                            </span>
                            <button
                                type="button"
                                onClick={handleIncrement}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-card text-primary shadow-sm hover:bg-primary hover:text-primary-foreground transition-all duration-150 active:scale-95 cursor-pointer"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onAdd(item, express)}
                            className={cn(
                                "w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold transition-all duration-200 active:scale-98 cursor-pointer",
                                inCart && isWeight
                                    ? "bg-primary text-primary-foreground hover:bg-primary-dark"
                                    : "bg-primary/8 text-primary hover:bg-primary hover:text-primary-foreground"
                            )}
                        >
                            {inCart && isWeight ? (
                                <>
                                    <Edit2 className="h-3.5 w-3.5" />
                                    {t('pos.editWeight', 'Edit Weight')}
                                </>
                            ) : (
                                <>
                                    <Plus className="h-3.5 w-3.5" />
                                    {t('pos.addToList', 'Add to List')}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
