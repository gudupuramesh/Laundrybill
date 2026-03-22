import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { LCard, LBadge, LButton, LSpinner } from "@/components/laundry";
import type { Order, OrderStatus } from "@/types/order";
import { format } from "date-fns";
import {
    Clock,
    Package,
    ArrowRight,
    Search
} from "lucide-react";

interface PlantOrderListProps {
    title: string;
    status: OrderStatus;
    orders?: Order[]; // Optional for now until we have real data
    loading?: boolean;
    emptyMessage?: string;
    actionLabel?: string;
    onAction?: (orderId: string) => void;
    actionVariant?: "primary" | "secondary" | "outline" | "destructive" | "ghost" | "link" | "success";
    secondaryActionLabel?: string;
    onSecondaryAction?: (order: Order) => void;
}

export function PlantOrderList({
    title,
    status,
    orders = [],
    loading = false,
    emptyMessage = "No orders found",
    actionLabel,
    onAction,
    actionVariant = "outline",
    secondaryActionLabel,
    onSecondaryAction
}: PlantOrderListProps) {
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState("");
    const [visibleCount, setVisibleCount] = useState(20);

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <LSpinner size="lg" />
            </div>
        );
    }

    const filteredOrders = orders.filter(order => {
        if (!searchTerm) return true;
        const lowerTerm = searchTerm.toLowerCase();
        return (
            order.orderNumber.toLowerCase().includes(lowerTerm) ||
            order.customerName.toLowerCase().includes(lowerTerm)
        );
    });

    const displayOrders = filteredOrders.slice(0, visibleCount);
    const hasMore = visibleCount < filteredOrders.length;

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 20);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">{title}</h1>
                    <p className="text-muted-foreground">
                        {filteredOrders.length} orders {status === "pickup_completed" ? "waiting" : "active"}
                    </p>
                </div>
                {/* Search Bar - Visible on Mobile now */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        placeholder="Search Order ID or Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 border rounded-md text-sm bg-background"
                    />
                </div>
            </div>

            <div className="grid gap-4">
                {displayOrders.map((order: any) => (
                    <LCard key={order.id} className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <Package className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-lg">{order.orderNumber}</span>
                                        <LBadge variant="outline">{order.items.length} Items</LBadge>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {format(new Date(order.createdAt?.seconds * 1000 || Date.now()), "dd MMM, hh:mm a")}
                                        </span>
                                        <span>•</span>
                                        <span>{order.customerName}</span>

                                        {/* Due Date Alert logic */}
                                        {(() => {
                                            if (!order.targetDate) return null;
                                            const targetDate = order.targetDate.toDate ? order.targetDate.toDate() : new Date(order.targetDate);
                                            const now = new Date();
                                            const isOverdue = now > targetDate;
                                            const isDueSoon = !isOverdue && (targetDate.getTime() - now.getTime() < 4 * 60 * 60 * 1000);

                                            if (isOverdue) return <LBadge variant="destructive" className="ml-2 animate-pulse">OVERDUE</LBadge>;
                                            if (isDueSoon) return <LBadge variant="warning" className="ml-2">DUE SOON</LBadge>;
                                            return null;
                                        })()}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 md:self-center self-end">
                                <LButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/plant/orders/${order.id}`)}
                                >
                                    View Details
                                </LButton>
                                {secondaryActionLabel && onSecondaryAction && (
                                    <LButton
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onSecondaryAction(order)}
                                    >
                                        {secondaryActionLabel}
                                    </LButton>
                                )}
                                {actionLabel && onAction && (
                                    <LButton
                                        variant={actionVariant}
                                        onClick={() => onAction(order.id)}
                                    >
                                        {actionLabel} <ArrowRight className="ml-2 h-4 w-4" />
                                    </LButton>
                                )}
                            </div>
                        </div>
                    </LCard>
                ))}
            </div>

            {hasMore && (
                <div className="flex justify-center pt-4">
                    <LButton variant="outline" onClick={handleLoadMore}>
                        Load More Orders
                    </LButton>
                </div>
            )}

            {filteredOrders.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <p>{searchTerm ? "No orders match your search" : emptyMessage}</p>
                </div>
            )}
        </div>
    );
}
