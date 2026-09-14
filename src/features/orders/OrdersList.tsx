/**
 * Orders List — 1000% to the design system (Order Management.dc.html):
 * header (title + count + search + Filters + New Order) · status pipeline tabs ·
 * full-width table (Order · Customer · Type · Status · Payment · Total · Updated) ·
 * infinite scroll. Wired to useOrdersPaginated + filter sheet + online-seen.
 */

import { useState, useEffect, useRef, useMemo, useContext, type CSSProperties } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { SeenOnlineOrdersContext } from "@/hooks/use-seen-online-orders";
import { LEmptyState, LSpinner } from "@/components/laundry";
import { MRow, MHeader, MIconBtn, MSearch } from "@/components/laundry/LMobileRows";
import { MobileOrders } from "./MobileOrders";
import { useOrdersPaginated, upcomingAt, type OrderSourceFilter } from "@/hooks/use-orders-paginated";
import { useCurrency } from "@/hooks/use-currency";
import type { Order, OrderStatus, DeliveryType } from "@/types/order";
import { mapLegacyDeliveryType, STATUS_LABELS } from "@/types/order";
import { ClipboardList, Search, ListFilter, SlidersHorizontal, AlertTriangle, Plus, Globe, ClockAlert, Wallet, CalendarClock, ScanLine, CalendarDays, ShoppingBag, CircleAlert, Printer, MessageCircle, Store, Home, Truck } from "lucide-react";
import { useDashboard } from "@/hooks/use-dashboard";
import { useOrderRowActions } from "./useOrderRowActions";
import { isToday, isTomorrow, isYesterday, format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { OrderFilterSheet } from "./OrderFilterSheet";
import { ExportDataButton } from "@/components/ExportDataButton";
import { exportOrders } from "@/lib/data-export";

const MONO = "'IBM Plex Mono'";
const NUM: CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** Status chip colours — the design-system tokens (design/laundrybill-design-system.html). */
const CHIP: Record<string, { bg: string; fg: string }> = {
    pending: { bg: "var(--ds-st-pending-bg)", fg: "var(--ds-st-pending)" },
    pickup_scheduled: { bg: "var(--ds-st-out-bg)", fg: "var(--ds-st-out)" },
    pickup_completed: { bg: "var(--ds-st-out-bg)", fg: "var(--ds-st-out)" },
    processing: { bg: "var(--ds-st-processing-bg)", fg: "var(--ds-st-processing)" },
    ready: { bg: "var(--ds-st-ready-bg)", fg: "var(--ds-st-ready)" },
    ready_for_pickup: { bg: "var(--ds-st-ready-bg)", fg: "var(--ds-st-ready)" },
    out_for_delivery: { bg: "var(--ds-st-out-bg)", fg: "var(--ds-st-out)" },
    delivered: { bg: "var(--ds-st-delivered-bg)", fg: "var(--ds-st-delivered)" },
    picked_up: { bg: "var(--ds-st-delivered-bg)", fg: "var(--ds-st-delivered)" },
    partially_delivered: { bg: "var(--ds-st-processing-bg)", fg: "var(--ds-st-processing)" },
    cancelled: { bg: "var(--ds-st-overdue-bg)", fg: "var(--ds-st-overdue)" },
};
const ACT: CSSProperties = { cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9, padding: 0 };
const ACTIVE_STATUSES = new Set(["pending", "pickup_scheduled", "pickup_completed", "processing", "ready", "ready_for_pickup", "out_for_delivery"]);
const TYPE_ICON: Record<DeliveryType, typeof Store> = { pickup_store: Store, pickup_home: Home, delivery_home: Truck };

/** "Today, 7:00 PM" · "Yesterday, 9:00 PM" — with a late flag for active orders. */
function dueInfo(order: Order): { text: string; late: boolean; today: boolean } {
    const ts = order.deliveryType === "pickup_home" && ["pending", "pickup_scheduled"].includes(order.status)
        ? order.scheduledPickupDate : order.expectedDelivery;
    const d = ts?.toDate?.();
    if (!d) return { text: "—", late: false, today: false };
    const late = ACTIVE_STATUSES.has(order.status) && d.getTime() < Date.now();
    const time = format(d, "h:mm a");
    if (isToday(d)) return { text: `Today, ${time}`, late, today: true };
    if (isTomorrow(d)) return { text: `Tomorrow, ${time}`, late: false, today: false };
    if (isYesterday(d)) return { text: `Yesterday, ${time}`, late, today: false };
    return { text: `${format(d, "d MMM")}, ${time}`, late, today: false };
}

/** "3 Shirts, 2 Pants" + the dominant service line under it. */
function itemsSummary(order: Order): { line: string; service: string } {
    const items = order.items || [];
    const line = items.slice(0, 2).map((i) => `${i.quantity || 1} ${i.serviceName || "item"}`).join(", ") + (items.length > 2 ? ` +${items.length - 2} more` : "");
    const cats = new Map<string, number>();
    items.forEach((i) => { const c = i.categoryName || ""; if (c) cats.set(c, (cats.get(c) || 0) + 1); });
    return { line: line || `${items.length} items`, service: [...cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "" };
}

/**
 * "Pickup Fri 31 Jul · 9–11 AM" for work booked on a FUTURE day (null for
 * today/past, so only genuinely-scheduled orders get the badge).
 */
function scheduledLabel(order: Order): string | null {
    const at = upcomingAt(order);
    if (!at) return null;
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    if (at.getTime() <= end.getTime()) return null;

    const awaitingPickup =
        order.deliveryType === "pickup_home" && ["pending", "pickup_scheduled"].includes(order.status);
    const slot = awaitingPickup ? order.scheduledPickupTime : order.deliverySlot;
    const day = at.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    return `${awaitingPickup ? "Pickup" : "Delivery"} ${day}${slot ? ` · ${slot}` : ""}`;
}
const AV = ["c-primary", "c-info", "c-violet", "c-cyan", "c-success", "c-warning"];

// app status → DS tint
const STATUS_TINT: Record<OrderStatus, string> = {
    pending: "c-slate",
    processing: "c-info",
    ready: "c-primary",
    ready_for_pickup: "c-primary",
    out_for_delivery: "c-cyan",
    picked_up: "c-success",
    delivered: "c-success",
    pickup_scheduled: "c-warning",
    pickup_completed: "c-violet",
    partially_delivered: "c-warning",
    cancelled: "c-error",
};
const TYPE_TINT: Record<DeliveryType, string> = { delivery_home: "c-success", pickup_store: "c-info", pickup_home: "c-violet" };

// pipeline tabs (DS look) mapped to the app's real statuses
const TABS: { key: OrderStatus | "all"; label: string; dot: string }[] = [
    { key: "all", label: "All", dot: "c-text-3" },
    { key: "pending", label: "Placed", dot: "c-slate" },
    { key: "processing", label: "Processing", dot: "c-info" },
    { key: "ready", label: "Ready", dot: "c-primary" },
    { key: "out_for_delivery", label: "Out for delivery", dot: "c-cyan" },
    { key: "partially_delivered", label: "Partial", dot: "c-warning" },
    { key: "delivered", label: "Delivered", dot: "c-success" },
    { key: "cancelled", label: "Cancelled", dot: "c-error" },
];


interface OrdersListProps {
    selectedId?: string | null;
    onSelect?: (orderId: string) => void;
}

export function OrdersList({ selectedId, onSelect }: OrdersListProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const location = useLocation();
    const { markSeen } = useContext(SeenOnlineOrdersContext);
    const { formatAmount } = useCurrency();
    const { stats } = useDashboard();
    const { printOrder, whatsappOrder } = useOrderRowActions();

    const basePath = location.pathname.startsWith("/staff") ? "/staff/orders" : "/orders";
    // The owner portal's POS lives at /new-order — /orders/new only exists for staff.
    const newOrderPath = location.pathname.startsWith("/staff") ? "/staff/orders/new" : "/new-order";

    const [selectedDeliveryType, setSelectedDeliveryType] = useState<DeliveryType | "all">("all");
    const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "all">("all");
    const [selectedOrderSource, setSelectedOrderSource] = useState<OrderSourceFilter>("all");
    const [selectedServiceId, setSelectedServiceId] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [specialFilter, setSpecialFilter] = useState<"pending_overdue" | "payment_due" | "scheduled_upcoming" | "collected_today" | null>(null);
    // "all" | "today" | "week" | "month" | "lastMonth" | "sixMonths" | "year" | "year:YYYY" | "custom"
    const [period, setPeriod] = useState<string>("all");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const [searchParams, setSearchParams] = useSearchParams();

    // Creation-date range for the period selector (Today / This Week / This Month / Last Month).
    const { dateStart, dateEnd } = useMemo(() => {
        const now = new Date();
        if (period === "today") { const s = new Date(now); s.setHours(0, 0, 0, 0); return { dateStart: s, dateEnd: null as Date | null }; }
        if (period === "week") { const s = new Date(now); s.setDate(s.getDate() - s.getDay()); s.setHours(0, 0, 0, 0); return { dateStart: s, dateEnd: null as Date | null }; }
        if (period === "month") return { dateStart: new Date(now.getFullYear(), now.getMonth(), 1), dateEnd: null as Date | null };
        if (period === "lastMonth") return { dateStart: new Date(now.getFullYear(), now.getMonth() - 1, 1), dateEnd: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, -1) };
        if (period === "sixMonths") return { dateStart: new Date(now.getFullYear(), now.getMonth() - 5, 1), dateEnd: null as Date | null };
        if (period === "year") return { dateStart: new Date(now.getFullYear(), 0, 1), dateEnd: null as Date | null };
        if (period.startsWith("year:")) {
            const y = Number(period.slice(5));
            return { dateStart: new Date(y, 0, 1), dateEnd: new Date(y, 11, 31, 23, 59, 59, 999) };
        }
        if (period === "custom") return {
            dateStart: customFrom ? new Date(customFrom + "T00:00:00") : null,
            dateEnd: customTo ? new Date(customTo + "T23:59:59.999") : null,
        };
        return { dateStart: null as Date | null, dateEnd: null as Date | null };
    }, [period, customFrom, customTo]);

    // Deep-link filters (?attention=overdue|due|scheduled — used by reminder push
    // notifications and the dashboard's "Scheduled ahead" card)
    useEffect(() => {
        const attention = searchParams.get("attention");
        if (attention === "overdue") setSpecialFilter("pending_overdue");
        else if (attention === "due") setSpecialFilter("payment_due");
        else if (attention === "scheduled") setSpecialFilter("scheduled_upcoming");
        else if (attention === "collected") setSpecialFilter("collected_today");
        // ?period= — the dashboard's Revenue/Orders today tiles.
        const periodParam = searchParams.get("period");
        if (periodParam && ["today", "week", "month", "lastMonth", "sixMonths", "year"].includes(periodParam)) setPeriod(periodParam);
        // ?search= from the dashboard quick-search: prefill the list's search box.
        const search = searchParams.get("search");
        if (search) setSearchQuery(search);
        // ?source=online — the dashboard's "Online orders" tile.
        const source = searchParams.get("source");
        if (source === "online" || source === "pos") setSelectedOrderSource(source);
        // ?status= — the dashboard's pipeline rows and "Ready for pickup" KPI.
        const status = searchParams.get("status");
        if (status && ["pending", "processing", "ready", "out_for_delivery", "delivered", "picked_up", "cancelled"].includes(status)) {
            setSelectedStatus(status as OrderStatus);
        }
        if (attention || search || source || status || periodParam) setSearchParams({}, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const { orders, loading, loadingMore, hasMore, loadMore } = useOrdersPaginated({
        status: specialFilter ? "all" : selectedStatus,
        // Type + source COMBINE with the special views (Unpaid + Online etc.);
        // only status is exclusive with them.
        deliveryType: selectedDeliveryType,
        orderSource: selectedOrderSource,
        searchTerm: searchQuery,
        specialFilter,
        // Period chip combines with the special views too: "This Month" + Due
        // shows only that month's unpaid orders (the hook range-filters them).
        dateStart,
        dateEnd,
    });

    const handleFilterApply = (
        type: DeliveryType | "all",
        status: OrderStatus | "all",
        newSpecialFilter: "pending_overdue" | "payment_due" | "scheduled_upcoming" | "collected_today" | null = null,
        orderSource: OrderSourceFilter = "all",
        serviceId: string = "all"
    ) => {
        // Special views COMBINE with type/source/service (Unpaid + Online etc.);
        // only status is exclusive — the special views own their status logic.
        setSpecialFilter(newSpecialFilter);
        setSelectedDeliveryType(type);
        setSelectedOrderSource(orderSource);
        setSelectedServiceId(serviceId);
        setSelectedStatus(newSpecialFilter ? "all" : status);
    };

    // mark online order as seen on open
    useEffect(() => {
        if (!selectedId || !markSeen) return;
        const sel = orders.find((o) => o.id === selectedId);
        if (sel?.orderSource === "online") markSeen(selectedId);
    }, [selectedId, orders, markSeen]);

    const activeFiltersCount = (selectedDeliveryType !== "all" ? 1 : 0) + (selectedOrderSource !== "all" ? 1 : 0) + (selectedServiceId !== "all" ? 1 : 0) + (specialFilter ? 1 : 0);

    // infinite scroll
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (loading) return;
        observerRef.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !loadingMore) loadMore();
        }, { threshold: 0.1 });
        if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
        return () => observerRef.current?.disconnect();
    }, [loading, hasMore, loadingMore, loadMore]);

    // Service-type filter (category) is client-side (order items are an array — not queryable server-side).
    const visibleOrders = useMemo(() => {
        if (selectedServiceId === "all") return orders;
        return orders.filter((o) => (o.items || []).some((i) => i.categoryId === selectedServiceId));
    }, [orders, selectedServiceId]);

    // Per-method mix for the Collected Today view — sums each payments[] entry
    // stamped today across the loaded (already service-filtered) orders.
    const collectedMix = useMemo(() => {
        if (specialFilter !== "collected_today") return null;
        const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
        const map: Record<string, number> = {};
        let total = 0;
        visibleOrders.forEach((o) => (o.payments || []).forEach((pmt) => {
            const at = pmt.collectedAt?.toDate?.();
            if (!at || at < dayStart) return;
            const m = pmt.method || "cash";
            map[m] = (map[m] || 0) + (pmt.amount || 0);
            total += pmt.amount || 0;
        }));
        return { entries: Object.entries(map).sort((a, b) => b[1] - a[1]), total };
    }, [specialFilter, visibleOrders]);


    const rows = useMemo(() => visibleOrders.map((order, i) => {
        const dtype = mapLegacyDeliveryType(order.deliveryType);
        const total = order.financials?.total || 0;
        const paid = order.financials?.amountPaid || 0;
        const balance = order.financials?.balance ?? (total - paid);
        const pay = balance <= 0 && total > 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
        const payRef = pay === "Paid" ? "c-success" : pay === "Partial" ? "c-warning" : "c-error";
        const av = AV[i % AV.length];
        return { order, dtype, total, pay, payRef, av };
    }), [visibleOrders]);

    const handleOpen = (id: string) => { if (onSelect) onSelect(id); else navigate(`${basePath}/${id}`); };

    // MOBILE: render the owner app's OrdersScreen clone instead of the web list.
    if (isMobile) return <MobileOrders basePath={basePath} />;

    return (
        <div className="lb-ds" style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--ds-bg)", minHeight: 0 }}>
            {/* header — on mobile, the owner app's header bar (filter + new order as round icon buttons) */}
            {isMobile ? (
                <MHeader
                    title={t("orders.title", "Orders")}
                    sub={`${visibleOrders.length}${hasMore ? "+" : ""} ${t("orders.stats.total", "total")}`}
                    right={
                        <div style={{ display: "flex", gap: 8 }}>
                            <MIconBtn aria-label={t("orders.filters.title", "Filters")} tint={activeFiltersCount ? "c-primary" : undefined} onClick={() => setFilterSheetOpen(true)}><SlidersHorizontal size={18} /></MIconBtn>
                            <MIconBtn aria-label={t("orders.newOrder", "New Order")} tint="c-primary" onClick={() => navigate(newOrderPath)}><Plus size={20} /></MIconBtn>
                        </div>
                    }
                />
            ) : (
            <header className="lb-ds" style={{ flex: "none", minHeight: 58, background: "var(--ds-card)", borderBottom: "1px solid var(--ds-border)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "12px 22px" }}>
                <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
                    <Search size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "var(--ds-text-3)" }} />
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="search"
                        placeholder={t("orders.searchPlaceholder", "Order number, phone or scan a tag")}
                        style={{ width: "100%", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12, padding: "12px 78px 12px 42px", outline: "none", boxShadow: "var(--ds-shadow)" }} />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <kbd style={{ font: "inherit", fontSize: 11, color: "var(--ds-text-3)", border: "1px solid var(--ds-border)", borderRadius: 6, padding: "2px 6px", background: "var(--ds-muted-surface)" }}>⌘ K</kbd>
                        <button type="button" onClick={() => navigate("/scan")} title={t("common.scan", "Scan")} style={{ cursor: "pointer", border: 0, background: "transparent", color: "var(--ds-blue)", display: "inline-flex", padding: 2 }}><ScanLine size={17} /></button>
                    </span>
                </div>
                <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <CalendarDays size={17} style={{ position: "absolute", left: 12, color: "var(--ds-blue)", pointerEvents: "none" }} />
                <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}
                    style={{ cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12, padding: "12px 12px 12px 36px", outline: "none", boxShadow: "var(--ds-shadow)", appearance: "none" }}>
                    <option value="all">{t("reports.periodAllTime", "All time")}</option>
                    <option value="today">{t("reports.periodToday", "Today")}</option>
                    <option value="week">{t("reports.periodThisWeek", "This Week")}</option>
                    <option value="month">{t("reports.periodThisMonth", "This Month")}</option>
                    <option value="lastMonth">{t("reports.periodLastMonth", "Last Month")}</option>
                    <option value="sixMonths">{t("reports.period6Months", "Last 6 Months")}</option>
                    <option value="year">{t("reports.periodThisYear", "This Year")}</option>
                    <option value={`year:${new Date().getFullYear() - 1}`}>{new Date().getFullYear() - 1}</option>
                    <option value={`year:${new Date().getFullYear() - 2}`}>{new Date().getFullYear() - 2}</option>
                    <option value="custom">{t("reports.periodCustom", "Custom range…")}</option>
                </select>
                </span>
                {period === "custom" && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} max={customTo || undefined}
                            style={{ font: "inherit", fontSize: 12.5, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "7px 9px", outline: "none" }} />
                        <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>→</span>
                        <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} min={customFrom || undefined}
                            style={{ font: "inherit", fontSize: 12.5, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "7px 9px", outline: "none" }} />
                    </span>
                )}
                <ExportDataButton onExport={exportOrders} kind={t("orders.title", "Orders").toLowerCase()} label={t("export.button", "Export")} />
                <button onClick={() => navigate(newOrderPath)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, font: "inherit", fontSize: 14, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 10, padding: "12px 18px", boxShadow: "var(--ds-shadow)" }}>
                    <Plus size={17} strokeWidth={2} />{t("orders.newOrder", "New Order")}
                </button>
            </header>
            )}

            {/* search + period (mobile: app-style row attached under the header) */}
            {isMobile && (
                <div style={{ flex: "none", display: "flex", gap: 8, padding: "2px 14px 10px", background: "var(--c-surface)" }}>
                    <MSearch value={searchQuery} onChange={setSearchQuery} placeholder={t("orders.searchOrders", "Search order, customer, phone…")} style={{ flex: 1 }} />
                    <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}
                        style={{ cursor: "pointer", flex: "none", font: "inherit", fontSize: 13, fontWeight: 600, height: 42, color: period !== "all" ? "var(--c-primary)" : "var(--c-text-2)", background: period !== "all" ? "var(--c-primary-soft)" : "var(--c-surface-2)", border: `1px solid ${period !== "all" ? "var(--c-primary)" : "var(--c-border)"}`, borderRadius: 12, padding: "0 10px", outline: "none" }}>
                        <option value="all">{t("reports.periodAllTime", "All time")}</option>
                        <option value="today">{t("reports.periodToday", "Today")}</option>
                        <option value="week">{t("reports.periodThisWeek", "This Week")}</option>
                        <option value="month">{t("reports.periodThisMonth", "This Month")}</option>
                        <option value="lastMonth">{t("reports.periodLastMonth", "Last Month")}</option>
                        <option value="sixMonths">{t("reports.period6Months", "Last 6 Months")}</option>
                        <option value="year">{t("reports.periodThisYear", "This Year")}</option>
                        <option value={`year:${new Date().getFullYear() - 1}`}>{new Date().getFullYear() - 1}</option>
                        <option value={`year:${new Date().getFullYear() - 2}`}>{new Date().getFullYear() - 2}</option>
                        <option value="custom">{t("reports.periodCustom", "Custom range…")}</option>
                    </select>
                </div>
            )}

            {/* ===== Summary strip + status pills (desktop) ===== */}
            {!isMobile && (
                <div style={{ flex: "none", background: "var(--ds-bg)", padding: "16px 22px 0" }}>
                    <div className="ol-sum" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 14 }}>
                        {[
                            { label: t("orders.stats.today", "Today"), value: formatAmount(stats.todayRevenue), icon: <CalendarDays size={18} />, tint: "var(--ds-blue)", soft: "var(--ds-blue-soft)", to: "today" as const },
                            { label: t("orders.stats.active", "Active"), value: String(stats.pendingOrders + stats.processingOrders + stats.readyOrders + stats.outForDeliveryOrders), icon: <ShoppingBag size={18} />, tint: "var(--ds-blue)", soft: "var(--ds-blue-soft)", to: null },
                            { label: t("orders.stats.pending", "Pending"), value: String(stats.pendingOrders), icon: <Wallet size={18} />, tint: "var(--ds-att-amber)", soft: "var(--ds-att-amber-bg)", to: null },
                            { label: t("orders.stats.due", "Due"), value: formatAmount(stats.outstandingAmount), icon: <CircleAlert size={18} />, tint: "var(--ds-att-red)", soft: "var(--ds-att-red-bg)", to: null, danger: true },
                        ].map((c) => (
                            <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, boxShadow: "var(--ds-shadow)", padding: "14px 16px" }}>
                                <span style={{ width: 42, height: 42, flex: "none", borderRadius: 11, background: c.soft, color: c.tint, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.icon}</span>
                                <span style={{ minWidth: 0 }}>
                                    <span style={{ display: "block", fontSize: 13, color: "var(--ds-text-2)" }}>{c.label}</span>
                                    <span style={{ display: "block", fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.15, color: c.danger ? "var(--ds-negative)" : "var(--ds-text)", ...NUM }}>{c.value}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, flex: 1, minWidth: 0 }}>
                        {TABS.map((tb) => {
                            const on = selectedStatus === tb.key && !specialFilter;
                            return (
                                <button key={tb.key} onClick={() => { setSelectedStatus(tb.key); setSpecialFilter(null); }}
                                    style={{ cursor: "pointer", whiteSpace: "nowrap", font: "inherit", fontSize: 13.5, fontWeight: on ? 600 : 500, padding: "9px 16px", borderRadius: 9, border: `1px solid ${on ? "var(--ds-blue)" : "var(--ds-border)"}`, background: on ? "var(--ds-blue)" : "var(--ds-card)", color: on ? "#fff" : "var(--ds-text-2)" }}>
                                    {tb.label}
                                </button>
                            );
                        })}
                        <span style={{ flex: "none", width: 1, alignSelf: "stretch", background: "var(--ds-border)", margin: "0 4px" }} />
                        {([
                            { key: "pending_overdue" as const, label: t("orders.filters.overdueOrders", "Overdue"), count: stats.pendingOrders, fg: "var(--ds-negative)", bg: "var(--ds-st-overdue-bg)", icon: <ClockAlert size={14} /> },
                            { key: "payment_due" as const, label: t("orders.filters.due", "Due"), count: null, fg: "var(--ds-negative)", bg: "var(--ds-st-overdue-bg)", icon: <CircleAlert size={14} /> },
                            { key: "scheduled_upcoming" as const, label: t("orders.filters.scheduled", "Scheduled"), count: null, fg: "var(--ds-st-pending)", bg: "var(--ds-st-pending-bg)", icon: <CalendarClock size={14} /> },
                            { key: "collected_today" as const, label: t("orders.collectedToday", "Collected today"), count: null, fg: "var(--ds-st-ready)", bg: "var(--ds-st-ready-bg)", icon: <Wallet size={14} /> },
                        ]).map((c) => {
                            const on = specialFilter === c.key;
                            return (
                                <button key={c.key} onClick={() => setSpecialFilter(on ? null : c.key)}
                                    style={{ cursor: "pointer", whiteSpace: "nowrap", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600, padding: "9px 16px", borderRadius: 9, border: `1px solid ${on ? c.fg : "var(--ds-border)"}`, background: on ? c.bg : "var(--ds-card)", color: c.fg }}>
                                    {c.icon}{c.label}{c.count ? <b style={{ ...NUM }}>{c.count}</b> : null}
                                </button>
                            );
                        })}
                    </div>
                        <button onClick={() => setFilterSheetOpen(true)}
                            style={{ flex: "none", cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, padding: "9px 16px", borderRadius: 10, border: `1px solid ${activeFiltersCount ? "var(--ds-blue)" : "var(--ds-border)"}`, background: activeFiltersCount ? "var(--ds-blue-soft)" : "var(--ds-card)", color: activeFiltersCount ? "var(--ds-blue)" : "var(--ds-text-2)" }}>
                            <ListFilter size={16} />{t("orders.filters.title", "Filters")}
                            {activeFiltersCount > 0 && <b style={{ ...NUM, minWidth: 20, height: 20, borderRadius: 6, background: "var(--ds-blue)", color: "#fff", fontSize: 11.5, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{activeFiltersCount}</b>}
                        </button>
                    </div>
                </div>
            )}

            {/* pipeline tabs (mobile) */}
            {isMobile && (
            <div className="lb-thin" style={{ flex: "none", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", padding: "10px 14px", display: "flex", gap: 8, overflowX: "auto" }}>
                {TABS.map((tb) => {
                    const on = selectedStatus === tb.key && !specialFilter;
                    return (
                        <button key={tb.key} onClick={() => { setSelectedStatus(tb.key); setSpecialFilter(null); }}
                            style={{ cursor: "pointer", whiteSpace: "nowrap", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 9, border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--${tb.dot})` }} />{tb.label}
                        </button>
                    );
                })}
                {/* attention chips — overdue + unpaid dues (same filters the reminder pushes point at) */}
                <span style={{ flex: "none", width: 1, alignSelf: "stretch", background: "var(--c-border)", margin: "0 3px" }} />
                <button onClick={() => { setSpecialFilter(specialFilter === "pending_overdue" ? null : "pending_overdue"); }}
                    style={{ cursor: "pointer", whiteSpace: "nowrap", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 9, border: `1px solid ${specialFilter === "pending_overdue" ? "var(--c-error)" : "var(--c-border)"}`, background: specialFilter === "pending_overdue" ? "var(--c-error-soft)" : "var(--c-surface)", color: specialFilter === "pending_overdue" ? "var(--c-error)" : "var(--c-text-2)" }}>
                    <AlertTriangle size={13} />{t("orders.filters.overdueOrders", "Overdue")}
                </button>
                <button onClick={() => { setSpecialFilter(specialFilter === "scheduled_upcoming" ? null : "scheduled_upcoming"); }}
                    style={{ cursor: "pointer", whiteSpace: "nowrap", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 9, border: `1px solid ${specialFilter === "scheduled_upcoming" ? "var(--c-primary)" : "var(--c-border)"}`, background: specialFilter === "scheduled_upcoming" ? "var(--c-primary-soft)" : "var(--c-surface)", color: specialFilter === "scheduled_upcoming" ? "var(--c-primary)" : "var(--c-text-2)" }}>
                    <CalendarClock size={13} />{t("orders.filters.scheduled", "Scheduled")}
                </button>
                <button onClick={() => { setSpecialFilter(specialFilter === "payment_due" ? null : "payment_due"); }}
                    style={{ cursor: "pointer", whiteSpace: "nowrap", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 9, border: `1px solid ${specialFilter === "payment_due" ? "var(--c-warning)" : "var(--c-border)"}`, background: specialFilter === "payment_due" ? "var(--c-warning-soft)" : "var(--c-surface)", color: specialFilter === "payment_due" ? "var(--c-warning)" : "var(--c-text-2)" }}>
                    <Wallet size={13} />{t("orders.filters.unpaidDues", "Unpaid dues")}
                </button>
                <button onClick={() => { setSpecialFilter(specialFilter === "collected_today" ? null : "collected_today"); }}
                    style={{ cursor: "pointer", whiteSpace: "nowrap", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 9, border: `1px solid ${specialFilter === "collected_today" ? "var(--c-success)" : "var(--c-border)"}`, background: specialFilter === "collected_today" ? "var(--c-success-soft)" : "var(--c-surface)", color: specialFilter === "collected_today" ? "var(--c-success)" : "var(--c-text-2)" }}>
                    <Wallet size={14} />{t("orders.collectedToday", "Collected Today")}
                </button>
            </div>
            )}

            {/* Collected-today mix — how today's money arrived, per method */}
            {collectedMix && collectedMix.total > 0 && (
                <div style={{ flex: "none", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "10px 22px", background: "var(--c-success-soft)", borderBottom: "1px solid var(--c-border)" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--c-success)" }}>
                        {t("orders.collectedTodayTotal", "Collected today")}: {formatAmount(collectedMix.total)}
                    </span>
                    {collectedMix.entries.map(([m, amt]) => (
                        <span key={m} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 999, padding: "4px 11px", textTransform: "capitalize" }}>
                            {m.replace(/_/g, " ")} · {formatAmount(amt)}
                        </span>
                    ))}
                </div>
            )}

            {/* table */}
            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", background: "var(--ds-bg)", padding: isMobile ? "14px 14px calc(88px + env(safe-area-inset-bottom, 0px))" : "0 22px 40px", minHeight: 0 }}>
                <div style={{ background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, boxShadow: "var(--ds-shadow)", overflow: "hidden" }}>
                    {loading ? (
                        <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><LSpinner /></div>
                    ) : visibleOrders.length === 0 ? (
                        <LEmptyState icon={<ClipboardList className="h-8 w-8" />} title={t("orders.empty", "No orders found")} description={t("orders.tryDifferentFilter", "Try another tab, filter, or search.")} />
                    ) : isMobile ? (
                        /* App-style order rows — the 880px table reads as a website on a phone */
                        <div>
                            {rows.map(({ order, dtype, total, pay, payRef }, i) => {
                                const stRef = STATUS_TINT[order.status] || "c-slate";
                                const tyRef = TYPE_TINT[dtype];
                                return (
                                    <MRow key={order.id}
                                        left={
                                            <span style={{ width: 38, height: 38, borderRadius: 11, background: `var(--${stRef}-soft)`, color: `var(--${stRef})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>
                                                #{String(order.publicId).slice(-4)}
                                            </span>
                                        }
                                        title={<>{order.customerName || t("customer.guest", "Guest")}{order.orderSource === "online" && <Globe size={12} style={{ marginLeft: 5, color: "var(--c-cyan)", verticalAlign: -1 }} />}</>}
                                        titleRight={
                                            <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: `var(--${stRef}-soft)`, color: `var(--${stRef})`, whiteSpace: "nowrap" }}>
                                                <span style={{ width: 4, height: 4, borderRadius: "50%", background: `var(--${stRef})` }} />{STATUS_LABELS[order.status]}
                                            </span>
                                        }
                                        sub={
                                            <>
                                                <span style={{ color: `var(--${tyRef})` }}>{t(`orders.deliveryTypes.${dtype}`, dtype.replace("_", " "))}</span>
                                                {" · "}{order.items.length} {t("pos.items", "pcs")} · <span style={{ color: `var(--${payRef})`, fontWeight: 600 }}>{pay}</span>
                                                {scheduledLabel(order) && <span style={{ color: "var(--c-primary)", fontWeight: 600 }}> · {scheduledLabel(order)}</span>}
                                            </>
                                        }
                                        right={<span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13.5 }}>{formatAmount(total)}</span>}
                                        selected={selectedId === order.id}
                                        last={i === rows.length - 1}
                                        onClick={() => handleOpen(order.id)}
                                    />
                                );
                            })}
                        </div>
                    ) : (
                        <div className="lb-scroll lb-ds" style={{ overflowX: "auto" }}>
                            <style>{`.ol-row:hover{background:var(--ds-row-hover)} .ol-act:hover{background:var(--ds-blue-soft);border-color:var(--ds-blue)}`}</style>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 1020, ...NUM }}>
                                <thead>
                                    <tr>
                                        {[t("orders.order", "Order"), t("customer.title", "Customer"), t("orders.items", "Items"), t("orders.type", "Type"), t("orders.status", "Status"), t("checkout.payment", "Payment"), t("orders.due", "Due"), t("pos.total", "Total"), t("orders.actions", "Actions")].map((h, n) => (
                                            <th key={h} style={{ textAlign: n === 7 ? "right" : "left", padding: "12px 12px", paddingLeft: n === 0 ? 18 : 12, fontSize: 12, fontWeight: 500, color: "var(--ds-text-2)", borderBottom: "1px solid var(--ds-border)", whiteSpace: "nowrap", background: "var(--ds-table-head)" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(({ order, dtype, total, pay }) => {
                                        const chip = CHIP[order.status] || { bg: "var(--ds-st-delivered-bg)", fg: "var(--ds-st-delivered)" };
                                        const due = dueInfo(order);
                                        const isOverdue = due.late;
                                        const items = itemsSummary(order);
                                        const TypeIcon = TYPE_ICON[dtype] || Store;
                                        const payTone = pay === "Paid" ? { bg: "var(--ds-pay-paid-bg)", fg: "var(--ds-pay-paid)" } : pay === "Partial" ? { bg: "var(--ds-pay-partial-bg)", fg: "var(--ds-pay-partial)" } : { bg: "var(--ds-pay-unpaid-bg)", fg: "var(--ds-pay-unpaid)" };
                                        const unseen = order.orderSource === "online" && ACTIVE_STATUSES.has(order.status) && order.status === "pending";
                                        const TD2: CSSProperties = { padding: "12px 12px", borderBottom: "1px solid var(--ds-divider)", verticalAlign: "middle", whiteSpace: "nowrap" };
                                        const ell: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
                                        return (
                                            <tr key={order.id} className="ol-row" onClick={() => handleOpen(order.id)} tabIndex={0} role="button"
                                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpen(order.id); } }}
                                                style={{ cursor: "pointer", background: selectedId === order.id ? "var(--ds-blue-soft)" : unseen ? "var(--ds-blue-soft)" : "transparent" }}>
                                                <td style={{ ...TD2, paddingLeft: 18, fontWeight: 700 }}>
                                                    {unseen && <span style={{ marginRight: 8, fontSize: 10.5, fontWeight: 700, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", borderRadius: 6, padding: "1px 6px" }}>{t("orders.new", "New")}</span>}
                                                    {order.publicId}
                                                </td>
                                                <td style={{ ...TD2, maxWidth: 170 }}>
                                                    <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6, ...ell }}>
                                                        {order.customerName || t("customer.guest", "Guest")}
                                                        {order.orderSource === "online" && <Globe size={12} style={{ flex: "none", color: "var(--ds-blue)" }} />}
                                                    </div>
                                                    <div style={{ fontSize: 11.5, color: "var(--ds-text-3)", ...ell }}>{order.customerPhone}</div>
                                                </td>
                                                <td style={{ ...TD2, maxWidth: 190 }} title={items.line}>
                                                    <div style={{ fontWeight: 500, ...ell }}>{items.line}</div>
                                                    <div style={{ fontSize: 11.5, color: "var(--ds-text-3)", ...ell }}>{items.service}</div>
                                                </td>
                                                <td style={TD2}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ds-text-2)" }}>
                                                        <TypeIcon size={16} style={{ color: "var(--ds-text-3)" }} />{t(`orders.deliveryTypes.${dtype}`, dtype === "pickup_store" ? "Store pickup" : dtype === "pickup_home" ? "Home pickup" : "Home delivery")}
                                                    </span>
                                                </td>
                                                <td style={TD2}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 600, padding: "4px 11px", borderRadius: 7, background: isOverdue ? "var(--ds-st-overdue-bg)" : chip.bg, color: isOverdue ? "var(--ds-st-overdue)" : chip.fg }}>
                                                        {isOverdue ? t("orders.filters.overdueOrders", "Overdue") : STATUS_LABELS[order.status]}
                                                    </span>
                                                </td>
                                                <td style={TD2}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 600, padding: "4px 11px", borderRadius: 7, background: payTone.bg, color: payTone.fg }}>{pay}</span>
                                                </td>
                                                <td style={{ ...TD2, fontSize: 12.5, color: due.late ? "var(--ds-negative)" : due.today ? "var(--ds-due-today)" : "var(--ds-text-2)", fontWeight: due.late || due.today ? 600 : 400 }}>{due.text}</td>
                                                <td style={{ ...TD2, textAlign: "right", fontWeight: 700 }}>{formatAmount(total)}</td>
                                                <td style={{ ...TD2, paddingRight: 18 }} onClick={(e) => e.stopPropagation()}>
                                                    <span style={{ display: "inline-flex", gap: 6 }}>
                                                        <button type="button" className="ol-act" aria-label={t("orders.collect", "Collect payment")} title={t("orders.collect", "Collect payment")} onClick={() => handleOpen(order.id)} style={ACT}><Wallet size={16} /></button>
                                                        <button type="button" className="ol-act" aria-label={t("orders.print", "Print bill")} title={t("orders.print", "Print bill")} onClick={() => printOrder(order.id)} style={ACT}><Printer size={16} /></button>
                                                        <button type="button" className="ol-act" aria-label={t("orders.whatsapp", "Send on WhatsApp")} title={t("orders.whatsapp", "Send on WhatsApp")} onClick={() => whatsappOrder(order.id)} style={{ ...ACT, color: "var(--ds-whatsapp)" }}><MessageCircle size={16} /></button>
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!loading && visibleOrders.length > 0 && (
                        <div ref={loadMoreRef} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderTop: "1px solid var(--c-border)", fontSize: 12, color: "var(--c-text-3)" }}>
                            <span>{t("orders.showing", "Showing")} {visibleOrders.length}</span>
                            <span style={{ marginLeft: "auto" }}>{loadingMore ? <LSpinner size="sm" /> : !hasMore ? t("orders.noMore", "End of list") : ""}</span>
                        </div>
                    )}
                </div>
                {/* keep observer target alive even while empty list footer hidden */}
                {(!visibleOrders.length || loading) && <div ref={loadMoreRef} style={{ height: 1 }} />}
            </div>

            <OrderFilterSheet
                key="order-filter-sheet"
                open={filterSheetOpen}
                onClose={() => setFilterSheetOpen(false)}
                selectedDeliveryType={selectedDeliveryType}
                selectedStatus={selectedStatus}
                selectedOrderSource={selectedOrderSource}
                selectedSpecialFilter={specialFilter}
                selectedServiceId={selectedServiceId}
                onApply={handleFilterApply}
            />
        </div>
    );
}
