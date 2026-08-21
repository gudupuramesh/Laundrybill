/**
 * Reports — comprehensive owner report on the brand design system.
 * KPI row (revenue / collected / outstanding / expenses / net profit / orders)
 * · revenue vs expenses trend + net-profit donut · orders breakdown
 * (status incl. partial, type, source) · payments mix · top services ·
 * expenses by category · staff & attendance · customer growth · peak hours.
 * Wired to useFinancialReports (all real data). Every card has an empty state.
 */

import { useState, useMemo, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LEmptyState, LPageLoader } from "@/components/laundry";
import { useAuth } from "@/features/auth/AuthContext";
import { useFinancialReports } from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { MobileReports } from "./MobileReports";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import {
    FileDown, Printer, TrendingUp, Wallet, Receipt, Banknote, Shirt, Hourglass,
    Package, Users, Clock, CreditCard, ListChecks, PieChart,
} from "lucide-react";
import { generateReportsPDF } from "@/lib/reports-pdf-generator";
import { useTranslation } from "react-i18next";
import { useMinLoading } from "@/hooks/use-min-loading";

const MONO = "'IBM Plex Mono'";
type DateRangeOption = "thisMonth" | "lastMonth" | "custom";
const CAT_TINT = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning", "c-error"];

const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "18px 20px", boxShadow: "var(--sh-sm)" };

