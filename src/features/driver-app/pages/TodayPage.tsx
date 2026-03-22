/**
 * Today Page - Driver Dashboard
 * 
 * The main dashboard for delivery agents showing:
 * - Quick stats (pickups, deliveries, collected)
 * - Next task card with quick actions
 * - Quick links to task lists
 */

import { useTranslation } from "react-i18next";
import { useDriverAuth } from "../DriverAuthContext";
import { useNavigate } from "react-router-dom";
import {
    LCard,
    LButton,
    LStatCard,
    LBadge,
    LSpinner,
    LEmptyState,
} from "@/components/laundry";
import { PageWrapper } from "@/components/PageWrapper";
import { useDriverTasks } from "../hooks/use-driver-tasks";
import {
    MapPin,
    Truck,
    IndianRupee,
    Phone,
    Navigation,
    ChevronRight,
    Package,
    Clock,
    CheckCircle2,
} from "lucide-react";
import { useCurrencyByShopId } from "@/hooks/use-currency";

export function TodayPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { agent, shopId, isOnline } = useDriverAuth();
    const { formatAmount } = useCurrencyByShopId(shopId);

    // Fetch real tasks (default sorts by scheduled time)
    // We want all tasks to count pending
    const { tasks, todayStats, loading } = useDriverTasks();

    // Next task is the first pending task
    const nextTask = tasks.find(t => t.status === "pending");

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LSpinner size="lg" />
            </div>
        );
    }

    return (
        <PageWrapper maxWidth="lg">
            {/* Welcome Header */}
            <div className="mb-6">
                <p className="text-sm text-muted-foreground">{t("agent.welcome", "Welcome back")}</p>
                <h1 className="text-2xl font-bold text-foreground">{agent?.name || "Agent"}</h1>
                {!isOnline && (
                    <LBadge variant="warning" size="md" className="mt-2">
                        <Clock className="h-3 w-3 mr-1" />
                        {t("agent.offlineHint", "Go online to receive tasks")}
                    </LBadge>
                )}
            </div>

            {/* Stats Cards - Using LStatCard */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <LStatCard
                    title={t("agent.pickups", "Pickups")}
                    value={`${todayStats.pickups.completed}/${todayStats.pickups.total}`}
                    icon={<MapPin className="h-5 w-5" />}
                    variant="success"
                    onClick={() => navigate("/agent/pickups")}
                />
                <LStatCard
                    title={t("agent.deliveries", "Deliveries")}
                    value={`${todayStats.deliveries.completed}/${todayStats.deliveries.total}`}
                    icon={<Truck className="h-5 w-5" />}
                    variant="primary"
                    onClick={() => navigate("/agent/deliveries")}
                />
                <LStatCard
                    title={t("agent.collected", "Collected")}
                    value={formatAmount(todayStats.collected)}
                    icon={<IndianRupee className="h-5 w-5" />}
                    variant="warning"
                />
            </div>

            {/* Next Task Section */}
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground mb-3">
                    {t("agent.nextTask", "Next Task")}
                </h2>

                {nextTask ? (
                    <LCard
                        variant="outlined"
                        padding="md"
                        interactive
                        onClick={() => navigate(`/agent/${nextTask.type}s/${nextTask.orderId}`)}
                        className="border-l-4 border-l-primary"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <LBadge
                                        variant={nextTask.type === "pickup" ? "success" : "default"}
                                        size="sm"
                                    >
                                        {nextTask.type.toUpperCase()}
                                    </LBadge>
                                    <span className="font-bold text-foreground">#{nextTask.orderPublicId}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    <Clock className="h-3 w-3 inline mr-1" />
                                    {nextTask.timeSlot
                                        ? `${nextTask.timeSlot.start} - ${nextTask.timeSlot.end}`
                                        : nextTask.scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    }
                                </p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>

                        <p className="font-medium text-foreground">{nextTask.customer.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                            {nextTask.customer.address}
                        </p>

                        {/* Quick Actions */}
                        <div className="flex gap-2 mt-4">
                            <LButton
                                variant="outline"
                                size="sm"
                                leftIcon={<Phone className="h-4 w-4" />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`tel:${nextTask.customer.phone}`);
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
                                    window.open(`https://maps.google.com/?q=${encodeURIComponent(nextTask.customer.address)}`);
                                }}
                            >
                                {t("agent.navigate", "Navigate")}
                            </LButton>
                        </div>
                    </LCard>
                ) : (
                    <LEmptyState
                        icon={<Package className="h-12 w-12 text-muted-foreground" />}
                        title={t("agent.noTasksTitle", "No tasks right now")}
                        description={t("agent.noTasksDesc", "You'll be notified when new tasks are assigned")}
                    />
                )}
            </div>

            {/* Pending Tasks Queue */}
            <h2 className="text-lg font-semibold text-foreground mb-3 flex justify-between items-center">
                <span>{t("agent.tasks", "Pending Tasks")}</span>
                <span className="text-sm font-normal text-muted-foreground">
                    {tasks.filter(t => t.status === "pending").length} {t("common.total")}
                </span>
            </h2>

            {tasks.filter(t => t.status === "pending").length === 0 ? (
                <LEmptyState
                    icon={<CheckCircle2 className="h-12 w-12 text-muted-foreground" />}
                    title={t("agent.allCaughtUp", "All caught up!")}
                    description={t("agent.noPendingTasks", "You have no pending tasks right now.")}
                />
            ) : (
                <div className="space-y-3 pb-20">
                    {tasks.filter(t => t.status === "pending").map((task) => (
                        <LCard
                            key={task.id}
                            variant="outlined"
                            padding="md"
                            interactive
                            onClick={() => navigate(`/agent/${task.type}s/${task.orderId}`)}
                            className={`border-l-4 ${task.type === 'pickup' ? 'border-l-success' : 'border-l-primary'}`}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <LBadge variant={task.type === "pickup" ? "success" : "default"} size="sm">
                                        {task.type === "pickup" ? (
                                            <><MapPin className="h-3 w-3 mr-1" />{t("agent.pickup", "PICKUP")}</>
                                        ) : (
                                            <><Truck className="h-3 w-3 mr-1" />{t("agent.delivery", "DELIVERY")}</>
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

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>
                                    {task.timeSlot
                                        ? `${task.timeSlot.start} - ${task.timeSlot.end}`
                                        : task.scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    }
                                </span>
                                {task.type === "pickup" && (
                                    <span>• {task.scheduledDate.toLocaleDateString()}</span>
                                )}
                            </div>
                        </LCard>
                    ))}
                </div>
            )}
        </PageWrapper>
    );
}
