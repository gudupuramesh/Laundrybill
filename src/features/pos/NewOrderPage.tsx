/**
 * New Order Page
 * 
 * POS interface for creating orders
 * Mobile: Tab-based (Services / Cart)
 * Desktop: Split panel
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    LSearchInput,
    LButton,
    LAmount,
    LHelpButton,
} from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCart } from "./useCart";
import { useInventory } from "@/hooks/use-inventory";
import { useOrder } from "@/hooks/use-orders";
import { useShop } from "@/hooks/use-shop";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useDashboard } from "@/hooks/use-dashboard";
import { ServiceGrid } from "./ServiceGrid";
import { CartPanel } from "./CartPanel";
import { CustomerSelectSheet } from "./CustomerSelectSheet";
import { ItemDetailSheet } from "./ItemDetailSheet";
import { CheckoutSheet } from "./CheckoutSheet";
import { OrderSuccessSheet } from "./OrderSuccessSheet";
import type { InventoryItem } from "@/types/inventory";
import { isWeightUnit } from "@/lib/inventory-translations";
import { ShoppingCart, User, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

type Tab = "services" | "cart";

export function NewOrderPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isMobile = useIsMobile();
    const cart = useCart();
    const { categories, items, loading: inventoryLoading } = useInventory();
    const { shop } = useShop();

    // Edit mode: Get orderId from URL
    const editOrderId = searchParams.get('edit');
    const isEditMode = !!editOrderId && editOrderId !== 'true';

    // Fetch order from Firebase if in edit mode
    const { order: editOrder, loading: orderLoading } = useOrder(isEditMode ? editOrderId : '');
    const loading = inventoryLoading || orderLoading;

    // UI State
    const [activeTab, setActiveTab] = useState<Tab>("services");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [orderLoaded, setOrderLoaded] = useState(false);

    // Set default category
    useEffect(() => {
        if (categories.length > 0 && !selectedCategory) {
            setSelectedCategory(categories[0].id);
        }
    }, [categories, selectedCategory]);

    // Update cart tax settings when shop loads
    useEffect(() => {
        if (shop?.settings?.tax) {
            cart.setTaxSettings(shop.settings.tax);
        }
    }, [shop, cart.setTaxSettings]);

    // Sheet states
    const [customerSheetOpen, setCustomerSheetOpen] = useState(false);
    const [itemDetailSheet, setItemDetailSheet] = useState<{
        open: boolean;
        item?: InventoryItem;
    }>({ open: false });
    const [checkoutSheetOpen, setCheckoutSheetOpen] = useState(false);
    const [successSheet, setSuccessSheet] = useState<{
        open: boolean;
        orderId: string;
    }>({ open: false, orderId: "" });

    // Edit mode: Load order from Firebase when fetched
    useEffect(() => {
        if (isEditMode && editOrder && !orderLoaded && !loading && items.length > 0) {
            // Set customer
            cart.setCustomer(
                editOrder.customerId || undefined,
                editOrder.customerName,
                editOrder.customerPhone,
                editOrder.isGuest
            );
            // Set delivery
            cart.setDelivery(
                editOrder.deliveryType,
                editOrder.deliveryAddress || undefined,
                editOrder.deliveryNotes || undefined,
                editOrder.financials?.deliveryCharge || 0
            );
            // Load items into cart
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

    // Handle service selection. Weight-priced items (kg/lb/sqft/…) open the detail
    // sheet so the user can enter an actual weight; count items add directly.
    const handleServiceClick = (service: InventoryItem) => {
        if (isWeightUnit(service.pricingType)) {
            setItemDetailSheet({ open: true, item: service });
        } else {
            cart.addItem(service);
        }
    };

    const handleServiceLongPress = (service: InventoryItem) => {
        setItemDetailSheet({ open: true, item: service });
    };

    // Handle checkout
    const handleCheckout = () => {
        if (!cart.customerPhone) {
            setCustomerSheetOpen(true);
            return;
        }
        setCheckoutSheetOpen(true);
    };

    // Verify Plan Limits
    const { checkLimit } = useShopLimits();
    const { stats, loading: dashboardLoading } = useDashboard();
    const orderLimit = checkLimit("maxOrders", stats.monthlyOrders);

    // Block access if limit reached (and not loading)
    if (!dashboardLoading && !orderLimit.allowed) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
                <div className="p-4 bg-destructive/10 rounded-full">
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{t('subscription.limitReached', 'Order Limit Reached')}</h2>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                        {t('subscription.limitReachedDesc', 'You have reached your monthly order limit of {{limit}}. Please upgrade your plan to accept more orders.', { limit: orderLimit.limit })}
                    </p>
                </div>
                <div className="flex flex-col w-full max-w-xs gap-3 pt-4">
                    <LButton
                        variant="primary"
                        size="lg"
                        onClick={() => navigate('/settings/subscription')}
                    >
                        {t('subscription.upgradeNow', 'Upgrade Now')}
                    </LButton>
                    <LButton
                        variant="ghost"
                        onClick={() => navigate('/')}
                    >
                        {t('common.backToDashboard', 'Back to Dashboard')}
                    </LButton>
                </div>
            </div>
        );
    }

    // Find existing item in cart to pre-fill settings
    const existingCartItem = itemDetailSheet.item
        ? cart.items.find(i => i.service.id === itemDetailSheet.item?.id)
        : undefined;

    // Mobile Layout: Tabs for Services/Cart
    if (isMobile) {
        return (
            <div className="flex flex-col h-full">
                {/* Header - Sticky within the scrollable main */}
                <div className="sticky top-0 z-20 bg-card shadow-sm">
                    {/* Underline Tabs - Full width with user button */}
                    <div className="flex items-center justify-between border-b border-border">
                        <div className="flex">
                            <button
                                onClick={() => setActiveTab("services")}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "services"
                                    ? "text-primary border-primary"
                                    : "text-muted-foreground border-transparent hover:text-foreground"
                                    }`}
                            >
                                {t('pos.services')}
                            </button>
                            <button
                                onClick={() => setActiveTab("cart")}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "cart"
                                    ? "text-primary border-primary"
                                    : "text-muted-foreground border-transparent hover:text-foreground"
                                    }`}
                            >
                                {t('pos.cart')} {cart.itemCount > 0 && `(${cart.itemCount})`}
                            </button>
                        </div>

                        <div className="flex items-center gap-1">
                            <LHelpButton size="icon" className="shrink-0" />
                            <LButton
                                variant="ghost"
                                size="icon"
                                onClick={() => setCustomerSheetOpen(true)}
                            >
                                <User className="h-5 w-5" />
                            </LButton>
                        </div>
                    </div>

                    {/* Customer Info - Only show if selected */}
                    {cart.customerPhone && (
                        <div
                            className="flex items-center gap-2 px-3 py-2 bg-primary-muted cursor-pointer"
                            onClick={() => setCustomerSheetOpen(true)}
                        >
                            <User className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="text-sm font-medium text-primary truncate flex-1">
                                {cart.customerName || cart.customerPhone}
                            </span>
                            {cart.isGuest && (
                                <span className="text-xs bg-primary/20 px-1.5 py-0.5 rounded">{t('customer.guest')}</span>
                            )}
                        </div>
                    )}

                    {/* Search - Only on services tab */}
                    {activeTab === "services" && (
                        <div className="px-3 py-2">
                            <LSearchInput
                                placeholder={t('pos.searchServices')}
                                onChange={setSearchQuery}
                            />
                        </div>
                    )}
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === "services" ? (
                        <div className="p-3">
                            <ServiceGrid
                                categories={categories}
                                items={filteredItems}
                                selectedCategory={selectedCategory}
                                cartItems={cart.items}
                                onCategoryChange={setSelectedCategory}
                                onServiceClick={handleServiceClick}
                                onServiceLongPress={handleServiceLongPress}
                                loading={inventoryLoading}
                            />
                        </div>
                    ) : (
                        <CartPanel
                            cart={cart}
                            onItemClick={(item) => setItemDetailSheet({ open: true, item: item.service })}
                            onCheckout={handleCheckout}
                        />
                    )}
                </div>

                {/* Floating Cart Bar (on services tab) */}
                {/* Fixed to viewport bottom, accounting for TabBar (approx 64px) + spacing */}
                {activeTab === "services" && cart.itemCount > 0 && (
                    <div className="fixed bottom-[84px] left-4 right-4 z-30 md:hidden">
                        <LButton
                            variant="primary"
                            size="lg"
                            fullWidth
                            onClick={() => setActiveTab("cart")}
                            className="flex items-center justify-between shadow-xl"
                        >
                            <span className="flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5" />
                                <span>{t('pos.itemsInCart', { count: cart.itemCount })}</span>
                            </span>
                            <LAmount value={cart.total} size="lg" className="text-white" />
                        </LButton>
                    </div>
                )}

                {/* Sheets */}
                <CustomerSelectSheet
                    open={customerSheetOpen}
                    onClose={() => setCustomerSheetOpen(false)}
                    selectedId={cart.customerId}
                    onSelect={(customer) => {
                        if (customer) {
                            // Use addresses array, or legacy address so delivery auto-fills for Home Delivery / Pickup & Home
                            const addressesForCart = customer.addresses?.length
                                ? customer.addresses
                                : (customer.address
                                    ? [{ id: "legacy", address: customer.address, isDefault: true }]
                                    : undefined);
                            cart.setCustomer(customer.id, customer.name, customer.phone, false, addressesForCart);
                        }
                        setCustomerSheetOpen(false);
                    }}
                    onGuestCheckout={(phone) => {
                        cart.setCustomer(undefined, undefined, phone, true);
                        setCustomerSheetOpen(false);
                    }}
                />

                <ItemDetailSheet
                    open={itemDetailSheet.open}
                    onClose={() => setItemDetailSheet({ open: false })}
                    item={itemDetailSheet.item}
                    initialValues={existingCartItem ? {
                        quantity: 1, // Always reset quantity to 1 for new additions
                        express: existingCartItem.express,
                        notes: existingCartItem.notes
                    } : undefined}
                    onAdd={(item, quantity, expressFlag, notesText) => {
                        cart.addItem(item, quantity, expressFlag, notesText);
                        setItemDetailSheet({ open: false });
                    }}
                />

                <CheckoutSheet
                    open={checkoutSheetOpen}
                    onClose={() => setCheckoutSheetOpen(false)}
                    cart={cart}
                    editOrderId={isEditMode ? editOrderId || undefined : undefined}
                    onComplete={(orderId) => {
                        cart.clearCart();
                        setCheckoutSheetOpen(false);
                        setSuccessSheet({ open: true, orderId });
                    }}
                />

                <OrderSuccessSheet
                    open={successSheet.open}
                    onClose={() => setSuccessSheet({ open: false, orderId: "" })}
                    orderId={successSheet.orderId}
                    onViewOrder={() => {
                        setSuccessSheet({ open: false, orderId: "" });
                        navigate(`/orders/${successSheet.orderId}`);
                    }}
                />
            </div>
        );
    }

    // Desktop Layout: Split View
    return (
        <div className="h-[calc(100vh-64px)] flex">
            {/* Left Panel - Services (60%) */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
                {/* Header */}
                <div className="p-4 border-b border-border space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <h1 className="text-xl font-bold text-foreground">{t('pos.newOrder')}</h1>
                        <div className="flex items-center gap-2">
                            <LHelpButton size="icon" />
                            <LButton
                                variant="outline"
                                leftIcon={<User className="h-4 w-4" />}
                                onClick={() => setCustomerSheetOpen(true)}
                            >
                                {cart.customerName || cart.customerPhone || t('customer.selectCustomer')}
                            </LButton>
                        </div>
                    </div>
                    <LSearchInput
                        placeholder={t('pos.searchServices')}
                        onChange={setSearchQuery}
                    />
                </div>

                {/* Services Grid */}
                <div className="flex-1 overflow-auto p-4">
                    <ServiceGrid
                        categories={categories}
                        items={filteredItems}
                        selectedCategory={selectedCategory}
                        cartItems={cart.items}
                        onCategoryChange={setSelectedCategory}
                        onServiceClick={handleServiceClick}
                        onServiceLongPress={handleServiceLongPress}
                        loading={inventoryLoading}
                    />
                </div>
            </div>

            {/* Right Panel - Cart (40%) */}
            <div className="w-[400px] flex flex-col bg-card">
                <CartPanel
                    cart={cart}
                    onItemClick={(item) => setItemDetailSheet({ open: true, item: item.service })}
                    onCheckout={handleCheckout}
                    isDesktop
                />
            </div>

            {/* Sheets */}
            <CustomerSelectSheet
                open={customerSheetOpen}
                onClose={() => setCustomerSheetOpen(false)}
                selectedId={cart.customerId}
                onSelect={(customer) => {
                    if (customer) {
                        // Use addresses array, or legacy address so delivery auto-fills for Home Delivery / Pickup & Home
                        const addressesForCart = customer.addresses?.length
                            ? customer.addresses
                            : (customer.address
                                ? [{ id: "legacy", address: customer.address, isDefault: true }]
                                : undefined);
                        cart.setCustomer(customer.id, customer.name, customer.phone, false, addressesForCart);
                    }
                    setCustomerSheetOpen(false);
                }}
                onGuestCheckout={(phone) => {
                    cart.setCustomer(undefined, undefined, phone, true);
                    setCustomerSheetOpen(false);
                }}
            />

            <ItemDetailSheet
                open={itemDetailSheet.open}
                onClose={() => setItemDetailSheet({ open: false })}
                item={itemDetailSheet.item}
                initialValues={existingCartItem ? {
                    quantity: 1, // Always reset quantity to 1 for new additions
                    express: existingCartItem.express,
                    notes: existingCartItem.notes
                } : undefined}
                onAdd={(item, quantity, expressFlag, notesText) => {
                    cart.addItem(item, quantity, expressFlag, notesText);
                    setItemDetailSheet({ open: false });
                }}
            />

            <CheckoutSheet
                open={checkoutSheetOpen}
                onClose={() => setCheckoutSheetOpen(false)}
                cart={cart}
                editOrderId={isEditMode ? editOrderId || undefined : undefined}
                onComplete={(orderId) => {
                    cart.clearCart();
                    setCheckoutSheetOpen(false);
                    setSuccessSheet({ open: true, orderId });
                }}
            />

            <OrderSuccessSheet
                open={successSheet.open}
                onClose={() => setSuccessSheet({ open: false, orderId: "" })}
                orderId={successSheet.orderId}
                onViewOrder={() => {
                    setSuccessSheet({ open: false, orderId: "" });
                    navigate(`/orders/${successSheet.orderId}`);
                }}
            />
        </div>
    );
}
