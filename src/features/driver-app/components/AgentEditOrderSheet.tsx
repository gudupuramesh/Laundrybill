/**
 * Agent Edit Order Sheet
 * 
 * Allows agents to modify order items during pickup.
 * Behaves like a mini-POS system within a sheet.
 */

import { useState, useEffect } from "react";
import {
    LResponsiveDialog,
    LButton,
    LSearchInput,
} from "@/components/laundry";
import { useTranslation } from "react-i18next";
import { useCart } from "@/features/pos/useCart";
import { useInventory } from "@/hooks/use-inventory";
import { useOrder, useOrderMutations } from "@/hooks/use-orders";
import { useShopByShopId } from "@/hooks/use-shop";
import { useDriverAuth } from "../DriverAuthContext";
import { ServiceGrid } from "@/features/pos/ServiceGrid";
import { CartPanel } from "@/features/pos/CartPanel";
import { ItemDetailSheet } from "@/features/pos/ItemDetailSheet";
import { PublicCheckoutCoupon } from "@/features/public-order/components/PublicCheckoutCoupon";
import { CartShopOverrideProvider } from "@/features/pos/CartShopOverrideContext";
import { ShoppingCart } from "lucide-react";

interface AgentEditOrderSheetProps {
    open: boolean;
    onClose: () => void;
    orderId: string;
    onOrderUpdated: () => void;
}

type Tab = "services" | "cart";

