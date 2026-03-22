/**
 * Orders List Page
 * 
 * Display orders with search, filtering, and status tabs
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import {
    LChipSelect,
    LSearchInput,
    LList,
    LListItem,
    LAvatar,
    LStatusBadge,
    LAmount,
    LDateDisplay,
    LEmptyState,
    LSkeletonList,
    LSwipeableListItem,
    LButton,
} from "@/components/laundry";
import { useOrders } from "@/hooks/use-orders";
import type { OrderStatus } from "@/types/order";
import { ClipboardList, Phone, Edit } from "lucide-react";
import { useTranslation } from "react-i18next";

// Status options - use i18n keys
const STATUS_OPTIONS_KEYS = [
    { id: "all", key: "orders.allStatuses" },
    { id: "pending", key: "orders.pending" },
    { id: "processing", key: "orders.processing" },
    { id: "ready", key: "orders.steps.ready" },
    { id: "delivered", key: "orders.steps.delivered" },
    { id: "cancelled", key: "orders.cancelled" },
];

export function OrdersListPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    const statusOptions = STATUS_OPTIONS_KEYS.map(opt => ({
        id: opt.id,
        label: t(opt.key)
    }));

    const { orders, loading, hasMore, loadMore } = useOrders({
        status: selectedStatus !== "all" ? (selectedStatus as OrderStatus) : undefined,
    });

    // Filter by search (phone or order ID)
    const filteredOrders = orders.filter((order) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            order.publicId.toLowerCase().includes(query) ||
            order.customerPhone.includes(query) ||
            order.customerName.toLowerCase().includes(query)
        );
    });

    // Group orders by date
    const groupedOrders = filteredOrders.reduce((acc, order) => {
        const dateKey = order.createdAt.toDate().toDateString();
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(order);
        return acc;
    }, {} as Record<string, typeof orders>);

    return (
        <PageWrapper>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background -mx-4 px-4 py-3 space-y-3 border-b border-border">
                <LSearchInput
                    placeholder={t('orders.searchOrders')}
                    onChange={setSearchQuery}
                />
                <LChipSelect
                    options={statusOptions}
                    value={selectedStatus}
                    onChange={(v) => setSelectedStatus(v as string)}
                />
            </div>

            {/* Orders List */}
            <div className="mt-4">
                {loading ? (
                    <LSkeletonList count={5} />
                ) : filteredOrders.length === 0 ? (
                    <LEmptyState
                        icon={<ClipboardList className="h-8 w-8" />}
                        title={t('orders.empty')}
                        description={
                            selectedStatus !== "all"
                                ? t('orders.tryDifferentFilter')
                                : t('orders.createFirstOrder')
                        }
                        action={{
                            label: t('dashboard.createOrder'),
                            onClick: () => navigate("/new-order"),
                        }}
                    />
                ) : (
                    <div className="space-y-6">
                        {Object.entries(groupedOrders).map(([date, dateOrders]) => (
                            <div key={date}>
                                {/* Date Header */}
                                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                                    <LDateDisplay date={new Date(date)} format="smart" />
                                </h3>

                                {/* Orders */}
                                <LList>
                                    {dateOrders.map((order) => (
                                        <LSwipeableListItem
                                            key={order.id}
                                            rightActions={[
                                                {
                                                    icon: Phone,
                                                    label: t('common.call'),
                                                    color: "primary",
                                                    onClick: () => window.open(`tel:${order.customerPhone}`),
                                                },
                                                {
                                                    icon: Edit,
                                                    label: t('common.edit'),
                                                    color: "warning",
                                                    onClick: () => navigate(`/orders/${order.id}`),
                                                },
                                            ]}
                                        >
                                            <LListItem
                                                title={`#${order.publicId}`}
                                                subtitle={`${order.customerName} • ${order.items.length} ${t('pos.items')}`}
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
                                                onClick={() => navigate(`/orders/${order.id}`)}
                                            />
                                        </LSwipeableListItem>
                                    ))}
                                </LList>
                            </div>
                        ))}

                        {/* Load More */}
                        {hasMore && (
                            <div className="text-center py-4">
                                <LButton variant="ghost" onClick={loadMore}>
                                    {t('common.loadMore')}
                                </LButton>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </PageWrapper>
    );
}
