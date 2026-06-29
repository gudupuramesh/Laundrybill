/**
 * Deliveries Page - Driver App
 *
 * List of delivery tasks assigned to the current agent.
 * Features:
 * - Filter tabs: Pending, Completed, All
 * - Task cards with collection amount and payment status
 * - Quick actions: Call, Navigate
 */

import { useState, useMemo, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDriverTasks, type DriverTask } from "../hooks/use-driver-tasks";
import { useCurrency } from "@/hooks/use-currency";
import {
    Phone,
    Navigation,
    Clock,
    Package,
    CheckCircle2,
    ChevronRight,
    Truck,
    Banknote,
    Loader2,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";

type FilterTab = "pending" | "overdue" | "upcoming" | "completed" | "all";

export function DeliveriesPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { formatAmount } = useCurrency();
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
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                <Loader2 className="animate-spin" size={28} style={{ color: "var(--c-primary)" }} />
            </div>
        );
    }

    return (
        <div style={{ color: "var(--c-text)", fontSize: 14, lineHeight: 1.45, padding: "20px 22px 40px", maxWidth: 720, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ marginBottom: 16 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.01em" }}>
                    {t("agent.deliveries", "Deliveries")}
                </h1>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4, fontSize: 13, color: "var(--c-text-3)" }}>
                    <span>{pendingCount} {t("agent.pendingDeliveries", "pending deliveries")}</span>
                    {totalToCollect > 0 && (
                        <>
                            <span>•</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--c-success)", fontWeight: 600, fontFamily: MONO }}>
                                <Banknote size={15} />
                                {formatAmount(totalToCollect)}
                                <span style={{ fontFamily: "inherit" }}>{t("agent.toCollect", "to collect")}</span>
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
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
                                background: active ? "var(--c-primary)" : "var(--c-surface)",
                                border: `1px solid ${active ? "var(--c-primary)" : "var(--c-border)"}`,
                                boxShadow: active ? "var(--sh-sm)" : "none",
                            }}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>

            {/* Task List */}
            {filteredTasks.length === 0 ? (
                <div style={{ ...card, padding: "48px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <ChipIcon soft="c-surface-2" refColor="c-text-3"><Truck size={20} /></ChipIcon>
                    <div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--c-text-2)" }}>
                            {filter === "pending"
                                ? t("agent.noPendingDeliveries", "No pending deliveries")
                                : t("agent.noDeliveries", "No deliveries found")}
                        </p>
                        {filter === "pending" && (
                            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--c-text-3)" }}>
                                {t("agent.noPendingDeliveriesDesc", "You'll see new delivery tasks here when ready")}
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
        </div>
    );
}

interface TaskCardProps {
    task: DriverTask;
    formatScheduledDate: (date: Date) => string;
    onClick: () => void;
}

function DeliveryTaskCard({ task, formatScheduledDate, onClick }: TaskCardProps) {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const isCompleted = task.status === "completed";
    const hasAmount = (task.amountToCollect || 0) > 0;

    const payment: { ref: string; label: string } | null = task.paymentStatus
        ? task.paymentStatus === "paid"
            ? { ref: "c-success", label: t("agent.paid", "Paid") }
            : task.paymentStatus === "partial"
                ? { ref: "c-warning", label: t("agent.partial", "Partial") }
                : { ref: "c-error", label: t("agent.unpaid", "Unpaid") }
        : null;

    return (
        <div
            onClick={onClick}
            style={{
                ...card,
                padding: "14px 16px",
                cursor: "pointer",
                opacity: isCompleted ? 0.75 : 1,
                borderLeft: isCompleted ? "1px solid var(--c-border)" : "3px solid var(--c-primary)",
            }}
        >
            {/* Top row: type badge + order number + amount + chevron */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                    {isCompleted ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: "var(--c-success-soft)", color: "var(--c-success)" }}>
                            <CheckCircle2 size={12} />{t("agent.delivered", "Delivered")}
                        </span>
                    ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: "var(--c-cyan-soft)", color: "var(--c-cyan)" }}>
                            <Truck size={12} />{t("agent.delivery", "DELIVERY")}
                        </span>
                    )}
                    <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700 }}>#{task.orderPublicId}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                    {hasAmount && !isCompleted && (
                        <span style={{ display: "inline-flex", alignItems: "center", fontFamily: MONO, fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "var(--c-success-soft)", color: "var(--c-success)" }}>
                            {formatAmount(task.amountToCollect || 0)}
                        </span>
                    )}
                    <ChevronRight size={18} style={{ color: "var(--c-text-3)" }} />
                </div>
            </div>

            {/* Customer */}
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>{task.customer.name}</p>
            <p style={{ margin: "2px 0 10px", fontSize: 13, color: "var(--c-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {task.customer.address}
            </p>

            {/* Meta row: date + items + payment */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--c-text-3)" }}>
                    <Clock size={13} />
                    {formatScheduledDate(task.scheduledDate)}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--c-text-3)" }}>
                        <Package size={13} />
                        {task.itemCount} {t("agent.items", "items")}
                    </span>
                    {payment && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: `var(--${payment.ref}-soft)`, color: `var(--${payment.ref})` }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: `var(--${payment.ref})` }} />{payment.label}
                        </span>
                    )}
                </div>
            </div>

            {/* Quick Actions - Only show for pending tasks */}
            {!isCompleted && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--c-border)" }}>
                    <button
                        style={{ ...btnOutline, padding: "8px 14px", fontSize: 13 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(`tel:${task.customer.phone}`);
                        }}
                    >
                        <Phone size={15} />
                        {t("common.call", "Call")}
                    </button>
                    <button
                        style={{ ...btnPrimary, padding: "8px 14px", fontSize: 13 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://maps.google.com/?q=${encodeURIComponent(task.customer.address)}`);
                        }}
                    >
                        <Navigation size={15} />
                        {t("agent.navigate", "Navigate")}
                    </button>
                </div>
            )}
        </div>
    );
}

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)" };
const btnPrimary: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "10px 16px", boxShadow: "var(--sh-sm)" };
const btnOutline: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-surface)", border: "1px solid var(--c-primary)", borderRadius: 9, padding: "10px 16px" };
function ChipIcon({ children, soft, refColor }: { children: ReactNode; soft: string; refColor: string }) { return <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${soft})`, color: `var(--${refColor})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>; }
