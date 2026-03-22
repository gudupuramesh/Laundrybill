/**
 * Order Filter Sheet
 * 
 * Cascading filter: Select Order Type → Status options change based on that type's flow
 * Works for both mobile (bottom sheet) and desktop (modal)
 */

import { useState, useEffect } from "react";
import {
    LResponsiveDialog,
    LButton,
    LRadioGroup,
    LDivider,
} from "@/components/laundry";
import { STATUS_FLOW } from "@/types/order";
import type { DeliveryType, OrderStatus } from "@/types/order";
import type { OrderSourceFilter } from "@/hooks/use-orders-paginated";
import { Filter, Store, Truck, Home, AlertTriangle, Wallet, Globe, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";

interface OrderFilterSheetProps {
    open: boolean;
    onClose: () => void;
    selectedDeliveryType: DeliveryType | "all";
    selectedStatus: OrderStatus | "all";
    selectedOrderSource?: OrderSourceFilter;
    selectedSpecialFilter?: 'pending_overdue' | 'payment_due' | null;
    onApply: (
        deliveryType: DeliveryType | "all",
        status: OrderStatus | "all",
        specialFilter: 'pending_overdue' | 'payment_due' | null,
        orderSource?: OrderSourceFilter
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
    onApply,
}: OrderFilterSheetProps) {
    const { t } = useTranslation();
    const [tempDeliveryType, setTempDeliveryType] = useState<DeliveryType | "all">(selectedDeliveryType);
    const [tempStatus, setTempStatus] = useState<OrderStatus | "all">(selectedStatus);
    const [tempOrderSource, setTempOrderSource] = useState<OrderSourceFilter>(selectedOrderSource);
    const [tempSpecialFilter, setTempSpecialFilter] = useState<'pending_overdue' | 'payment_due' | null>(selectedSpecialFilter || null);

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
            setTempSpecialFilter(selectedSpecialFilter || null);
        }
    }, [open, selectedDeliveryType, selectedStatus, selectedOrderSource, selectedSpecialFilter]);

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
    const handleSpecialFilterSelect = (filter: 'pending_overdue' | 'payment_due') => {
        if (tempSpecialFilter === filter) {
            setTempSpecialFilter(null);
        } else {
            setTempSpecialFilter(filter);
            setTempDeliveryType("all");
            setTempStatus("all");
            setTempOrderSource("all");
        }
    };

    // When regular filters are touched, clear special filter
    const handleRegularFilterChange = (type: DeliveryType | "all") => {
        setTempDeliveryType(type);
        setTempSpecialFilter(null);
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
            const commonStatuses: OrderStatus[] = ["pending", "processing", "ready", "delivered", "cancelled"];
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
        onApply(tempDeliveryType, tempStatus, tempSpecialFilter, tempOrderSource);
        onClose();
    };

    const handleReset = () => {
        setTempDeliveryType("all");
        setTempStatus("all");
        setTempOrderSource("all");
        setTempSpecialFilter(null);
    };

    const hasActiveFilters = tempDeliveryType !== "all" || tempStatus !== "all" || tempOrderSource !== "all" || tempSpecialFilter !== null;

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={t('orders.filterOrders')}
            size="sm"
            snapPoints={[0.85]}
        >
            <div className="space-y-6">
                {/* Quick Filters (Special) */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">
                        {t('orders.filters.attentionNeeded')}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => handleSpecialFilterSelect('pending_overdue')}
                            className={`
                                p-3 rounded-xl text-left transition-all border-2
                                ${tempSpecialFilter === 'pending_overdue'
                                    ? "border-destructive bg-destructive/10"
                                    : "border-border hover:border-destructive/50"
                                }
                            `}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className={`h-4 w-4 ${tempSpecialFilter === 'pending_overdue' ? 'text-destructive' : 'text-muted-foreground'}`} />
                                <span className={`font-medium text-sm ${tempSpecialFilter === 'pending_overdue' ? 'text-destructive' : 'text-foreground'}`}>
                                    {t('orders.filters.overdueOrders')}
                                </span>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSpecialFilterSelect('payment_due')}
                            className={`
                                p-3 rounded-xl text-left transition-all border-2
                                ${tempSpecialFilter === 'payment_due'
                                    ? "border-warning bg-warning/10"
                                    : "border-border hover:border-warning/50"
                                }
                            `}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Wallet className={`h-4 w-4 ${tempSpecialFilter === 'payment_due' ? 'text-warning' : 'text-muted-foreground'}`} />
                                <span className={`font-medium text-sm ${tempSpecialFilter === 'payment_due' ? 'text-warning' : 'text-foreground'}`}>
                                    {t('orders.filters.unpaidDues')}
                                </span>
                            </div>
                        </button>
                    </div>
                </div>

                <LDivider />

                {/* Order Source */}
                <div className={`space-y-3 ${tempSpecialFilter ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <h3 className="text-sm font-semibold text-foreground">
                        {t('orders.orderSource')}
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                        {ORDER_SOURCE_OPTIONS.map((option) => {
                            const isSelected = tempOrderSource === option.id;
                            const Icon = option.icon;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setTempOrderSource(option.id)}
                                    className={`
                                        p-3 rounded-xl text-left transition-all border-2
                                        ${isSelected
                                            ? "border-primary bg-primary/10"
                                            : "border-border hover:border-primary/50"
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        {Icon && <Icon className="h-4 w-4 text-primary" />}
                                        <span className="font-medium text-sm text-foreground">
                                            {t(option.labelKey)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {t(option.descKey)}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <LDivider />

                {/* Order Type Selection */}
                <div className={`space-y-3 ${tempSpecialFilter ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <h3 className="text-sm font-semibold text-foreground">
                        {t('orders.orderType')}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {DELIVERY_TYPE_OPTIONS.map((option) => {
                            const isSelected = tempDeliveryType === option.id;
                            const Icon = option.icon;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleRegularFilterChange(option.id)}
                                    className={`
                                        p-3 rounded-xl text-left transition-all border-2
                                        ${isSelected
                                            ? "border-primary bg-primary/10"
                                            : "border-border hover:border-primary/50"
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        {Icon && <Icon className="h-4 w-4 text-primary" />}
                                        <span className="font-medium text-sm text-foreground">
                                            {t(option.labelKey)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {t(option.descriptionKey)}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <LDivider />

                {/* Status Selection - Changes based on Order Type */}
                <div className={`space-y-3 ${tempSpecialFilter ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <h3 className="text-sm font-semibold text-foreground">
                        {t('orders.status')}
                    </h3>
                    <LRadioGroup
                        name="status"
                        value={tempStatus}
                        onChange={(v) => handleStatusChange(v as OrderStatus | "all")}
                        options={getStatusOptions()}
                    />
                </div>

                <LDivider />

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <LButton
                        variant="outline"
                        fullWidth
                        onClick={handleReset}
                        disabled={!hasActiveFilters}
                    >
                        {t('common.reset')}
                    </LButton>
                    <LButton
                        variant="primary"
                        fullWidth
                        onClick={handleApply}
                    >
                        {t('orders.applyFilters')}
                    </LButton>
                </div>
            </div>
        </LResponsiveDialog>
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
