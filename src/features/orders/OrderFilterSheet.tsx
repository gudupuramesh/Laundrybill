/**
 * Order Filter Sheet
 * 
 * Cascading filter: Select Order Type → Status options change based on that type's flow
 * Works for both mobile (bottom sheet) and desktop (modal)
 */

import { useState, useEffect, type CSSProperties } from "react";
import {
    LResponsiveDialog,
    LDrawer,
    LButton,
} from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import { STATUS_FLOW } from "@/types/order";
import type { DeliveryType, OrderStatus } from "@/types/order";
import type { OrderSourceFilter } from "@/hooks/use-orders-paginated";
import { useInventory } from "@/hooks/use-inventory";
import { Store, Truck, Home, AlertTriangle, Wallet, Globe, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";

interface OrderFilterSheetProps {
    open: boolean;
    onClose: () => void;
    selectedDeliveryType: DeliveryType | "all";
    selectedStatus: OrderStatus | "all";
    selectedOrderSource?: OrderSourceFilter;
    selectedSpecialFilter?: 'pending_overdue' | 'payment_due' | 'scheduled_upcoming' | 'collected_today' | null;
    /** Service (inventory item) filter — orders containing this service. "all" = no filter. */
    selectedServiceId?: string;
    onApply: (
        deliveryType: DeliveryType | "all",
        status: OrderStatus | "all",
        specialFilter: 'pending_overdue' | 'payment_due' | 'scheduled_upcoming' | 'collected_today' | null,
        orderSource?: OrderSourceFilter,
        serviceId?: string
    ) => void;
}

// Delivery type options config - labels are i18n keys
const DELIVERY_TYPE_OPTIONS: {
    id: DeliveryType | "all";
    labelKey: string;
    icon: typeof Store | null;
    descriptionKey: string;
}[] = [
        { id: "all", labelKey: "orders.allTypes", icon: null, descriptionKey: "orders.allTypesDesc" },
        { id: "pickup_store", labelKey: "orders.shopPickup", icon: Store, descriptionKey: "orders.shopPickupDesc" },
        { id: "delivery_home", labelKey: "orders.homeDelivery", icon: Truck, descriptionKey: "orders.homeDeliveryDesc" },
        { id: "pickup_home", labelKey: "orders.pickupFromHome", icon: Home, descriptionKey: "orders.pickupFromHomeDesc" },
    ];

// Order source options config - labels are i18n keys
const ORDER_SOURCE_OPTIONS: {
    id: OrderSourceFilter;
    labelKey: string;
    descKey: string;
    icon: typeof Globe | typeof ShoppingBag | null;
}[] = [
        { id: "all", labelKey: "common.all", descKey: "orders.allOrdersDesc", icon: null },
        { id: "online", labelKey: "orders.onlineOrders", descKey: "orders.onlineOrdersDesc", icon: Globe },
        { id: "pos", labelKey: "orders.posOrders", descKey: "orders.posOrdersDesc", icon: ShoppingBag },
    ];

export function OrderFilterSheet({
    open,
    onClose,
    selectedDeliveryType,
    selectedStatus,
    selectedOrderSource = "all",
    selectedSpecialFilter,
    selectedServiceId = "all",
    onApply,
}: OrderFilterSheetProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    // Filter by SERVICE TYPE (category: Wash & Fold, Iron, Dry Clean…), not individual items.
    const { categories: services } = useInventory();
    const [tempDeliveryType, setTempDeliveryType] = useState<DeliveryType | "all">(selectedDeliveryType);
    const [tempStatus, setTempStatus] = useState<OrderStatus | "all">(selectedStatus);
    const [tempOrderSource, setTempOrderSource] = useState<OrderSourceFilter>(selectedOrderSource);
    const [tempServiceId, setTempServiceId] = useState<string>(selectedServiceId);
    const [tempSpecialFilter, setTempSpecialFilter] = useState<'pending_overdue' | 'payment_due' | 'scheduled_upcoming' | 'collected_today' | null>(selectedSpecialFilter || null);

    // Helper for status labels
    const getStatusLabel = (status: OrderStatus) => {
        switch (status) {
            case 'pending': return t('orders.steps.placed');
            case 'processing': return t('orders.steps.processing');
            case 'ready_for_pickup': return t('orders.steps.readyForPickup');
            case 'picked_up': return t('orders.steps.pickedUp');
            case 'ready': return t('orders.steps.ready');
            case 'delivered': return t('orders.steps.delivered');
            case 'cancelled': return t('orders.cancelled');
            case 'pickup_scheduled': return t('orders.scheduledPickup');
            case 'pickup_completed': return t('orders.steps.pickedUp');
            case 'partially_delivered': return t('orders.partiallyDelivered', 'Partially Delivered');
            case 'out_for_delivery': return t('dashboard.outForDelivery');
            default: return (status as string).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        }
    };

    // Reset temp values when sheet opens
    useEffect(() => {
        if (open) {
            setTempDeliveryType(selectedDeliveryType);
            setTempStatus(selectedStatus);
            setTempOrderSource(selectedOrderSource || "all");
            setTempServiceId(selectedServiceId || "all");
            setTempSpecialFilter(selectedSpecialFilter || null);
        }
    }, [open, selectedDeliveryType, selectedStatus, selectedOrderSource, selectedServiceId, selectedSpecialFilter]);

    // When delivery type changes, reset status to "all" if current status isn't in new flow
    // AND clear special filter
    useEffect(() => {
        if (tempDeliveryType !== "all" && tempDeliveryType !== selectedDeliveryType) {
            setTempSpecialFilter(null);
        }

        if (tempDeliveryType !== "all" && tempStatus !== "all") {
            const flow = STATUS_FLOW[tempDeliveryType];
            if (!flow.includes(tempStatus)) {
                setTempStatus("all");
            }
        }
    }, [tempDeliveryType, tempStatus]);

    // When special filter is selected, clear others
    // Special views COMBINE with source / type / service ("Unpaid + Online",
    // "Overdue + Shop Pickup"). Only status is exclusive — the special views
    // carry their own status semantics.
    const handleSpecialFilterSelect = (filter: 'pending_overdue' | 'payment_due') => {
        if (tempSpecialFilter === filter) {
            setTempSpecialFilter(null);
        } else {
            setTempSpecialFilter(filter);
            setTempStatus("all");
        }
    };

    // When regular filters are touched, clear special filter
    const handleRegularFilterChange = (type: DeliveryType | "all") => {
        setTempDeliveryType(type);
    };

    const handleStatusChange = (status: OrderStatus | "all") => {
        setTempStatus(status);
        if (status !== 'all') {
            setTempSpecialFilter(null);
        }
    };

    // Get status options based on selected delivery type
    const getStatusOptions = () => {
        const baseOptions = [{ value: "all", label: t('orders.allStatuses') }];

        if (tempDeliveryType === "all") {
            // Show common statuses when "All Types" is selected
            const commonStatuses: OrderStatus[] = ["pending", "processing", "ready", "partially_delivered", "delivered", "cancelled"];
            return [
                ...baseOptions,
                ...commonStatuses.map(status => ({
                    value: status,
                    label: getStatusLabel(status),
                })),
            ];
        }

        // Show statuses specific to selected delivery type
        const flow = STATUS_FLOW[tempDeliveryType];
        return [
            ...baseOptions,
            ...flow.map(status => ({
                value: status,
                label: getStatusLabel(status),
            })),
            { value: "cancelled", label: getStatusLabel('cancelled') },
        ];
    };

    const handleApply = () => {
        onApply(tempDeliveryType, tempStatus, tempSpecialFilter, tempOrderSource, tempServiceId);
        onClose();
    };

    const handleReset = () => {
        setTempDeliveryType("all");
        setTempStatus("all");
        setTempOrderSource("all");
        setTempServiceId("all");
        setTempSpecialFilter(null);
    };

    const hasActiveFilters = tempDeliveryType !== "all" || tempStatus !== "all" || tempOrderSource !== "all" || tempServiceId !== "all" || tempSpecialFilter !== null;

    // Compact chip styling — the old two-line option cards made the panel huge;
    // descriptions live on as hover tooltips (title attributes).
    const chip = (on: boolean, color = "var(--c-primary)", soft = "var(--c-primary-soft)"): CSSProperties => ({
        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
        font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: 999,
        border: `1.5px solid ${on ? color : "var(--c-border)"}`,
        background: on ? soft : "var(--c-surface)",
        color: on ? color : "var(--c-text-2)", whiteSpace: "nowrap",
    });
    const sect: CSSProperties = { fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 8 };
    const dim = (off: boolean): CSSProperties => (off ? { opacity: 0.45, pointerEvents: "none", filter: "grayscale(1)" } : {});

    // One body, two containers: bottom sheet on phones, right-edge slide-in
    // drawer on desktop (the left edge belongs to the navigation sidebar).
    const body = (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
                <div style={sect}>{t('orders.filters.attentionNeeded')}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button type="button" onClick={() => handleSpecialFilterSelect('pending_overdue')} title={t('orders.filters.overdueDesc', 'Past expected delivery')}
                        style={chip(tempSpecialFilter === 'pending_overdue', "var(--c-error)", "var(--c-error-soft)")}>
                        <AlertTriangle size={13} />{t('orders.filters.overdueOrders')}
                    </button>
                    <button type="button" onClick={() => handleSpecialFilterSelect('payment_due')} title={t('orders.filters.unpaidDuesDesc', 'Balance not collected')}
                        style={chip(tempSpecialFilter === 'payment_due', "var(--c-warning)", "var(--c-warning-soft)")}>
                        <Wallet size={13} />{t('orders.filters.unpaidDues')}
                    </button>
                </div>
            </div>

            <div>
                <div style={sect}>{t('orders.orderSource')}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {ORDER_SOURCE_OPTIONS.map((o) => { const Icon = o.icon; return (
                        <button key={o.id} type="button" onClick={() => setTempOrderSource(o.id)} title={t(o.descKey)} style={chip(tempOrderSource === o.id)}>
                            {Icon && <Icon size={13} />}{t(o.labelKey)}
                        </button>
                    ); })}
                </div>
            </div>

            <div>
                <div style={sect}>{t('orders.orderType')}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {DELIVERY_TYPE_OPTIONS.map((o) => { const Icon = o.icon; return (
                        <button key={o.id} type="button" onClick={() => handleRegularFilterChange(o.id)} title={t(o.descriptionKey)} style={chip(tempDeliveryType === o.id)}>
                            {Icon && <Icon size={13} />}{t(o.labelKey)}
                        </button>
                    ); })}
                </div>
            </div>

            <div>
                <div style={sect}>{t('orders.serviceFilter', 'Service type')}</div>
                <select value={tempServiceId} onChange={(e) => setTempServiceId(e.target.value)}
                    style={{ width: "100%", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 9, padding: "9px 11px", outline: "none" }}>
                    <option value="all">{t('orders.allServices', 'All service types')}</option>
                    {services.map((sv) => (<option key={sv.id} value={sv.id}>{sv.name}</option>))}
                </select>
            </div>

            <div style={dim(!!tempSpecialFilter)}>
                <div style={sect}>{t('orders.status')}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {getStatusOptions().map((o) => (
                        <button key={o.value} type="button" onClick={() => handleStatusChange(o.value as OrderStatus | "all")} style={chip(tempStatus === o.value)}>
                            {o.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: "flex", gap: 10, paddingTop: 2 }}>
                <LButton variant="outline" fullWidth onClick={handleReset} disabled={!hasActiveFilters}>{t('common.reset')}</LButton>
                <LButton variant="primary" fullWidth onClick={handleApply}>{t('orders.applyFilters')}</LButton>
            </div>
        </div>
    );

    return isMobile ? (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={t('orders.filterOrders')}
            size="sm"
            snapPoints={[0.85]}
        >
            {body}
        </LResponsiveDialog>
    ) : (
        <LDrawer open={open} onClose={onClose} title={t('orders.filterOrders')} width={360}>
            {body}
        </LDrawer>
    );
}

// Filter Button Component for triggering the sheet
interface OrderFilterButtonProps {
    activeFiltersCount: number;
    onClick: () => void;
}

export function OrderFilterButton({ activeFiltersCount, onClick }: OrderFilterButtonProps) {
    const { t } = useTranslation();

    return (
        <button
            type="button"
            onClick={onClick}
            className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                ${activeFiltersCount > 0
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }
            `}
        >
            <Filter className="h-4 w-4" />
            <span>{t('orders.filter')}</span>
            {activeFiltersCount > 0 && (
                <span className="bg-white text-primary text-xs rounded-full px-1.5 min-w-5 text-center">
                    {activeFiltersCount}
                </span>
            )}
        </button>
    );
}
