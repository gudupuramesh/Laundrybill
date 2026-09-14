/**
 * Dashboard — the owner's morning screen, built to the approved concept:
 * search bar · five KPI tiles · Needs attention · Pipeline · Recent orders (with
 * Collect / Print / WhatsApp row actions) on the left; 30-day collected-vs-revenue,
 * payment mix, top services and Team on the right. Every number is live data;
 * every tile deep-links into the filtered list behind it.
 */

import { useState, useEffect, useRef, useContext, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { useDashboard } from "@/hooks/use-dashboard";
import { useDashboardInsights } from "@/hooks/use-dashboard-insights";
import { useShopSubscription } from "@/hooks/use-shop-subscription";
import { useOrderSummary } from "@/hooks/use-order-summary";
import { useSeenOnlineOrders as _unused, SeenOnlineOrdersContext } from "@/hooks/use-seen-online-orders";
import { useCurrency } from "@/hooks/use-currency";
import { useShop } from "@/hooks/use-shop";
import { LPageLoader, LEmptyState } from "@/components/laundry";
import { AppDownloadBanner } from "@/components/AppDownloadBanner";
import { MobileDashboard } from "./MobileDashboard";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOrderRowActions } from "@/features/orders/useOrderRowActions";
import {
    Search, ScanLine, CalendarDays, Bell, ChevronRight, Clock, CalendarClock, Globe, CreditCard,
    Banknote, Wallet, ReceiptText, ClipboardList, ShoppingBag, Printer, MessageCircle,
    AlertTriangle, ArrowRight, Package, Users, X,
} from "lucide-react";
import { format, isToday, isTomorrow, isYesterday } from "date-fns";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import type { Order } from "@/types/order";

void _unused; // the context is what this page consumes; the hook itself lives in AppLayout

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
// Reference palette — scoped to this page via CSS custom properties so every
// var(--c-*) below re-skins without touching the rest of the app.
// Design-system tokens (src/styles/ds.css, design/laundrybill-design-system.html).
// PAL mirrors the sheet for the few places that need a literal (tile fills, chart
// strokes); everything else reads var(--c-*) which SKIN bridges onto the --ds-* vars.
const PAL = {
    bg: "#F5F7FA", border: "#E5E7EB", text: "#111827", text2: "#6B7280", text3: "#9CA3AF", surface2: "#F3F4F6",
    blue: "#2563EB", blueSoft: "#EEF2FF", green: "#059669", greenText: "#047857", greenSoft: "#D1FAE5",
    orange: "#EA580C", amber: "#F59E0B", amberText: "#B45309", amberSoft: "#FEF3C7",
    violet: "#7C3AED", violetText: "#6D28D9", violetSoft: "#EDE9FE", red: "#EF4444", redText: "#B91C1C", redSoft: "#FEE2E2",
    sky: "#3B82F6", skySoft: "#DBEAFE", teal: "#10B981", tealSoft: "#D1FAE5",
    positive: "#15803D", dueToday: "#C2410C", whatsapp: "#15803D",
    donut: { upi: "#8B5CF6", cash: "#10B981", card: "#3B82F6", other: "#F97316" },
};
const SKIN = {
    "--c-border": "var(--ds-border)", "--c-text": "var(--ds-text)", "--c-text-2": "var(--ds-text-2)", "--c-text-3": "var(--ds-text-3)", "--c-surface": "var(--ds-card)", "--c-surface-2": "var(--ds-muted-surface)",
    "--c-primary": "var(--ds-blue)", "--c-primary-soft": "var(--ds-blue-soft)", "--c-success": "var(--ds-st-ready)", "--c-success-soft": "var(--ds-st-ready-bg)",
    "--c-warning": "var(--ds-st-pending)", "--c-warning-soft": "var(--ds-st-pending-bg)", "--c-error": "var(--ds-negative)", "--c-error-soft": "var(--ds-st-overdue-bg)",
    "--c-violet": "var(--ds-st-out)", "--c-violet-soft": "var(--ds-st-out-bg)", "--c-info": "var(--ds-st-processing)", "--c-info-soft": "var(--ds-st-processing-bg)",
    "--sh-sm": "var(--ds-shadow)",
} as unknown as CSSProperties;
const NUM: CSSProperties = { fontVariantNumeric: "tabular-nums" };
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, boxShadow: "var(--sh-sm)" };
const cardHead: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 0" };
const h2: CSSProperties = { fontSize: 15, fontWeight: 700, letterSpacing: "-.01em" };
const muted: CSSProperties = { fontSize: 12.5, color: "var(--c-text-3)" };
const linkStyle: CSSProperties = { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--c-primary)", textDecoration: "none", cursor: "pointer" };

const METHOD_COLOR: Record<string, string> = { upi: PAL.donut.upi, cash: PAL.donut.cash, card: PAL.donut.card };
const methodColor = (m: string) => METHOD_COLOR[m] || PAL.donut.other;
const methodLabel = (m: string) => m === "upi" ? "UPI" : m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, " ");

