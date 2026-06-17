/**
 * Order Summary panel for the billing portal (right column).
 * Cart items · subtotal · discount · GST toggle · pickup/delivery · grand total · confirm.
 */

import { ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { getTranslatedItemName } from "@/lib/inventory-translations";
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
    const { formatAmount } = useCurrency();
    const empty = cart.items.length === 0;
    const taxConfigured = !!cart.taxSettings?.enabled;

    return (
        <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {/* Header */}
            <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-extrabold text-foreground">{t('pos.orderSummary', 'Order Summary')}</h2>
            </div>

            {/* Items / empty */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
                {empty ? (
                    <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "hsl(var(--primary) / 0.08)" }}>
                            <ShoppingCart className="h-7 w-7 text-primary" />
                        </div>
                        <p className="text-sm font-bold text-foreground">{t('pos.cartEmpty', 'Order List is Empty')}</p>
                        <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
                            {t('pos.cartEmptyHint', 'Select items and quantities from the catalog to build the invoice.')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {cart.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 rounded-xl border border-border p-2.5">
                                <button onClick={() => onItemClick(item)} className="min-w-0 flex-1 text-left">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                        {getTranslatedItemName(item.service.name)}
                                        {item.express && (
                                            <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-warning" style={{ background: "hsl(var(--warning) / 0.16)" }}>
                                                {t('pos.express', 'Express')}
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{formatAmount(item.unitPrice)} × {item.quantity}</p>
                                </button>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => item.quantity <= 1 ? cart.removeItem(item.id) : cart.updateItem(item.id, { quantity: item.quantity - 1 })}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                                    >
                                        <Minus className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                                    <button
                                        onClick={() => cart.updateItem(item.id, { quantity: item.quantity + 1 })}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <span className="w-16 text-right text-sm font-bold tabular-nums">{formatAmount(item.total)}</span>
                                <button
                                    onClick={() => cart.removeItem(item.id)}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Totals + controls */}
            <div className="border-t border-border px-5 py-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('pos.subtotal', 'Subtotal')}</span>
                    <span className="font-bold text-foreground tabular-nums">{formatAmount(cart.subtotal)}</span>
                </div>

                {/* Discount */}
                <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{t('pos.applyDiscount', 'Apply Discount')} (₹)</span>
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
                        className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-right text-sm font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                </div>

                {/* GST toggle */}
                {taxConfigured && (
                    <button
                        onClick={cart.toggleTax}
                        className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5"
                    >
                        <span className="text-sm font-semibold text-foreground">
                            {t('pos.apply', 'Apply')} {cart.taxRate}% {cart.taxName || t('pos.gstTax', 'GST Tax')}
                        </span>
                        <span className={cn("relative h-5 w-9 rounded-full transition-colors", cart.taxEnabled ? "bg-primary" : "bg-muted-foreground/25")}>
                            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", cart.taxEnabled ? "left-[18px]" : "left-0.5")} />
                        </span>
                    </button>
                )}

                {/* Conditional rows */}
                {cart.taxEnabled && taxConfigured && cart.taxAmount > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{cart.taxName || 'GST'} ({cart.taxRate}%)</span>
                        <span className="tabular-nums">{formatAmount(cart.taxAmount)}</span>
                    </div>
                )}
                {cart.deliveryCharge > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t('pos.deliveryCharge', 'Delivery charge')}</span>
                        <span className="tabular-nums">{formatAmount(cart.deliveryCharge)}</span>
                    </div>
                )}

                {/* Grand total */}
                <div className="flex items-center justify-between border-t border-border pt-3">
                    <span className="text-base font-extrabold text-foreground">{t('pos.grandTotal', 'Grand Total')}</span>
                    <span className="text-xl font-extrabold text-primary tabular-nums">{formatAmount(cart.total)}</span>
                </div>

                <button
                    onClick={onCheckout}
                    disabled={empty}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {t('pos.confirmPlaceOrder', 'Confirm & Place Order')}
                </button>
            </div>
        </section>
    );
}
