/**
 * New Order Page — full-screen "Desk Billing Portal" POS.
 *
 * Layout: top bar (title + exit + user) → two columns:
 *   Left  : Customer Details card + Select Garments & Services (chips + search + item grid)
 *   Right : Order Summary panel (sticky)
 * Confirm opens the quick checkout step (payment / date / address) then success.
 */

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { LSkeleton, LEmptyState } from "@/components/laundry";
import { useCart } from "./useCart";
import { useInventory } from "@/hooks/use-inventory";
import { useOrder } from "@/hooks/use-orders";
import { useShop } from "@/hooks/use-shop";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDriverAuthOptional } from "@/features/driver-app/DriverAuthContext";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useDashboard } from "@/hooks/use-dashboard";
import { POSItemCard } from "./POSItemCard";
import { POSCart } from "./POSCart";
import { CustomerModal } from "./CustomerModal";
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
    const location = useLocation();
    // Shared POS page reused by the staff app (/staff/*) and the agent portal (/agent/*) —
    // keep navigation in-context.
    const isStaffApp = location.pathname.startsWith('/staff');
    const isAgentApp = location.pathname.startsWith('/agent');
    const agent = useDriverAuthOptional()?.agent;
    const ordersBase = isAgentApp ? '/agent' : isStaffApp ? '/staff/orders' : '/orders';
    const [searchParams] = useSearchParams();
    const editOrderId = searchParams.get('edit');
    const isEditMode = !!editOrderId && editOrderId !== 'true';
    // Persist the new-order draft so the cart survives navigating to other screens.
    // Edit mode hydrates from Firestore instead, so it does not persist a draft.
    const cart = useCart(isEditMode ? undefined : "pos:new-order:draft");
    const { categories, items, loading: inventoryLoading } = useInventory();
    const { shop } = useShop();
    const { addToast } = useLToast();
    const isMobile = useIsMobile();

    const { order: editOrder, loading: orderLoading } = useOrder(isEditMode ? editOrderId : '');
    const loading = inventoryLoading || orderLoading;

    // Agents may only edit orders assigned to them.
    useEffect(() => {
        if (isAgentApp && isEditMode && editOrder && agent && editOrder.assignedAgentId !== agent.id) {
            navigate('/agent', { replace: true });
        }
    }, [isAgentApp, isEditMode, editOrder, agent, navigate]);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [orderLoaded, setOrderLoaded] = useState(false);

    const [view, setView] = useState<"build" | "checkout">("build");
    const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
    const [custOpen, setCustOpen] = useState(false);
    const [itemDetailSheet, setItemDetailSheet] = useState<{ open: boolean; item?: InventoryItem; express?: boolean; cartItemId?: string }>({ open: false });

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

    // Add item: weight-priced items open the detail sheet for an explicit weight
    const handleAddItem = (item: InventoryItem, express: boolean) => {
        if (isWeightUnit(item.pricingType)) {
            setItemDetailSheet({ open: true, item, express });
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
                    <LButton variant="ghost" onClick={() => navigate(isAgentApp ? '/agent' : isStaffApp ? '/staff' : '/dashboard')}>{t('common.backToDashboard', 'Back to Dashboard')}</LButton>
                </div>
            </div>
        );
    }

    const existingCartItem = itemDetailSheet.cartItemId
        ? cart.items.find(i => i.id === itemDetailSheet.cartItemId)
        : itemDetailSheet.item
            ? cart.items.find(i => i.service.id === itemDetailSheet.item?.id && i.express === !!itemDetailSheet.express)
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
            <div className="pos-body" style={{ height: "calc(100vh - 56px)", display: "flex", overflow: "hidden", background: "var(--c-bg)" }}>
                {/* catalog */}
                <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "14px 18px 12px", display: "flex", flexDirection: "column", gap: 12, borderBottom: "1px solid var(--c-border)", background: "var(--c-surface)" }}>
                        {isEditMode && (
                            <button onClick={() => navigate(ordersBase)} style={{ alignSelf: "flex-start", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", background: "transparent", border: 0 }}>← {t('common.cancel', 'Cancel edit')}</button>
                        )}
                        <div style={{ position: "relative" }}>
                            <Search size={17} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('pos.searchCatalog', 'Search items or scan a tag…')}
                                style={{ width: "100%", font: "inherit", fontSize: 14, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 10, padding: "11px 13px 11px 38px", outline: "none" }} />
                        </div>
                        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
                            {[{ id: "", label: t('common.all', 'All') }, ...categoryOptions].map((c) => {
                                const on = selectedCategory === c.id;
                                return (
                                    <button key={c.id || "all"} onClick={() => setSelectedCategory(c.id)}
                                        style={{ cursor: "pointer", whiteSpace: "nowrap", font: "inherit", fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 20, border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary)" : "var(--c-surface)", color: on ? "#fff" : "var(--c-text-2)" }}>{c.label}</button>
                                );
                            })}
                        </div>
                    </div>
                    <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "16px 14px 156px" : "16px 18px 24px" }}>
                        {loading ? (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 13 }}>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <LSkeleton key={i} height={210} className="rounded-xl" />)}
                            </div>
                        ) : filteredItems.length > 0 ? (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 13 }}>
                                {filteredItems.map((item) => (
                                    <POSItemCard key={item.id} item={item} cartItems={cart.items} onAdd={handleAddItem}
                                        onUpdateQuantity={(itemId, newQty) => cart.updateItem(itemId, { quantity: newQty })}
                                        onRemoveItem={cart.removeItem} onToggleExpress={cart.toggleItemExpress} />
                                ))}
                            </div>
                        ) : (
                            <LEmptyState icon={<Package className="h-8 w-8" />} title={t('pos.noServicesFound', 'No items found')} description={t('pos.tryChangingFilter', 'Try another category or search.')} />
                        )}
                    </div>
                </section>

                {/* cart */}
                <POSCart cart={cart} onCheckout={handleCheckout} onOpenCustomer={() => setCustOpen(true)} />
            </div>

            <CustomerModal open={custOpen} onClose={() => setCustOpen(false)} onSelect={(c) => { handleSelectCustomer(c); }} />

            {/* Sheets */}
            <ItemDetailSheet
                open={itemDetailSheet.open}
                onClose={() => setItemDetailSheet({ open: false })}
                item={itemDetailSheet.item}
                initialValues={existingCartItem 
                    ? { quantity: existingCartItem.quantity, express: existingCartItem.express, notes: existingCartItem.notes } 
                    : itemDetailSheet.express !== undefined 
                        ? { quantity: 1, express: itemDetailSheet.express, notes: undefined }
                        : undefined
                }
                onAdd={(item, quantity, expressFlag, notesText) => {
                    if (existingCartItem) {
                        cart.updateItem(existingCartItem.id, { quantity, express: expressFlag, notes: notesText });
                    } else {
                        cart.addItem(item, quantity, expressFlag, notesText);
                    }
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
                    if (id) navigate(isAgentApp ? '/agent' : `${ordersBase}/${id}`);
                }}
            />
        </>
    );
}