export function DashboardPage() {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { shopId, user, role } = useAuth();
    const { shop } = useShop();
    const { stats, recentOrders, staffAttendance, loading, error } = useDashboard();
    const insights = useDashboardInsights(30);
    const { subscription } = useShopSubscription();
    const planExpired = String(subscription?.status || "").toLowerCase() === "expired";
    const fin = useOrderSummary();
    const { formatAmount, currencySymbol } = useCurrency();
    const { unseenCount } = useContext(SeenOnlineOrdersContext);
    const { printOrder, whatsappOrder } = useOrderRowActions();

    const [searchQ, setSearchQ] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);

    // Expired-plan card: small, bottom-right, dismissable for this session. Stacks
    // above the app-download promo when that banner is on screen too.
    const [expiredOpen, setExpiredOpen] = useState<boolean>(() => { try { return sessionStorage.getItem("lb-expired-dismissed") !== "1"; } catch { return true; } });
    const [dockBottom, setDockBottom] = useState(24);
    useEffect(() => {
        const place = () => {
            const promo = document.getElementById("lb-app-download-banner");
            setDockBottom(promo ? Math.round(promo.getBoundingClientRect().height) + 36 : 24);
        };
        place();
        const id = window.setInterval(place, 1500); // the promo self-dismisses; keep the card docked
        window.addEventListener("resize", place);
        return () => { window.clearInterval(id); window.removeEventListener("resize", place); };
    }, []);

    // ── Quick-search dropdown: live order + customer matches ──
    interface QsCustomer { id: string; name: string; phone: string; email?: string }
    interface QsOrder { id: string; publicId: string; customerName: string; status: string; total: number }
    const [dq, setDq] = useState("");
    const [drop, setDrop] = useState<{ customers: QsCustomer[]; orders: QsOrder[] } | null>(null);
    const [dropOpen, setDropOpen] = useState(false);
    const custCacheRef = useRef<QsCustomer[] | null>(null);

    useEffect(() => {
        const id = window.setTimeout(() => setDq(searchQ), 250);
        return () => window.clearTimeout(id);
    }, [searchQ]);

    useEffect(() => {
        const raw = dq.trim();
        const term = raw.toLowerCase();
        if (isMobile || !term || !shopId) { setDrop(null); return; }
        let dead = false;
        (async () => {
            try {
                if (!custCacheRef.current) {
                    const snap = await getDocs(query(collection(db, "shops", shopId, "customers"), limit(1000)));
                    custCacheRef.current = snap.docs.map((d) => {
                        const c = d.data() as { name?: string; phone?: string; email?: string };
                        return { id: d.id, name: c.name || "", phone: c.phone || "", email: c.email || "" };
                    });
                }
                const customers = custCacheRef.current.filter((c) =>
                    c.name.toLowerCase().includes(term) || c.phone.includes(raw) || (c.email || "").toLowerCase().includes(term)
                ).slice(0, 5);
                const up = raw.toUpperCase();
                const idSnap = await getDocs(query(
                    collection(db, "shops", shopId, "orders"),
                    where("publicId", ">=", up), where("publicId", "<=", up + ""), limit(5),
                ));
                const byId = idSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Order[];
                const byRecent = recentOrders.filter((o) =>
                    o.publicId?.toLowerCase().includes(term) || o.customerName?.toLowerCase().includes(term) || o.customerPhone?.includes(raw));
                const seen = new Set<string>();
                const orders = [...byId, ...byRecent]
                    .filter((o) => !seen.has(o.id) && !!seen.add(o.id))
                    .slice(0, 5)
                    .map((o) => ({ id: o.id, publicId: o.publicId, customerName: o.customerName, status: o.status, total: ("financials" in o ? o.financials?.total : o.total) || 0 }));
                if (!dead) { setDrop({ customers, orders }); setDropOpen(true); }
            } catch { if (!dead) setDrop(null); }
        })();
        return () => { dead = true; };
    }, [dq, shopId, isMobile, recentOrders]);

    // ⌘K / Ctrl+K focuses the search — the hint in the field promises it.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    if (isMobile) return <MobileDashboard />;
    if (loading) return <div className="h-full"><LPageLoader variant="machine" message="Loading dashboard…" /></div>;
    if (error) return (
        <div className="p-8"><LEmptyState icon={<AlertTriangle className="h-8 w-8" />} title="Error loading dashboard" description={error} action={{ label: "Retry", onClick: () => window.location.reload() }} /></div>
    );

    // ── derived ──
    const trend = (n: number | null) => n == null
        ? <span style={{ color: "var(--c-text-3)" }}>—</span>
        : <span style={{ color: n >= 0 ? PAL.positive : "var(--ds-negative)", fontWeight: 700 }}>{n >= 0 ? "↑" : "↓"} {Math.abs(n)}%</span>;

    const mixToday = ["cash", "upi", "card"].map((m) => ({ method: m, amount: stats.todayCollectedByMethod[m] || 0 }));
    const otherToday = Object.entries(stats.todayCollectedByMethod).filter(([m]) => !["cash", "upi", "card"].includes(m)).reduce((s, [, v]) => s + v, 0);
    if (otherToday > 0) mixToday.push({ method: "other", amount: otherToday });
    const mixTodayTotal = Math.max(1, mixToday.reduce((s, x) => s + x.amount, 0));

    const kpis: { label: string; value: string; icon: ReactNode; tint: string; soft: string; foot: ReactNode; to: string }[] = [
        { label: "Today's revenue", value: formatAmount(stats.todayRevenue), icon: <Banknote size={18} />, tint: PAL.blue, soft: PAL.blueSoft, foot: <><span style={muted}>vs yesterday</span>{trend(stats.revenueTrend)}</>, to: "/orders?period=today" },
        { label: "Collected today", value: formatAmount(stats.todayCollected), icon: <Wallet size={18} />, tint: PAL.green, soft: PAL.greenSoft, to: "/orders?attention=collected",
          foot: (
            <div style={{ width: "100%" }}>
                <div style={{ display: "flex", height: 5, borderRadius: 5, overflow: "hidden", background: "var(--c-surface-2)", gap: 2 }}>
                    {mixToday.map((m) => <span key={m.method} style={{ width: `${(m.amount / mixTodayTotal) * 100}%`, background: methodColor(m.method) }} />)}
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                    {mixToday.map((m) => (
                        <span key={m.method} style={{ display: "inline-flex", flexDirection: "column", gap: 1, fontSize: 11.5, ...NUM }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--c-text-2)" }}><i style={{ width: 6, height: 6, borderRadius: 3, background: methodColor(m.method) }} />{methodLabel(m.method)}</span>
                            <b style={{ color: "var(--c-text)" }}>{formatAmount(m.amount)}</b>
                        </span>
                    ))}
                </div>
            </div>
          ) },
        { label: "Outstanding", value: formatAmount(stats.outstandingAmount), icon: <ReceiptText size={18} />, tint: PAL.orange, soft: PAL.amberSoft, foot: <><span style={muted}>from {stats.outstandingOrders} orders</span><ChevronRight size={14} style={{ marginLeft: "auto", color: "var(--c-text-3)" }} /></>, to: "/orders?attention=due" },
        { label: "Orders today", value: String(stats.todayOrders), icon: <ClipboardList size={18} />, tint: PAL.violet, soft: PAL.violetSoft, foot: <><span style={muted}>vs yesterday</span>{trend(stats.ordersTrend)}</>, to: "/orders?period=today" },
        { label: "Ready to hand over", value: String(stats.readyOrders), icon: <ShoppingBag size={18} />, tint: PAL.sky, soft: PAL.skySoft, foot: <><span style={muted}>waiting for the customer</span></>, to: "/orders?status=ready" },
    ];

    const attention = [
        { count: fin.pendingCount, label: "overdue", icon: <Clock size={18} />, tint: PAL.red, soft: PAL.redSoft, to: "/orders?attention=overdue" },
        { count: stats.dueTodayCount, label: "due today", icon: <CalendarClock size={18} />, tint: PAL.amber, soft: PAL.amberSoft, to: "/orders?period=today&attention=due" },
        { count: fin.onlineOrdersCount, label: "online booking to confirm", icon: <Globe size={18} />, tint: PAL.sky, soft: PAL.skySoft, to: "/orders?source=online" },
        { count: stats.readyUnpaidCount, label: "ready & unpaid", icon: <CreditCard size={18} />, tint: PAL.teal, soft: PAL.tealSoft, to: "/orders?status=ready&attention=due" },
    ];

    const STAGE_META: Record<string, { label: string; status: string }> = {
        placed: { label: "Placed", status: "pending" }, processing: { label: "Processing", status: "processing" },
        ready: { label: "Ready", status: "ready" }, out: { label: "Out for delivery", status: "out_for_delivery" }, delivered: { label: "Delivered", status: "delivered" },
    };
    const stageMax = Math.max(1, ...stats.stages.map((s) => s.count));

    const ST: Record<string, { bg: string; fg: string; label: string }> = {
        pending: { bg: "var(--c-warning-soft)", fg: "var(--c-warning)", label: "Pending" },
        pickup_scheduled: { bg: "var(--c-violet-soft)", fg: "var(--c-violet)", label: "Pickup scheduled" },
        pickup_completed: { bg: "var(--c-violet-soft)", fg: "var(--c-violet)", label: "Picked up" },
        processing: { bg: "var(--c-info-soft)", fg: "var(--c-info)", label: "Processing" },
        ready: { bg: "var(--c-success-soft)", fg: "var(--c-success)", label: "Ready" },
        ready_for_pickup: { bg: "var(--c-success-soft)", fg: "var(--c-success)", label: "Ready" },
        out_for_delivery: { bg: "var(--ds-st-out-bg)", fg: "var(--ds-st-out)", label: "Out for delivery" },
        delivered: { bg: "var(--ds-st-delivered-bg)", fg: "var(--ds-st-delivered)", label: "Delivered" },
        picked_up: { bg: "var(--c-surface-2)", fg: "var(--c-text-2)", label: "Collected" },
        partially_delivered: { bg: "var(--c-info-soft)", fg: "var(--c-info)", label: "Partly delivered" },
        cancelled: { bg: "var(--c-error-soft)", fg: "var(--c-error)", label: "Cancelled" },
    };
    const ACTIVE = new Set(["pending", "pickup_scheduled", "pickup_completed", "processing", "ready", "ready_for_pickup", "out_for_delivery"]);
    const dueText = (d: Date | null, status: string) => {
        if (!d) return { text: "—", late: false };
        const late = ACTIVE.has(status) && d.getTime() < Date.now();
        if (isToday(d)) return { text: `Today, ${format(d, "h:mm a")}`, late };
        if (isTomorrow(d)) return { text: `Tomorrow, ${format(d, "h:mm a")}`, late: false };
        if (isYesterday(d)) return { text: `Yesterday, ${format(d, "h:mm a")}`, late };
        return { text: format(d, "d MMM, h:mm a"), late };
    };
    const payChip = (o: { total: number; amountPaid: number; balance: number }) => {
        const bal = Math.max(0, o.balance ?? (o.total - o.amountPaid));
        if (o.total > 0 && bal <= 0) return { label: "Paid", bg: "var(--c-success-soft)", fg: "var(--c-success)" };
        if (o.amountPaid > 0) return { label: "Partial", bg: "var(--c-warning-soft)", fg: "var(--c-warning)" };
        return { label: "Unpaid", bg: "var(--c-error-soft)", fg: "var(--c-error)" };
    };

    const mixTotal = Math.max(1, insights.paymentMix.reduce((s, x) => s + x.amount, 0));
    const svcMax = Math.max(1, ...insights.topServices.map((s) => s.orders));
    const svcTotal = Math.max(1, insights.topServices.reduce((s, x) => s + x.orders, 0));
    const roleLabel = role === "admin" ? "Owner" : role === "manager" ? "Manager" : "Staff";
    const initials = (user?.displayName || shop?.name || "?").trim().charAt(0).toUpperCase();

    const th: CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 500, color: "var(--c-text-2)", background: "var(--ds-table-head)", borderBottom: "1px solid var(--c-border)", whiteSpace: "nowrap" };
    const td: CSSProperties = { padding: "11px 12px", verticalAlign: "middle", borderBottom: "1px solid var(--c-border)", whiteSpace: "nowrap" };
    const ell: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
    const actBtn: CSSProperties = { cursor: "pointer", font: "inherit", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 9.5, fontWeight: 600, color: "var(--c-primary)", background: "#fff", border: "1px solid var(--c-border)", borderRadius: 8, padding: "5px 7px", minWidth: 50 };
    const chip = (bg: string, fg: string, label: string) => <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: bg, color: fg, whiteSpace: "nowrap" }}>{label}</span>;

    return (
        <div className="lb-ds" style={{ ...SKIN, color: "var(--c-text)", background: "var(--ds-bg)", minHeight: "100%", fontSize: 14, lineHeight: 1.45, padding: "18px 22px 40px", ...NUM }}>
            <style>{`
                .db-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-bottom:16px}
                .db-main{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(300px,1fr);gap:16px;align-items:start}
                .db-col{display:flex;flex-direction:column;gap:16px;min-width:0}
                .db-att{display:grid;grid-template-columns:repeat(4,1fr)}
                .db-pipe{display:grid;grid-template-columns:repeat(5,1fr)}
                .db-row:hover{background:var(--ds-row-hover)}
                .db-top input::placeholder{color:var(--ds-text-3)}
                .db-act:hover{background:var(--c-primary-soft);border-color:var(--c-primary)}
                @media (max-width:1380px){.db-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
                @media (max-width:1180px){.db-main{grid-template-columns:1fr}}
                @media (max-width:900px){.db-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.db-att,.db-pipe{grid-template-columns:repeat(2,1fr)}}
            `}</style>
            <AppDownloadBanner />

            {/* ===== Top bar: white band with a hairline, like the reference ===== */}
            <div className="db-top" style={{ display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 5, margin: "-18px -22px 18px", padding: "12px 22px", background: "var(--ds-card)", borderBottom: "1px solid var(--ds-border)" }}>
                <form onSubmit={(e) => { e.preventDefault(); navigate(searchQ.trim() ? `/orders?search=${encodeURIComponent(searchQ.trim())}` : "/orders"); }}
                    style={{ flex: 1, minWidth: 260, position: "relative" }}>
                    <Search size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                    <input ref={searchRef} value={searchQ} placeholder="Order number, phone or scan a tag"
                        onChange={(e) => { setSearchQ(e.target.value); if (!e.target.value.trim()) setDropOpen(false); }}
                        onFocus={() => { if (drop) setDropOpen(true); }}
                        onBlur={() => window.setTimeout(() => setDropOpen(false), 150)}
                        onKeyDown={(e) => { if (e.key === "Escape") setDropOpen(false); }}
                        style={{ width: "100%", font: "inherit", fontSize: 14.5, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "13px 92px 13px 42px", outline: "none", boxShadow: "var(--sh-sm)" }} />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "inline-flex", gap: 6 }}>
                        <kbd style={{ font: "inherit", fontSize: 11, color: "var(--c-text-3)", border: "1px solid var(--c-border)", borderRadius: 6, padding: "2px 6px", background: "var(--c-surface-2)" }}>⌘ K</kbd>
                        <button type="button" onClick={() => navigate("/scan")} title="Scan a tag" style={{ cursor: "pointer", font: "inherit", border: 0, background: "transparent", color: "var(--c-primary)", display: "inline-flex", alignItems: "center", padding: 2 }}><ScanLine size={17} /></button>
                    </span>
                    {dropOpen && drop && searchQ.trim() && (
                        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 60, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-lg, 0 12px 32px rgba(15,23,42,.16))", overflow: "hidden auto", maxHeight: 400 }}>
                            <style>{`.lb-qsrow { display: flex; align-items: center; gap: 11px; width: 100%; padding: 10px 14px; border: 0; background: transparent; cursor: pointer; font: inherit; text-align: left; } .lb-qsrow:hover { background: var(--c-surface-2); }`}</style>
                            {drop.orders.length > 0 && (<>
                                <div style={{ padding: "9px 14px 3px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px", color: "var(--c-text-3)" }}>ORDERS</div>
                                {drop.orders.map((o) => (
                                    <button key={o.id} type="button" className="lb-qsrow" onMouseDown={() => navigate(`/orders/${o.id}`)}>
                                        <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Package size={15} /></span>
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ display: "block", fontSize: 13, fontWeight: 600, fontFamily: MONO }}>#{o.publicId}</span>
                                            <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customerName}</span>
                                        </span>
                                        <span style={{ flex: "none", fontSize: 11, fontWeight: 600, color: "var(--c-text-2)", textTransform: "capitalize" }}>{o.status.replace(/_/g, " ")}</span>
                                        <span style={{ flex: "none", fontSize: 12.5, fontWeight: 700 }}>{formatAmount(o.total)}</span>
                                    </button>
                                ))}
                            </>)}
                            {drop.customers.length > 0 && (<>
                                <div style={{ padding: "9px 14px 3px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px", color: "var(--c-text-3)", borderTop: drop.orders.length ? "1px solid var(--c-border)" : "none" }}>CUSTOMERS</div>
                                {drop.customers.map((c) => (
                                    <button key={c.id} type="button" className="lb-qsrow" onMouseDown={() => navigate(`/customers/${c.id}`)}>
                                        <span style={{ width: 30, height: 30, flex: "none", borderRadius: 15, background: "var(--c-info-soft)", color: "var(--c-info)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700 }}>{(c.name || "?").charAt(0).toUpperCase()}</span>
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                                            <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-3)" }}>{c.phone || c.email}</span>
                                        </span>
                                    </button>
                                ))}
                            </>)}
                            {drop.orders.length === 0 && drop.customers.length === 0 && (
                                <div style={{ padding: 14, fontSize: 12.5, color: "var(--c-text-3)" }}>No matches — press Enter to search all orders</div>
                            )}
                            <button type="button" className="lb-qsrow" style={{ borderTop: "1px solid var(--c-border)", color: "var(--c-primary)", fontSize: 12.5, fontWeight: 600 }}
                                onMouseDown={() => navigate(`/orders?search=${encodeURIComponent(searchQ.trim())}`)}>
                                <ArrowRight size={14} />See all orders matching “{searchQ.trim()}”
                            </button>
                        </div>
                    )}
                </form>
                <button type="button" onClick={() => navigate("/reports")} title="Other periods live in Reports"
                    style={{ cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "12px 16px", display: "inline-flex", alignItems: "center", gap: 9, boxShadow: "var(--sh-sm)" }}>
                    <CalendarDays size={17} style={{ color: "var(--c-primary)" }} />Today<span style={{ color: "var(--c-text-3)", fontWeight: 500 }}>· {format(new Date(), "d MMM")}</span>
                </button>
                <button type="button" onClick={() => navigate("/orders?source=online")} title="Online bookings you haven't opened yet"
                    style={{ cursor: "pointer", font: "inherit", position: "relative", width: 46, height: 46, borderRadius: 12, border: "1px solid var(--c-border)", background: "var(--c-surface)", color: "var(--c-text-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--sh-sm)" }}>
                    <Bell size={18} />
                    {unseenCount > 0 && <span style={{ position: "absolute", top: -6, right: -6, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 10, background: "var(--c-primary)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--c-surface)" }}>{unseenCount}</span>}
                </button>
                <button type="button" onClick={() => navigate("/settings")} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 10, border: 0, background: "transparent", padding: 0, textAlign: "left" }}>
                    {user?.photoURL
                        ? <img src={user.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover" }} />
                        : <span style={{ width: 40, height: 40, borderRadius: 20, background: "var(--c-primary)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{initials}</span>}
                    <span style={{ lineHeight: 1.2 }}>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--c-text)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.displayName || shop?.name || "Account"}</span>
                        <span style={{ display: "block", fontSize: 12, color: "var(--c-text-3)" }}>{roleLabel}</span>
                    </span>
                    <ChevronRight size={15} style={{ color: "var(--c-text-3)", transform: "rotate(90deg)" }} />
                </button>
            </div>

            {planExpired && expiredOpen && (
                <div role="status" style={{ position: "fixed", right: 24, bottom: dockBottom, zIndex: 46, width: 320, background: "var(--ds-card)", border: "1px solid #FECACA", borderRadius: 14, boxShadow: "0 10px 30px rgba(16,24,40,.12)", padding: "14px 14px 12px", fontSize: 12.5, color: "var(--c-text-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 32, height: 32, flex: "none", borderRadius: 16, background: "var(--ds-st-overdue-bg)", color: "var(--ds-negative)", display: "flex", alignItems: "center", justifyContent: "center" }}><AlertTriangle size={16} /></span>
                        <b style={{ fontSize: 13.5, color: "var(--ds-negative)" }}>Subscription expired</b>
                        <button aria-label="Dismiss" onClick={() => { setExpiredOpen(false); try { sessionStorage.setItem("lb-expired-dismissed", "1"); } catch { /* ignore */ } }}
                            style={{ marginLeft: "auto", cursor: "pointer", border: 0, background: "transparent", color: "var(--c-text-3)", padding: 4, display: "inline-flex" }}><X size={15} /></button>
                    </div>
                    <div style={{ marginTop: 8, lineHeight: 1.45 }}>Your shop is on the Free plan — 10 orders a month, no team logins. Renew to get everything back.</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                        <button onClick={() => navigate("/settings/subscription")} style={{ cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 700, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 9, padding: "8px 14px" }}>Renew plan</button>
                        <button onClick={() => { setExpiredOpen(false); try { sessionStorage.setItem("lb-expired-dismissed", "1"); } catch { /* ignore */ } }} style={{ cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, color: "var(--c-text-2)", background: "transparent", border: 0, padding: "8px 4px" }}>Later</button>
                    </div>
                </div>
            )}

            {/* ===== KPI tiles ===== */}
            <div className="db-kpis">
                {kpis.map((k) => (
                    <div key={k.label} role="button" tabIndex={0} onClick={() => navigate(k.to)} onKeyDown={(e) => { if (e.key === "Enter") navigate(k.to); }}
                        style={{ ...card, padding: "16px 18px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 12, minHeight: 132 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ width: 42, height: 42, flex: "none", borderRadius: 11, background: k.tint, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--sh-sm)" }}>{k.icon}</span>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: "var(--c-text-2)", whiteSpace: "nowrap" }}>{k.label}</div>
                                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.15, marginTop: 2 }}>{k.value}</div>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginTop: "auto" }}>{k.foot}</div>
                    </div>
                ))}
            </div>

            <div className="db-main">
                {/* ===== LEFT ===== */}
                <div className="db-col">
                    {/* Needs attention */}
                    <div style={{ ...card, overflow: "hidden" }}>
                        <div style={cardHead}><span style={h2}>Needs attention</span></div>
                        <div className="db-att" style={{ padding: "12px 10px 14px" }}>
                            {attention.map((a, i) => (
                                <button key={a.label} type="button" onClick={() => navigate(a.to)}
                                    style={{ cursor: "pointer", font: "inherit", textAlign: "left", background: "transparent", border: 0, borderLeft: i ? "1px solid var(--c-border)" : 0, padding: "8px 12px", display: "flex", alignItems: "center", gap: 12, color: "var(--c-text)" }}>
                                    <span style={{ width: 40, height: 40, flex: "none", borderRadius: 20, background: a.soft, color: a.tint, display: "flex", alignItems: "center", justifyContent: "center" }}>{a.icon}</span>
                                    <span style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
                                        <span style={{ display: "block", fontSize: 20, fontWeight: 700, letterSpacing: "-.02em" }}>{a.count}</span>
                                        <span style={{ display: "block", fontSize: 12, color: "var(--c-text-2)" }}>{a.label}</span>
                                    </span>
                                    <ChevronRight size={16} style={{ color: "var(--c-text-3)", flex: "none" }} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Pipeline */}
                    <div style={{ ...card, overflow: "hidden" }}>
                        <div className="db-pipe">
                            {stats.stages.map((s, i) => {
                                const m = STAGE_META[s.key];
                                const barColor = s.key === "delivered" ? "var(--c-text-3)" : "var(--c-primary)";
                                return (
                                    <button key={s.key} type="button" onClick={() => navigate(`/orders?status=${m.status}`)}
                                        style={{ cursor: "pointer", font: "inherit", textAlign: "left", background: "transparent", border: 0, borderLeft: i ? "1px solid var(--c-border)" : 0, padding: "16px 14px", color: "var(--c-text)", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--c-text-2)", whiteSpace: "nowrap" }}>{m.label}<ChevronRight size={15} style={{ marginLeft: "auto", flex: "none", color: "var(--c-text-3)" }} /></span>
                                        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.1 }}>{s.count}</span>
                                        <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>orders</span>
                                        <span style={{ display: "block", height: 5, borderRadius: 5, background: "var(--c-surface-2)", overflow: "hidden", marginTop: 8 }}><span style={{ display: "block", height: "100%", width: `${(s.count / stageMax) * 100}%`, background: barColor, borderRadius: 5 }} /></span>
                                        <span style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>{formatAmount(s.amount)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Recent orders */}
                    <div style={{ ...card, overflow: "hidden" }}>
                        <div style={{ ...cardHead, paddingBottom: 12 }}>
                            <span style={h2}>Recent orders</span>
                            <a onClick={() => navigate("/orders")} style={linkStyle}>View all orders <ArrowRight size={13} /></a>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                <thead><tr>{["Order", "Customer", "Items", "Status", "Payment", "Due", "Actions"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                                <tbody>
                                    {recentOrders.slice(0, 6).map((o) => {
                                        const st = ST[o.status] || { bg: "var(--c-surface-2)", fg: "var(--c-text-2)", label: o.status.replace(/_/g, " ") };
                                        const pc = payChip(o);
                                        const due = dueText(o.due, o.status);
                                        return (
                                            <tr key={o.id} className="db-row" onClick={() => navigate(`/orders/${o.id}`)} style={{ cursor: "pointer" }}>
                                                <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>{o.publicId}</td>
                                                <td style={{ ...td, maxWidth: 150 }}><div style={{ fontWeight: 600, ...ell }}>{o.customerName || "Walk-in"}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)", ...ell }}>{o.customerPhone}</div></td>
                                                <td style={{ ...td, maxWidth: 170 }} title={o.itemsSummary}><div style={{ fontWeight: 500, ...ell }}>{o.itemsSummary || `${o.itemCount} items`}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)", ...ell }}>{o.serviceSummary}</div></td>
                                                <td style={td}>{chip(st.bg, st.fg, st.label)}</td>
                                                <td style={td}>{chip(pc.bg, pc.fg, pc.label)}</td>
                                                <td style={{ ...td, fontSize: 12.5, color: due.late ? "var(--ds-negative)" : due.text.startsWith("Today") ? "var(--ds-due-today)" : "var(--c-text-2)", fontWeight: due.late || due.text.startsWith("Today") ? 600 : 400 }}>{due.text}</td>
                                                <td style={{ ...td, paddingRight: 14 }} onClick={(e) => e.stopPropagation()}>
                                                    <span style={{ display: "inline-flex", gap: 5 }}>
                                                        <button type="button" className="db-act" style={actBtn} title="Collect payment" onClick={() => navigate(`/orders/${o.id}`)}><Wallet size={16} />Collect</button>
                                                        <button type="button" className="db-act" style={actBtn} title="Print bill" onClick={() => printOrder(o.id)}><Printer size={16} />Print</button>
                                                        <button type="button" className="db-act" style={{ ...actBtn, color: "var(--ds-whatsapp)" }} title="Send on WhatsApp" onClick={() => whatsappOrder(o.id)}><MessageCircle size={16} />WhatsApp</button>
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {recentOrders.length === 0 && <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "var(--c-text-3)" }}>No orders yet — take the first one from New Order.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ===== RIGHT ===== */}
                <div className="db-col">
                    {/* 30-day chart */}
                    <div style={{ ...card, padding: "16px 18px 10px" }}>
                        <div style={h2}>Last 30 days — collected vs revenue</div>
                        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "var(--c-text-2)", flexWrap: "wrap" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 14, height: 2, background: "var(--c-primary)" }} />Revenue <b style={{ color: "var(--c-text)" }}>{formatAmount(insights.revenueTotal)}</b></span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 14, height: 0, borderTop: "2px dashed var(--c-primary)" }} />Collected <b style={{ color: "var(--c-text)" }}>{formatAmount(insights.collectedTotal)}</b></span>
                        </div>
                        <div style={{ height: 190, marginTop: 8 }}>
                            {insights.loading ? <div style={{ ...muted, paddingTop: 70, textAlign: "center" }}>Loading…</div> : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={insights.series} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                                        <CartesianGrid vertical={false} stroke="var(--c-border)" strokeDasharray="3 3" />
                                        <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "var(--c-text-3)" }} tickLine={false} axisLine={false} interval={6} />
                                        <YAxis tick={{ fontSize: 10.5, fill: "var(--c-text-3)" }} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => `${currencySymbol}${v >= 1000 ? `${Math.round(v / 1000)}K` : v}`} />
                                        <Tooltip formatter={(v) => formatAmount(Number(v))} contentStyle={{ borderRadius: 10, border: "1px solid var(--c-border)", fontSize: 12 }} />
                                        <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--c-primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="collected" name="Collected" stroke="var(--c-primary)" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Payment mix */}
                    <div style={{ ...card, padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center" }}><span style={h2}>Payment mix</span><span style={{ ...muted, marginLeft: "auto" }}>Last 30 days</span></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 10 }}>
                            <div style={{ width: 118, height: 118, flex: "none" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={insights.paymentMix.length ? insights.paymentMix : [{ method: "none", amount: 1 }]} dataKey="amount" nameKey="method" innerRadius={38} outerRadius={56} paddingAngle={2} stroke="none">
                                            {(insights.paymentMix.length ? insights.paymentMix : [{ method: "none", amount: 1 }]).map((m) => <Cell key={m.method} fill={m.method === "none" ? "var(--c-surface-2)" : methodColor(m.method)} />)}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, fontSize: 13 }}>
                                {insights.paymentMix.length === 0 && <span style={muted}>No payments in the last 30 days.</span>}
                                {insights.paymentMix.map((m) => (
                                    <div key={m.method} style={{ display: "grid", gridTemplateColumns: "1fr 44px auto", alignItems: "center", gap: 10 }}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--c-text-2)" }}><i style={{ width: 8, height: 8, borderRadius: 4, background: methodColor(m.method) }} />{methodLabel(m.method)}</span>
                                        <span style={{ color: "var(--c-text-3)", textAlign: "right" }}>{Math.round((m.amount / mixTotal) * 100)}%</span>
                                        <b>{formatAmount(m.amount)}</b>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Top services */}
                    <div style={{ ...card, padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center" }}><span style={h2}>Top services</span><span style={{ ...muted, marginLeft: "auto" }}>Last 30 days</span></div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 12 }}>
                            {insights.topServices.length === 0 && <span style={muted}>No orders in the last 30 days.</span>}
                            {insights.topServices.map((s) => (
                                <div key={s.name} style={{ display: "grid", gridTemplateColumns: "104px 1fr auto auto", alignItems: "center", gap: 10, fontSize: 13 }}>
                                    <span style={{ color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                                    <span style={{ height: 8, borderRadius: 4, background: "var(--c-surface-2)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(s.orders / svcMax) * 100}%`, background: "var(--c-primary)", borderRadius: 4 }} /></span>
                                    <b style={{ minWidth: 40, textAlign: "right" }}>{s.orders}</b>
                                    <span style={{ color: "var(--c-text-3)", fontSize: 12, minWidth: 40, textAlign: "right" }}>({Math.round((s.orders / svcTotal) * 100)}%)</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Team */}
                    <div style={{ ...card, padding: "16px 18px" }}>
                        <div style={h2}>Team</div>
                        <div style={{ ...muted, marginTop: 3 }}>
                            {insights.agents.length} {insights.agents.length === 1 ? "agent" : "agents"} on route · Plant: {stats.processingOrders} processing, {stats.readyOrders} ready
                            {staffAttendance.totalStaff > 0 && <> · {staffAttendance.presentToday}/{staffAttendance.totalStaff} present</>}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                            {insights.agents.slice(0, 3).map((a) => (
                                <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 12, border: "1px solid var(--c-border)", background: "var(--c-surface-2)", minWidth: 150 }}>
                                    <span style={{ width: 32, height: 32, borderRadius: 16, background: a.name === "Unassigned" ? PAL.text3 : PAL.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{a.name.charAt(0).toUpperCase()}</span>
                                    <span style={{ lineHeight: 1.25 }}>
                                        <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{a.name}</span>
                                        {a.name === "Unassigned" ? <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-3)" }}>no agent assigned</span> : <span style={{ display: "block", fontSize: 11.5, color: "var(--c-success)" }}>● On route</span>}
                                        <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-3)" }}>{a.stops} {a.stops === 1 ? "stop" : "stops"} left</span>
                                    </span>
                                </div>
                            ))}
                            {[{ l: "Placed", n: stats.stages[0]?.count ?? 0 }, { l: "Processing", n: stats.processingOrders }, { l: "Ready", n: stats.readyOrders }].map((q) => (
                                <button key={q.l} type="button" onClick={() => navigate(`/orders?status=${q.l === "Placed" ? "pending" : q.l.toLowerCase()}`)}
                                    style={{ cursor: "pointer", font: "inherit", textAlign: "left", flex: "1 1 80px", padding: "9px 12px", borderRadius: 12, border: "1px solid var(--c-border)", background: "var(--c-surface)", color: "var(--c-text)" }}>
                                    <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-3)" }}>{q.l}</span>
                                    <span style={{ display: "block", fontSize: 22, fontWeight: 700, color: "var(--c-primary)", letterSpacing: "-.02em" }}>{q.n}</span>
                                    <span style={{ display: "block", fontSize: 11, color: "var(--c-text-3)" }}>orders</span>
                                </button>
                            ))}
                        </div>
                        <a onClick={() => navigate("/manage-staff")} style={{ ...linkStyle, marginLeft: 0, marginTop: 14 }}><Users size={14} />View full team activity <ArrowRight size={13} /></a>
                    </div>
                </div>
            </div>
        </div>
    );
}
