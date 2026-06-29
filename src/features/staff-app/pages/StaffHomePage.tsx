/**
 * Staff Home — built to the Enterprise Laundry CRM design system (--c-* tokens, IBM Plex Mono),
 * mirroring the owner Dashboard's visual language but operations-focused for staff:
 * Quick actions/search · KPI tiles · Recent activity · Order pipeline.
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/hooks/use-dashboard";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useCurrency } from "@/hooks/use-currency";
import { useTranslation } from "react-i18next";
import { LPageLoader, LEmptyState } from "@/components/laundry";
import {
    Search, ScanLine, DollarSign, PackageCheck, Clock, Users, ShoppingBag,
    PlusCircle, ClipboardList, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const card: CSSProperties = {
    background: "var(--c-surface)", border: "1px solid var(--c-border)",
    borderRadius: 12, boxShadow: "var(--sh-sm)",
};

export function StaffHomePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { formatAmount } = useCurrency();
    const { stats, recentOrders = [], loading, error } = useDashboard();
    const showLoading = useMinLoading(loading, { minDuration: 800 });

    const [searchQ, setSearchQ] = useState("");

    if (showLoading) return <div className="h-full"><LPageLoader variant="machine" message={t('common.loading')} /></div>;
    if (error) return (
        <div className="p-8">
            <LEmptyState
                icon={<AlertTriangle className="h-8 w-8" />}
                title={t('common.error', 'Error loading dashboard')}
                description={error}
                action={{ label: t('common.retry', 'Retry'), onClick: () => window.location.reload() }}
            />
        </div>
    );

    const trendStr = (n: number) => (n > 0 ? `▲ ${n}%` : n < 0 ? `▼ ${Math.abs(n)}%` : "—");
    const trendRef = (n: number) => (n >= 0 ? "c-success" : "c-error");

    const kpis = [
        { label: t('dashboard.todaysOrders', "Orders today"), value: String(stats.todayOrders), ref: "c-primary", soft: "c-primary-soft", icon: <ShoppingBag size={15} />, delta: trendStr(stats.ordersTrend), deltaRef: trendRef(stats.ordersTrend), sub: t('dashboard.vsYesterday', "vs yesterday"), to: "/staff/orders" },
        { label: t('dashboard.todaysRevenue', "Revenue today"), value: formatAmount(stats.todayRevenue), ref: "c-success", soft: "c-success-soft", icon: <DollarSign size={15} />, delta: trendStr(stats.revenueTrend), deltaRef: trendRef(stats.revenueTrend), sub: t('dashboard.vsPrior', "vs prior"), to: undefined },
        { label: t('dashboard.readyForPickup', "Ready for pickup"), value: String(stats.readyOrders), ref: "c-info", soft: "c-info-soft", icon: <PackageCheck size={15} />, delta: "● live", deltaRef: "c-info", sub: t('dashboard.inQueue', "in queue"), to: "/staff/orders?status=ready" },
        { label: t('dashboard.pending', "Pending"), value: String(stats.pendingOrders), ref: "c-warning", soft: "c-warning-soft", icon: <Clock size={15} />, delta: t('dashboard.needsAction', "needs action"), deltaRef: "c-warning", sub: "", to: "/staff/orders?status=pending" },
        { label: t('dashboard.activeCustomers', "Customers"), value: String(stats.totalCustomers), ref: "c-violet", soft: "c-violet-soft", icon: <Users size={15} />, delta: (stats.newCustomersToday ?? 0) > 0 ? `+${stats.newCustomersToday}` : "—", deltaRef: "c-success", sub: t('dashboard.newToday', "new today"), to: "/staff/customers" },
    ];

    const pipeline = [
        { label: t('dashboard.received', "Received"), count: stats.pendingOrders, color: "var(--c-text-3)", to: "/staff/orders?status=pending" },
        { label: t('dashboard.processing', "Processing"), count: stats.processingOrders, color: "var(--c-info)", to: "/staff/orders?status=processing" },
        { label: t('dashboard.ready', "Ready"), count: stats.readyOrders, color: "var(--c-success)", to: "/staff/orders?status=ready" },
        { label: t('dashboard.outForDelivery', "Out for delivery"), count: stats.outForDeliveryOrders, color: "var(--c-cyan)", to: "/staff/orders?status=out_for_delivery" },
    ];
    const pipeTotal = pipeline.reduce((s, p) => s + p.count, 0);
    const pipeMax = Math.max(1, ...pipeline.map((p) => p.count));

    const ST: Record<string, { bg: string; fg: string; label: string }> = {
        pending: { bg: "var(--c-warning-soft)", fg: "var(--c-warning)", label: t('dashboard.pending', "Pending") },
        processing: { bg: "var(--c-info-soft)", fg: "var(--c-info)", label: t('dashboard.processing', "Processing") },
        ready: { bg: "var(--c-success-soft)", fg: "var(--c-success)", label: t('dashboard.ready', "Ready") },
        ready_for_pickup: { bg: "var(--c-success-soft)", fg: "var(--c-success)", label: t('dashboard.ready', "Ready") },
        out_for_delivery: { bg: "var(--c-info-soft)", fg: "var(--c-cyan)", label: t('dashboard.outForDelivery', "Out for delivery") },
        delivered: { bg: "var(--c-success-soft)", fg: "var(--c-success)", label: t('orders.status.delivered', "Delivered") },
        cancelled: { bg: "var(--c-error-soft)", fg: "var(--c-error)", label: t('orders.status.cancelled', "Cancelled") },
    };
    const typeMeta = (ty?: string) => ty === "pickup_store" ? { c: "var(--c-text-3)", l: t('dashboard.shop', "Shop") }
        : ty === "delivery_home" ? { c: "var(--c-success)", l: t('dashboard.delivery', "Delivery") }
            : { c: "var(--c-violet)", l: t('dashboard.pickup', "Pickup") };

    const th: CSSProperties = { textAlign: "left", padding: "8px 14px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-text-3)", borderBottom: "1px solid var(--c-border)" };

    return (
        <div style={{ color: "var(--c-text)", fontSize: 14, lineHeight: 1.45, padding: "20px 22px 40px" }}>

            {/* ===== Quick actions & search ===== */}
            <div style={{ ...card, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 20px", borderBottom: "1px solid var(--c-border)" }}>
                    <ChipIcon soft="c-primary-soft" refColor="c-primary"><Search size={17} /></ChipIcon>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{t('dashboard.quickActions', 'Quick actions')}</div>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{t('dashboard.findOrCreate', 'Find an order or start a new one')}</div>
                    </div>
                </div>
                <form
                    onSubmit={(e) => { e.preventDefault(); navigate(searchQ.trim() ? `/staff/orders?search=${encodeURIComponent(searchQ.trim())}` : "/staff/orders"); }}
                    style={{ padding: "16px 20px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}
                >
                    <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
                        <Search size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                        <input
                            value={searchQ}
                            onChange={(e) => setSearchQ(e.target.value)}
                            placeholder={t('dashboard.searchOrdersCustomers', 'Search orders, customers…')}
                            style={{ width: "100%", font: "inherit", fontSize: 14, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 9, padding: "11px 13px 11px 38px", outline: "none" }}
                        />
                    </div>
                    <button type="button" onClick={() => navigate("/staff/orders/new")} style={btnPrimary}><PlusCircle size={16} />{t('dashboard.newOrder', 'New Order')}</button>
                    <button type="button" onClick={() => navigate("/staff/orders")} style={btnOutline}><ClipboardList size={16} />{t('dashboard.viewOrders', 'View Orders')}</button>
                    <button type="button" onClick={() => navigate("/staff/scan")} style={btnOutline}><ScanLine size={16} />{t('common.scan', 'Scan')}</button>
                </form>
            </div>

            {/* ===== KPI ROW ===== */}
            <div className="lb-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 16 }}>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 11.5 }}>
                            <span style={{ fontWeight: 600, color: `var(--${k.deltaRef})` }}>{k.delta}</span>
                            {k.sub && <span style={{ color: "var(--c-text-3)" }}>{k.sub}</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* ===== Recent activity + Pipeline ===== */}
            <div className="lb-row" style={{ display: "flex", gap: 16 }}>
                {/* Recent activity */}
                <div style={{ ...card, flex: 1.7, minWidth: 0, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid var(--c-border)" }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{t('dashboard.recentActivity', 'Recent activity')}</div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", padding: "2px 8px", borderRadius: 20 }}>{recentOrders.length}</span>
                        <a onClick={() => navigate("/staff/orders")} style={{ ...linkStyle, fontSize: 12.5 }}>{t('common.viewAll', 'View all')}</a>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ background: "var(--c-surface-2)" }}>
                                {[t('dashboard.time', "Time"), t('dashboard.order', "Order"), t('common.customer', "Customer"), t('dashboard.type', "Type"), t('dashboard.payment', "Payment"), t('common.status', "Status")].map((h) => <th key={h} style={th}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {recentOrders.slice(0, 7).map((o: any) => {
                                    const st = ST[o.status] || { bg: "var(--c-surface-2)", fg: "var(--c-text-2)", label: o.status };
                                    const tm = typeMeta(o.deliveryType);
                                    const paid = o.total > 0 && o.balance <= 0;
                                    return (
                                        <tr key={o.id} onClick={() => navigate(`/staff/orders/${o.id}`)} style={{ borderBottom: "1px solid var(--c-border)", cursor: "pointer" }}>
                                            <td style={{ padding: "9px 14px", fontFamily: MONO, fontWeight: 500 }}>{o.createdAt ? format(o.createdAt, "HH:mm") : "—"}</td>
                                            <td style={{ padding: "9px 14px", fontFamily: MONO, color: "var(--c-text-2)" }}>#{o.publicId}</td>
                                            <td style={{ padding: "9px 14px", fontWeight: 500 }}>{o.customerName}</td>
                                            <td style={{ padding: "9px 14px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: tm.c }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: tm.c }} />{tm.l}</span></td>
                                            <td style={{ padding: "9px 14px" }}><span style={{ fontSize: 11.5, fontWeight: 600, color: paid ? "var(--c-success)" : "var(--c-error)" }}>{paid ? t('dashboard.paid', "Paid") : t('dashboard.unpaid', "Unpaid")}</span></td>
                                            <td style={{ padding: "9px 20px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: st.bg, color: st.fg }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: st.fg }} />{st.label}</span></td>
                                        </tr>
                                    );
                                })}
                                {recentOrders.length === 0 && <tr><td colSpan={6} style={{ padding: 28, textAlign: "center", color: "var(--c-text-3)" }}>{t('orders.empty', 'No recent orders')}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Order pipeline */}
                <div style={{ ...card, flex: 1, minWidth: 0, padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{t('dashboard.orderPipeline', 'Order pipeline')}</div>
                            <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t('dashboard.liveAcrossStages', 'Live across stages')}</div>
                        </div>
                        <span style={{ marginLeft: "auto", fontFamily: MONO, fontWeight: 700, fontSize: 20 }}>{pipeTotal}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                        {pipeline.map((p) => (
                            <div key={p.label} onClick={() => navigate(p.to)} style={{ cursor: "pointer" }}>
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
        </div>
    );
}

/* ===== helpers (shared design-system primitives) ===== */
const btnPrimary: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 14, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "11px 18px", boxShadow: "var(--sh-sm)" };
const btnOutline: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-surface)", border: "1px solid var(--c-primary)", borderRadius: 9, padding: "11px 18px" };
const linkStyle: CSSProperties = { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--c-primary)", textDecoration: "none", cursor: "pointer" };

function ChipIcon({ children, soft, refColor }: { children: ReactNode; soft: string; refColor: string }) {
    return <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${soft})`, color: `var(--${refColor})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>;
}
function Bar({ w, color }: { w: string; color: string }) {
    return <div style={{ height: 6, background: "var(--c-surface-2)", borderRadius: 6, overflow: "hidden" }}><div style={{ height: "100%", width: w, background: color, borderRadius: 6 }} /></div>;
}
