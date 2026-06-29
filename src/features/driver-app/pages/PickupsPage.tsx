/**
 * Pickups Page - Driver App
 *
 * List of pickup tasks assigned to the current agent.
 * Features:
 * - Filter tabs: Pending, Completed, All
 * - Task cards with customer info and quick actions
 * - Pull to refresh
 */

import { useState, useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDriverTasks, type DriverTask } from "../hooks/use-driver-tasks";
import {
    MapPin,
    Phone,
    Navigation,
    Clock,
    Package,
    CheckCircle2,
    ChevronRight,
    Loader2,
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
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
                <Loader2 className="animate-spin" size={28} style={{ color: "var(--c-primary)" }} />
            </div>
        );
    }

    return (
        <div style={{ color: "var(--c-text)", fontSize: 14, lineHeight: 1.45, padding: "20px 22px 40px", maxWidth: 720, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ marginBottom: 18 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.01em" }}>
                    {t("agent.pickups", "Pickups")}
                </h1>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--c-text-3)" }}>
                    {pendingCount} {t("agent.pendingPickups", "pending pickups")}
                </p>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                {filterOptions.map((opt) => {
                    const active = filter === opt.id;
                    return (
                        <button
                            key={opt.id}
                            onClick={() => setFilter(opt.id as FilterTab)}
                            style={{
                                cursor: "pointer",
                                font: "inherit",
                                fontSize: 13,
                                fontWeight: 600,
                                padding: "8px 14px",
                                borderRadius: 20,
                                color: active ? "#fff" : "var(--c-text-2)",
                                background: active ? "var(--c-primary)" : "var(--c-surface-2)",
                                border: active ? "1px solid var(--c-primary)" : "1px solid var(--c-border)",
                                boxShadow: active ? "var(--sh-sm)" : "none",
                                transition: "background .12s, color .12s",
                            }}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>

            {/* Task List */}
            {filteredTasks.length === 0 ? (
                <div style={{ ...card, padding: "40px 24px", textAlign: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: 14, background: "var(--c-surface-2)", color: "var(--c-text-3)", marginBottom: 14 }}>
                        <Package size={26} />
                    </span>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--c-text)" }}>
                        {filter === "pending"
                            ? t("agent.noPendingPickups", "No pending pickups")
                            : t("agent.noPickups", "No pickups found")}
                    </p>
                    {filter === "pending" && (
                        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--c-text-3)" }}>
                            {t("agent.noPendingPickupsDesc", "You'll see new pickup tasks here when assigned")}
                        </p>
                    )}
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
        </div>
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
        <div
            onClick={onClick}
            style={{
                ...card,
                cursor: "pointer",
                padding: "14px 16px",
                borderLeft: "4px solid var(--c-success)",
                opacity: isCompleted ? 0.8 : 1,
            }}
        >
            {/* Top row: status pill + order number + chevron */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                    {isCompleted ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: "var(--c-success-soft)", color: "var(--c-success)" }}>
                            <CheckCircle2 size={11} />{t("agent.completed", "Completed")}
                        </span>
                    ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: "var(--c-success-soft)", color: "var(--c-success)" }}>
                            <MapPin size={11} />{t("agent.pickup", "PICKUP")}
                        </span>
                    )}
                    <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700 }}>#{task.orderPublicId}</span>
                </div>
                <ChevronRight size={18} style={{ flex: "none", color: "var(--c-text-3)" }} />
            </div>

            {/* Customer name + address */}
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>{task.customer.name}</p>
            <p style={{ margin: "2px 0 8px", fontSize: 13, color: "var(--c-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {task.customer.address}
            </p>

            {/* Meta row: schedule + item count */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12, color: "var(--c-text-3)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Clock size={13} />
                    <span>{formatScheduledDate(task.scheduledDate)}</span>
                    {task.timeSlot?.start && <span>• {task.timeSlot.start}</span>}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Package size={13} />
                    <span>{task.itemCount} {t("agent.items", "items")}</span>
                </span>
            </div>

            {/* Quick Actions - Only show for pending tasks */}
            {!isCompleted && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--c-border)" }}>
                    <button
                        style={btnOutline}
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(`tel:${task.customer.phone}`);
                        }}
                    >
                        <Phone size={15} />{t("common.call", "Call")}
                    </button>
                    <button
                        style={btnGhost}
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://maps.google.com/?q=${encodeURIComponent(task.customer.address)}`);
                        }}
                    >
                        <Navigation size={15} />{t("agent.navigate", "Navigate")}
                    </button>
                </div>
            )}
        </div>
    );
}

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)" };
const btnOutline: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-surface)", border: "1px solid var(--c-primary)", borderRadius: 9, padding: "10px 16px" };
const btnGhost: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "transparent", border: 0, padding: "8px 10px" };
