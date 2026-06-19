/**
 * Dashboard — built 1000% to the Enterprise Laundry CRM design system
 * (Dashboard.dc.html): IBM Plex Sans/Mono, --c-* tokens, utilitarian high-density.
 * Sections: Quick Scan · KPI tiles · Revenue chart + Pipeline ·
 *           Store Health + Revenue Analytics · Schedule + Needs attention + Channels.
 */

import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { useDashboard } from "@/hooks/use-dashboard";
import { useOrderSummary } from "@/hooks/use-order-summary";
import { useStoreHealth } from "@/hooks/use-store-health";
import { useCurrency } from "@/hooks/use-currency";
import { LPageLoader, LEmptyState } from "@/components/laundry";
import {
    Search, ScanLine, Package, DollarSign, PackageCheck, Clock, CreditCard,
    Activity, TrendingUp, AlertTriangle, FileWarning, ArrowRight,
} from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import type { Order } from "@/types/order";

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const card: CSSProperties = {
    background: "var(--c-surface)", border: "1px solid var(--c-border)",
    borderRadius: 12, boxShadow: "var(--sh-sm)",
};

export function DashboardPage() {
    const navigate = useNavigate();
    const { shopId } = useAuth();
    const { stats, recentOrders, staffAttendance, loading, error } = useDashboard();
    const fin = useOrderSummary();
    const health = useStoreHealth();
    const { formatAmount } = useCurrency();

    const [searchQ, setSearchQ] = useState("");
    const [series, setSeries] = useState<{ day: string; value: number }[]>([]);

    // 14-day daily revenue series
    useEffect(() => {
        if (!shopId) return;
        let cancelled = false;
        (async () => {
            try {
                const since = startOfDay(subDays(new Date(), 13));
                const snap = await getDocs(query(
                    collection(db, "shops", shopId, "orders"),
                    where("createdAt", ">=", Timestamp.fromDate(since)),
                ));
                const buckets = new Map<string, number>();
                for (let i = 0; i < 14; i++) buckets.set(format(subDays(new Date(), 13 - i), "yyyy-MM-dd"), 0);
                snap.forEach((d) => {
                    const o = d.data() as Order;
                    if (o.status === "cancelled") return;
                    const dt = o.createdAt?.toDate?.();
                    if (!dt) return;
                    const key = format(dt, "yyyy-MM-dd");
                    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + (o.financials?.total || 0));
                });
                if (!cancelled) setSeries([...buckets.entries()].map(([k, v]) => ({ day: format(new Date(k), "d"), value: v })));
            } catch (e) { console.error("revenue series", e); }
        })();
        return () => { cancelled = true; };
    }, [shopId]);

    if (loading) return <div className="h-full"><LPageLoader variant="machine" message="Loading dashboard…" /></div>;
    if (error) return (
        <div className="p-8"><LEmptyState icon={<AlertTriangle className="h-8 w-8" />} title="Error loading dashboard" description={error} action={{ label: "Retry", onClick: () => window.location.reload() }} /></div>
    );

    // ---- derived ----
    const collected = fin.loading ? stats.todayCollected : fin.collected;
    const sales = fin.loading ? stats.monthlyRevenue : fin.revenue;
    const uncollected = Math.max(0, sales - collected);
    const expenses = stats.monthlyExpenses;
    const netProfit = collected - expenses;
    const collectionPct = sales > 0 ? Math.round((collected / sales) * 100) : 0;

    const seriesMax = Math.max(1, ...series.map((s) => s.value));
    const seriesTotal = series.reduce((s, x) => s + x.value, 0);

    const trendStr = (n: number) => (n > 0 ? `▲ ${n}%` : n < 0 ? `▼ ${Math.abs(n)}%` : "—");
    const trendRef = (n: number) => (n >= 0 ? "c-success" : "c-error");

    const kpis = [
        { label: "Orders today", value: String(stats.todayOrders), ref: "c-primary", soft: "c-primary-soft", icon: <Package size={15} />, delta: trendStr(stats.ordersTrend), deltaRef: trendRef(stats.ordersTrend), sub: "vs yesterday" },
        { label: "Revenue today", value: formatAmount(stats.todayRevenue), ref: "c-success", soft: "c-success-soft", icon: <DollarSign size={15} />, delta: trendStr(stats.revenueTrend), deltaRef: trendRef(stats.revenueTrend), sub: "vs prior" },
        { label: "Ready for pickup", value: String(stats.readyOrders), ref: "c-info", soft: "c-info-soft", icon: <PackageCheck size={15} />, delta: "● live", deltaRef: "c-info", sub: "in queue" },
        { label: "Overdue", value: String(fin.pendingCount), ref: "c-warning", soft: "c-warning-soft", icon: <Clock size={15} />, delta: "needs action", deltaRef: "c-warning", sub: "" },
        { label: "Customers", value: String(stats.totalCustomers), ref: "c-violet", soft: "c-violet-soft", icon: <CreditCard size={15} />, delta: stats.newCustomersToday > 0 ? `+${stats.newCustomersToday}` : "—", deltaRef: "c-success", sub: "new today" },
    ];

    const pipeline = [
        { label: "Received", count: stats.pendingOrders, color: "var(--c-text-3)" },
        { label: "Processing", count: stats.processingOrders, color: "var(--c-info)" },
        { label: "Ready", count: stats.readyOrders, color: "var(--c-success)" },
        { label: "Out for delivery", count: stats.outForDeliveryOrders, color: "var(--c-cyan)" },
    ];
    const pipeTotal = pipeline.reduce((s, p) => s + p.count, 0);
    const pipeMax = Math.max(1, ...pipeline.map((p) => p.count));

    const metricTone = (v: number | null) => (v == null ? "c-text-3" : v >= 80 ? "c-success" : v >= 60 ? "c-warning" : "c-error");
    const healthMetrics = [
        { label: "On-Time Delivery", m: health.onTimeDelivery },
        { label: "On-Time Pickup", m: health.onTimePickup },
        { label: "Order Flow", m: health.orderFlow },
        { label: "Collection Rate", m: health.collectionRate },
    ];
    const healthRing = `conic-gradient(var(--c-success) 0 ${health.score ?? 0}%, var(--c-surface-2) ${health.score ?? 0}% 100%)`;
    const healthStatus = health.score == null ? { label: "No data", ref: "c-text-3" }
        : health.score >= 70 ? { label: "Healthy", ref: "c-success" }
            : health.score >= 55 ? { label: "Needs attention", ref: "c-warning" }
                : { label: "Critical", ref: "c-error" };

    const pnl = [
        { label: "Sales", value: formatAmount(sales), ref: "c-primary" },
        { label: "Collected", value: formatAmount(collected), ref: "c-success" },
        { label: "Uncollected", value: formatAmount(uncollected), ref: "c-error" },
        { label: "Monthly Expenses", value: formatAmount(expenses), ref: "c-warning" },
    ];

    const ST: Record<string, { bg: string; fg: string; label: string }> = {
        pending: { bg: "var(--c-warning-soft)", fg: "var(--c-warning)", label: "Pending" },
        processing: { bg: "var(--c-info-soft)", fg: "var(--c-info)", label: "Processing" },
        ready: { bg: "var(--c-success-soft)", fg: "var(--c-success)", label: "Ready" },
        ready_for_pickup: { bg: "var(--c-success-soft)", fg: "var(--c-success)", label: "Ready" },
        out_for_delivery: { bg: "var(--c-info-soft)", fg: "var(--c-cyan)", label: "Out for delivery" },
        delivered: { bg: "var(--c-success-soft)", fg: "var(--c-success)", label: "Delivered" },
        cancelled: { bg: "var(--c-error-soft)", fg: "var(--c-error)", label: "Cancelled" },
    };
    const typeMeta = (t?: string) => t === "pickup_store" ? { c: "var(--c-text-3)", l: "Shop" }
        : t === "delivery_home" ? { c: "var(--c-success)", l: "Delivery" }
            : { c: "var(--c-violet)", l: "Pickup" };

    const alerts = [
        { title: "Overdue orders", sub: "Past scheduled window", count: fin.pendingCount, ref: "c-warning", soft: "c-warning-soft", icon: <Clock size={15} />, to: "/orders?filter=overdue" },
        { title: "Unpaid invoices", sub: `${formatAmount(fin.due)} outstanding`, count: fin.unpaidCount, ref: "c-error", soft: "c-error-soft", icon: <FileWarning size={15} />, to: "/orders?filter=unpaid" },
        { title: "Online orders", sub: "From public page", count: fin.onlineOrdersCount, ref: "c-info", soft: "c-info-soft", icon: <Package size={15} />, to: "/orders" },
    ];

    const channels = [
        { label: "Store Pickup", count: stats.storePickupOrders, color: "var(--c-primary)" },
        { label: "Home Pickup", count: stats.homePickupOrders, color: "var(--c-violet)" },
        { label: "Home Delivery", count: stats.homeDeliveryOrders, color: "var(--c-success)" },
        { label: "Online", count: fin.onlineOrdersCount, color: "var(--c-info)" },
    ];
    const chMax = Math.max(1, ...channels.map((c) => c.count));

    const th: CSSProperties = { textAlign: "left", padding: "8px 14px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-text-3)", borderBottom: "1px solid var(--c-border)" };

    return (
        <div style={{ color: "var(--c-text)", fontSize: 14, lineHeight: 1.45, padding: "20px 22px 40px" }}>

            {/* ===== Quick Scan & Search ===== */}
            <div style={{ ...card, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 20px", borderBottom: "1px solid var(--c-border)" }}>
                    <ChipIcon soft="c-primary-soft" refColor="c-primary"><Search size={17} /></ChipIcon>
                    <div><div style={{ fontSize: 14, fontWeight: 600 }}>Quick Scan &amp; Search</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>Find an order or customer</div></div>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); navigate(searchQ.trim() ? `/orders?search=${encodeURIComponent(searchQ.trim())}` : "/orders"); }}
                    style={{ padding: "16px 20px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
                        <Search size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                        <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search orders, customers…"
                            style={{ width: "100%", font: "inherit", fontSize: 14, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 9, padding: "11px 13px 11px 38px", outline: "none" }} />
                    </div>
                    <button type="submit" style={btnPrimary}><Search size={16} />Search</button>
                    <button type="button" onClick={() => navigate("/scan")} style={btnOutline}><ScanLine size={16} />Scan Order</button>
                </form>
            </div>

            {/* ===== KPI ROW ===== */}
            <div className="lb-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 16 }}>
                {kpis.map((k) => (
                    <div key={k.label} style={{ ...card, padding: "15px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <ChipIcon soft={k.soft} refColor={k.ref}>{k.icon}</ChipIcon>
                            <span style={{ fontSize: 11.5, color: "var(--c-text-3)", fontWeight: 500 }}>{k.label}</span>
                        </div>
                        <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 25, letterSpacing: "-.02em", marginTop: 11 }}>{k.value}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 11.5 }}>
                            <span style={{ fontWeight: 600, color: `var(--${k.deltaRef})` }}>{k.delta}</span>
                            {k.sub && <span style={{ color: "var(--c-text-3)" }}>{k.sub}</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* ===== Revenue + Pipeline ===== */}
            <div className="lb-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <div style={{ ...card, flex: 1.7, minWidth: 0, padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
                        <div><div style={{ fontSize: 14, fontWeight: 600 }}>Revenue</div><div style={{ fontSize: 12, color: "var(--c-text-3)" }}>Last 14 days</div></div>
                        <div style={{ marginLeft: "auto", textAlign: "right" }}>
                            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 20 }}>{formatAmount(seriesTotal)}</div>
                            <div style={{ fontSize: 11.5, color: `var(--${trendRef(stats.revenueTrend)})`, fontWeight: 600 }}>{trendStr(stats.revenueTrend)} vs prior</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 180, fontFamily: MONO, fontSize: 10, color: "var(--c-text-3)", textAlign: "right", paddingBottom: 18 }}>
                            <span>{(seriesMax / 1000).toFixed(1)}k</span><span>{((seriesMax * 0.66) / 1000).toFixed(1)}k</span><span>{((seriesMax * 0.33) / 1000).toFixed(1)}k</span><span>0</span>
                        </div>
                        <div style={{ flex: 1, position: "relative" }}>
                            <div style={{ position: "absolute", inset: "0 0 18px 0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                {[0, 1, 2, 3].map((i) => <span key={i} style={{ borderTop: "1px dashed var(--c-border)" }} />)}
                            </div>
                            <div role="img" aria-label="Daily revenue, last 14 days" style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 6, height: 180 }}>
                                {series.map((b, i) => {
                                    const today = i === series.length - 1;
                                    return (
                                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 6 }}>
                                            <div style={{ width: "100%", maxWidth: 22, height: `${Math.max(1, (b.value / seriesMax) * 100)}%`, background: today ? "var(--c-primary)" : "var(--c-primary-tint)", borderRadius: "4px 4px 0 0" }} />
                                            <span style={{ fontFamily: MONO, fontSize: 9.5, color: today ? "var(--c-text)" : "var(--c-text-3)" }}>{b.day}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{ ...card, flex: 1, minWidth: 0, padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
                        <div><div style={{ fontSize: 14, fontWeight: 600 }}>Order pipeline</div><div style={{ fontSize: 12, color: "var(--c-text-3)" }}>Live across stages</div></div>
                        <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 700, fontSize: 20 }}>{pipeTotal}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                        {pipeline.map((p) => (
                            <div key={p.label}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color }} />
                                    <span style={{ fontSize: 12.5, color: "var(--c-text-2)" }}>{p.label}</span>
                                    <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 600, fontSize: 13 }}>{p.count}</span>
                                </div>
                                <Bar w={`${(p.count / pipeMax) * 100}%`} color={p.color} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ===== Store Health + Revenue Analytics ===== */}
            <div className="lb-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <div style={{ ...card, flex: 1, minWidth: 0, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 20px", borderBottom: "1px solid var(--c-border)" }}>
                        <ChipIcon soft="c-success-soft" refColor="c-success"><Activity size={17} /></ChipIcon>
                        <div><div style={{ fontSize: 14, fontWeight: 600 }}>Store Health</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>Operational performance · last 30 days</div></div>
                        {health.overdueCount > 0 && (
                            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--c-error)", background: "var(--c-error-soft)", padding: "4px 10px", borderRadius: 20 }}>
                                <AlertTriangle size={13} />{health.overdueCount} overdue
                            </span>
                        )}
                    </div>
                    <div style={{ padding: "18px 20px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 18 }}>
                            <div style={{ position: "relative", width: 120, height: 120, borderRadius: "50%", background: healthRing, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ width: 90, height: 90, borderRadius: "50%", background: "var(--c-surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30, letterSpacing: "-.02em" }}>{health.score ?? "—"}</div>
                                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".08em", color: "var(--c-text-3)" }}>SCORE</div>
                                </div>
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: `var(--${healthStatus.ref})`, background: "var(--c-success-soft)", padding: "4px 13px", borderRadius: 20 }}>{healthStatus.label}</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px", paddingTop: 16, borderTop: "1px solid var(--c-border)" }}>
                            {healthMetrics.map(({ label, m }) => {
                                const ref = metricTone(m.value);
                                return (
                                    <div key={label}>
                                        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 5 }}>
                                            <span style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</span>
                                            <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 700, fontSize: 13, color: `var(--${ref})` }}>{m.value == null ? "—" : `${m.value}%`}</span>
                                        </div>
                                        <Bar w={`${m.value ?? 0}%`} color={`var(--${ref})`} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", padding: "13px 20px", borderTop: "1px solid var(--c-border)", fontSize: 12, color: "var(--c-text-3)" }}>
                        <span>{health.activeCount} active orders on schedule</span>
                        <a onClick={() => navigate("/reports")} style={linkStyle}>View reports <ArrowRight size={13} /></a>
                    </div>
                </div>

                <div style={{ ...card, flex: 1, minWidth: 0, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 20px", borderBottom: "1px solid var(--c-border)" }}>
                        <ChipIcon soft="c-primary-soft" refColor="c-primary"><TrendingUp size={17} /></ChipIcon>
                        <div><div style={{ fontSize: 14, fontWeight: 600 }}>Revenue Analytics</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>This month overview</div></div>
                    </div>
                    <div style={{ padding: "18px 20px" }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)", display: "flex", alignItems: "center", marginBottom: 9 }}>
                            <span>Collection progress</span>
                            <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 700, fontSize: 14, color: "var(--c-success)" }}>{collectionPct}%</span>
                        </div>
                        <div style={{ height: 9, background: "var(--c-error)", borderRadius: 6, overflow: "hidden", marginBottom: 9 }}>
                            <div style={{ height: "100%", width: `${collectionPct}%`, background: "var(--c-success)", borderRadius: 6 }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", fontSize: 11.5, marginBottom: 18 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--c-text-2)" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--c-success)" }} />{formatAmount(collected)} collected</span>
                            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--c-text-2)" }}>{formatAmount(uncollected)} pending<span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--c-error)" }} /></span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 11, paddingTop: 16, borderTop: "1px solid var(--c-border)" }}>
                            {pnl.map((r) => (
                                <div key={r.label} style={{ display: "flex", alignItems: "center", fontSize: 13 }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--c-text-2)" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: `var(--${r.ref})` }} />{r.label}</span>
                                    <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 600 }}>{r.value}</span>
                                </div>
                            ))}
                            <div style={{ display: "flex", alignItems: "center", paddingTop: 11, borderTop: "1px solid var(--c-border)", fontSize: 14 }}>
                                <span style={{ fontWeight: 700 }}>Net Profit</span>
                                <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 700, fontSize: 15, color: netProfit >= 0 ? "var(--c-success)" : "var(--c-error)" }}>{formatAmount(netProfit)}</span>
                            </div>
                        </div>
                        <div style={{ textAlign: "center", marginTop: 16 }}>
                            <a onClick={() => navigate("/reports")} style={{ ...linkStyle, marginLeft: 0 }}>View Full Reports <ArrowRight size={13} /></a>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== Recent activity + side ===== */}
            <div className="lb-row" style={{ display: "flex", gap: 16 }}>
                <div style={{ ...card, flex: 1.7, minWidth: 0, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid var(--c-border)" }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>Recent activity</div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", padding: "2px 8px", borderRadius: 20 }}>{recentOrders.length}</span>
                        <a onClick={() => navigate("/orders")} style={{ ...linkStyle, fontSize: 12.5 }}>View all</a>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ background: "var(--c-surface-2)" }}>
                                {["Time", "Order", "Customer", "Type", "Payment", "Status"].map((h) => <th key={h} style={th}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {recentOrders.slice(0, 6).map((o) => {
                                    const st = ST[o.status] || { bg: "var(--c-surface-2)", fg: "var(--c-text-2)", label: o.status };
                                    const tm = typeMeta(o.deliveryType);
                                    const paid = o.total > 0 && o.balance <= 0;
                                    return (
                                        <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)} style={{ borderBottom: "1px solid var(--c-border)", cursor: "pointer" }}>
                                            <td style={{ padding: "9px 14px", fontFamily: MONO, fontWeight: 500 }}>{format(o.createdAt, "HH:mm")}</td>
                                            <td style={{ padding: "9px 14px", fontFamily: MONO, color: "var(--c-text-2)" }}>#{o.publicId}</td>
                                            <td style={{ padding: "9px 14px", fontWeight: 500 }}>{o.customerName}</td>
                                            <td style={{ padding: "9px 14px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: tm.c }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: tm.c }} />{tm.l}</span></td>
                                            <td style={{ padding: "9px 14px" }}><span style={{ fontSize: 11.5, fontWeight: 600, color: paid ? "var(--c-success)" : "var(--c-error)" }}>{paid ? "Paid" : "Unpaid"}</span></td>
                                            <td style={{ padding: "9px 20px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: st.bg, color: st.fg }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: st.fg }} />{st.label}</span></td>
                                        </tr>
                                    );
                                })}
                                {recentOrders.length === 0 && <tr><td colSpan={6} style={{ padding: 28, textAlign: "center", color: "var(--c-text-3)" }}>No recent orders</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ ...card, padding: "16px 18px" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 13 }}>Needs attention</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                            {alerts.map((a) => (
                                <a key={a.title} onClick={() => navigate(a.to)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 11px", borderRadius: 9, textDecoration: "none", background: `var(--${a.soft})`, cursor: "pointer" }}>
                                    <span style={{ width: 28, height: 28, flex: "none", borderRadius: 7, background: "var(--c-surface)", color: `var(--${a.ref})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{a.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-text)" }}>{a.title}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{a.sub}</div></div>
                                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15, color: `var(--${a.ref})` }}>{a.count}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                    <div style={{ ...card, padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>Order channels</div>
                            <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--c-text-3)" }}>today</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                            {channels.map((s) => (
                                <div key={s.label}>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                                        <span style={{ fontSize: 12.5, color: "var(--c-text-2)" }}>{s.label}</span>
                                        <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 600, fontSize: 12.5 }}>{s.count}</span>
                                    </div>
                                    <Bar w={`${(s.count / chMax) * 100}%`} color={s.color} />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ ...card, padding: "16px 18px" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Staff attendance</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, textAlign: "center" }}>
                            {[
                                { n: staffAttendance.presentToday, l: "Present", ref: "c-success", soft: "c-success-soft" },
                                { n: staffAttendance.absentToday, l: "Absent", ref: "c-error", soft: "c-error-soft" },
                                { n: staffAttendance.onLeaveToday, l: "Leave", ref: "c-warning", soft: "c-warning-soft" },
                            ].map((x) => (
                                <div key={x.l} style={{ borderRadius: 9, padding: "11px 6px", background: `var(--${x.soft})` }}>
                                    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, color: `var(--${x.ref})` }}>{x.n}</div>
                                    <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: `var(--${x.ref})` }}>{x.l}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", textAlign: "center", marginTop: 10 }}>Total staff: <b style={{ color: "var(--c-text)" }}>{staffAttendance.totalStaff}</b></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ===== helpers ===== */
const btnPrimary: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 14, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "11px 22px", boxShadow: "var(--sh-sm)" };
const btnOutline: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-surface)", border: "1px solid var(--c-primary)", borderRadius: 9, padding: "11px 22px" };
const linkStyle: CSSProperties = { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--c-primary)", textDecoration: "none", cursor: "pointer" };

function ChipIcon({ children, soft, refColor }: { children: ReactNode; soft: string; refColor: string }) {
    return <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${soft})`, color: `var(--${refColor})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>;
}
function Bar({ w, color }: { w: string; color: string }) {
    return <div style={{ height: 6, background: "var(--c-surface-2)", borderRadius: 6, overflow: "hidden" }}><div style={{ height: "100%", width: w, background: color, borderRadius: 6 }} /></div>;
}