function AgentEditOrderSheetInner({
    orderId,
    open,
    onClose,
    onOrderUpdated,
}: AgentEditOrderSheetProps) {
    const { t } = useTranslation();
    const { shopId: driverShopId } = useDriverAuth();
    const cart = useCart();
    const { categories, items, loading: inventoryLoading } = useInventory({ shopIdOverride: driverShopId ?? undefined });
    const { order, loading: orderLoading } = useOrder(orderId, { shopIdOverride: driverShopId ?? undefined });
    const { updateOrder } = useOrderMutations({ shopIdOverride: driverShopId ?? undefined });
    const { shop } = useShopByShopId(driverShopId);

    // UI State
    const [activeTab, setActiveTab] = useState<Tab>("services");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [saving, setSaving] = useState(false);

    const [itemDetailSheet, setItemDetailSheet] = useState<{
        open: boolean;
        item?: any; // InventoryItem type mismatch workaround if needed, but should be fine
    }>({ open: false });

    // Set default category
    useEffect(() => {
        if (categories.length > 0 && !selectedCategory) {
            setSelectedCategory(categories[0].id);
        }
    }, [categories, selectedCategory]);

    // Load order into cart when sheet opens (works with 0 items for online quick orders).
    // Online/quick orders must show as Pickup from home and preserve delivery charge (e.g. ₹50).
    // For 0-item orders, clear cart first then set delivery so clearCart() does not overwrite delivery.
    useEffect(() => {
        if (!open || !order) return;

        const orderDeliveryCharge = order.financials?.deliveryCharge ?? 0;
        const isOnlineOrQuickOrder =
            order.orderSource === "online" ||
            (order.isQuickOrder === true) ||
            (order.items?.length === 0 && orderDeliveryCharge > 0);
        const deliveryType =
            isOnlineOrQuickOrder &&
            order.deliveryType !== "delivery_home" &&
            order.deliveryType !== "pickup_home"
                ? "pickup_home"
                : order.deliveryType;

        if (order.items && order.items.length > 0 && items.length > 0) {
            cart.setCustomer(
                order.customerId,
                order.customerName,
                order.customerPhone,
                order.isGuest
            );
            cart.setDelivery(
                deliveryType,
                order.deliveryAddress,
                order.deliveryNotes,
                orderDeliveryCharge
            );
            const orderItems = order.items.map(item => ({
                serviceId: item.serviceId,
                serviceName: item.serviceName,
                categoryId: item.categoryId || '',
                categoryName: item.categoryName || '',
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                unit: item.unit,
                express: item.express,
                notes: item.notes,
            }));
            cart.loadEditOrder(orderItems, items);
        } else {
            cart.clearCart();
            cart.setCustomer(
                order.customerId,
                order.customerName,
                order.customerPhone,
                order.isGuest
            );
            cart.setDelivery(
                deliveryType,
                order.deliveryAddress,
                order.deliveryNotes,
                orderDeliveryCharge
            );
        }
    }, [open, order, items.length]); // Intentionally not including cart to avoid loops

    // Apply shop tax settings when in agent context so tax toggle and amount show
    useEffect(() => {
        if (open && shop?.settings?.tax) {
            cart.setTaxSettings(shop.settings.tax);
        }
    }, [open, shop?.settings?.tax]);

    // Filter services
    const filteredItems = items.filter((item) => {
        if (selectedCategory && item.categoryId !== selectedCategory) {
            return false;
        }
        if (searchQuery) {
            return item.name.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
    });

    const handleSave = async () => {
        if (!order) return;
        setSaving(true);
        try {
            await updateOrder(orderId, {
                items: cart.items.map((item, index) => ({
                    id: `item-${item.service.id}-${index}`,
                    serviceId: item.service.id,
                    serviceName: item.service.name,
                    categoryId: item.service.categoryId,
                    categoryName: item.service.categoryName,
                    quantity: item.quantity,
                    unit: item.service.pricingType,
                    unitPrice: item.unitPrice,
                    total: item.total,
                    express: item.express,
                    notes: item.notes,
                    damages: item.damages,
                    expressMultiplier: item.service.expressMultiplier,
                })),
                financials: {
                    subtotal: cart.subtotal,
                    discountType: cart.discountType,
                    discountValue: cart.discountValue,
                    discountAmount: cart.discountAmount,
                    expressCharge: cart.expressCharge,
                    deliveryCharge: cart.deliveryCharge,
                    taxAmount: cart.taxAmount ?? 0,
                    taxRate: cart.taxRate,
                    taxName: cart.taxName,
                    total: cart.total,
                    amountPaid: order.financials.amountPaid, // Preserve existing payment
                },
                deliveryType: cart.deliveryType,
            });
            onOrderUpdated();
            onClose();
        } catch (error) {
            console.error("Failed to update order:", error);
        } finally {
            setSaving(false);
        }
    };

    const existingCartItem = itemDetailSheet.item
        ? cart.items.find(i => i.service.id === itemDetailSheet.item?.id)
        : undefined;

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={activeTab === "services" ? t('common.addItems', 'Add Items') : t('pos.cart', 'Cart')}
            size="lg"
            snapPoints={[0.9]}
        >
            <div className="flex flex-col h-[70vh]">
                {/* Tabs */}
                {cart.itemCount > 0 && (
                    <div className="flex border-b border-border mb-4">
                        <button
                            onClick={() => setActiveTab("services")}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "services"
                                ? "text-primary border-primary"
                                : "text-muted-foreground border-transparent"
                                }`}
                        >
                            {t('pos.services')}
                        </button>
                        <button
                            onClick={() => setActiveTab("cart")}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "cart"
                                ? "text-primary border-primary"
                                : "text-muted-foreground border-transparent"
                                }`}
                        >
                            {t('pos.cart')} ({cart.itemCount})
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {orderLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : activeTab === "services" ? (
                        <div className="h-full flex flex-col">
                            <div className="mb-4">
                                <LSearchInput
                                    placeholder={t('pos.searchServices')}
                                    onChange={setSearchQuery}
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <ServiceGrid
                                    categories={categories}
                                    items={filteredItems}
                                    selectedCategory={selectedCategory}
                                    cartItems={cart.items}
                                    onCategoryChange={setSelectedCategory}
                                    onServiceClick={(item) => cart.addItem(item)}
                                    onServiceLongPress={(item) => setItemDetailSheet({ open: true, item })}
                                    loading={inventoryLoading}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto flex flex-col">
                            {shop && (shop.settings?.publicCoupons?.length ?? 0) > 0 && (
                                <div className="p-3 border-b border-border shrink-0">
                                    <PublicCheckoutCoupon
                                        shop={shop}
                                        subtotal={cart.subtotal}
                                        discountAmount={cart.discountAmount}
                                        appliedCoupon={
                                            cart.discountType && cart.discountValue != null
                                                ? { type: cart.discountType, value: cart.discountValue }
                                                : null
                                        }
                                        onApply={(type, value) => cart.setDiscount(type, value)}
                                        onRemove={() => cart.setDiscount(undefined, undefined)}
                                    />
                                </div>
                            )}
                            <div className="flex-1 min-h-0">
                                <CartPanel
                                    cart={cart}
                                    onItemClick={(item) => setItemDetailSheet({ open: true, item: item.service })}
                                    onCheckout={handleSave}
                                    isDesktop={false}
                                    loading={saving}
                                    readonlyDeliveryType
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions (Only on Services tab) */}
                {activeTab === "services" && (
                    <div className="mt-4 pt-4 border-t border-border flex gap-3">
                        {cart.itemCount > 0 ? (
                            <LButton
                                variant="primary"
                                fullWidth
                                onClick={() => setActiveTab("cart")}
                                size="lg"
                            >
                                <ShoppingCart className="h-5 w-5 mr-2" />
                                {t('common.viewCart', 'View Cart')} ({cart.itemCount})
                            </LButton>
                        ) : (
                            <LButton variant="ghost" fullWidth onClick={onClose}>
                                {t('common.cancel')}
                            </LButton>
                        )}
                    </div>
                )}
                {/* Footer Actions (Only on Cart tab) - CartPanel handles checkout button */}
            </div>

            <ItemDetailSheet
                open={itemDetailSheet.open}
                onClose={() => setItemDetailSheet({ open: false })}
                item={itemDetailSheet.item}
                initialValues={existingCartItem ? {
                    quantity: 1,
                    express: existingCartItem.express,
                    notes: existingCartItem.notes
                } : undefined}
                onAdd={(item, quantity, expressFlag, notesText) => {
                    cart.addItem(item, quantity, expressFlag, notesText);
                    setItemDetailSheet({ open: false });
                }}
            />
        </LResponsiveDialog>
    );
}

export function AgentEditOrderSheet(props: AgentEditOrderSheetProps) {
    const { shopId: driverShopId } = useDriverAuth();
    const { shop } = useShopByShopId(driverShopId);
    return (
        <CartShopOverrideProvider shop={shop}>
            <AgentEditOrderSheetInner {...props} />
        </CartShopOverrideProvider>
    );
}
