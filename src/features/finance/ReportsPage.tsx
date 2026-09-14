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
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfYear, endOfYear, eachDayOfInterval, differenceInCalendarDays, min as minDate } from "date-fns";
import { FileDown, Printer, TrendingUp, Wallet, IndianRupee, FolderOpen, ClipboardList, CalendarDays, ChevronDown, LineChart as LineChartIcon } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, LabelList, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { generateReportsPDF } from "@/lib/reports-pdf-generator";
import { useTranslation } from "react-i18next";
import { useMinLoading } from "@/hooks/use-min-loading";

type DateRangeOption = "today" | "week" | "month" | "lastMonth" | "sixMonths" | "year" | "custom";
const RANGE_ORDER: DateRangeOption[] = ["today", "week", "month", "lastMonth", "sixMonths", "year", "custom"];

const monthLabel = (m: string) => format(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1), "MMM");
const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function ReportsPage() {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const { ownedShops, shopName } = useAuth();
    const [rangeOption, setRangeOption] = useState<DateRangeOption>("month");
    const [customStart, setCustomStart] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [customEnd, setCustomEnd] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    const [generatingPDF, setGeneratingPDF] = useState(false);

    const { startDate, endDate, periodLabel } = useMemo(() => {
        const now = new Date();
        switch (rangeOption) {
            case "today": return { startDate: startOfDay(now), endDate: endOfDay(now), periodLabel: format(now, "d MMM yyyy") };
            case "week": { const a = startOfWeek(now, { weekStartsOn: 1 }), b = endOfWeek(now, { weekStartsOn: 1 }); return { startDate: a, endDate: b, periodLabel: `${format(a, "d MMM")} – ${format(b, "d MMM yyyy")}` }; }
            case "month": return { startDate: startOfMonth(now), endDate: endOfMonth(now), periodLabel: format(now, "MMMM yyyy") };
            case "lastMonth": { const lm = subMonths(now, 1); return { startDate: startOfMonth(lm), endDate: endOfMonth(lm), periodLabel: format(lm, "MMMM yyyy") }; }
            case "sixMonths": { const a = startOfMonth(subMonths(now, 5)); return { startDate: a, endDate: endOfMonth(now), periodLabel: `${format(a, "MMM yyyy")} – ${format(now, "MMM yyyy")}` }; }
            case "year": return { startDate: startOfYear(now), endDate: endOfYear(now), periodLabel: format(now, "yyyy") };
            default: {
                const start = startOfDay(new Date(customStart)), end = endOfDay(new Date(customEnd));
                return { startDate: start, endDate: end, periodLabel: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}` };
            }
        }
    }, [rangeOption, customStart, customEnd]);

    const rangeLabel = (o: DateRangeOption): string => ({
        today: t("reports.today", "Today"), week: t("reports.thisWeek", "This week"), month: t("reports.thisMonth", "This month"),
        lastMonth: t("reports.lastMonth", "Last month"), sixMonths: t("reports.last6Months", "Last 6 months"), year: t("reports.thisYear", "This year"),
        custom: t("reports.custom", "Custom"),
    })[o];
    const chipLabel = (o: DateRangeOption): string => ({
        today: t("reports.chipToday", "Today"), week: t("reports.chipWeek", "Week"), month: t("reports.chipMonth", "Month"),
        lastMonth: t("reports.lastMonth", "Last month"), sixMonths: t("reports.chip6Months", "6 months"), year: t("reports.chipYear", "Year"),
        custom: t("reports.custom", "Custom"),
    })[o];

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
    const hasTrend = tr.some((m) => m.revenue > 0 || m.expenses > 0);

    // orders breakdown    const typeEntries = Object.entries(r.ordersByType).sort((a, b) => b[1] - a[1]);

    // payments mix
    const payEntries = Object.entries(r.paymentsByMethod).sort((a, b) => b[1] - a[1]);
    const payTotal = payEntries.reduce((s, [, v]) => s + v, 0);

    // top services (top 5)
    const typeEntries = Object.entries(r.ordersByType).sort((a, b) => b[1] - a[1]);

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
    const hasPeak = peak.some((p) => p.count > 0);

    // MOBILE: the owner app's ReportsScreen.
    if (isMobile) {
        const os = r.orderStats;
        return (
            <MobileReports
                loading={showLoading}
                periodLabel={periodLabel}
                // The app's period sheet maps onto the same three ranges the web has.
                onPickPeriod={() => setRangeOption(RANGE_ORDER[(RANGE_ORDER.indexOf(rangeOption) + 1) % RANGE_ORDER.length])}
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
                    paymentsByMethod: payEntries,
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

    // ---- reference layout data ------------------------------------------
    const isMonthRange = rangeOption === "month" || rangeOption === "lastMonth";
    const colDelta = prev && cur ? pctDelta(cur.collected, prev.collected) : 0;
    const outDelta = prev && cur ? pctDelta(cur.outstanding, prev.outstanding) : 0;
    const shortAmt = (v: number) => {
        const sym = formatAmount(0).replace(/[\d.,\s]/g, "");
        if (v >= 1e5) return `${sym}${(v / 1e5).toFixed(2).replace(/\.?0+$/, "")}L`;
        if (v >= 1e3) return `${sym}${Math.round(v / 1e3)}K`;
        return `${sym}${Math.round(v)}`;
    };

    // Revenue by day — every day of the period (up to today); long periods bucket by month.
    const lastDay = minDate([endDate, endOfDay(new Date())]);
    const spanDays = differenceInCalendarDays(lastDay, startDate) + 1;
    const byMonthBars = spanDays > 62;
    const dayMap = new Map(r.revenueByDay.map((d) => [d.date, d.amount]));
    const revenueBars = byMonthBars
        ? (() => {
            const m = new Map<string, number>();
            r.revenueByDay.forEach((d) => m.set(d.date.slice(0, 7), (m.get(d.date.slice(0, 7)) || 0) + d.amount));
            const out: { label: string; amount: number }[] = [];
            for (let d = startOfMonth(startDate); d <= lastDay; d = startOfMonth(subMonths(d, -1))) out.push({ label: format(d, "MMM"), amount: m.get(format(d, "yyyy-MM")) || 0 });
            return out;
        })()
        : spanDays >= 1
            ? eachDayOfInterval({ start: startDate, end: lastDay }).map((d) => ({ label: spanDays > 7 ? format(d, "d") : format(d, "EEE"), amount: dayMap.get(format(d, "yyyy-MM-dd")) || 0 }))
            : [];

    const trend6 = tr.slice(-6).map((m) => ({ label: format(new Date(Number(m.month.slice(0, 4)), Number(m.month.slice(5, 7)) - 1, 1), "MMM yyyy"), revenue: m.revenue, expenses: m.expenses }));

    const PAY_COLOR: Record<string, string> = { upi: "#2563EB", cash: "#16A34A", card: "#7C3AED" };
    const payMix = payEntries.map(([m, amt]) => ({ key: m, label: methodLabel(m), amount: amt, pct: payTotal > 0 ? Math.round((amt / payTotal) * 100) : 0, color: PAY_COLOR[m] || "#F59E0B" }));

    const statusGroups = [
        { label: t("reports.grpPlaced", "Placed"), keys: ["pending", "order_placed", "pickup_scheduled"], color: "#2563EB" },
        { label: t("reports.grpProcessing", "Processing"), keys: ["processing", "in_progress", "pickup_completed"], color: "#F59E0B" },
        { label: t("reports.grpReady", "Ready"), keys: ["ready", "ready_for_pickup", "ready_for_delivery"], color: "#16A34A" },
        { label: t("reports.grpOut", "Out for delivery"), keys: ["out_for_delivery", "partially_delivered"], color: "#7C3AED" },
        { label: t("reports.grpDelivered", "Delivered"), keys: ["delivered", "picked_up"], color: "#14B8A6" },
        { label: t("reports.stCancelled", "Cancelled"), keys: ["cancelled"], color: "#EF4444" },
    ].map((g) => ({ ...g, n: g.keys.reduce((sum, k) => sum + (r.ordersByStatus[k] || 0), 0) }));
    const known = new Set(statusGroups.flatMap((g) => g.keys));
    const otherStatusN = Object.entries(r.ordersByStatus).filter(([k]) => !known.has(k)).reduce((sum, [, n]) => sum + n, 0);
    if (otherStatusN > 0) statusGroups[1].n += otherStatusN; // unknown in-flight statuses count as processing
    const statusTotal = statusGroups.reduce((sum, g) => sum + g.n, 0);

    const srcPos = r.ordersBySource.pos, srcOnline = r.ordersBySource.online;
    const srcSum = srcPos + srcOnline;
    const posPct = srcSum > 0 ? Math.round((srcPos / srcSum) * 100) : 0;

    // Peak hours — hourly 9 AM–9 PM, widened to any hour that actually has orders.
    const hoursWithData = r.peakHours.filter((h) => h.count > 0).map((h) => h.hour);
    const hFrom = Math.min(9, ...hoursWithData), hTo = Math.max(21, ...hoursWithData);
    const peakBars = r.peakHours.filter((h) => h.hour >= hFrom && h.hour <= hTo).map((h) => ({ label: format(new Date(2000, 0, 1, h.hour), "h a"), count: h.count }));

    const svcTotal = r.topServices.reduce((sum, x) => sum + x.revenue, 0);
    const topSvc4 = r.topServices.slice(0, 5);
    const maxSvc4 = Math.max(1, ...topSvc4.map((x) => x.revenue));

    const CAT_COLORS = ["#2563EB", "#16A34A", "#7C3AED", "#F59E0B", "#CBD5E1", "#14B8A6", "#EF4444"];
    const catTotal = Object.values(r.revenueByCategory).reduce((a2, b2) => a2 + b2, 0);
    const catEntries = Object.entries(r.revenueByCategory).filter(([, v]) => v > 0).sort((a2, b2) => b2[1] - a2[1]);
    const catRows = (catEntries.length > 5
        ? [...catEntries.slice(0, 4), [t("reports.other", "Other"), catEntries.slice(4).reduce((sum, [, v]) => sum + v, 0)] as [string, number]]
        : catEntries
    ).map(([name, v], i) => ({ name, value: v, pct: catTotal > 0 ? Math.round((v / catTotal) * 100) : 0, color: CAT_COLORS[i % CAT_COLORS.length] }));

    const periodDays = Math.max(1, differenceInCalendarDays(lastDay, startDate) + 1);

    // ---- styles ----------------------------------------------------------
    const dsCard: CSSProperties = { background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, padding: "18px 18px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", minWidth: 0 };
    const title: CSSProperties = { fontSize: 15, fontWeight: 600, letterSpacing: "-.01em" };
    const empty = (text: string) => <div style={{ fontSize: 13, color: "var(--ds-text-3)", padding: "28px 0", textAlign: "center" }}>{text}</div>;
    const rangeChip = (on: boolean): CSSProperties => ({ cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, padding: "8px 16px", borderRadius: 9, border: `1px solid ${on ? "var(--ds-blue)" : "var(--ds-border)"}`, background: on ? "var(--ds-blue)" : "var(--ds-card)", color: on ? "#fff" : "var(--ds-text)" });
    const axisTick = { fontSize: 11, fill: "#6B7280" };
    const tooltipStyle = { borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12 };
    const deltaLine = (n: number, goodUp: boolean) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, color: (n >= 0) === goodUp ? "var(--ds-positive)" : "var(--ds-negative)" }}>{n >= 0 ? "▲" : "▼"}</span>
            <span style={{ color: (n >= 0) === goodUp ? "var(--ds-positive)" : "var(--ds-negative)", fontWeight: 500 }}>{Math.abs(n)}%</span>
            <span>{t("reports.vsLastMonth", "vs last month")}</span>
        </span>
    );

    const kpiCards: { label: string; value: string; color?: string; icon: ReactNode; tint: string; sub: ReactNode }[] = [
        { label: t("reports.revenue", "Revenue"), value: formatAmount(r.revenue), icon: <LineChartIcon size={20} />, tint: "ds-blue", sub: isMonthRange ? deltaLine(revDelta, true) : <span>{t("reports.avgPerDay", "avg {{v}} / day", { v: formatAmount(r.revenue / periodDays) })}</span> },
        { label: t("reports.collected", "Collected"), value: formatAmount(r.collections), icon: <Wallet size={20} />, tint: "ds-st-ready", sub: isMonthRange ? deltaLine(colDelta, true) : <span>{Math.round(r.collectionRate)}% {t("reports.ofBilled", "of billed")}</span> },
        { label: t("reports.outstanding", "Outstanding"), value: formatAmount(r.outstanding), color: "var(--ds-negative)", icon: <IndianRupee size={20} />, tint: "ds-st-overdue", sub: isMonthRange ? deltaLine(outDelta, false) : <span>{t("reports.toCollect", "to collect")}</span> },
        { label: t("reports.expenses", "Expenses"), value: formatAmount(r.totalExpenses), icon: <FolderOpen size={20} />, tint: "ds-st-out", sub: <span>{t("reports.inclSalaries", "incl. salaries")}{isMonthRange && expDelta !== 0 ? ` · ${expDelta > 0 ? "▲" : "▼"} ${Math.abs(expDelta)}%` : ""}</span> },
        { label: t("reports.netProfit", "Net profit"), value: formatAmount(r.profit), color: r.profit < 0 ? "var(--ds-negative)" : undefined, icon: <TrendingUp size={20} />, tint: "ds-st-ready", sub: <span style={{ color: r.profit >= 0 ? "var(--ds-positive)" : "var(--ds-negative)", fontWeight: 500 }}>{Math.round(r.profitMargin)}% {t("reports.margin", "margin")}{isMonthRange && profitDelta !== 0 ? ` · ${profitDelta > 0 ? "▲" : "▼"} ${Math.abs(profitDelta)}%` : ""}</span> },
        { label: t("reports.orders", "Orders"), value: String(r.orderCount), icon: <ClipboardList size={20} />, tint: "ds-blue", sub: <span>{t("reports.avg", "avg")} {formatAmount(r.avgOrderValue)}</span> },
    ];

    return (
        <div className="lb-ds" style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--ds-bg)" }}>
            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: "22px 26px 40px", minHeight: 0 }}>
                {/* title */}
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.02em", marginBottom: 18 }}>{t("reports.title", "Reports")}</div>

                {/* range bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                    <label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1px solid var(--ds-border)", borderRadius: 12, background: "var(--ds-card)", minWidth: 176, cursor: "pointer" }}>
                        <CalendarDays size={18} style={{ color: "var(--ds-text-2)" }} />
                        <span style={{ fontSize: 14.5, fontWeight: 500, flex: 1 }}>{rangeLabel(rangeOption)}</span>
                        <ChevronDown size={17} style={{ color: "var(--ds-text-2)" }} />
                        <select value={rangeOption} onChange={(e) => setRangeOption(e.target.value as DateRangeOption)} aria-label={t("reports.period", "Period")}
                            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}>
                            {RANGE_ORDER.map((o) => <option key={o} value={o}>{rangeLabel(o)}</option>)}
                        </select>
                    </label>
                    {RANGE_ORDER.map((o) => (
                        <button key={o} onClick={() => setRangeOption(o)} style={rangeChip(rangeOption === o)}>{chipLabel(o)}</button>
                    ))}
                    {rangeOption === "custom" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ font: "inherit", fontSize: 13.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9, padding: "7px 10px" }} />
                            <span style={{ color: "var(--ds-text-3)" }}>–</span>
                            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ font: "inherit", fontSize: 13.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9, padding: "7px 10px" }} />
                        </span>
                    )}
                    <span style={{ fontSize: 13, color: "var(--ds-text-3)" }}>{periodLabel}</span>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => window.print()} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 9, font: "inherit", fontSize: 14.5, fontWeight: 600, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12, padding: "11px 16px" }}><Printer size={17} />{t("reports.print", "Print")}</button>
                    <button onClick={handleDownloadPDF} disabled={generatingPDF} style={{ cursor: generatingPDF ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 9, font: "inherit", fontSize: 14.5, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", borderRadius: 12, padding: "11px 18px", opacity: generatingPDF ? 0.6 : 1 }}><FileDown size={18} />{generatingPDF ? t("common.loading", "Generating…") : t("reports.exportPdf", "Export PDF")}</button>
                </div>

                {/* franchise note */}
                {ownedShops.length > 1 && (
                    <Link to="/shops" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, background: "var(--ds-blue-soft)", borderRadius: 12, padding: "11px 16px", fontSize: 13.5, fontWeight: 600, color: "var(--ds-blue)", textDecoration: "none" }}>
                        {t("reports.franchiseNote", "This report shows {{shop}} only — view the all-shops franchise report →", { shop: shopName })}
                    </Link>
                )}

                {/* KPI row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginBottom: 18 }}>
                    {kpiCards.map((k) => (
                        <div key={k.label} style={{ ...dsCard, padding: "18px 18px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                            <span style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", background: `var(--${k.tint}-soft, var(--${k.tint}-bg))`, color: `var(--${k.tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{k.icon}</span>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, color: "var(--ds-text-2)" }}>{k.label}</div>
                                <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-.02em", marginTop: 4, color: k.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.value}</div>
                                <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.sub}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* main grid: left 2 columns + right rail */}
                <div className="rep-main" style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.45fr) minmax(300px, 1fr)", gap: 18, alignItems: "start" }}>
                    <style>{`@media (max-width: 1180px) { .rep-main { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
                    <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
                            {/* revenue by day */}
                            <div style={dsCard}>
                                <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                                    <span style={title}>{byMonthBars ? t("reports.revenueByMonth", "Revenue by month") : t("reports.revenueByDay", "Revenue by day")}</span>
                                    <span style={{ marginLeft: "auto", fontSize: 13.5, color: "var(--ds-text-2)" }}>{t("reports.total", "Total")} <b style={{ color: "var(--ds-blue)", fontWeight: 600 }}>{formatAmount(r.revenue)}</b></span>
                                </div>
                                {r.revenue <= 0 ? empty(t("reports.noOrders", "No orders in this period.")) : (
                                    <div style={{ height: 260 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={revenueBars} margin={{ top: 8, right: 4, left: -6, bottom: 0 }}>
                                                <CartesianGrid vertical={false} stroke="#EEF0F3" />
                                                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
                                                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={50} tickFormatter={(v: number) => shortAmt(v)} />
                                                <Tooltip cursor={{ fill: "rgba(37,99,235,.06)" }} formatter={(v) => formatAmount(Number(v))} contentStyle={tooltipStyle} />
                                                <Bar dataKey="amount" name={t("reports.revenue", "Revenue")} fill="#2563EB" radius={[2, 2, 0, 0]} maxBarSize={14} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>

                            {/* last 6 months */}
                            <div style={dsCard}>
                                <div style={{ ...title, marginBottom: 6 }}>{t("reports.last6Title", "Last 6 months — revenue vs expenses")}</div>
                                <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 12.5, color: "var(--ds-text-2)", marginBottom: 4 }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 16, height: 2, background: "#2563EB", position: "relative" }}><span style={{ position: "absolute", left: 5, top: -2.5, width: 6, height: 6, borderRadius: "50%", background: "#2563EB" }} /></span>{t("reports.revenue", "Revenue")}</span>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 16, height: 2, background: "#EF4444", position: "relative" }}><span style={{ position: "absolute", left: 5, top: -2.5, width: 6, height: 6, borderRadius: "50%", background: "#EF4444" }} /></span>{t("reports.expenses", "Expenses")}</span>
                                </div>
                                {!hasTrend ? empty(t("reports.noTrendData", "No revenue or expenses recorded yet.")) : (
                                    <div style={{ height: 262 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={trend6} margin={{ top: 22, right: 22, left: -6, bottom: 0 }}>
                                                <CartesianGrid vertical={false} stroke="#EEF0F3" />
                                                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
                                                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={50} tickFormatter={(v: number) => shortAmt(v)} />
                                                <Tooltip formatter={(v) => formatAmount(Number(v))} contentStyle={tooltipStyle} />
                                                <Line type="linear" dataKey="revenue" name={t("reports.revenue", "Revenue")} stroke="#2563EB" strokeWidth={2} dot={{ r: 3.5, fill: "#2563EB" }}>
                                                    <LabelList dataKey="revenue" position="top" formatter={(v: unknown) => shortAmt(Number(v))} style={{ fontSize: 10.5, fill: "#2563EB" }} />
                                                </Line>
                                                <Line type="linear" dataKey="expenses" name={t("reports.expenses", "Expenses")} stroke="#EF4444" strokeWidth={2} dot={{ r: 3.5, fill: "#EF4444" }}>
                                                    <LabelList dataKey="expenses" position="top" formatter={(v: unknown) => shortAmt(Number(v))} style={{ fontSize: 10.5, fill: "#EF4444" }} />
                                                </Line>
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
                            {/* top services */}
                            <div style={dsCard}>
                                <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
                                    <span style={title}>{t("reports.topServices", "Top services")}</span>
                                    <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--ds-text-2)" }}>{t("reports.byRevenueShort", "By revenue")}</span>
                                </div>
                                {topSvc4.length === 0 ? empty(t("reports.noServices", "No service revenue in this period.")) : (
                                    <>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
                                            {topSvc4.map((x) => (
                                                <div key={x.name} style={{ display: "grid", gridTemplateColumns: "88px 1fr 42px", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${x.name} · ${x.orders} ${t("reports.orders", "orders")}`}>{x.name}</span>
                                                    <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                                        <span style={{ height: 11, width: `${Math.max(4, (x.revenue / maxSvc4) * 62)}%`, background: "#2563EB", borderRadius: 3, flex: "none" }} />
                                                        <span style={{ whiteSpace: "nowrap" }}>{formatAmount(x.revenue)}</span>
                                                    </span>
                                                    <span style={{ textAlign: "right", color: "var(--ds-text-2)" }}>{svcTotal > 0 ? Math.round((x.revenue / svcTotal) * 100) : 0}%</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", marginTop: 26, paddingTop: 16, borderTop: "1px solid var(--ds-divider)", fontSize: 14.5 }}>
                                            <span style={{ fontWeight: 500 }}>{t("reports.total", "Total")}</span>
                                            <span style={{ marginLeft: "auto", fontWeight: 600 }}>{formatAmount(topSvc4.reduce((sum, x) => sum + x.revenue, 0))}</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* revenue by category */}
                            <div style={dsCard}>
                                <div style={{ ...title, marginBottom: 16 }}>{t("reports.revenueByCategory", "Revenue by category")}</div>
                                {catRows.length === 0 ? empty(t("reports.noServices", "No service revenue in this period.")) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                                        <div style={{ position: "relative", width: 176, height: 176, flex: "none" }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={catRows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2}>
                                                        {catRows.map((c) => <Cell key={c.name} fill={c.color} />)}
                                                    </Pie>
                                                    <Tooltip formatter={(v) => formatAmount(Number(v))} contentStyle={tooltipStyle} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                                                <span style={{ fontSize: 17, fontWeight: 600 }}>{formatAmount(catTotal)}</span>
                                                <span style={{ fontSize: 12.5, color: "var(--ds-text-2)" }}>{t("reports.total", "Total")}</span>
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 20 }}>
                                            {catRows.map((c) => (
                                                <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13.5 }}>
                                                    <span style={{ width: 9, height: 9, borderRadius: 2, background: c.color, flex: "none" }} />
                                                    <span style={{ color: "var(--ds-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                                                    <span style={{ marginLeft: "auto", color: "var(--ds-text-2)", whiteSpace: "nowrap" }}>{formatAmount(c.value)} ({c.pct}%)</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* right rail */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                        {/* payment mix */}
                        <div style={dsCard}>
                            <div style={{ ...title, marginBottom: 10 }}>{t("reports.paymentMix", "Payment mix")}</div>
                            {payMix.length === 0 ? empty(t("reports.noPayments", "No payments recorded in this period.")) : (
                                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                    <div style={{ width: 140, height: 140, flex: "none" }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={payMix} dataKey="amount" nameKey="label" innerRadius={36} outerRadius={66} startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2}
                                                    labelLine={false} label={(pl: { percent?: number; cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number }) => {
                                                        const pctv = Math.round((pl.percent || 0) * 100);
                                                        if (pctv < 5) return null;
                                                        const rad = ((pl.innerRadius || 0) + (pl.outerRadius || 0)) / 2;
                                                        const ang = (-(pl.midAngle || 0) * Math.PI) / 180;
                                                        return <text x={(pl.cx || 0) + rad * Math.cos(ang)} y={(pl.cy || 0) + rad * Math.sin(ang)} fill="#fff" fontSize={10.5} fontWeight={600} textAnchor="middle" dominantBaseline="central">{pctv}%</text>;
                                                    }}>
                                                    {payMix.map((m) => <Cell key={m.key} fill={m.color} />)}
                                                </Pie>
                                                <Tooltip formatter={(v) => formatAmount(Number(v))} contentStyle={tooltipStyle} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 13 }}>
                                        {payMix.map((m) => (
                                            <div key={m.key} style={{ display: "grid", gridTemplateColumns: "10px 1fr 40px auto", alignItems: "center", gap: 10, fontSize: 13 }}>
                                                <span style={{ width: 9, height: 9, borderRadius: 2, background: m.color }} />
                                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.label}</span>
                                                <span style={{ color: "var(--ds-text-2)" }}>{m.pct}%</span>
                                                <span style={{ textAlign: "right", color: "var(--ds-text-2)" }}>{formatAmount(m.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* orders by status */}
                        <div style={dsCard}>
                            <div style={{ ...title, marginBottom: 12 }}>{t("reports.ordersByStatus", "Orders by status")}</div>
                            {statusTotal === 0 ? empty(t("reports.noOrders", "No orders in this period.")) : (
                                <>
                                    <div style={{ display: "flex", height: 26, borderRadius: 5, overflow: "hidden" }}>
                                        {statusGroups.filter((g) => g.n > 0).map((g) => (
                                            <span key={g.label} title={`${g.label} · ${g.n}`} style={{ flex: `${g.n} 0 0`, minWidth: 26, background: g.color, color: "#fff", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "2px solid #fff" }}>{g.n}</span>
                                        ))}
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 12 }}>
                                        {statusGroups.filter((g) => g.n > 0 || g.label !== t("reports.stCancelled", "Cancelled")).map((g) => (
                                            <span key={g.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ds-text-2)" }}><span style={{ width: 8, height: 8, borderRadius: 2, background: g.color }} />{g.label}</span>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* orders by source */}
                        <div style={dsCard}>
                            <div style={{ ...title, marginBottom: 10 }}>{t("reports.ordersBySource", "Orders by source")}</div>
                            <div style={{ display: "flex", fontSize: 12.5, color: "var(--ds-text-2)", marginBottom: 8 }}>
                                <span>{t("reports.counter", "Counter")} {posPct}%</span>
                                <span style={{ marginLeft: "auto" }}>{t("reports.online", "Online")} {srcSum > 0 ? 100 - posPct : 0}%</span>
                            </div>
                            <div style={{ height: 5, borderRadius: 5, background: "#E5E7EB", overflow: "hidden" }} title={`${t("reports.counter", "Counter")} ${srcPos} · ${t("reports.online", "Online")} ${srcOnline}`}>
                                <div style={{ width: `${posPct}%`, height: "100%", background: "#2563EB", borderRadius: 5 }} />
                            </div>
                        </div>

                        {/* peak hours */}
                        <div style={dsCard}>
                            <div style={{ ...title, marginBottom: 6 }}>{t("reports.peakHoursTitle", "Peak hours")}</div>
                            {!hasPeak ? empty(t("reports.noPeakData", "No orders yet to chart intake hours.")) : (
                                <div style={{ height: 110 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={peakBars} margin={{ top: 6, right: 2, left: -22, bottom: 0 }}>
                                            <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "#6B7280" }} tickLine={false} axisLine={false} interval={1} />
                                            <YAxis tick={{ fontSize: 10.5, fill: "#6B7280" }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                                            <Tooltip cursor={{ fill: "rgba(37,99,235,.06)" }} contentStyle={tooltipStyle} />
                                            <Bar dataKey="count" name={t("reports.orders", "Orders")} fill="#2563EB" radius={[1, 1, 0, 0]} maxBarSize={14} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {/* staff */}
                        <div style={dsCard}>
                            <div style={{ ...title, marginBottom: 12 }}>{isMonthRange ? t("reports.staffThisMonth", "Staff this month") : t("reports.staffThisPeriod", "Staff this period")}</div>
                            {staffSorted.length === 0 ? empty(t("reports.noStaffData", "No staff attendance or payroll in this period.")) : (
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                                    <thead>
                                        <tr style={{ color: "var(--ds-text-2)" }}>
                                            <th style={{ textAlign: "left", fontWeight: 500, padding: "0 0 8px" }}>{t("reports.staff", "Staff")}</th>
                                            <th style={{ textAlign: "center", fontWeight: 500, padding: "0 0 8px" }}>{t("reports.presentDays", "Present days")}</th>
                                            <th style={{ textAlign: "right", fontWeight: 500, padding: "0 0 8px" }}>{t("reports.ordersHandled", "Orders handled")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffSorted.map((st) => (
                                            <tr key={st.staffId} style={{ borderTop: "1px solid var(--ds-divider)" }} title={`${t("reports.salaryPaid", "Salary paid")}: ${formatAmount(st.salaryPaid)}`}>
                                                <td style={{ padding: "7px 0" }}>{st.staffName}</td>
                                                <td style={{ padding: "7px 0", textAlign: "center" }}>{st.presentDays} / {periodDays}</td>
                                                <td style={{ padding: "7px 0", textAlign: "right" }}>{r.ordersByStaff[st.staffId] || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* ---- more detail kept from the previous report ---- */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, marginTop: 18 }}>
                    {/* expenses by category */}
                    <div style={dsCard}>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                            <span style={title}>{t("reports.expensesByCategory", "Expenses by category")}</span>
                            <span style={{ marginLeft: "auto", fontWeight: 600 }}>{formatAmount(r.totalExpenses)}</span>
                        </div>
                        {expEntries.length === 0 ? empty(t("reports.noExpenses", "No expenses recorded in this period.")) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                                {expEntries.map(([catKey, amt], i) => (
                                    <div key={catKey} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                                        <span style={{ width: 9, height: 9, flex: "none", borderRadius: 2, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                                        <span style={{ color: "var(--ds-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{catKey === "salary" ? t("reports.salaries", "Salaries") : t(`expenses.cat.${catKey}`, humanize(catKey))}</span>
                                        <span style={{ marginLeft: "auto", color: "var(--ds-text-3)" }}>{r.totalExpenses > 0 ? Math.round((amt / r.totalExpenses) * 100) : 0}%</span>
                                        <span style={{ width: 96, textAlign: "right", fontWeight: 500 }}>{formatAmount(amt)}</span>
                                    </div>
                                ))}
                                <div style={{ display: "flex", paddingTop: 11, borderTop: "1px solid var(--ds-divider)", fontSize: 13.5 }}>
                                    <span style={{ color: "var(--ds-text-2)" }}>{t("reports.salariesPaid", "Salaries paid")}</span>
                                    <span style={{ marginLeft: "auto", fontWeight: 600 }}>{formatAmount(r.salariesPaid)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* customer growth */}
                    <div style={dsCard}>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                            <span style={title}>{t("reports.customerGrowth", "Customer growth")}</span>
                            <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: custDelta >= 0 ? "var(--ds-positive)" : "var(--ds-negative)" }}>{deltaStr(custDelta)}</span>
                        </div>
                        <div style={{ height: 130 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={tr.map((m) => ({ label: monthLabel(m.month), n: m.newCustomers }))} margin={{ top: 6, right: 2, left: -26, bottom: 0 }}>
                                    <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "#6B7280" }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 10.5, fill: "#6B7280" }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                                    <Tooltip cursor={{ fill: "rgba(37,99,235,.06)" }} contentStyle={tooltipStyle} />
                                    <Bar dataKey="n" name={t("reports.newCustomers", "New customers")} fill="#2563EB" radius={[3, 3, 0, 0]} maxBarSize={22} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ display: "flex", gap: 10, paddingTop: 12, marginTop: 8, borderTop: "1px solid var(--ds-divider)", fontSize: 13 }}>
                            <div style={{ flex: 1 }}><div style={{ color: "var(--ds-text-2)" }}>{t("reports.newThisPeriod", "New this period")}</div><div style={{ fontWeight: 600, fontSize: 17, color: "var(--ds-positive)" }}>{r.customerStats?.newCustomers ?? 0}</div></div>
                            <div style={{ flex: 1 }}><div style={{ color: "var(--ds-text-2)" }}>{t("reports.totalCustomers", "Total customers")}</div><div style={{ fontWeight: 600, fontSize: 17 }}>{r.customerStats?.totalCustomers ?? 0}</div></div>
                        </div>
                    </div>

                    {/* order types + attendance */}
                    <div style={dsCard}>
                        <div style={{ ...title, marginBottom: 12 }}>{t("reports.orderTypesAttendance", "Order types & attendance")}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                            {typeEntries.length === 0 ? empty(t("reports.noOrders", "No orders in this period.")) : typeEntries.map(([ty, n], i) => (
                                <div key={ty} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                                    <span style={{ width: 9, height: 9, borderRadius: 2, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                                    <span style={{ color: "var(--ds-text-2)" }}>{typeLabel(ty)}</span>
                                    <span style={{ marginLeft: "auto", fontWeight: 600 }}>{n}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, paddingTop: 14, borderTop: "1px solid var(--ds-divider)" }}>
                            {attPills.map((pl) => (
                                <div key={pl.label} style={{ textAlign: "center" }}>
                                    <div style={{ fontWeight: 600, fontSize: 17 }}>{pl.v}</div>
                                    <div style={{ fontSize: 11.5, color: "var(--ds-text-2)" }}>{pl.label}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ds-text-3)", marginTop: 10 }}>{att.staffTracked} {t("reports.staffTracked", "staff tracked")} · {attTotal} {t("reports.entries", "entries")}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
