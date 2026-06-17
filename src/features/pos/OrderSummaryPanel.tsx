/**
 * Order Summary panel for the billing portal (right column).
 * Cart items · subtotal · discount · GST toggle · pickup/delivery · grand total · confirm.
 */

import { ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { isWeightUnit, getTranslatedUnit, getTranslatedItemName, getTranslatedCategoryName } from "@/lib/inventory-translations";
import { cn } from "@/lib/utils";
import type { useCart } from "./useCart";
import type { CartItem } from "./useCart";
import { useTranslation } from "react-i18next";

type CartApi = ReturnType<typeof useCart>;

interface OrderSummaryPanelProps {
    cart: CartApi;
    onCheckout: () => void;
    onItemClick: (item: CartItem) => void;
}

export function OrderSummaryPanel({ cart, onCheckout, onItemClick }: OrderSummaryPanelProps) {
    const { t } = useTranslation();
    const { formatAmount, currencySymbol } = useCurrency();
    const empty = cart.items.length === 0;
    const taxConfigured = !!cart.taxSettings?.enabled;

    return (
        <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300">
            {/* Header */}
            <div className="border-b border-border/60 px-6 py-4.5 flex items-center justify-between">
                <div>
                    <h2 className="text-base font-extrabold text-foreground">{t('pos.orderSummary', 'Order Summary')}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{cart.items.length} {cart.items.length === 1 ? t('orders.item', 'item') : t('orders.items', 'items')} {t('pos.inCart', 'in cart')}</p>
                </div>
                {cart.items.length > 0 && (
                    <button 
                        onClick={cart.clearCart}
                        className="text-xs font-bold text-destructive hover:underline cursor-pointer"
                    >
                        {t('common.clearAll', 'Clear All')}
                    </button>
                )}
            </div>

            {/* Items / empty */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 scrollbar-hide">
                {empty ? (
                    <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "hsl(var(--primary) / 0.08)" }}>
                            <ShoppingCart className="h-7 w-7 text-primary" />
                        </div>
                        <p className="text-sm font-bold text-foreground">{t('pos.cartEmpty', 'Order List is Empty')}</p>
                        <p className="mt-1.5 max-w-[240px] text-xs text-muted-foreground leading-relaxed">
                            {t('pos.cartEmptyHint', 'Select items and quantities from the catalog to build the invoice.')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {(() => {
                            // Group items by category
                            const groupedItems = cart.items.reduce((acc, item) => {
                                const catId = item.service.categoryId || 'other';
                                if (!acc[catId]) acc[catId] = { name: item.service.categoryName || 'Other', items: [] };
                                acc[catId].items.push(item);
                                return acc;
                            }, {} as Record<string, { name: string; items: typeof cart.items }>);

                            return Object.entries(groupedItems).map(([catId, group]) => (
                                <div key={catId} className="space-y-2">
                                    <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground ml-1 mb-1">
                                        {getTranslatedCategoryName(group.name, catId)}
                                    </h3>
                                    <div className="space-y-2">
                                        {group.items.map((item) => {
                                            const weighed = isWeightUnit(item.service.pricingType);
                                            const unitLabel = weighed ? getTranslatedUnit(item.service.pricingType) : '';
                                            return (
                                                <div key={item.id} className="group flex items-center gap-3 rounded-xl border border-border/80 bg-background/40 hover:bg-background/80 hover:border-primary/20 p-3 transition-all duration-200">
                                                    <button onClick={() => onItemClick(item)} className="min-w-0 flex-1 text-left cursor-pointer">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <p className="truncate text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                                                {getTranslatedItemName(item.service.name)}
                                                            </p>
                                                            {item.express && (
                                                                <span className="shrink-0 rounded-lg px-2 py-0.5 text-[9px] font-bold text-warning uppercase tracking-wider bg-warning/10 border border-warning/15">
                                                                    {t('pos.express', 'Express')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                                                            {formatAmount(item.unitPrice)} × {item.quantity}{weighed ? ` ${unitLabel}` : ''}
                                                        </p>
                                                    </button>
                                                    {weighed ? (
                                                        /* Weight items: show weight badge, click to edit */
                                                        <button
                                                            onClick={() => onItemClick(item)}
                                                            className="flex items-center gap-1.5 bg-primary/8 border border-primary/15 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-primary/15 transition-all"
                                                        >
                                                            <span className="text-xs font-extrabold text-primary tabular-nums">{item.quantity} {unitLabel}</span>
                                                        </button>
                                                    ) : (
                                                        /* Piece items: show +/- stepper */
                                                        <div className="flex items-center gap-1.5 bg-card rounded-lg border border-border/80 p-0.5">
                                                            <button
                                                                onClick={() => item.quantity <= 1 ? cart.removeItem(item.id) : cart.updateItem(item.id, { quantity: item.quantity - 1 })}
                                                                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all duration-150 cursor-pointer"
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </button>
                                                            <span className="w-5 text-center text-xs font-bold tabular-nums text-foreground">{item.quantity}</span>
                                                            <button
                                                                onClick={() => cart.updateItem(item.id, { quantity: item.quantity + 1 })}
                                                                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all duration-150 cursor-pointer"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <span className="w-16 text-right text-sm font-bold tabular-nums text-foreground">{formatAmount(item.total)}</span>
                                                    <button
                                                        onClick={() => cart.removeItem(item.id)}
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200 cursor-pointer"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                )}
            </div>

            {/* Totals + controls */}
            <div className="border-t border-border/60 bg-muted/10 px-6 py-4.5 space-y-3.5">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-medium">{t('pos.subtotal', 'Subtotal')}</span>
                    <span className="font-bold text-foreground tabular-nums">{formatAmount(cart.subtotal)}</span>
                </div>

                {/* Discount */}
                <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground font-medium">{t('pos.applyDiscount', 'Apply Discount')} ({currencySymbol})</span>
                    <input
                        type="number"
                        min={0}
                        value={cart.discountValue || ""}
                        onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!v || v <= 0) cart.setDiscount(undefined, undefined);
                            else cart.setDiscount("flat", v);
                        }}
                        placeholder="0"
                        className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-right text-sm font-bold text-foreground outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                </div>

                {/* GST toggle */}
                {taxConfigured && (
                    <button
                        onClick={cart.toggleTax}
                        className="flex w-full items-center justify-between rounded-xl border border-border/80 bg-background px-3 py-2.5 cursor-pointer hover:border-primary/20 hover:bg-primary/[0.01] transition-all"
                    >
                        <span className="text-sm font-semibold text-foreground">
                            {t('pos.apply', 'Apply')} {cart.taxRate}% {cart.taxName || t('pos.gstTax', 'GST Tax')}
                        </span>
                        <span className={cn("relative h-5 w-9 rounded-full transition-colors duration-200", cart.taxEnabled ? "bg-primary" : "bg-muted-foreground/25")}>
                            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200", cart.taxEnabled ? "left-[18px]" : "left-0.5")} />
                        </span>
                    </button>
                )}

                {/* Conditional rows */}
                {cart.taxEnabled && taxConfigured && cart.taxAmount > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{cart.taxName || 'GST'} ({cart.taxRate}%)</span>
                        <span className="tabular-nums font-semibold">{formatAmount(cart.taxAmount)}</span>
                    </div>
                )}
                {cart.deliveryCharge > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t('pos.deliveryCharge', 'Delivery charge')}</span>
                        <span className="tabular-nums font-semibold">{formatAmount(cart.deliveryCharge)}</span>
                    </div>
                )}

                {/* Grand total */}
                <div className="flex items-center justify-between border-t border-border/60 pt-3.5">
                    <span className="text-base font-extrabold text-foreground">{t('pos.grandTotal', 'Grand Total')}</span>
                    <span className="text-xl font-extrabold text-primary tabular-nums">{formatAmount(cart.total)}</span>
                </div>

                <button
                    onClick={onCheckout}
                    disabled={empty}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/10 transition-all duration-200 hover:bg-primary-dark active:scale-98 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                    {t('pos.confirmPlaceOrder', 'Confirm & Place Order')}
                </button>
            </div>
        </section>
    );
}
