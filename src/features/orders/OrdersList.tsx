/**
 * Orders List Component
 * 
 * Used within master-detail layout on desktop
 * Displays searchable, filterable list of orders with stats
 */

import React, { useState, useEffect, useRef, useMemo, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { SeenOnlineOrdersContext } from "@/hooks/use-seen-online-orders";
import {
    LSearchInput,
    LList,
    LListItem,
    LAvatar,
    LStatusBadge,
    LAmount,
    LDateDisplay,
    LEmptyState,
    LSkeletonList,
    LAdSlot,
    LSpinner,
} from "@/components/laundry";
import { useOrdersPaginated, type OrderSourceFilter } from "@/hooks/use-orders-paginated";
import { useOrderSummary } from "@/hooks/use-order-summary";
import { useCurrency } from "@/hooks/use-currency";
import { useIsMobile } from "@/hooks/use-mobile";
import type { OrderStatus, DeliveryType } from "@/types/order";
import { mapLegacyDeliveryType, STATUS_LABELS } from "@/types/order";
import { ClipboardList, Store, Truck, Home, Package, CheckCircle, Clock, AlertCircle, IndianRupee, AlertTriangle, Wallet, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { OrderFilterSheet, OrderFilterButton } from "./OrderFilterSheet";

// Delivery type badge configuration
const useDeliveryTypeConfig = () => {
    const { t } = useTranslation();
    return {
        pickup_store: {
            icon: Store,
            label: t('orders.deliveryTypes.pickup'),
            bgClass: "bg-blue-100",
            textClass: "text-blue-700",
        },
        delivery_home: {
            icon: Truck,
            label: t('orders.deliveryTypes.delivery'),
            bgClass: "bg-green-100",
            textClass: "text-green-700",
        },
        pickup_home: {
            icon: Home,
            label: t('orders.deliveryTypes.collect'),
            bgClass: "bg-purple-100",
            textClass: "text-purple-700",
        },
    };
};

const AD_FREQUENCY = 5; // Show ad every 5 orders on mobile

interface OrdersListProps {
    selectedId?: string | null;
    onSelect?: (orderId: string) => void;
}

// Stats summary chip component
function StatChip({
    icon: Icon,
    label,
    count,
    color,
    onClick,
    isActive
}: {
    icon: typeof Package;
    label: string;
    count: number;
    color: "primary" | "success" | "warning" | "destructive";
    onClick?: () => void;
    isActive?: boolean;
}) {
    const colorClasses = {
        primary: "bg-primary/10 text-primary",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        destructive: "bg-destructive/10 text-destructive",
    };

    return (
        <button
            onClick={onClick}
            disabled={!onClick}
            className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                colorClasses[color],
                isActive && "ring-2 ring-offset-1 ring-primary",
                onClick && "cursor-pointer hover:opacity-80 active:scale-95",
                !onClick && "cursor-default"
            )}
        >
            <Icon className="h-3.5 w-3.5" />
            <span>{count}</span>
            <span className="hidden sm:inline text-[10px] opacity-75">{label}</span>
        </button>
    );
}

