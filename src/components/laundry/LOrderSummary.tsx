/**
 * Order Summary Component
 *
 * Display order line items grouped by service type, then totals
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { groupOrderItemsByCategory } from "@/lib/order-item-groups";
import { LAmount } from "./LAmount";
import { LDivider } from "./LList";

interface OrderItem {
    id: string;
    name: string;
    categoryName?: string;
    quantity: number;
    price: number;
    unit?: string;
    express?: boolean;
    processingDays?: number;
}

interface LOrderSummaryProps {
    items: OrderItem[];
    subtotal: number;
    discount?: number;
    delivery?: number;
    taxAmount?: number;
    taxRate?: number;
    taxName?: string;
    total: number;
    className?: string;
    /** When true, hide all prices and totals (e.g. for plant/agent views) */
    hidePrices?: boolean;
}

export function LOrderSummary({
    items,
    subtotal,
    discount = 0,
    delivery = 0,
    taxAmount = 0,
    taxRate,
    taxName,
    total,
    className,
    hidePrices = false,
}: LOrderSummaryProps) {
    const { t } = useTranslation();
    const groups = useMemo(
        () => groupOrderItemsByCategory(items, (i) => i.categoryName || ""),
        [items]
    );

    return (
        <div className={cn("space-y-3 p-4", className)}>
            {/* Items grouped by service type */}
            <div className="space-y-4">
                {groups.map(({ categoryName, items: groupItems }) => (
                    <div key={categoryName}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            {categoryName === "Others" ? t("common.other", "Other") : categoryName}
                        </p>
                        <div className="space-y-2">
                            {groupItems.map((item) => (
                                <div key={item.id} className={cn("flex items-start text-sm gap-2", hidePrices ? "justify-start" : "justify-between")}>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center flex-wrap gap-1">
                                            <span className="text-foreground font-medium">{item.name}</span>
                                            <span className="text-muted-foreground">× {item.quantity}</span>
                                        </div>
                                        {item.express && (
                                            <span className="text-xs text-warning">Express</span>
                                        )}
                                        {item.processingDays != null && item.processingDays > 0 && (
                                            <div className="text-xs text-muted-foreground">
                                                Ready in {item.processingDays} {item.processingDays === 1 ? "day" : "days"}
                                            </div>
                                        )}
                                    </div>
                                    {!hidePrices && (
                                        <LAmount value={item.price * item.quantity} size="sm" className="shrink-0" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {!hidePrices && (
                <>
                    <LDivider />

                    {/* Summary */}
                    <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                            <span>{t('pos.subtotal')}</span>
                            <LAmount value={subtotal} size="sm" />
                        </div>

                        {discount > 0 && (
                            <div className="flex justify-between text-success">
                                <span>{t('checkout.discount')}</span>
                                <span>-<LAmount value={discount} size="sm" /></span>
                            </div>
                        )}

                        <div className="flex justify-between text-muted-foreground">
                            <span>{t('checkout.delivery')}</span>
                            <LAmount value={delivery} size="sm" />
                        </div>

                        {taxAmount > 0 && (
                            <div className="flex justify-between text-foreground">
                                <span>{taxName || "Tax"} {taxRate ? `(${taxRate}%)` : ""}</span>
                                <LAmount value={taxAmount} size="sm" />
                            </div>
                        )}
                    </div>

                    <LDivider />

                    {/* Total */}
                    <div className="flex justify-between font-semibold text-foreground">
                        <span>{t('pos.total')}</span>
                        <LAmount value={total} size="lg" />
                    </div>
                </>
            )}
        </div>
    );
}
