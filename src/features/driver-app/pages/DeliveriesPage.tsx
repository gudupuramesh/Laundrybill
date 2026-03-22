/**
 * Deliveries Page - Driver App
 * 
 * List of delivery tasks assigned to the current agent.
 * Features:
 * - Filter tabs: Pending, Completed, All
 * - Task cards with collection amount and payment status
 * - Quick actions: Call, Navigate
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDriverTasks, type DriverTask } from "../hooks/use-driver-tasks";
import {
    LCard,
    LButton,
    LBadge,
    LSpinner,
    LEmptyState,
    LChipSelect,
    LAmount,
} from "@/components/laundry";
import { PageWrapper } from "@/components/PageWrapper";
import {
    Phone,
    Navigation,
    Clock,
    Package,
    CheckCircle2,
    ChevronRight,
    Truck,
    Banknote,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";

type FilterTab = "pending" | "overdue" | "upcoming" | "completed" | "all";

export function DeliveriesPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [filter, setFilter] = useState<FilterTab>("pending");

    const { deliveryTasks, loading } = useDriverTasks({ type: "delivery" });

    // Filter tasks based on selected tab
    const filteredTasks = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (filter) {
            case "pending":
                // Ready for delivery today (Active)
                return deliveryTasks.filter(t =>
                    t.status === "pending" &&
                    ["ready", "out_for_delivery"].includes(t.orderStatus)
                );
            case "overdue":
                // Overdue: Status is pending, ready for delivery, but past expected date
                return deliveryTasks.filter(t =>
                    t.status === "pending" &&
                    ["ready", "out_for_delivery"].includes(t.orderStatus) &&
                    t.scheduledDate < startOfToday
                );
            case "upcoming":
                // Not yet ready (Processing, Pickup Completed)
                return deliveryTasks.filter(t =>
                    t.status === "pending" &&
                    ["processing", "pickup_completed", "pending", "pickup_scheduled"].includes(t.orderStatus)
                );
            case "completed":
                return deliveryTasks.filter(t => t.status === "completed");
            default:
                return deliveryTasks;
        }
    }, [deliveryTasks, filter]);

    // Stats
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const pendingCount = deliveryTasks.filter(t => t.status === "pending" && ["ready", "out_for_delivery"].includes(t.orderStatus)).length;
    const overdueCount = deliveryTasks.filter(t => t.status === "pending" && ["ready", "out_for_delivery"].includes(t.orderStatus) && t.scheduledDate < startOfToday).length;
    const upcomingCount = deliveryTasks.filter(t => t.status === "pending" && ["processing", "pickup_completed", "pending", "pickup_scheduled"].includes(t.orderStatus)).length;
    const completedCount = deliveryTasks.filter(t => t.status === "completed").length;

    // Amount to collect (only from Active Pending tasks)
    const totalToCollect = deliveryTasks
        .filter(t => t.status === "pending" && ["ready", "out_for_delivery"].includes(t.orderStatus))
        .reduce((sum, t) => sum + (t.amountToCollect || 0), 0);

    const filterOptions = [
        { id: "pending", label: `${t("agent.forDelivery", "For Delivery")} (${pendingCount})` },
        ...(overdueCount > 0 ? [{ id: "overdue", label: `${t("agent.overdue", "Overdue")} (${overdueCount})` }] : []),
        { id: "upcoming", label: `${t("agent.upcoming", "Upcoming")} (${upcomingCount})` },
        { id: "completed", label: `${t("agent.completed", "Completed")} (${completedCount})` },
        { id: "all", label: t("agent.all", "All") },
    ];

    const formatScheduledDate = (date: Date) => {
        if (isToday(date)) return t("common.today", "Today");
        if (isTomorrow(date)) return t("common.tomorrow", "Tomorrow");
        return format(date, "MMM d");
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LSpinner size="lg" />
            </div>
        );
    }

    return (
        <PageWrapper maxWidth="lg">
            {/* Header */}
            <div className="mb-4">
                <h1 className="text-xl font-bold text-foreground">
                    {t("agent.deliveries", "Deliveries")}
                </h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{pendingCount} {t("agent.pendingDeliveries", "pending deliveries")}</span>
                    {totalToCollect > 0 && (
                        <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-success font-medium">
                                <Banknote className="h-4 w-4" />
                                <LAmount value={totalToCollect} />
                                {t("agent.toCollect", "to collect")}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Filter Tabs */}
            <LChipSelect
                options={filterOptions}
                value={filter}
                onChange={(v) => setFilter(v as FilterTab)}
                className="mb-4"
            />

            {/* Task List */}
            {filteredTasks.length === 0 ? (
                <LEmptyState
                    icon={<Truck className="h-12 w-12 text-muted-foreground" />}
                    title={filter === "pending"
                        ? t("agent.noPendingDeliveries", "No pending deliveries")
                        : t("agent.noDeliveries", "No deliveries found")}
                    description={filter === "pending"
                        ? t("agent.noPendingDeliveriesDesc", "You'll see new delivery tasks here when ready")
                        : undefined}
                />
            ) : (
                <div className="space-y-3">
                    {filteredTasks.map((task) => (
                        <DeliveryTaskCard
                            key={task.id}
                            task={task}
                            formatScheduledDate={formatScheduledDate}
                            onClick={() => navigate(`/agent/deliveries/${task.orderId}`)}
                        />
                    ))}
                </div>
            )}
        </PageWrapper>
    );
}

