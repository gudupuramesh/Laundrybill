/**
 * Store Health — high-level operational health band for the dashboard.
 *
 * A composite 0-100 score (SVG ring) + honest sub-metric rails:
 * On-Time Delivery · On-Time Pickup · Order Flow · Collection Rate.
 * Colour-graded Healthy / Needs attention / Critical. Data: useStoreHealth.
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { useStoreHealth, type HealthMetric, type HealthStatus } from "@/hooks/use-store-health";

type Tone = "green" | "amber" | "red" | "gray";

const FILL: Record<Tone, string> = {
    green: "hsl(var(--success))",
    amber: "hsl(var(--warning))",
    red: "hsl(var(--destructive))",
    gray: "hsl(var(--muted-foreground))",
};
const TINT: Record<Tone, string> = {
    green: "hsl(var(--success) / 0.14)",
    amber: "hsl(var(--warning) / 0.18)",
    red: "hsl(var(--destructive) / 0.12)",
    gray: "hsl(var(--muted-foreground) / 0.14)",
};
const TEXT: Record<Tone, string> = {
    green: "hsl(var(--success))",
    amber: "hsl(36 92% 38%)",
    red: "hsl(var(--destructive))",
    gray: "hsl(var(--muted-foreground))",
};

const metricTone = (v: number | null): Tone =>
    v == null ? "gray" : v >= 80 ? "green" : v >= 60 ? "amber" : "red";
const scoreTone = (s: number | null): Tone =>
    s == null ? "gray" : s >= 70 ? "green" : s >= 55 ? "amber" : "red";

export function StoreHealth() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const h = useStoreHealth();

    const statusText: Record<HealthStatus, string> = {
        excellent: t("health.excellent", "Excellent"),
        good: t("health.good", "Healthy"),
        attention: t("health.attention", "Needs attention"),
        critical: t("health.critical", "Critical"),
        nodata: t("health.nodata", "No data yet"),
    };

    const sTone = scoreTone(h.score);

    return (
        <section className="rounded-2xl border border-border bg-card shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-primary shrink-0"><Activity className="h-[18px] w-[18px]" /></span>
                    <div className="min-w-0">
                        <h3 className="text-[15px] font-extrabold text-foreground leading-tight truncate">
                            {t("health.title", "Store Health")}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                            {t("health.subtitle", "Operational performance · last {{n}} days", { n: h.windowDays })}
                        </p>
                    </div>
                </div>
                {h.overdueCount > 0 ? (
                    <button
                        onClick={() => navigate("/orders?filter=overdue")}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                        style={{ background: TINT.red, color: TEXT.red }}
                    >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {h.overdueCount} {t("health.overdue", "overdue")}
                    </button>
                ) : (
                    <span
                        className="hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                        style={{ background: TINT.green, color: TEXT.green }}
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t("health.allOnSchedule", "All on schedule")}
                    </span>
                )}
            </div>

            {/* Body — compact: ring on top, rails below */}
            <div className="p-5">
                {/* Score ring + status */}
                <div className="flex flex-col items-center gap-3">
                    <div className="relative h-28 w-28 shrink-0">
                        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                            <circle cx="18" cy="18" r="15.9155" fill="none" stroke={TINT[sTone]} strokeWidth="3.4" />
                            <circle
                                cx="18" cy="18" r="15.9155" fill="none"
                                stroke={FILL[sTone]} strokeWidth="3.4" strokeLinecap="round"
                                strokeDasharray={`${h.score ?? 0} 100`}
                                style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[30px] font-extrabold leading-none text-foreground">
                                {h.loading ? "··" : h.score ?? "—"}
                            </span>
                            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {t("health.score", "Score")}
                            </span>
                        </div>
                    </div>
                    <span
                        className="rounded-full px-3 py-1 text-xs font-extrabold"
                        style={{ background: TINT[sTone], color: TEXT[sTone] }}
                    >
                        {statusText[h.status]}
                    </span>
                </div>

                {/* Sub-metric rails */}
                <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-border pt-4">
                    <Rail label={t("health.onTimeDelivery", "On-Time Delivery")} metric={h.onTimeDelivery} loading={h.loading} />
                    <Rail label={t("health.onTimePickup", "On-Time Pickup")} metric={h.onTimePickup} loading={h.loading} />
                    <Rail label={t("health.orderFlow", "Order Flow")} metric={h.orderFlow} loading={h.loading} hint={t("health.orderFlowHint", "active orders on schedule")} />
                    <Rail label={t("health.collectionRate", "Collection Rate")} metric={h.collectionRate} loading={h.loading} />
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
                <span className="text-xs text-muted-foreground">
                    {h.activeCount} {t("health.activeOrders", "active orders")}
                </span>
                <button
                    onClick={() => navigate("/reports")}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                    {t("health.viewReports", "View reports")} <ArrowRight className="h-3.5 w-3.5" />
                </button>
            </div>
        </section>
    );
}

function Rail({
    label, metric, loading, hint,
}: {
    label: string;
    metric: HealthMetric;
    loading: boolean;
    hint?: string;
}) {
    const tone = metricTone(metric.value);
    const noData = !loading && metric.value == null;
    return (
        <div>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <span className="text-sm font-semibold text-foreground truncate">{label}</span>
                <span className="text-sm font-extrabold tabular-nums" style={{ color: noData ? TEXT.gray : TEXT[tone] }}>
                    {loading ? "··" : metric.value == null ? "—" : `${metric.value}%`}
                </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: TINT[tone] }}>
                <div
                    className="h-full rounded-full"
                    style={{
                        width: `${metric.value ?? 0}%`,
                        background: FILL[tone],
                        transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                    }}
                />
            </div>
            {(noData || hint) && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                    {noData ? "No data yet" : hint}
                </p>
            )}
        </div>
    );
}
