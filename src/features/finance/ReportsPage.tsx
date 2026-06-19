/**
 * Reports — 1000% to the design system (Reports.dc.html).
 * KPI row · Revenue vs Expenses (8mo) + net-profit donut · operational health +
 * order outcomes · customer growth + top services · staff attendance + payment
 * collection + peak hours. Wired to useFinancialReports (all real data).
 */

import { useState, useMemo, type CSSProperties, type ReactNode } from "react";
import { LEmptyState, LPageLoader } from "@/components/laundry";
import { useFinancialReports } from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import { FileDown, Printer, TrendingUp, Wallet, Receipt, Banknote, Shirt } from "lucide-react";
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

const cardHead = (label: string, sub?: string): ReactNode => <div style={{ marginBottom: 16 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>{sub && <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>{sub}</div>}</div>;
const monthLabel = (m: string) => format(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1), "MMM");

export function ReportsPage() {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
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

    const handleDownloadPDF = async () => {
        setGeneratingPDF(true);
        try { await generateReportsPDF({ periodLabel, revenue: r.revenue, orderCount: r.orderCount, avgOrderValue: r.avgOrderValue, collections: r.collections, outstanding: r.outstanding, collectionRate: r.collectionRate, totalExpenses: r.totalExpenses, expensesByCategory: r.expensesByCategory, salariesPaid: r.salariesPaid, profit: r.profit, profitMargin: r.profitMargin, orderStats: r.orderStats, staffMetrics: r.staffMetrics, customerStats: r.customerStats ? { totalCustomers: r.customerStats.totalCustomers, newCustomers: r.customerStats.newCustomers } : undefined }); }
        catch (err) { console.error("Failed to generate PDF:", err); }
        finally { setGeneratingPDF(false); }
    };

    if (showLoading) return <div className="h-full"><LPageLoader variant="cash" message={t("reports.generating")} /></div>;
    if (r.error) return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}><LEmptyState icon={<FileDown className="h-8 w-8" />} title={t("reports.error", "Couldn't load report")} description={r.error} /></div>;

    const os = r.orderStats;
    const ongoing = Math.max(0, os.total - os.delivered - os.cancelled);
    const outcomeRing = `conic-gradient(var(--c-success) 0 ${(os.delivered / Math.max(1, os.total)) * 360}deg, var(--c-primary) 0 ${((os.delivered + ongoing) / Math.max(1, os.total)) * 360}deg, var(--c-error) 0)`;

    // KPI deltas from the monthly trend (this vs last month)
    const tr = r.monthlyTrend;
    const cur = tr[tr.length - 1], prev = tr[tr.length - 2];
    const pctDelta = (c: number, p: number) => (p > 0 ? Math.round(((c - p) / p) * 100) : 0);
    const revDelta = prev ? pctDelta(cur.revenue, prev.revenue) : 0;
    const expDelta = prev ? pctDelta(cur.expenses, prev.expenses) : 0;
    const profitDelta = prev ? pctDelta(cur.revenue - cur.expenses, prev.revenue - prev.expenses) : 0;
    const custDelta = prev ? pctDelta(cur.newCustomers, prev.newCustomers) : 0;
    const deltaStr = (n: number) => `${n >= 0 ? "▲" : "▼"} ${Math.abs(n)}%`;
    const deltaColor = (n: number, goodUp = true) => ((n >= 0) === goodUp ? "c-success" : "c-error");

    const kpis = [
        { label: t("reports.revenue", "Revenue"), value: formatAmount(r.revenue), tint: "c-primary", icon: <TrendingUp size={16} />, delta: revDelta, goodUp: true },
        { label: t("reports.netProfit", "Net profit"), value: formatAmount(r.profit), tint: r.profit >= 0 ? "c-success" : "c-error", icon: <Wallet size={16} />, delta: profitDelta, goodUp: true },
        { label: t("reports.collected", "Collected"), value: formatAmount(r.collections), tint: "c-info", icon: <Banknote size={16} />, sub: `${Math.round(r.collectionRate)}% rate` },
        { label: t("reports.expenses", "Expenses"), value: formatAmount(r.totalExpenses), tint: "c-warning", icon: <Receipt size={16} />, delta: expDelta, goodUp: false },
    ];

    // monthly trend bars
    const maxTrend = Math.max(1, ...tr.map((m) => Math.max(m.revenue, m.expenses)));
    const maxGrowth = Math.max(1, ...tr.map((m) => m.newCustomers));

    // operational health (real derived metrics)
    const tot = Math.max(1, os.total);
    const completion = Math.round((os.delivered / tot) * 100);
    const paidRatio = Math.round((os.paidOrders / tot) * 100);
    const fulfil = Math.round(((os.total - os.cancelled) / tot) * 100);
    const tagFor = (v: number) => (v >= 90 ? { tag: "Good", ref: "c-success" } : v >= 75 ? { tag: "OK", ref: "c-warning" } : { tag: "Low", ref: "c-error" });
    const healthRows = [
        { label: t("reports.collectionRate", "Collection rate"), v: Math.round(r.collectionRate) },
        { label: t("reports.orderCompletion", "Order completion"), v: completion },
        { label: t("reports.paidOrders", "Paid orders"), v: paidRatio },
        { label: t("reports.fulfilment", "Fulfilment"), v: fulfil },
    ].map((h) => ({ ...h, ...tagFor(h.v) }));
    const healthScore = Math.round(healthRows.reduce((s, h) => s + h.v, 0) / healthRows.length);
    const healthMeta = tagFor(healthScore);

    // top services
    const topSvc = r.topServices;
    const top = topSvc[0];
    const maxSvc = Math.max(1, ...topSvc.map((s) => s.revenue));

    // peak hours — bucket into 2h slots 8:00–22:00
    const slots: [number, number, string][] = [[8, 10, "8a"], [10, 12, "10a"], [12, 14, "12p"], [14, 16, "2p"], [16, 18, "4p"], [18, 20, "6p"], [20, 22, "8p"]];
    const peak = slots.map(([a, b, label]) => ({ label, count: r.peakHours.filter((h) => h.hour >= a && h.hour < b).reduce((s, h) => s + h.count, 0) }));
    const maxPeak = Math.max(1, ...peak.map((p) => p.count));

    // staff attendance
    const staffSorted = [...r.staffMetrics].sort((a, b) => b.presentDays - a.presentDays);
    const totalPresent = r.staffMetrics.reduce((s, m) => s + m.presentDays, 0);

    const navPill = (on: boolean): CSSProperties => ({ cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "7px 13px", borderRadius: 8, border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border-strong)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" });
    const hdrBtn: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "8px 13px" };

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            <header style={{ flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "10px 22px" }}>
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

            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: "20px 22px 44px", minHeight: 0 }}>
                {/* KPI row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
                    {kpis.map((k) => (
                        <div key={k.label} style={card}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${k.tint}-soft)`, color: `var(--${k.tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{k.icon}</span><span style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{k.label}</span></div>
                            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 24, letterSpacing: "-.02em", marginTop: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.value}</div>
                            {k.delta !== undefined ? <div style={{ fontSize: 11.5, marginTop: 5 }}><span style={{ fontWeight: 600, color: `var(--${deltaColor(k.delta, k.goodUp)})` }}>{deltaStr(k.delta)}</span> <span style={{ color: "var(--c-text-3)" }}>{t("reports.vsLastMonth", "vs last month")}</span></div> : <div style={{ fontSize: 11.5, color: "var(--c-text-3)", fontWeight: 600, marginTop: 5 }}>{k.sub}</div>}
                        </div>
                    ))}
                </div>

                {/* Row B: revenue vs expenses + net profit */}
                <div className="lb-row" style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                    <div style={{ ...card, flex: 1.7, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 16 }}>
                            <div><div style={{ fontSize: 14, fontWeight: 600 }}>{t("reports.revenueVsExpenses", "Revenue vs Expenses")}</div><div style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t("reports.last8Months", "Last 8 months")}</div></div>
                            <div style={{ marginLeft: "auto", display: "flex", gap: 14 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--c-text-2)" }}><span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--c-primary)" }} />{t("reports.revenue", "Revenue")}</span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--c-text-2)" }}><span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--c-warning)" }} />{t("reports.expenses", "Expenses")}</span>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 170 }}>
                            {tr.map((m, i) => (
                                <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 7 }} title={`${monthLabel(m.month)} · rev ${formatAmount(m.revenue)} · exp ${formatAmount(m.expenses)}`}>
                                    <div style={{ width: "100%", display: "flex", gap: 3, alignItems: "flex-end", height: "100%", justifyContent: "center" }}>
                                        <div style={{ width: "42%", maxWidth: 14, height: `${Math.max(2, (m.revenue / maxTrend) * 100)}%`, background: "var(--c-primary)", borderRadius: "3px 3px 0 0" }} />
                                        <div style={{ width: "42%", maxWidth: 14, height: `${Math.max(2, (m.expenses / maxTrend) * 100)}%`, background: "var(--c-warning)", borderRadius: "3px 3px 0 0" }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: i === tr.length - 1 ? "var(--c-primary)" : "var(--c-text-3)", fontWeight: i === tr.length - 1 ? 700 : 400 }}>{monthLabel(m.month)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ ...card, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, alignSelf: "flex-start" }}>{t("reports.netProfit", "Net profit")}</div>
                        <div style={{ margin: "16px 0 8px" }}><Donut pct={Math.max(0, r.profitMargin)} color={r.profit >= 0 ? "c-success" : "c-error"} big={`${Math.round(r.profitMargin)}%`} sub={t("reports.margin", "margin")} size={150} /></div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, color: r.profit >= 0 ? "var(--c-success)" : "var(--c-error)" }}>{formatAmount(r.profit)}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: `var(--${deltaColor(profitDelta)})`, marginTop: 3 }}>{deltaStr(profitDelta)} {t("reports.vsLastMonth", "vs last month")}</div>
                    </div>
                </div>

                {/* Row C: operational health + order outcomes */}
                <div className="lb-row" style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                    <div style={{ ...card, flex: 1.4, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{t("reports.operationalHealth", "Operational health")}</div><span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: `var(--${healthMeta.ref})`, background: `var(--${healthMeta.ref}-soft)`, padding: "4px 11px", borderRadius: 20 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: `var(--${healthMeta.ref})` }} />{healthMeta.tag} · {healthScore}/100</span></div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            {healthRows.map((h) => (
                                <div key={h.label}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><span style={{ fontSize: 12.5, color: "var(--c-text-2)" }}>{h.label}</span><span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 600, fontSize: 12.5 }}>{h.v}%</span><span style={{ fontSize: 10, fontWeight: 600, color: `var(--${h.ref})`, background: `var(--${h.ref}-soft)`, padding: "2px 7px", borderRadius: 20 }}>{h.tag}</span></div>
                                    <div style={{ height: 6, background: "var(--c-surface-2)", borderRadius: 6, overflow: "hidden" }}><div style={{ height: "100%", width: `${h.v}%`, background: `var(--${h.ref})`, borderRadius: 6 }} /></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ ...card, flex: 1, minWidth: 0 }}>
                        {cardHead(t("reports.orderOutcomes", "Order outcomes"), `${os.total} ${t("reports.orders", "orders")}`)}
                        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                            <div style={{ position: "relative", width: 120, height: 120, flex: "none", borderRadius: "50%", background: outcomeRing, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ width: 78, height: 78, borderRadius: "50%", background: "var(--c-surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 20 }}>{os.total}</div><div style={{ fontSize: 9.5, color: "var(--c-text-3)" }}>{t("reports.orders", "orders")}</div></div>
                            </div>
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
                                {[{ label: t("reports.delivered", "Delivered"), v: os.delivered, tint: "c-success" }, { label: t("reports.ongoing", "Ongoing"), v: ongoing, tint: "c-primary" }, { label: t("reports.cancelled", "Cancelled"), v: os.cancelled, tint: "c-error" }].map((o) => (
                                    <div key={o.label} style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: `var(--${o.tint})` }} /><span style={{ fontSize: 12.5, color: "var(--c-text-2)" }}>{o.label}</span><span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 600, fontSize: 12.5 }}>{o.v}</span></div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Row D: customer growth + top services */}
                <div className="lb-row" style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                    <div style={{ ...card, flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 16 }}><div><div style={{ fontSize: 14, fontWeight: 600 }}>{t("reports.customerGrowth", "Customer growth")}</div><div style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t("reports.newPerMonth", "New customers / month")}</div></div><div style={{ marginLeft: "auto", textAlign: "right" }}><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 18 }}>+{cur?.newCustomers ?? 0}</div><div style={{ fontSize: 11, color: `var(--${deltaColor(custDelta)})`, fontWeight: 600 }}>{deltaStr(custDelta)}</div></div></div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, marginBottom: 14 }}>
                            {tr.map((m, i) => <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 6 }} title={`${monthLabel(m.month)} · ${m.newCustomers}`}><div style={{ width: "100%", maxWidth: 24, height: `${Math.max(3, (m.newCustomers / maxGrowth) * 100)}%`, background: i === tr.length - 1 ? "var(--c-primary)" : "var(--c-primary-tint)", borderRadius: "4px 4px 0 0" }} /><span style={{ fontSize: 10, color: "var(--c-text-3)" }}>{monthLabel(m.month)}</span></div>)}
                        </div>
                        <div style={{ display: "flex", gap: 10, paddingTop: 13, borderTop: "1px solid var(--c-border)" }}>
                            <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "var(--c-text-3)" }}>{t("reports.newThisPeriod", "New this period")}</div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16, color: "var(--c-success)" }}>{r.customerStats?.newCustomers ?? 0}</div></div>
                            <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "var(--c-text-3)" }}>{t("reports.totalCustomers", "Total customers")}</div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16 }}>{r.customerStats?.totalCustomers ?? 0}</div></div>
                        </div>
                    </div>
                    <div style={{ ...card, flex: 1.4, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{t("reports.topServices", "Top services")}</div><span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--c-text-3)" }}>{t("reports.byRevenue", "by revenue")}</span></div>
                        {!top ? (
                            <div style={{ fontSize: 13, color: "var(--c-text-3)" }}>{t("reports.noServices", "No service revenue in this period.")}</div>
                        ) : (
                            <>
                                <div style={{ display: "flex", alignItems: "center", gap: 13, padding: 13, borderRadius: 11, background: "var(--c-primary-soft)", marginBottom: 12 }}>
                                    <span style={{ width: 40, height: 40, flex: "none", borderRadius: 10, background: "var(--c-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Shirt size={20} /></span>
                                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ fontSize: 14, fontWeight: 700 }}>{top.name}</span><span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "var(--c-primary)", padding: "2px 7px", borderRadius: 5 }}>#1</span></div><div style={{ fontSize: 11.5, color: "var(--c-text-2)", marginTop: 2 }}>{top.orders} {t("reports.orders", "orders")}</div></div>
                                    <div style={{ textAlign: "right" }}><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 17 }}>{formatAmount(top.revenue)}</div></div>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                                    {topSvc.slice(1, 5).map((s, i) => (
                                        <div key={s.name}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}><span style={{ fontSize: 11, fontFamily: MONO, color: "var(--c-text-3)", width: 16 }}>{i + 2}</span><span style={{ fontSize: 12.5, color: "var(--c-text-2)" }}>{s.name}</span><span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 600, fontSize: 12.5 }}>{formatAmount(s.revenue)}</span></div>
                                            <div style={{ height: 6, background: "var(--c-surface-2)", borderRadius: 6, overflow: "hidden", marginLeft: 24 }}><div style={{ height: "100%", width: `${Math.max(4, (s.revenue / maxSvc) * 100)}%`, background: `var(--${CAT_TINT[(i + 1) % CAT_TINT.length]})`, borderRadius: 6 }} /></div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Row E: staff attendance + payment collection + peak hours */}
                <div className="lb-row" style={{ display: "flex", gap: 14 }}>
                    <div style={{ ...card, flex: 1, minWidth: 0 }}>
                        {cardHead(t("reports.staffAttendance", "Staff attendance"), `${totalPresent} ${t("reports.presentDays", "present days")}`)}
                        {staffSorted.length === 0 ? <div style={{ fontSize: 13, color: "var(--c-text-3)" }}>{t("reports.noStaffData", "No staff data.")}</div> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: ".04em" }}>{t("reports.topAttendance", "Top attendance")}</div>
                                {staffSorted.slice(0, 4).map((s, i) => (
                                    <div key={s.staffId} style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 28, height: 28, flex: "none", borderRadius: "50%", background: `var(--${CAT_TINT[i % CAT_TINT.length]}-soft)`, color: `var(--${CAT_TINT[i % CAT_TINT.length]})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 600 }}>{(s.staffName || "?").slice(0, 2).toUpperCase()}</span><span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.staffName}</span><span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 600, fontSize: 12.5, color: "var(--c-success)" }}>{s.presentDays}d</span></div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ ...card, flex: 1, minWidth: 0 }}>
                        {cardHead(t("reports.paymentCollection", "Payment collection"))}
                        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                            <Donut pct={r.collectionRate} color="c-success" big={`${Math.round(r.collectionRate)}%`} sub={t("reports.collected", "collected")} size={110} />
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                                <div><div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--c-success)" }} /><span style={{ fontSize: 12, color: "var(--c-text-2)" }}>{t("reports.collected", "Collected")}</span></div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15, marginTop: 2 }}>{formatAmount(r.collections)}</div></div>
                                <div><div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--c-error)" }} /><span style={{ fontSize: 12, color: "var(--c-text-2)" }}>{t("reports.outstanding", "Outstanding")}</span></div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15, marginTop: 2, color: "var(--c-error)" }}>{formatAmount(r.outstanding)}</div></div>
                            </div>
                        </div>
                    </div>
                    <div style={{ ...card, flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t("reports.peakHours", "Peak intake hours")}</div>
                        <div style={{ fontSize: 12, color: "var(--c-text-3)", marginBottom: 18 }}>{t("reports.ordersByTime", "Orders by time of day")}</div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 120 }}>
                            {peak.map((pk) => { const top1 = pk.count === maxPeak && maxPeak > 0; return <div key={pk.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 6 }} title={`${pk.label} · ${pk.count}`}><div style={{ width: "100%", maxWidth: 22, height: `${Math.max(3, (pk.count / maxPeak) * 100)}%`, background: top1 ? "var(--c-primary)" : "var(--c-primary-tint)", borderRadius: "4px 4px 0 0" }} /><span style={{ fontSize: 9, color: top1 ? "var(--c-primary)" : "var(--c-text-3)", fontWeight: top1 ? 700 : 400 }}>{pk.label}</span></div>; })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
