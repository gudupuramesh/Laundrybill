/**
 * Cart Panel Component
 * 
 * Display cart items and summary with translated names
 */

import {
    LButton,
    LCard,
    LAmount,
    LQuantityStepper,
    LBadge,
    LEmptyState,
    LDivider,
    LSpacer,
    LToggle,
} from "@/components/laundry";
import type { CartItem } from "./useCart";
import { useCart } from "./useCart";
import type { DeliveryType } from "@/types/order";
import { ShoppingCart, Trash2, Zap, StickyNote, Store, Truck, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getTranslatedItemName, getTranslatedCategoryName, getTranslatedUnit, isWeightUnit } from "@/lib/inventory-translations";
import { useState } from "react";
import { groupOrderItemsByCategory } from "@/lib/order-item-groups";
import { useCurrency } from "@/hooks/use-currency";

interface CartPanelProps {
    cart: ReturnType<typeof useCart>;
    onItemClick: (item: CartItem) => void;
    onCheckout: () => void;
    isDesktop?: boolean;
    loading?: boolean;
    /** When true, delivery type is shown as read-only (no buttons). Useful for agent edit flows. */
    readonlyDeliveryType?: boolean;
}

export function CartPanel({
    cart,
    onItemClick,
    onCheckout,
    isDesktop,
    loading,
    readonlyDeliveryType,
}: CartPanelProps) {
    const { t } = useTranslation();
    const { currencySymbol } = useCurrency();

    if (cart.items.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <LEmptyState
                    icon={<ShoppingCart className="h-10 w-10" />}
                    title={t('pos.cartEmpty')}
                    description={t('pos.addItemsToStart')}
                />
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col h-full", !isDesktop && "p-0")}>
            {/* Header - Desktop Only */}
            {isDesktop && (
                <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-foreground">{t('pos.cart')}</h2>
                        <LBadge variant="muted">
                            {t('pos.itemsInCart', { count: cart.itemCount })}
                        </LBadge>
                    </div>
                </div>
            )}

            {/* Items List – grouped by service type */}
            <div className="flex-1 overflow-auto p-3 space-y-4">
                {groupOrderItemsByCategory(cart.items, (i) => i.service.categoryName || "").map(({ categoryName, items: groupItems }) => (
                    <div key={categoryName}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            {categoryName === "Others" ? t('common.other', 'Other') : categoryName}
                        </p>
                        <div className="space-y-2">
                            {groupItems.map((item) => (
                                <CartItemCard
                                    key={item.id}
                                    item={item}
                                    onQuantityChange={(qty) => cart.updateItem(item.id, { quantity: qty })}
                                    onRemove={() => cart.removeItem(item.id)}
                                    onClick={() => onItemClick(item)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Summary */}
            <div className="p-3 border-t border-border bg-card">
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                        <span>{t('pos.subtotal')}</span>
                        <LAmount value={cart.subtotal} size="sm" />
                    </div>

                    {cart.expressCharge > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3 text-warning" />
                                {t('pos.expressDelivery')}
                            </span>
                            <LAmount value={cart.expressCharge} size="sm" />
                        </div>
                    )}

                    {cart.discountAmount > 0 && (
                        <div className="flex justify-between text-success">
                            <span>{t('checkout.discount')}</span>
                            <span>-<LAmount value={cart.discountAmount} size="sm" /></span>
                        </div>
                    )}

                    {/* Delivery type – choose before checkout so delivery fee shows correctly */}
                    <div className="space-y-1.5">
                        <span className="text-muted-foreground text-xs block">
                            {t('checkout.deliveryType', 'Delivery type')}
                        </span>

                        {/* Read-only view (for agent edit flows) */}
                        {readonlyDeliveryType ? (
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40">
                                {cart.deliveryType === "pickup_store" && (
                                    <Store className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                {cart.deliveryType === "delivery_home" && (
                                    <Truck className="h-3.5 w-3.5 text-primary" />
                                )}
                                {cart.deliveryType === "pickup_home" && (
                                    <Home className="h-3.5 w-3.5 text-primary" />
                                )}
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium text-foreground">
                                        {cart.deliveryType === "pickup_store" && t('checkout.shopPickup')}
                                        {cart.deliveryType === "delivery_home" && t('checkout.homeDelivery')}
                                        {cart.deliveryType === "pickup_home" && t('checkout.pickupFromHome', 'Pickup & Delivery')}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">
                                        {t('checkout.selectedInCart', 'Selected in cart. Change delivery type in cart if needed.')}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-1 flex-wrap">
                                {(["pickup_store", "delivery_home", "pickup_home"] as DeliveryType[]).map((type) => {
                                    const Icon = type === "pickup_store" ? Store : type === "delivery_home" ? Truck : Home;
                                    const isSelected = cart.deliveryType === type;
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => cart.setDelivery(type)}
                                            className={cn(
                                                "flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                            )}
                                        >
                                            <Icon className="h-3.5 w-3" />
                                            {type === "pickup_store"
                                                ? t('checkout.shopPickup')
                                                : type === "delivery_home"
                                                    ? t('checkout.homeDelivery')
                                                    : t('checkout.pickupFromHome', 'Pickup & Delivery')}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground">
                        <span>{t('checkout.delivery')}</span>
                        {readonlyDeliveryType && (cart.deliveryType === "delivery_home" || cart.deliveryType === "pickup_home") ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                    {t('checkout.waiveDeliveryFee', 'Waive fee')}
                                </span>
                                <LToggle
                                    checked={cart.deliveryFeeWaived}
                                    onChange={(v) => cart.setDeliveryFeeWaived(v)}
                                    size="sm"
                                />
                                <LAmount value={cart.deliveryFeeWaived ? 0 : cart.deliveryCharge} size="sm" className="shrink-0" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-xs">{currencySymbol}</span>
                                <input
                                    type="number"
                                    className="w-16 p-1 text-right bg-transparent border-b border-border focus:outline-none focus:border-primary text-sm"
                                    value={cart.deliveryCharge}
                                    onChange={(e) => cart.setDelivery(
                                        cart.deliveryType,
                                        cart.deliveryAddress,
                                        cart.deliveryNotes,
                                        Number(e.target.value) || 0
                                    )}
                                />
                            </div>
                        )}
                    </div>

                    {cart.taxSettings?.enabled && (
                        <div className="flex justify-between items-center text-muted-foreground mt-2">
                            <span className="flex items-center gap-2">
                                {t('pos.tax', { name: cart.taxName, rate: cart.taxRate })}
                                <LToggle
                                    checked={cart.taxEnabled}
                                    onChange={cart.toggleTax}
                                    size="sm"
                                />
                            </span>
                            {cart.taxEnabled && <LAmount value={cart.taxAmount} size="sm" />}
                        </div>
                    )}

                    <LDivider />

                    {/* Discount Controls */}
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{t('checkout.discount')}</span>
                            {!cart.discountValue ? (
                                <button
                                    onClick={() => cart.setDiscount('flat', 0)}
                                    className="text-primary text-xs font-medium hover:underline"
                                >
                                    + Add Discount
                                </button>
                            ) : (
                                <button
                                    onClick={() => cart.setDiscount(undefined, undefined)}
                                    className="text-destructive text-xs font-medium hover:underline"
                                >
                                    Remove
                                </button>
                            )}
                        </div>

                        {(cart.discountType !== undefined) && (
                            <div className="flex items-center gap-2 mt-1">
                                <select
                                    className="text-xs bg-transparent border border-border rounded p-1"
                                    value={cart.discountType}
                                    onChange={(e) => cart.setDiscount(e.target.value as 'flat' | 'percent', cart.discountValue || 0)}
                                >
                                    <option value="flat">{currencySymbol} (Flat)</option>
                                    <option value="percent">% (Percent)</option>
                                </select>
                                <input
                                    type="number"
                                    className="w-20 p-1 text-right bg-transparent border-b border-border focus:outline-none focus:border-primary text-sm"
                                    value={cart.discountValue || 0}
                                    onChange={(e) => cart.setDiscount(cart.discountType, Number(e.target.value))}
                                    placeholder="0"
                                />
                            </div>
                        )}
                    </div>

                    <LDivider />

                    <div className="flex justify-between font-semibold text-foreground">
                        <span>{t('pos.total')}</span>
                        <LAmount value={cart.total} size="lg" />
                    </div>
                </div>

                <LSpacer size="sm" />

                <LButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={onCheckout}
                    loading={loading}
                >
                    {t('pos.proceedToCheckout')}
                </LButton>
            </div>
        </div>
    );
}

// Cart Item Card
interface CartItemCardProps {
    item: CartItem;
    onQuantityChange: (quantity: number) => void;
    onRemove: () => void;
    onClick: () => void;
}

function CartItemCard({ item, onQuantityChange, onRemove, onClick }: CartItemCardProps) {
    const { t } = useTranslation();
    const weighed = isWeightUnit(item.service.pricingType);
    const unitLabel = getTranslatedUnit(item.service.pricingType);
    const [weightText, setWeightText] = useState(String(item.quantity));
    const turnaroundDays = item.express
        ? Math.ceil(item.service.turnaroundDays / 2)
        : item.service.turnaroundDays;

    const onWeightChange = (raw: string) => {
        const normalized = raw.replace(",", ".");
        if (normalized !== "" && !/^\d*\.?\d*$/.test(normalized)) return;
        setWeightText(normalized);
        const parsed = parseFloat(normalized);
        if (!Number.isNaN(parsed) && parsed > 0) onQuantityChange(parsed);
    };

    // Get translated names
    const translatedName = getTranslatedItemName(item.service.name);
    const translatedCategory = getTranslatedCategoryName(item.service.categoryName, item.service.categoryId);

    return (
        <LCard variant="outlined" className="p-2 relative">
            <div className="flex gap-2">
                {/* Service Info */}
                <div className="flex-1 min-w-0" onClick={onClick}>
                    <div className="flex items-start gap-2">
                        <div className="flex-1">
                            <h3 className="font-medium text-foreground truncate">
                                {translatedName}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {translatedCategory}
                            </p>
                        </div>
                        {item.express && (
                            <LBadge variant="warning" size="sm">
                                <Zap className="h-3 w-3 mr-0.5" />
                                {item.service.expressMultiplier}x
                            </LBadge>
                        )}
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">
                        <LAmount value={item.unitPrice} size="sm" />{weighed ? `/${unitLabel} × ${item.quantity} ${unitLabel}` : ` × ${item.quantity}`}
                    </p>

                    <p className="text-xs text-muted-foreground mt-0.5">
                        {t('pos.readyIn', { days: turnaroundDays })}
                    </p>

                    {item.notes && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <StickyNote className="h-3 w-3" />
                            {item.notes}
                        </p>
                    )}
                </div>

                {/* Controls */}
                <div className="flex flex-col items-end gap-2">
                    <LAmount value={item.total} size="md" className="font-semibold" />

                    <div className="flex items-center gap-2">
                        {weighed ? (
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={weightText}
                                    onChange={(e) => onWeightChange(e.target.value)}
                                    className="h-8 w-16 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
                                />
                                <span className="text-xs text-muted-foreground">{unitLabel}</span>
                            </div>
                        ) : (
                            <LQuantityStepper
                                value={item.quantity}
                                onChange={onQuantityChange}
                                min={1}
                                max={99}
                                size="sm"
                            />
                        )}

                        <button
                            onClick={onRemove}
                            className="p-2 text-destructive hover:bg-destructive-muted rounded-lg transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </LCard>
    );
}
