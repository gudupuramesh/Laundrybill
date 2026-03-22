/**
 * Pickups Page - Driver App
 * 
 * List of pickup tasks assigned to the current agent.
 * Features:
 * - Filter tabs: Pending, Completed, All
 * - Task cards with customer info and quick actions
 * - Pull to refresh
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
} from "@/components/laundry";
import { PageWrapper } from "@/components/PageWrapper";
import {
    MapPin,
    Phone,
    Navigation,
    Clock,
    Package,
    CheckCircle2,
    ChevronRight,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";

type FilterTab = "pending" | "overdue" | "upcoming" | "completed" | "all";

export function PickupsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [filter, setFilter] = useState<FilterTab>("pending");

    const { pickupTasks, loading } = useDriverTasks({ type: "pickup" });

    // Filter tasks based on selected tab
    const filteredTasks = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        switch (filter) {
            case "pending":
                // Today: Status is pending AND date is today
                return pickupTasks.filter(t =>
                    t.status === "pending" &&
                    t.scheduledDate >= startOfToday &&
                    t.scheduledDate <= endOfToday
                );
            case "overdue":
                // Overdue: Status is pending AND date is before today
                return pickupTasks.filter(t =>
                    t.status === "pending" &&
                    t.scheduledDate < startOfToday
                );
            case "upcoming":
                // Upcoming: Status is pending AND date is after today
                return pickupTasks.filter(t =>
                    t.status === "pending" &&
                    t.scheduledDate > endOfToday
                );
            case "completed":
                return pickupTasks.filter(t => t.status === "completed");
            default:
                return pickupTasks;
        }
    }, [pickupTasks, filter]);

    // Stats
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Calculate counts
    const pendingCount = pickupTasks.filter(t => t.status === "pending" && t.scheduledDate >= startOfToday && t.scheduledDate <= endOfToday).length;
    const overdueCount = pickupTasks.filter(t => t.status === "pending" && t.scheduledDate < startOfToday).length;
    const upcomingCount = pickupTasks.filter(t => t.status === "pending" && t.scheduledDate > endOfToday).length;
    const completedCount = pickupTasks.filter(t => t.status === "completed").length;

    const filterOptions = [
        { id: "pending", label: `${t("agent.today", "Today")} (${pendingCount})` },
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
                    {t("agent.pickups", "Pickups")}
                </h1>
                <p className="text-sm text-muted-foreground">
                    {pendingCount} {t("agent.pendingPickups", "pending pickups")}
                </p>
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
                    icon={<Package className="h-12 w-12 text-muted-foreground" />}
                    title={filter === "pending"
                        ? t("agent.noPendingPickups", "No pending pickups")
                        : t("agent.noPickups", "No pickups found")}
                    description={filter === "pending"
                        ? t("agent.noPendingPickupsDesc", "You'll see new pickup tasks here when assigned")
                        : undefined}
                />
            ) : (
                <div className="space-y-3">
                    {filteredTasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            formatScheduledDate={formatScheduledDate}
                            onClick={() => navigate(`/agent/pickups/${task.orderId}`)}
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

function TaskCard({ task, formatScheduledDate, onClick }: TaskCardProps) {
    const { t } = useTranslation();
    const isCompleted = task.status === "completed";

    return (
        <LCard
            variant="outlined"
            padding="md"
            interactive
            onClick={onClick}
            className={isCompleted ? "opacity-75" : "border-l-4 border-l-success"}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <LBadge variant={isCompleted ? "muted" : "success"} size="sm">
                        {isCompleted ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" />{t("agent.completed", "Completed")}</>
                        ) : (
                            <><MapPin className="h-3 w-3 mr-1" />{t("agent.pickup", "PICKUP")}</>
                        )}
                    </LBadge>
                    <span className="font-bold text-foreground">#{task.orderPublicId}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>

            <p className="font-medium text-foreground">{task.customer.name}</p>
            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                {task.customer.address}
            </p>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatScheduledDate(task.scheduledDate)}</span>
                    {task.timeSlot?.start && <span>• {task.timeSlot.start}</span>}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" />
                    <span>{task.itemCount} {t("agent.items", "items")}</span>
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
