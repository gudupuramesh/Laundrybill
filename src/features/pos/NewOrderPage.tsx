/**
 * New Order Page — full-screen "Desk Billing Portal" POS.
 *
 * Layout: top bar (title + exit + user) → two columns:
 *   Left  : Customer Details card + Select Garments & Services (chips + search + item grid)
 *   Right : Order Summary panel (sticky)
 * Confirm opens the quick checkout step (payment / date / address) then success.
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LChipSelect, LSkeleton, LEmptyState } from "@/components/laundry";
import { useCart } from "./useCart";
import { useInventory } from "@/hooks/use-inventory";
import { useOrder } from "@/hooks/use-orders";
import { useShop } from "@/hooks/use-shop";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useDashboard } from "@/hooks/use-dashboard";
import { POSItemCard } from "./POSItemCard";
import { CustomerDetailsCard } from "./CustomerDetailsCard";
import { OrderSummaryPanel } from "./OrderSummaryPanel";
import { ItemDetailSheet } from "./ItemDetailSheet";
import { CheckoutSheet } from "./CheckoutSheet";
import { OrderSuccessSheet } from "./OrderSuccessSheet";
import type { InventoryItem } from "@/types/inventory";
import type { Customer } from "@/types/customer";
import { isWeightUnit } from "@/lib/inventory-translations";
import { getTranslatedCategoryName } from "@/lib/inventory-translations";
import { AlertTriangle, Search, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LButton, useLToast } from "@/components/laundry";

export function NewOrderPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editOrderId = searchParams.get('edit');
    const isEditMode = !!editOrderId && editOrderId !== 'true';
    // Persist the new-order draft so the cart survives navigating to other screens.
    // Edit mode hydrates from Firestore instead, so it does not persist a draft.
    const cart = useCart(isEditMode ? undefined : "pos:new-order:draft");
    const { categories, items, loading: inventoryLoading } = useInventory();
    const { shop } = useShop();
    const { addToast } = useLToast();

    const { order: editOrder, loading: orderLoading } = useOrder(isEditMode ? editOrderId : '');
    const loading = inventoryLoading || orderLoading;

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [orderLoaded, setOrderLoaded] = useState(false);

    const [view, setView] = useState<"build" | "checkout">("build");
    const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
    const [itemDetailSheet, setItemDetailSheet] = useState<{ open: boolean; item?: InventoryItem }>({ open: false });

    // Default category
    useEffect(() => {
        if (categories.length > 0 && !selectedCategory) setSelectedCategory(categories[0].id);
    }, [categories, selectedCategory]);

    // Tax settings → cart
    useEffect(() => {
        if (shop?.settings?.tax) cart.setTaxSettings(shop.settings.tax);
    }, [shop, cart.setTaxSettings]);

    // Edit mode hydration
    useEffect(() => {
        if (isEditMode && editOrder && !orderLoaded && !loading && items.length > 0) {
            cart.setCustomer(editOrder.customerId || undefined, editOrder.customerName, editOrder.customerPhone, editOrder.isGuest);
            cart.setDelivery(editOrder.deliveryType, editOrder.deliveryAddress || undefined, editOrder.deliveryNotes || undefined, editOrder.financials?.deliveryCharge || 0);
            if (editOrder.items && editOrder.items.length > 0) {
                const orderItems = editOrder.items.map(item => ({
                    serviceId: item.serviceId,
                    serviceName: item.serviceName,
                    categoryId: item.categoryId || '',
                    categoryName: item.categoryName || '',
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    unit: item.unit,
                    express: item.express,
                    notes: item.notes || undefined,
                }));
                cart.loadEditOrder(orderItems, items);
            }
            setOrderLoaded(true);
        }
    }, [isEditMode, editOrder, orderLoaded, inventoryLoading, items.length]);

    // Filter catalog
    const filteredItems = items.filter((item) => {
        if (selectedCategory && item.categoryId !== selectedCategory) return false;
        if (searchQuery) return item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return true;
    });

    const cartQty = (serviceId: string) =>
        cart.items.filter((i) => i.service.id === serviceId).reduce((s, i) => s + i.quantity, 0);

    // Add item: weight-priced items open the detail sheet for an explicit weight
    const handleAddItem = (item: InventoryItem, express: boolean) => {
        if (isWeightUnit(item.pricingType)) {
            setItemDetailSheet({ open: true, item });
        } else {
            cart.addItem(item, 1, express);
        }
    };

    const handleSelectCustomer = (customer: Customer) => {
        const addressesForCart = customer.addresses?.length
            ? customer.addresses
            : (customer.address ? [{ id: "legacy", address: customer.address, isDefault: true }] : undefined);
        cart.setCustomer(customer.id, customer.name, customer.phone, false, addressesForCart);
    };

    const handleCheckout = () => {
        if (!cart.customerId && !cart.customerPhone) {
            addToast({ type: "error", title: t('customer.selectCustomerFirst', 'Please select a customer first') });
            return;
        }
        setView("checkout");
    };

    // Plan limit guard
    const { checkLimit } = useShopLimits();
    const { stats, loading: dashboardLoading } = useDashboard();
    const orderLimit = checkLimit("maxOrders", stats.monthlyOrders);

    if (!dashboardLoading && !orderLimit.allowed) {
        return (
            <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="rounded-full bg-destructive/10 p-4"><AlertTriangle className="h-12 w-12 text-destructive" /></div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{t('subscription.limitReached', 'Order Limit Reached')}</h2>
                    <p className="max-w-sm text-muted-foreground">
                        {t('subscription.limitReachedDesc', 'You have reached your monthly order limit of {{limit}}. Please upgrade your plan to accept more orders.', { limit: orderLimit.limit })}
                    </p>
                </div>
                <div className="flex w-full max-w-xs flex-col gap-3 pt-4">
                    <LButton variant="primary" size="lg" onClick={() => navigate('/settings/subscription')}>{t('subscription.upgradeNow', 'Upgrade Now')}</LButton>
                    <LButton variant="ghost" onClick={() => navigate('/dashboard')}>{t('common.backToDashboard', 'Back to Dashboard')}</LButton>
                </div>
            </div>
        );
    }

    const existingCartItem = itemDetailSheet.item
        ? cart.items.find(i => i.service.id === itemDetailSheet.item?.id)
        : undefined;

    const categoryOptions = categories
        .filter((c) => c.isActive)
        .sort((a, b) => a.order - b.order)
        .map((c) => ({ id: c.id, label: getTranslatedCategoryName(c.name, c.id) }));

    // Full-page checkout view (replaces the modal popup)
    if (view === "checkout") {
        return (
            <CheckoutSheet
                asPage
                open
                cart={cart}
                editOrderId={isEditMode ? editOrderId || undefined : undefined}
                onClose={() => setView("build")}
                onComplete={(orderId) => {
                    cart.clearCart();
                    setView("build");
                    setSuccessOrderId(orderId);
                }}
            />
        );
    }

    return (
        <>
            <div className="mx-auto grid max-w-[1500px] gap-5 p-4 lg:grid-cols-[1fr_400px] lg:p-6">
                    {/* Left column */}
                    <div className="space-y-5">
                        <CustomerDetailsCard
                            customerId={cart.customerId}
                            customerName={cart.customerName}
                            customerPhone={cart.customerPhone}
                            onSelectCustomer={handleSelectCustomer}
                            onClearCustomer={() => cart.setCustomer(undefined, undefined, undefined, false)}
                        />

                        {/* Garments & Services */}
                        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                            <h2 className="mb-4 text-base font-extrabold text-foreground">
                                {t('pos.selectGarmentsServices', 'Select Garments & Services')}
                            </h2>

                            {categoryOptions.length > 0 && (
                                <div className="mb-4">
                                    <LChipSelect
                                        options={categoryOptions}
                                        value={selectedCategory}
                                        onChange={(v) => setSelectedCategory(v as string)}
                                    />
                                </div>
                            )}

                            <div className="relative mb-4">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('pos.searchCatalog', 'Search catalog items…')}
                                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            {loading ? (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                                    {[1, 2, 3, 4, 5, 6].map((i) => <LSkeleton key={i} height={230} className="rounded-2xl" />)}
                                </div>
                            ) : filteredItems.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                                    {filteredItems.map((item) => (
                                        <POSItemCard
                                            key={item.id}
                                            item={item}
                                            cartQuantity={cartQty(item.id)}
                                            onAdd={handleAddItem}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <LEmptyState
                                    icon={<Package className="h-8 w-8" />}
                                    title={t('pos.noServicesFound', 'No items found')}
                                    description={t('pos.tryChangingFilter', 'Try another category or search.')}
                                />
                            )}
                        </section>
                    </div>

                    {/* Right column — Order Summary (sticky on desktop) */}
                    <div className="lg:sticky lg:top-4 lg:self-start lg:h-[calc(100vh-88px)]">
                        <OrderSummaryPanel
                            cart={cart}
                            onCheckout={handleCheckout}
                            onItemClick={(item) => setItemDetailSheet({ open: true, item: item.service })}
                        />
                    </div>
            </div>

            {/* Sheets */}
            <ItemDetailSheet
                open={itemDetailSheet.open}
                onClose={() => setItemDetailSheet({ open: false })}
                item={itemDetailSheet.item}
                initialValues={existingCartItem ? { quantity: 1, express: existingCartItem.express, notes: existingCartItem.notes } : undefined}
                onAdd={(item, quantity, expressFlag, notesText) => {
                    cart.addItem(item, quantity, expressFlag, notesText);
                    setItemDetailSheet({ open: false });
                }}
            />

            <OrderSuccessSheet
                open={!!successOrderId}
                orderId={successOrderId || ""}
                onClose={() => setSuccessOrderId(null)}
                onViewOrder={() => {
                    const id = successOrderId;
                    setSuccessOrderId(null);
                    if (id) navigate(`/orders/${id}`);
                }}
            />
        </>
    );
}