export function OrdersList({ selectedId, onSelect }: OrdersListProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { markSeen } = useContext(SeenOnlineOrdersContext);
    const [selectedDeliveryType, setSelectedDeliveryType] = useState<DeliveryType | "all">("all");
    const DELIVERY_TYPE_CONFIG = useDeliveryTypeConfig();
    const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "all">("all");
    const [selectedOrderSource, setSelectedOrderSource] = useState<OrderSourceFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);

    // Special Filters (Mutually exclusive with standard filters)
    const [specialFilter, setSpecialFilter] = useState<'pending_overdue' | 'payment_due' | null>(null);
    const { formatAmount } = useCurrency();

    // Use paginated hook
    const { orders, loading, loadingMore, hasMore, loadMore } = useOrdersPaginated({
        status: specialFilter ? 'all' : (selectedStatus !== "all" ? selectedStatus : 'all'),
        deliveryType: specialFilter ? 'all' : (selectedDeliveryType !== "all" ? selectedDeliveryType : 'all'),
        orderSource: specialFilter ? 'all' : selectedOrderSource,
        searchTerm: searchQuery,
        specialFilter: specialFilter,
    });

    const handleSpecialFilter = (filter: 'pending_overdue' | 'payment_due') => {
        if (specialFilter === filter) {
            setSpecialFilter(null); // Toggle off
        } else {
            setSpecialFilter(filter);
            // Reset standard filters when special filter is active
            setSelectedDeliveryType("all");
            setSelectedStatus("all");
        }
    };

    // When standard filters change, clear special filter (or set it if coming from sheet)
    const handleFilterApply = (
        type: DeliveryType | "all",
        status: OrderStatus | "all",
        newSpecialFilter: 'pending_overdue' | 'payment_due' | null = null,
        orderSource: OrderSourceFilter = "all"
    ) => {
        if (newSpecialFilter) {
            setSpecialFilter(newSpecialFilter);
            setSelectedDeliveryType("all");
            setSelectedStatus("all");
            setSelectedOrderSource("all");
        } else {
            setSelectedDeliveryType(type);
            setSelectedStatus(status);
            setSelectedOrderSource(orderSource);
            setSpecialFilter(null);
        }
    };

    // Mark online order as seen when user selects it (so Orders badge count goes down)
    useEffect(() => {
        if (!selectedId || !markSeen) return;
        const selected = orders.find((o) => o.id === selectedId);
        if (selected?.orderSource === "online") {
            markSeen(selectedId);
        }
    }, [selectedId, orders, markSeen]);

    // Fetch proper financial summary (Revenue/Collected This Month, Due All Time)
    const summaryMetrics = useOrderSummary();

    // Calculate order stats including revenue
    const orderStats = useMemo(() => {
        const stats = {
            total: orders.length,
            online: 0,
            pickupStore: 0,
            pickupHome: 0,
            deliveryHome: 0,
            // By status
            delivered: 0,
            ongoing: 0,
            unpaid: 0, // Orders that are delivered but not fully paid
        };

        orders.forEach(order => {
            if (order.orderSource === "online") stats.online++;
            const deliveryType = mapLegacyDeliveryType(order.deliveryType);
            const total = order.financials?.total || 0;
            const paid = order.financials?.amountPaid || 0;
            const balance = order.financials?.balance ?? (total - paid);

            // Revenue/Collected metrics removed here (handled by summaryMetrics)

            // Count by delivery type
            switch (deliveryType) {
                case "pickup_store": stats.pickupStore++; break;
                case "pickup_home": stats.pickupHome++; break;
                case "delivery_home": stats.deliveryHome++; break;
            }

            // Count by status - "picked_up" for store pickup = delivered
            const isCompleted = order.status === "delivered" ||
                (order.status === "picked_up" && deliveryType === "pickup_store");

            if (isCompleted) {
                stats.delivered++;
                // Check if payment is pending (delivered but not paid)
                if (balance > 0) {
                    stats.unpaid++;
                }
            } else if (order.status !== "cancelled") {
                stats.ongoing++;
            }
        });

        return stats;
    }, [orders]);

    // Count active filters
    const activeFiltersCount = (selectedDeliveryType !== "all" ? 1 : 0) + (selectedStatus !== "all" ? 1 : 0) + (selectedOrderSource !== "all" ? 1 : 0) + (specialFilter ? 1 : 0);

    // Get filter summary text
    const getFilterSummary = () => {
        const parts: string[] = [];

        if (specialFilter === 'pending_overdue') return t('orders.filters.overdueOrders');
        if (specialFilter === 'payment_due') return t('orders.filters.unpaidDues');

        if (selectedOrderSource !== "all") {
            parts.push(selectedOrderSource === "online" ? t('orders.onlineOrders') : t('orders.posOrders'));
        }
        if (selectedDeliveryType !== "all") {
            const typeLabels: Record<DeliveryType, string> = {
                pickup_store: t('orders.shopPickup'),
                delivery_home: t('orders.homeDelivery'),
                pickup_home: t('orders.pickupFromHome'),
            };
            parts.push(typeLabels[selectedDeliveryType]);
        }
        if (selectedStatus !== "all") {
            parts.push(STATUS_LABELS[selectedStatus]);
        }
        return parts.length > 0 ? parts.join(" • ") : null;
    };

    // Infinite scroll with IntersectionObserver
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (loading) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [loading, hasMore, loadingMore, loadMore]);

    // Group orders by date
    const groupedOrders = orders.reduce((acc, order) => {
        const dateKey = order.createdAt.toDate().toDateString();
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(order);
        return acc;
    }, {} as Record<string, typeof orders>);

    const handleOrderClick = (orderId: string) => {
        if (onSelect) {
            onSelect(orderId);
        } else {
            navigate(`/orders/${orderId}`);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-card p-4 space-y-3 border-b border-border">
                <div className="flex gap-3">
                    <div className="flex-1">
                        <LSearchInput
                            placeholder={t('orders.searchOrders')}
                            onChange={setSearchQuery}
                        />
                    </div>
                    <OrderFilterButton
                        activeFiltersCount={activeFiltersCount}
                        onClick={() => setFilterSheetOpen(true)}
                    />
                </div>

                {/* Order Stats Summary */}
                {!loading && (
                    <div className="space-y-2">
                        {/* Revenue Stats Row */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                                <IndianRupee className="h-3.5 w-3.5" />
                                {summaryMetrics.loading ? (
                                    <LSpinner size="sm" />
                                ) : (
                                    <span>{formatAmount(summaryMetrics.revenue)}</span>
                                )}
                                <span className="text-[10px] opacity-75">{t('orders.stats.revenue')}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-success/10 text-success">
                                {summaryMetrics.loading ? (
                                    <LSpinner size="sm" />
                                ) : (
                                    <span>{formatAmount(summaryMetrics.collected)}</span>
                                )}
                                <span className="text-[10px] opacity-75">{t('orders.stats.collected')}</span>
                            </div>
                            {summaryMetrics.due > 0 && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive">
                                    {summaryMetrics.loading ? (
                                        <LSpinner size="sm" />
                                    ) : (
                                        <span>{formatAmount(summaryMetrics.due)}</span>
                                    )}
                                    <span className="text-[10px] opacity-75">{t('orders.stats.due')}</span>
                                </div>
                            )}
                        </div>

                        {/* Order Counts Row */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {/* Total */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-muted">
                                <Package className="h-3.5 w-3.5" />
                                <span>{orderStats.total}</span>
                                <span className="text-[10px] opacity-75">{t('orders.stats.total')}</span>
                            </div>

                            {/* By type */}
                            <div className="h-4 w-px bg-border" />
                            {orderStats.online > 0 && (
                                <StatChip
                                    icon={Globe}
                                    label={t('orders.onlineOrders')}
                                    count={orderStats.online}
                                    color="primary"
                                    onClick={() => handleFilterApply(selectedDeliveryType, selectedStatus, null, "online")}
                                    isActive={selectedOrderSource === "online"}
                                />
                            )}
                            <StatChip icon={Store} label={t('orders.stats.store')} count={orderStats.pickupStore} color="primary" />
                            <StatChip icon={Home} label={t('orders.deliveryTypes.collect')} count={orderStats.pickupHome} color="primary" />
                            <StatChip icon={Truck} label={t('orders.deliveryTypes.delivery')} count={orderStats.deliveryHome} color="success" />

                            <div className="h-4 w-px bg-border" />

                            {/* Attention Needed */}
                            {summaryMetrics.pendingCount > 0 && (
                                <StatChip
                                    icon={AlertTriangle}
                                    label={t('orders.pending')}
                                    count={summaryMetrics.pendingCount}
                                    color="destructive"
                                    onClick={() => handleSpecialFilter('pending_overdue')}
                                    isActive={specialFilter === 'pending_overdue'}
                                />
                            )}
                            {summaryMetrics.unpaidCount > 0 && (
                                <StatChip
                                    icon={Wallet}
                                    label={t('orders.stats.due')}
                                    count={summaryMetrics.unpaidCount}
                                    color="warning"
                                    onClick={() => handleSpecialFilter('payment_due')}
                                    isActive={specialFilter === 'payment_due'}
                                />
                            )}

                            {/* By status */}
                            <div className="h-4 w-px bg-border" />
                            <StatChip icon={CheckCircle} label={t('orders.steps.delivered')} count={orderStats.delivered} color="success" />
                            <StatChip icon={Clock} label={t('orders.stats.ongoing')} count={orderStats.ongoing} color="warning" />
                            {orderStats.unpaid > 0 && (
                                <StatChip icon={AlertCircle} label={t('orders.stats.unpaid')} count={orderStats.unpaid} color="destructive" />
                            )}
                        </div>
                    </div>
                )}

                {/* Active Filter Summary */}
                {activeFiltersCount > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{t('orders.filterOrders')}:</span>
                        <span className="text-xs font-medium text-primary">
                            {getFilterSummary()}
                        </span>
                        <button
                            onClick={() => {
                                setSelectedDeliveryType("all");
                                setSelectedStatus("all");
                                setSelectedOrderSource("all");
                                setSpecialFilter(null);
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            {t('orders.filters.reset')}
                        </button>
                    </div>
                )}
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <LSkeletonList count={5} />
                ) : orders.length === 0 ? (
                    <LEmptyState
                        icon={<ClipboardList className="h-8 w-8" />}
                        title={t('orders.empty')}
                        description={
                            selectedStatus !== "all"
                                ? t('orders.tryDifferentFilter')
                                : t('orders.createFirstOrder')
                        }
                    />
                ) : (
                    <div className="space-y-4">
                        {Object.entries(groupedOrders).map(([date, dateOrders]) => (
                            <div key={date}>
                                {/* Date Header */}
                                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                                    <LDateDisplay date={new Date(date)} format="smart" />
                                </h3>

                                {/* Orders */}
                                <LList>
                                    {dateOrders.map((order, index) => (
                                        <React.Fragment key={order.id}>
                                            <LListItem
                                                title={
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span>#{order.publicId}</span>
                                                        {order.orderSource === "online" && (
                                                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-0.5 bg-teal-100 text-teal-700">
                                                                <Globe className="h-2.5 w-2.5" />
                                                                {t('orders.onlineOrders')}
                                                            </span>
                                                        )}
                                                        {(() => {
                                                            const deliveryType = mapLegacyDeliveryType(order.deliveryType);
                                                            const config = DELIVERY_TYPE_CONFIG[deliveryType];
                                                            const Icon = config.icon;
                                                            return (
                                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-0.5 ${config.bgClass} ${config.textClass}`}>
                                                                    <Icon className="h-2.5 w-2.5" />
                                                                    {config.label}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                }
                                                subtitle={`${order.customerName} • ${order.items.length} ${t('pos.items')} • By ${order.staffName || 'Admin'}`}
                                                leftContent={
                                                    <LAvatar name={order.customerName} size="sm" />
                                                }
                                                rightContent={
                                                    <div className="text-right">
                                                        <LAmount value={order.financials.total} size="sm" />
                                                        <div className="mt-1">
                                                            <LStatusBadge status={order.status} size="sm" />
                                                        </div>
                                                    </div>
                                                }
                                                onClick={() => handleOrderClick(order.id)}
                                                className={cn(
                                                    "cursor-pointer transition-colors",
                                                    selectedId === order.id &&
                                                    "bg-primary-muted border-l-4 border-l-primary"
                                                )}
                                            />
                                            {/* Mobile: Show ad card every N items */}
                                            {isMobile && (index + 1) % AD_FREQUENCY === 0 && (
                                                <LAdSlot
                                                    variant="card"
                                                    position={`orders-list-${index + 1}`}
                                                />
                                            )}
                                        </React.Fragment>
                                    ))}
                                </LList>
                            </div>
                        ))}
                    </div>
                )}

                {/* Infinite Scroll Trigger */}
                <div ref={loadMoreRef} className="h-16 flex items-center justify-center">
                    {loadingMore && <LSpinner size="sm" />}
                    {!hasMore && orders.length > 0 && (
                        <p className="text-xs text-muted-foreground">{t('orders.noMore')}</p>
                    )}
                </div>
            </div>

            {/* Filter Sheet */}
            <OrderFilterSheet
                open={filterSheetOpen}
                onClose={() => setFilterSheetOpen(false)}
                selectedDeliveryType={selectedDeliveryType}
                selectedStatus={selectedStatus}
                selectedOrderSource={selectedOrderSource}
                selectedSpecialFilter={specialFilter}
                onApply={handleFilterApply}
            />
        </div>
    );
}