interface TaskCardProps {
    task: DriverTask;
    formatScheduledDate: (date: Date) => string;
    onClick: () => void;
}

function DeliveryTaskCard({ task, formatScheduledDate, onClick }: TaskCardProps) {
    const { t } = useTranslation();
    const isCompleted = task.status === "completed";
    const hasAmount = (task.amountToCollect || 0) > 0;

    return (
        <LCard
            variant="outlined"
            padding="md"
            interactive
            onClick={onClick}
            className={isCompleted ? "opacity-75" : "border-l-4 border-l-primary"}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <LBadge variant={isCompleted ? "muted" : "default"} size="sm">
                        {isCompleted ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" />{t("agent.delivered", "Delivered")}</>
                        ) : (
                            <><Truck className="h-3 w-3 mr-1" />{t("agent.delivery", "DELIVERY")}</>
                        )}
                    </LBadge>
                    <span className="font-bold text-foreground">#{task.orderPublicId}</span>
                </div>
                <div className="flex items-center gap-2">
                    {hasAmount && !isCompleted && (
                        <LBadge variant="success" size="sm">
                            <LAmount value={task.amountToCollect || 0} />
                        </LBadge>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
            </div>

            <p className="font-medium text-foreground">{task.customer.name}</p>
            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                {task.customer.address}
            </p>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatScheduledDate(task.scheduledDate)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {task.itemCount} {t("agent.items", "items")}
                    </span>
                    {task.paymentStatus && (
                        <LBadge
                            variant={task.paymentStatus === "paid" ? "success" : task.paymentStatus === "partial" ? "warning" : "destructive"}
                            size="sm"
                        >
                            {task.paymentStatus === "paid" ? t("agent.paid", "Paid") :
                                task.paymentStatus === "partial" ? t("agent.partial", "Partial") :
                                    t("agent.unpaid", "Unpaid")}
                        </LBadge>
                    )}
                </div>
            </div>

            {/* Quick Actions - Only show for pending tasks */}
            {!isCompleted && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <LButton
                        variant="outline"
                        size="sm"
                        leftIcon={<Phone className="h-4 w-4" />}
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(`tel:${task.customer.phone}`);
                        }}
                    >
                        {t("common.call", "Call")}
                    </LButton>
                    <LButton
                        variant="secondary"
                        size="sm"
                        leftIcon={<Navigation className="h-4 w-4" />}
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://maps.google.com/?q=${encodeURIComponent(task.customer.address)}`);
                        }}
                    >
                        {t("agent.navigate", "Navigate")}
                    </LButton>
                </div>
            )}
        </LCard>
    );
}