function Donut({ pct, color, big, sub, size = 130 }: { pct: number; color: string; big: ReactNode; sub: string; size?: number }) {
    const deg = Math.max(0, Math.min(100, pct)) * 3.6;
    const inner = size - 34;
    return (
        <div style={{ position: "relative", width: size, height: size, flex: "none", borderRadius: "50%", background: `conic-gradient(var(--${color}) ${deg}deg, var(--c-surface-3) 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: inner, height: inner, borderRadius: "50%", background: "var(--c-surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: size > 110 ? 22 : 18, color: `var(--${color})` }}>{big}</div>
                <div style={{ fontSize: 10, color: "var(--c-text-3)" }}>{sub}</div>
            </div>
        </div>
    );
}

function CardHead({ icon, label, sub, right }: { icon?: ReactNode; label: string; sub?: string; right?: ReactNode }) {
    return (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 16 }}>
            {icon && <span style={{ width: 28, height: 28, flex: "none", borderRadius: 8, background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>}
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>{label}</div>
                {sub && <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 1 }}>{sub}</div>}
            </div>
            {right && <div style={{ marginLeft: "auto", flex: "none" }}>{right}</div>}
        </div>
    );
}

function EmptyNote({ text }: { text: string }) {
    return <div style={{ fontSize: 12.5, color: "var(--c-text-3)", padding: "14px 0", textAlign: "center", background: "var(--c-surface-2)", borderRadius: 9 }}>{text}</div>;
}

/** Small labeled count row with a colored dot + mono value */
function DotRow({ tint, label, value }: { tint: string; label: string; value: ReactNode }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, flex: "none", borderRadius: 3, background: `var(--${tint})` }} />
            <span style={{ fontSize: 12.5, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
            <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 600, fontSize: 12.5 }}>{value}</span>
        </div>
    );
}

const monthLabel = (m: string) => format(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1), "MMM");
const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const STATUS_TINT: Record<string, string> = {
    delivered: "c-success", picked_up: "c-success", pickup_completed: "c-success",
    partially_delivered: "c-warning",
    out_for_delivery: "c-info", ready: "c-info", ready_for_pickup: "c-info", ready_for_delivery: "c-info",
    cancelled: "c-error",
    pending: "c-violet", pickup_scheduled: "c-violet",
    processing: "c-primary",
};

export function ReportsPage() {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const { ownedShops, shopName } = useAuth();
    const [rangeOption, setRangeOption] = useState<DateRangeOption>("thisMonth");
    const [customStart, setCustomStart] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [customEnd, setCustomEnd] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    const [generatingPDF, setGeneratingPDF] = useState(false);

    const { startDate, endDate, periodLabel } = useMemo(() => {
        const now = new Date();
        if (rangeOption === "thisMonth") return { startDate: startOfMonth(now), endDate: endOfMonth(now), periodLabel: format(now, "MMMM yyyy") };
        if (rangeOption === "lastMonth") { const lm = subMonths(now, 1); return { startDate: startOfMonth(lm), endDate: endOfMonth(lm), periodLabel: format(lm, "MMMM yyyy") }; }
        const start = startOfDay(new Date(customStart)), end = endOfDay(new Date(customEnd));
        return { startDate: start, endDate: end, periodLabel: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}` };
    }, [rangeOption, customStart, customEnd]);

    const r = useFinancialReports(startDate, endDate);
    const showLoading = useMinLoading(r.loading, { minDuration: 700 });

    const statusLabel = (s: string): string => {
        const map: Record<string, string> = {
            pending: t("reports.stPending", "Pending"),
            processing: t("reports.stProcessing", "Processing"),
            ready: t("reports.stReady", "Ready"),
            ready_for_pickup: t("reports.stReadyForPickup", "Ready for pickup"),
            picked_up: t("reports.stPickedUp", "Picked up"),
            out_for_delivery: t("reports.stOutForDelivery", "Out for delivery"),
            delivered: t("reports.stDelivered", "Delivered"),
            pickup_scheduled: t("reports.stPickupScheduled", "Pickup scheduled"),
            pickup_completed: t("reports.stPickupCompleted", "Pickup completed"),
            partially_delivered: t("reports.stPartiallyDelivered", "Partially delivered"),
            cancelled: t("reports.stCancelled", "Cancelled"),
        };
        return map[s] || humanize(s);
    };
    const typeLabel = (ty: string): string => {
        const map: Record<string, string> = {
            pickup_store: t("reports.typeStore", "Store walk-in"),
            pickup_home: t("reports.typePickupHome", "Pickup from home"),
            delivery_home: t("reports.typeDelivery", "Home delivery"),
        };
        return map[ty] || humanize(ty);
    };
    const methodLabel = (m: string): string => {
        const map: Record<string, string> = {
            cash: t("reports.payCash", "Cash"),
            upi: t("reports.payUpi", "UPI"),
            card: t("reports.payCard", "Card"),
            pay_later: t("reports.payLater", "Pay later"),
        };
        return map[m] || humanize(m);
    };

    const handleDownloadPDF = async () => {
        setGeneratingPDF(true);
        try {
            await generateReportsPDF({
                periodLabel,
                revenue: r.revenue, orderCount: r.orderCount, avgOrderValue: r.avgOrderValue,
                collections: r.collections, outstanding: r.outstanding, collectionRate: r.collectionRate,
                totalExpenses: r.totalExpenses, expensesByCategory: r.expensesByCategory, salariesPaid: r.salariesPaid,
                profit: r.profit, profitMargin: r.profitMargin,
                orderStats: r.orderStats,
                staffMetrics: r.staffMetrics,
                customerStats: r.customerStats ? { totalCustomers: r.customerStats.totalCustomers, newCustomers: r.customerStats.newCustomers } : undefined,
                attendanceSummary: r.attendanceSummary,
                ordersByStatus: r.ordersByStatus,
                ordersBySource: r.ordersBySource,
                paymentsByMethod: r.paymentsByMethod,
            });
        }
        catch (err) { console.error("Failed to generate PDF:", err); }
        finally { setGeneratingPDF(false); }
    };

    if (showLoading) return <div className="h-full"><LPageLoader variant="cash" message={t("reports.generating")} /></div>;
    if (r.error) return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}><LEmptyState icon={<FileDown className="h-8 w-8" />} title={t("reports.error", "Couldn't load report")} description={r.error} /></div>;

    // ---- derived --------------------------------------------------------
    const tr = r.monthlyTrend;
    const cur = tr[tr.length - 1], prev = tr[tr.length - 2];
    const pctDelta = (c: number, p: number) => (p > 0 ? Math.round(((c - p) / p) * 100) : 0);
    const revDelta = prev && cur ? pctDelta(cur.revenue, prev.revenue) : 0;
    const expDelta = prev && cur ? pctDelta(cur.expenses, prev.expenses) : 0;
    const profitDelta = prev && cur ? pctDelta(cur.revenue - cur.expenses, prev.revenue - prev.expenses) : 0;
    const custDelta = prev && cur ? pctDelta(cur.newCustomers, prev.newCustomers) : 0;
    const deltaStr = (n: number) => `${n >= 0 ? "▲" : "▼"} ${Math.abs(n)}%`;
    const deltaColor = (n: number, goodUp = true) => ((n >= 0) === goodUp ? "c-success" : "c-error");

    const kpis: { label: string; value: string; tint: string; icon: ReactNode; sub?: ReactNode }[] = [
        { label: t("reports.revenue", "Revenue"), value: formatAmount(r.revenue), tint: "c-primary", icon: <TrendingUp size={15} />, sub: <span style={{ fontWeight: 600, color: `var(--${deltaColor(revDelta)})` }}>{deltaStr(revDelta)} <span style={{ color: "var(--c-text-3)", fontWeight: 400 }}>{t("reports.vsLastMonth", "vs last month")}</span></span> },
        { label: t("reports.collected", "Collected"), value: formatAmount(r.collections), tint: "c-success", icon: <Banknote size={15} />, sub: <span style={{ color: "var(--c-text-3)" }}>{Math.round(r.collectionRate)}% {t("reports.ofBilled", "of billed")}</span> },
        { label: t("reports.outstanding", "Outstanding"), value: formatAmount(r.outstanding), tint: "c-error", icon: <Hourglass size={15} />, sub: <span style={{ color: "var(--c-text-3)" }}>{t("reports.toCollect", "to collect")}</span> },
        { label: t("reports.expenses", "Expenses"), value: formatAmount(r.totalExpenses), tint: "c-warning", icon: <Receipt size={15} />, sub: <span style={{ fontWeight: 600, color: `var(--${deltaColor(expDelta, false)})` }}>{deltaStr(expDelta)} <span style={{ color: "var(--c-text-3)", fontWeight: 400 }}>{t("reports.inclSalaries", "incl. salaries")}</span></span> },
        { label: t("reports.netProfit", "Net profit"), value: formatAmount(r.profit), tint: r.profit >= 0 ? "c-success" : "c-error", icon: <Wallet size={15} />, sub: <span style={{ fontWeight: 600, color: r.profit >= 0 ? "var(--c-success)" : "var(--c-error)" }}>{Math.round(r.profitMargin)}% <span style={{ color: "var(--c-text-3)", fontWeight: 400 }}>{t("reports.margin", "margin")}</span></span> },
        { label: t("reports.orders", "Orders"), value: String(r.orderCount), tint: "c-info", icon: <Package size={15} />, sub: <span style={{ color: "var(--c-text-3)" }}>{t("reports.avg", "avg")} {formatAmount(r.avgOrderValue)}</span> },
    ];

    const maxTrend = Math.max(1, ...tr.map((m) => Math.max(m.revenue, m.expenses)));
    const maxGrowth = Math.max(1, ...tr.map((m) => m.newCustomers));
    const hasTrend = tr.some((m) => m.revenue > 0 || m.expenses > 0);

    // orders breakdown
    const statusEntries = Object.entries(r.ordersByStatus).sort((a, b) => b[1] - a[1]);
    const typeEntries = Object.entries(r.ordersByType).sort((a, b) => b[1] - a[1]);
    const totalOrdersAll = r.orderStats.total;
    const srcTotal = Math.max(1, r.ordersBySource.online + r.ordersBySource.pos);

    // payments mix
    const payEntries = Object.entries(r.paymentsByMethod).sort((a, b) => b[1] - a[1]);
    const payTotal = payEntries.reduce((s, [, v]) => s + v, 0);

    // top services (top 5)
    const topSvc = r.topServices.slice(0, 5);
    const maxSvc = Math.max(1, ...topSvc.map((s) => s.revenue));

    // expenses by category
    const expEntries = Object.entries(r.expensesByCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    // staff & attendance
    const staffSorted = [...r.staffMetrics].sort((a, b) => b.presentDays - a.presentDays);
    const att = r.attendanceSummary;
    const attTotal = att.presentDays + att.absentDays + att.halfDays + att.leaveDays;
    const attPills = [
        { label: t("reports.attPresent", "Present"), v: att.presentDays, tint: "c-success" },
        { label: t("reports.attHalf", "Half day"), v: att.halfDays, tint: "c-warning" },
        { label: t("reports.attLeave", "Leave"), v: att.leaveDays, tint: "c-info" },
        { label: t("reports.attAbsent", "Absent"), v: att.absentDays, tint: "c-error" },
    ];

    // peak hours — 2h buckets 8:00–22:00
    const slots: [number, number, string][] = [[8, 10, "8a"], [10, 12, "10a"], [12, 14, "12p"], [14, 16, "2p"], [16, 18, "4p"], [18, 20, "6p"], [20, 22, "8p"]];
    const peak = slots.map(([a, b, label]) => ({ label, count: r.peakHours.filter((h) => h.hour >= a && h.hour < b).reduce((s, h) => s + h.count, 0) }));
    const maxPeak = Math.max(1, ...peak.map((p) => p.count));
    const hasPeak = peak.some((p) => p.count > 0);

    const navPill = (on: boolean): CSSProperties => ({ cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: 8, border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border-strong)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" });
    const hdrBtn: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "8px 13px" };
    const colHead: CSSProperties = { fontSize: 10.5, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 };
    const barTrack: CSSProperties = { height: 6, background: "var(--c-surface-2)", borderRadius: 6, overflow: "hidden" };

    // MOBILE: the owner app's ReportsScreen.
    if (isMobile) {
        const os = r.orderStats;
        return (
            <MobileReports
                loading={showLoading}
                periodLabel={periodLabel}
                // The app's period sheet maps onto the same three ranges the web has.
                onPickPeriod={() => setRangeOption(rangeOption === "thisMonth" ? "lastMonth" : rangeOption === "lastMonth" ? "custom" : "thisMonth")}
                onExport={handleDownloadPDF}
                exporting={generatingPDF}
                onBack={() => navigate("/settings")}
                formatAmount={formatAmount}
                data={{
                    revenue: Math.round(r.revenue || 0),
                    collections: Math.round(r.collections || 0),
                    outstanding: Math.round(r.outstanding || 0),
                    totalExpenses: Math.round(r.totalExpenses || 0),
                    netProfit: Math.round(r.profit || 0),
                    orderCount: r.orderCount || 0,
                    avgOrderValue: Math.round(r.avgOrderValue || 0),
                    newCustomers: r.customerStats?.newCustomers || 0,
                    byStatus: [
                        { label: statusLabel("pending"), n: os.orderPlaced, tint: "c-primary" },
                        { label: statusLabel("processing"), n: os.inProgress, tint: "c-info" },
                        { label: statusLabel("ready"), n: os.readyForDelivery, tint: "c-primary" },
                        { label: statusLabel("out_for_delivery"), n: os.outForDelivery, tint: "c-cyan" },
                        { label: statusLabel("delivered"), n: os.delivered, tint: "c-success" },
                        { label: statusLabel("cancelled"), n: os.cancelled, tint: "c-error" },
                    ],
                    byDeliveryType: [
                        { label: t("reports.dtPickupStore", "Store pickup"), n: os.pickupStore },
                        { label: t("reports.dtPickupHome", "Home pickup"), n: os.pickupHome },
                        { label: t("reports.dtDeliveryHome", "Home delivery"), n: os.deliveryHome },
                    ],
                    bySource: [
                        { label: t("mobile.repSourceOnline", "Online"), n: r.ordersBySource?.online || 0, color: "#0369a1" },
                        { label: t("mobile.repSourceDirect", "In-store / Direct"), n: r.ordersBySource?.pos || 0, color: "var(--c-text-3)" },
                    ],
                    topServices: r.topServices || [],
                    expensesByCategory: Object.entries(r.expensesByCategory || {}).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a),
                }}
            />
        );
    }

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* ---- Sticky header ---- */}
            <header style={{ flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: isMobile ? "10px 14px" : "10px 22px" }}>
                <div><div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1.1 }}>{t("reports.title", "Reports")}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{periodLabel}</div></div>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setRangeOption("thisMonth")} style={navPill(rangeOption === "thisMonth")}>{t("reports.thisMonth", "This month")}</button>
                    <button onClick={() => setRangeOption("lastMonth")} style={navPill(rangeOption === "lastMonth")}>{t("reports.lastMonth", "Last month")}</button>
                    <button onClick={() => setRangeOption("custom")} style={navPill(rangeOption === "custom")}>{t("reports.custom", "Custom")}</button>
                </div>
                {rangeOption === "custom" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ font: "inherit", fontSize: 12.5, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "7px 9px" }} />
                        <span style={{ color: "var(--c-text-3)" }}>–</span>
                        <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ font: "inherit", fontSize: 12.5, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "7px 9px" }} />
                    </div>
                )}
                <button onClick={() => window.print()} style={hdrBtn}><Printer size={15} />{t("reports.print", "Print")}</button>
                <button onClick={handleDownloadPDF} disabled={generatingPDF} style={{ cursor: generatingPDF ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 8, padding: "8px 14px", boxShadow: "var(--sh-sm)", opacity: generatingPDF ? 0.6 : 1 }}><FileDown size={15} />{generatingPDF ? t("common.loading", "Generating…") : t("reports.exportPdf", "Export PDF")}</button>
            </header>

            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: isMobile ? "16px 14px calc(88px + env(safe-area-inset-bottom, 0px))" : "20px 22px 44px", minHeight: 0 }}>

                {/* ---- Franchise: this report covers ONE shop; link to the master view ---- */}
                {ownedShops.length > 1 && (
                    <Link
                        to="/shops"
                        style={{
                            display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
                            background: "var(--c-primary-soft)", border: "1px solid var(--c-border)",
                            borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600,
                            color: "var(--c-primary)", textDecoration: "none",
                        }}
                    >
                        This report shows <span style={{ fontWeight: 700 }}>{shopName}</span> only — view the all-shops
                        franchise report →
                    </Link>
                )}

                {/* ---- KPI row ---- */}
                <div className="lb-kpi" style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(6, 1fr)", gap: 14, marginBottom: 16 }}>
                    {kpis.map((k) => (
                        <div key={k.label} style={{ ...card, padding: "15px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 28, height: 28, flex: "none", borderRadius: 8, background: `var(--${k.tint}-soft)`, color: `var(--${k.tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{k.icon}</span><span style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{k.label}</span></div>
                            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 21, letterSpacing: "-.02em", marginTop: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: k.label === t("reports.netProfit", "Net profit") ? (r.profit >= 0 ? "var(--c-success)" : "var(--c-error)") : undefined }}>{k.value}</div>
                            <div style={{ fontSize: 11, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.sub}</div>
                        </div>
                    ))}
                </div>

                {/* ---- Row B: revenue vs expenses trend + net profit donut ---- */}
                <div className="lb-row" style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                    <div style={{ ...card, flex: 1.7, minWidth: 0 }}>
                        <CardHead icon={<TrendingUp size={15} />} label={t("reports.revenueVsExpenses", "Revenue vs Expenses")} sub={t("reports.last8Months", "Last 8 months")}
                            right={<div style={{ display: "flex", gap: 14 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--c-text-2)" }}><span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--c-primary)" }} />{t("reports.revenue", "Revenue")}</span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--c-text-2)" }}><span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--c-warning)" }} />{t("reports.expenses", "Expenses")}</span>
                            </div>} />
                        {!hasTrend ? <EmptyNote text={t("reports.noTrendData", "No revenue or expenses recorded yet.")} /> : (
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 170 }}>
                                {tr.map((m, i) => (
                                    <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 7 }} title={`${monthLabel(m.month)} · ${t("reports.revenue", "Revenue")} ${formatAmount(m.revenue)} · ${t("reports.expenses", "Expenses")} ${formatAmount(m.expenses)}`}>
                                        <div style={{ width: "100%", display: "flex", gap: 3, alignItems: "flex-end", height: "100%", justifyContent: "center" }}>
                                            <div style={{ width: "42%", maxWidth: 14, height: `${Math.max(2, (m.revenue / maxTrend) * 100)}%`, background: "var(--c-primary)", borderRadius: "3px 3px 0 0" }} />
                                            <div style={{ width: "42%", maxWidth: 14, height: `${Math.max(2, (m.expenses / maxTrend) * 100)}%`, background: "var(--c-warning)", borderRadius: "3px 3px 0 0" }} />
                                        </div>
                                        <span style={{ fontSize: 10, color: i === tr.length - 1 ? "var(--c-primary)" : "var(--c-text-3)", fontWeight: i === tr.length - 1 ? 700 : 400 }}>{monthLabel(m.month)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ ...card, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, alignSelf: "flex-start" }}>{t("reports.netProfit", "Net profit")}</div>
                        <div style={{ margin: "16px 0 8px" }}><Donut pct={Math.max(0, r.profitMargin)} color={r.profit >= 0 ? "c-success" : "c-error"} big={`${Math.round(r.profitMargin)}%`} sub={t("reports.margin", "margin")} size={150} /></div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, color: r.profit >= 0 ? "var(--c-success)" : "var(--c-error)" }}>{formatAmount(r.profit)}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: `var(--${deltaColor(profitDelta)})`, marginTop: 3 }}>{deltaStr(profitDelta)} {t("reports.vsLastMonth", "vs last month")}</div>
                    </div>
                </div>

                {/* ---- Row C: orders breakdown + payments mix ---- */}
                <div className="lb-row" style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                    <div style={{ ...card, flex: 1.6, minWidth: 0 }}>
                        <CardHead icon={<ListChecks size={15} />} label={t("reports.ordersBreakdown", "Orders breakdown")} sub={`${totalOrdersAll} ${t("reports.ordersInPeriod", "orders in this period")}`} />
                        {totalOrdersAll === 0 ? <EmptyNote text={t("reports.noOrders", "No orders in this period.")} /> : (
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 1fr", gap: isMobile ? 18 : 22 }}>
                                <div>
                                    <div style={colHead}>{t("reports.byStatus", "By status")}</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                                        {statusEntries.map(([s, n]) => <DotRow key={s} tint={STATUS_TINT[s] || "c-primary"} label={statusLabel(s)} value={n} />)}
                                    </div>
                                </div>
                                <div>
                                    <div style={colHead}>{t("reports.byType", "By type")}</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                                        {typeEntries.map(([ty, n], i) => <DotRow key={ty} tint={CAT_TINT[i % CAT_TINT.length]} label={typeLabel(ty)} value={n} />)}
                                    </div>
                                </div>
                                <div>
                                    <div style={colHead}>{t("reports.bySource", "By source")}</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        {[{ key: "online", label: t("reports.srcOnline", "Online booking"), v: r.ordersBySource.online, tint: "c-info" }, { key: "pos", label: t("reports.srcPos", "In-store (POS)"), v: r.ordersBySource.pos, tint: "c-primary" }].map((s) => (
                                            <div key={s.key}>
                                                <DotRow tint={s.tint} label={s.label} value={s.v} />
                                                <div style={{ ...barTrack, marginTop: 5, marginLeft: 17 }}><div style={{ height: "100%", width: `${(s.v / srcTotal) * 100}%`, background: `var(--${s.tint})`, borderRadius: 6 }} /></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div style={{ ...card, flex: 1, minWidth: 0 }}>
                        <CardHead icon={<CreditCard size={15} />} label={t("reports.paymentsMix", "Payments mix")} sub={t("reports.collectedByMethod", "Collected by method")} />
                        {payEntries.length === 0 ? <EmptyNote text={t("reports.noPayments", "No payments recorded in this period.")} /> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                                {payEntries.map(([m, amt], i) => (
                                    <div key={m}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                                            <span style={{ width: 9, height: 9, borderRadius: 3, background: `var(--${CAT_TINT[i % CAT_TINT.length]})` }} />
                                            <span style={{ fontSize: 12.5, color: "var(--c-text-2)" }}>{methodLabel(m)}</span>
                                            <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 600, fontSize: 12.5 }}>{formatAmount(amt)}</span>
                                            <span style={{ fontSize: 10.5, fontFamily: MONO, color: "var(--c-text-3)", width: 34, textAlign: "right" }}>{payTotal > 0 ? Math.round((amt / payTotal) * 100) : 0}%</span>
                                        </div>
                                        <div style={{ ...barTrack, marginLeft: 17 }}><div style={{ height: "100%", width: `${payTotal > 0 ? Math.max(3, (amt / payTotal) * 100) : 0}%`, background: `var(--${CAT_TINT[i % CAT_TINT.length]})`, borderRadius: 6 }} /></div>
                                    </div>
                                ))}
                                <div style={{ display: "flex", paddingTop: 11, borderTop: "1px solid var(--c-border)" }}>
                                    <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t("reports.totalCollected", "Total collected")}</span>
                                    <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 700, fontSize: 13.5, color: "var(--c-success)" }}>{formatAmount(payTotal)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ---- Row D: top services + expenses by category ---- */}
                <div className="lb-row" style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                    <div style={{ ...card, flex: 1.3, minWidth: 0 }}>
                        <CardHead icon={<Shirt size={15} />} label={t("reports.topServices", "Top services")} sub={t("reports.byRevenue", "Top 5 by revenue")} />
                        {topSvc.length === 0 ? <EmptyNote text={t("reports.noServices", "No service revenue in this period.")} /> : (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                <div style={{ display: "flex", gap: 8, fontSize: 10.5, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: ".05em", paddingBottom: 8, borderBottom: "1px solid var(--c-border)" }}>
                                    <span style={{ width: 18 }}>#</span><span style={{ flex: 1 }}>{t("reports.service", "Service")}</span><span style={{ width: 60, textAlign: "right" }}>{t("reports.orders", "Orders")}</span><span style={{ width: 90, textAlign: "right" }}>{t("reports.revenue", "Revenue")}</span>
                                </div>
                                {topSvc.map((s, i) => (
                                    <div key={s.name} style={{ padding: "9px 0", borderBottom: i < topSvc.length - 1 ? "1px solid var(--c-border)" : "none" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{ width: 18, fontFamily: MONO, fontSize: 11.5, color: i === 0 ? "var(--c-primary)" : "var(--c-text-3)", fontWeight: i === 0 ? 700 : 400 }}>{i + 1}</span>
                                            <span style={{ flex: 1, fontSize: 13, fontWeight: i === 0 ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                                            <span style={{ width: 60, textAlign: "right", fontFamily: MONO, fontSize: 12.5 }}>{s.orders}</span>
                                            <span style={{ width: 90, textAlign: "right", fontFamily: MONO, fontWeight: 600, fontSize: 12.5 }}>{formatAmount(s.revenue)}</span>
                                        </div>
                                        <div style={{ ...barTrack, height: 4, marginTop: 6, marginLeft: 26 }}><div style={{ height: "100%", width: `${Math.max(3, (s.revenue / maxSvc) * 100)}%`, background: `var(--${CAT_TINT[i % CAT_TINT.length]})`, borderRadius: 6 }} /></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ ...card, flex: 1, minWidth: 0 }}>
                        <CardHead icon={<PieChart size={15} />} label={t("reports.expensesByCategory", "Expenses by category")} sub={t("reports.periodTotal", "Period total")} right={<span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15 }}>{formatAmount(r.totalExpenses)}</span>} />
                        {expEntries.length === 0 ? <EmptyNote text={t("reports.noExpenses", "No expenses recorded in this period.")} /> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {expEntries.map(([catKey, amt], i) => (
                                    <div key={catKey} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ width: 9, height: 9, flex: "none", borderRadius: 3, background: `var(--${CAT_TINT[i % CAT_TINT.length]})` }} />
                                        <span style={{ fontSize: 12.5, color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{catKey === "salary" ? t("reports.salaries", "Salaries") : t(`expenses.cat.${catKey}`, humanize(catKey))}</span>
                                        <span style={{ marginLeft: "auto", fontSize: 10.5, fontFamily: MONO, color: "var(--c-text-3)" }}>{r.totalExpenses > 0 ? Math.round((amt / r.totalExpenses) * 100) : 0}%</span>
                                        <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 12.5, width: 88, textAlign: "right" }}>{formatAmount(amt)}</span>
                                    </div>
                                ))}
                                <div style={{ display: "flex", alignItems: "center", paddingTop: 11, marginTop: 2, borderTop: "1px solid var(--c-border)" }}>
                                    <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t("reports.salariesPaid", "Salaries paid")}</span>
                                    <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 700, fontSize: 13, color: "var(--c-warning)" }}>{formatAmount(r.salariesPaid)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ---- Row E: staff & attendance ---- */}
                <div className="lb-row" style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                    <div style={{ ...card, flex: 1, minWidth: 0 }}>
                        <CardHead icon={<Users size={15} />} label={t("reports.staffAttendance", "Staff & attendance")} sub={`${att.staffTracked} ${t("reports.staffTracked", "staff tracked")} · ${attTotal} ${t("reports.entries", "entries")}`} />
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                            {attPills.map((p) => (
                                <div key={p.label} style={{ background: `var(--${p.tint}-soft)`, borderRadius: 10, padding: "10px 12px" }}>
                                    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 18, color: `var(--${p.tint})` }}>{p.v}</div>
                                    <div style={{ fontSize: 10.5, color: "var(--c-text-2)", marginTop: 1 }}>{p.label}</div>
                                </div>
                            ))}
                        </div>
                        {staffSorted.length === 0 ? <EmptyNote text={t("reports.noStaffData", "No staff attendance or payroll in this period.")} /> : (
                            <div>
                                <div style={{ display: "flex", gap: 8, fontSize: 10.5, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: ".05em", paddingBottom: 8, borderBottom: "1px solid var(--c-border)" }}>
                                    <span style={{ flex: 1 }}>{t("reports.staffMember", "Staff member")}</span><span style={{ width: 88, textAlign: "right" }}>{t("reports.presentDays", "Present days")}</span><span style={{ width: 100, textAlign: "right" }}>{t("reports.salaryPaid", "Salary paid")}</span>
                                </div>
                                {staffSorted.map((s, i) => (
                                    <div key={s.staffId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: i < staffSorted.length - 1 ? "1px solid var(--c-border)" : "none" }}>
                                        <span style={{ width: 28, height: 28, flex: "none", borderRadius: "50%", background: `var(--${CAT_TINT[i % CAT_TINT.length]}-soft)`, color: `var(--${CAT_TINT[i % CAT_TINT.length]})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 600 }}>{(s.staffName || "?").slice(0, 2).toUpperCase()}</span>
                                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.staffName}</span>
                                        <span style={{ width: 88, textAlign: "right", fontFamily: MONO, fontWeight: 600, fontSize: 12.5, color: "var(--c-success)" }}>{s.presentDays}d</span>
                                        <span style={{ width: 100, textAlign: "right", fontFamily: MONO, fontWeight: 600, fontSize: 12.5 }}>{formatAmount(s.salaryPaid)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ---- Row F: customer growth + peak hours ---- */}
                <div className="lb-row" style={{ display: "flex", gap: 14 }}>
                    <div style={{ ...card, flex: 1, minWidth: 0 }}>
                        <CardHead icon={<Users size={15} />} label={t("reports.customerGrowth", "Customer growth")} sub={t("reports.newPerMonth", "New customers / month")}
                            right={<div style={{ textAlign: "right" }}><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 18 }}>+{cur?.newCustomers ?? 0}</div><div style={{ fontSize: 11, color: `var(--${deltaColor(custDelta)})`, fontWeight: 600 }}>{deltaStr(custDelta)}</div></div>} />
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, marginBottom: 14 }}>
                            {tr.map((m, i) => <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 6 }} title={`${monthLabel(m.month)} · ${m.newCustomers}`}><div style={{ width: "100%", maxWidth: 24, height: `${Math.max(3, (m.newCustomers / maxGrowth) * 100)}%`, background: i === tr.length - 1 ? "var(--c-primary)" : "var(--c-primary-tint)", borderRadius: "4px 4px 0 0" }} /><span style={{ fontSize: 10, color: "var(--c-text-3)" }}>{monthLabel(m.month)}</span></div>)}
                        </div>
                        <div style={{ display: "flex", gap: 10, paddingTop: 13, borderTop: "1px solid var(--c-border)" }}>
                            <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "var(--c-text-3)" }}>{t("reports.newThisPeriod", "New this period")}</div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16, color: "var(--c-success)" }}>{r.customerStats?.newCustomers ?? 0}</div></div>
                            <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "var(--c-text-3)" }}>{t("reports.totalCustomers", "Total customers")}</div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16 }}>{r.customerStats?.totalCustomers ?? 0}</div></div>
                        </div>
                    </div>
                    <div style={{ ...card, flex: 1, minWidth: 0 }}>
                        <CardHead icon={<Clock size={15} />} label={t("reports.peakHours", "Peak intake hours")} sub={t("reports.ordersByTime", "Orders by time of day")} />
                        {!hasPeak ? <EmptyNote text={t("reports.noPeakData", "No orders yet to chart intake hours.")} /> : (
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 130 }}>
                                {peak.map((pk) => { const top1 = pk.count === maxPeak && maxPeak > 0; return <div key={pk.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 6 }} title={`${pk.label} · ${pk.count}`}><div style={{ width: "100%", maxWidth: 22, height: `${Math.max(3, (pk.count / maxPeak) * 100)}%`, background: top1 ? "var(--c-primary)" : "var(--c-primary-tint)", borderRadius: "4px 4px 0 0" }} /><span style={{ fontSize: 9, color: top1 ? "var(--c-primary)" : "var(--c-text-3)", fontWeight: top1 ? 700 : 400 }}>{pk.label}</span></div>; })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
