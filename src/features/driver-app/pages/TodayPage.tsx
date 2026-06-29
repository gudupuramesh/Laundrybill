/**
 * Today Page — Driver Dashboard, built to the Enterprise Laundry CRM design system
 * (--c-* tokens, IBM Plex Mono). Shows the agent's day:
 * - KPI tiles (pickups, deliveries, collected)
 * - Next task card with quick actions (call / navigate)
 * - Pending tasks queue
 */

import { type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDriverAuth } from "../DriverAuthContext";
import { useNavigate } from "react-router-dom";
import { LEmptyState } from "@/components/laundry";
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
    Loader2,
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
            <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Loader2 className="animate-spin" size={28} style={{ color: "var(--c-primary)" }} />
            </div>
        );
    }

    const pendingTasks = tasks.filter(t => t.status === "pending");

    const kpis = [
        {
            label: t("agent.pickups", "Pickups"),
            value: `${todayStats.pickups.completed}/${todayStats.pickups.total}`,
            soft: "c-success-soft", ref: "c-success",
            icon: <MapPin size={15} />,
            to: "/agent/pickups",
        },
        {
            label: t("agent.deliveries", "Deliveries"),
            value: `${todayStats.deliveries.completed}/${todayStats.deliveries.total}`,
            soft: "c-primary-soft", ref: "c-primary",
            icon: <Truck size={15} />,
            to: "/agent/deliveries",
        },
        {
            label: t("agent.collected", "Collected"),
            value: formatAmount(todayStats.collected),
            soft: "c-warning-soft", ref: "c-warning",
            icon: <IndianRupee size={15} />,
            to: undefined,
        },
    ];

    return (
        <div style={{ color: "var(--c-text)", fontSize: 14, lineHeight: 1.45, padding: "20px 22px 40px", maxWidth: 720, margin: "0 auto" }}>

            {/* ===== Welcome header ===== */}
            <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: 0 }}>{t("agent.welcome", "Welcome back")}</p>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--c-text)", margin: "2px 0 0" }}>{agent?.name || "Agent"}</h1>
                {!isOnline && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: "var(--c-warning-soft)", color: "var(--c-warning)" }}>
                        <Clock size={13} />
                        {t("agent.offlineHint", "Go online to receive tasks")}
                    </span>
                )}
            </div>

            {/* ===== KPI tiles ===== */}
            <div className="lb-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 22 }}>
                {kpis.map((k) => (
                    <div
                        key={k.label}
                        onClick={k.to ? () => navigate(k.to as string) : undefined}
                        style={{ ...card, padding: "15px 16px", cursor: k.to ? "pointer" : "default" }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <ChipIcon soft={k.soft} refColor={k.ref}>{k.icon}</ChipIcon>
                            <span style={{ fontSize: 11.5, color: "var(--c-text-3)", fontWeight: 500 }}>{k.label}</span>
                        </div>
                        <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 25, letterSpacing: "-.02em", marginTop: 11 }}>{k.value}</div>
                    </div>
                ))}
            </div>

            {/* ===== Next task ===== */}
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--c-text)", margin: "0 0 12px" }}>
                    {t("agent.nextTask", "Next Task")}
                </h2>

                {nextTask ? (
                    <div
                        onClick={() => navigate(`/agent/${nextTask.type}s/${nextTask.orderId}`)}
                        style={{ ...card, padding: 16, cursor: "pointer", borderLeft: `4px solid ${nextTask.type === "pickup" ? "var(--c-success)" : "var(--c-primary)"}` }}
                    >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {taskPill(nextTask.type, t)}
                                    <span style={{ fontFamily: MONO, fontWeight: 700, color: "var(--c-text)" }}>#{nextTask.orderPublicId}</span>
                                </div>
                                <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--c-text-3)", margin: "8px 0 0" }}>
                                    <Clock size={13} />
                                    {nextTask.timeSlot
                                        ? `${nextTask.timeSlot.start} - ${nextTask.timeSlot.end}`
                                        : nextTask.scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    }
                                </p>
                            </div>
                            <ChevronRight size={20} style={{ color: "var(--c-text-3)", flex: "none" }} />
                        </div>

                        <p style={{ fontWeight: 600, color: "var(--c-text)", margin: 0 }}>{nextTask.customer.name}</p>
                        <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {nextTask.customer.address}
                        </p>

                        {/* Quick Actions */}
                        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                            <button
                                type="button"
                                style={btnOutline}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`tel:${nextTask.customer.phone}`);
                                }}
                            >
                                <Phone size={16} />{t("common.call", "Call")}
                            </button>
                            <button
                                type="button"
                                style={btnPrimary}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`https://maps.google.com/?q=${encodeURIComponent(nextTask.customer.address)}`);
                                }}
                            >
                                <Navigation size={16} />{t("agent.navigate", "Navigate")}
                            </button>
                        </div>
                    </div>
                ) : (
                    <LEmptyState
                        icon={<Package className="h-12 w-12 text-muted-foreground" />}
                        title={t("agent.noTasksTitle", "No tasks right now")}
                        description={t("agent.noTasksDesc", "You'll be notified when new tasks are assigned")}
                    />
                )}
            </div>

            {/* ===== Pending tasks queue ===== */}
            <h2 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 16, fontWeight: 600, color: "var(--c-text)", margin: "0 0 12px" }}>
                <span>{t("agent.tasks", "Pending Tasks")}</span>
                <span style={{ fontSize: 13, fontWeight: 400, color: "var(--c-text-3)" }}>
                    {pendingTasks.length} {t("common.total")}
                </span>
            </h2>

            {pendingTasks.length === 0 ? (
                <LEmptyState
                    icon={<CheckCircle2 className="h-12 w-12 text-muted-foreground" />}
                    title={t("agent.allCaughtUp", "All caught up!")}
                    description={t("agent.noPendingTasks", "You have no pending tasks right now.")}
                />
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 80 }}>
                    {pendingTasks.map((task) => (
                        <div
                            key={task.id}
                            onClick={() => navigate(`/agent/${task.type}s/${task.orderId}`)}
                            style={{ ...card, padding: 16, cursor: "pointer", borderLeft: `4px solid ${task.type === "pickup" ? "var(--c-success)" : "var(--c-primary)"}` }}
                        >
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {taskPill(task.type, t)}
                                    <span style={{ fontFamily: MONO, fontWeight: 700, color: "var(--c-text)" }}>#{task.orderPublicId}</span>
                                </div>
                                <ChevronRight size={20} style={{ color: "var(--c-text-3)", flex: "none" }} />
                            </div>

                            <p style={{ fontWeight: 600, color: "var(--c-text)", margin: 0 }}>{task.customer.name}</p>
                            <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "2px 0 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {task.customer.address}
                            </p>

                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--c-text-3)" }}>
                                <Clock size={13} />
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
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ===== helpers (design-system primitives) ===== */
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const card: CSSProperties = {
    background: "var(--c-surface)", border: "1px solid var(--c-border)",
    borderRadius: 12, boxShadow: "var(--sh-sm)",
};
const btnPrimary: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "10px 16px", boxShadow: "var(--sh-sm)" };
const btnOutline: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-surface)", border: "1px solid var(--c-primary)", borderRadius: 9, padding: "10px 16px" };

function ChipIcon({ children, soft, refColor }: { children: ReactNode; soft: string; refColor: string }) {
    return <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${soft})`, color: `var(--${refColor})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>;
}

// Task-type status pill (pickup → success, delivery → primary)
function taskPill(type: "pickup" | "delivery", t: ReturnType<typeof useTranslation>["t"]) {
    const isPickup = type === "pickup";
    const soft = isPickup ? "var(--c-success-soft)" : "var(--c-primary-soft)";
    const ref = isPickup ? "var(--c-success)" : "var(--c-primary)";
    const label = isPickup ? t("agent.pickup", "PICKUP") : t("agent.delivery", "DELIVERY");
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: soft, color: ref }}>
            {isPickup ? <MapPin size={11} /> : <Truck size={11} />}
            {label}
        </span>
    );
}
