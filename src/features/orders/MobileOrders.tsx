/**
 * MOBILE orders list — a 1:1 clone of the owner app's OrdersScreen
 * (mobile/src/screens/OrdersScreen.tsx): header with search toggle · stats card
 * (Today Rev | Active | Pending | Due Amt) · scrollable filter chips · order
 * cards with a status accent bar, ID · STATUS · price, customer + item summary,
 * dashed separator, PAID/type badges + time-ago, quick action buttons · FAB.
 *
 * Desktop keeps OrdersList's table; this renders only when isMobile.
 */

import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useOrdersPaginated, upcomingAt } from "@/hooks/use-orders-paginated";
import { useOrderMutations } from "@/hooks/use-orders";
import { useInventory } from "@/hooks/use-inventory";
import { useCurrency } from "@/hooks/use-currency";
import { useLToast } from "@/components/laundry";
import { mapLegacyDeliveryType, STATUS_LABELS } from "@/types/order";
import type { Order, OrderStatus, DeliveryType } from "@/types/order";
import { useTranslation } from "react-i18next";
import { Search, X, Plus, MessageCircle, CalendarDays, ChevronLeft, ChevronDown, Truck, WashingMachine } from "lucide-react";

/* Status palette — same three-part mapping as the app's STATUS_COLORS. */
const SC: Record<string, { color: string; bg: string }> = {
    pending: { color: "var(--c-warning)", bg: "var(--c-warning-soft)" },
    confirmed: { color: "var(--c-info)", bg: "var(--c-info-soft)" },
    picked_up_from_customer: { color: "var(--c-info)", bg: "var(--c-info-soft)" },
    processing: { color: "var(--c-info)", bg: "var(--c-info-soft)" },
    ready: { color: "#84CC16", bg: "#F1FBE7" },
    ready_for_pickup: { color: "#84CC16", bg: "#F1FBE7" },
    ready_for_delivery: { color: "#84CC16", bg: "#F1FBE7" },
    out_for_delivery: { color: "var(--c-primary)", bg: "var(--c-primary-soft)" },
    delivered: { color: "var(--c-success)", bg: "var(--c-success-soft)" },
    picked_up: { color: "var(--c-success)", bg: "var(--c-success-soft)" },
    partially_delivered: { color: "var(--c-warning)", bg: "var(--c-warning-soft)" },
    cancelled: { color: "var(--c-error)", bg: "var(--c-error-soft)" },
};

function timeAgo(d: Date | null): string {
    if (!d) return "";
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Future-dated pickup/delivery label — mirrors the app's scheduledLabel(). */
function scheduledLabel(o: Order): string | null {
    const at = upcomingAt(o);
    if (!at) return null;
    const now = new Date();
    const d = new Date(at);
    if (d.getTime() <= now.getTime()) return null;
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - startOfToday.getTime()) / 86400000);
    const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    if (days === 0) return `Today ${time}`;
    if (days === 1) return `Tomorrow ${time}`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ` ${time}`;
}


type TimePeriod = "today" | "week" | "month" | "year" | "all_time";

/** Same quick ranges as the app's date sheet. */
function rangeFor(p: TimePeriod): { dateStart: Date | null; dateEnd: Date | null } {
    const now = new Date();
    if (p === "today") { const s = new Date(now); s.setHours(0, 0, 0, 0); return { dateStart: s, dateEnd: null }; }
    if (p === "week") { const s = new Date(now); s.setDate(s.getDate() - s.getDay()); s.setHours(0, 0, 0, 0); return { dateStart: s, dateEnd: null }; }
    if (p === "month") return { dateStart: new Date(now.getFullYear(), now.getMonth(), 1), dateEnd: null };
    if (p === "year") return { dateStart: new Date(now.getFullYear(), 0, 1), dateEnd: null };
    return { dateStart: null, dateEnd: null };
}

const DELIVERY_TYPES: (DeliveryType | "all")[] = ["all", "pickup_store", "delivery_home", "pickup_home"];

export function MobileOrders({ basePath = "/orders" }: { basePath?: string }) {
    // basePath is the ORDERS base ("/orders" or "/staff/orders"); the app root is
    // what remains once that suffix is stripped (owner = "", staff = "/staff").
    const root = basePath.replace(/\/orders$/, "");
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { formatAmount } = useCurrency();
    const { addToast } = useLToast();
    const { updateStatus } = useOrderMutations();

    const [filter, setFilter] = useState<string>("all");
    const [showSearch, setShowSearch] = useState(false);
    const [search, setSearch] = useState("");
    const [searchParams, setSearchParams] = useSearchParams();

    // ?search= from the home-screen search: open the search bar pre-filled.
    useEffect(() => {
        const s = searchParams.get("search");
        if (s) {
            setSearch(s);
            setShowSearch(true);
            setSearchParams({}, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);
    const [busyId, setBusyId] = useState<string | null>(null);
    // The app's three dropdown chips that sit before the status chips.
    const [timePeriod, setTimePeriod] = useState<TimePeriod>("all_time");
    const [dateBasis, setDateBasis] = useState<"created" | "scheduled">("created");
    const [orderType, setOrderType] = useState<DeliveryType | "all">("all");
    const [serviceFilter, setServiceFilter] = useState<string>("all");
    const [sheet, setSheet] = useState<null | "date" | "type" | "service">(null);
    const { categories: services } = useInventory();

    // The app's chips map onto the web's status + special filters.
    const statusArg: OrderStatus | "all" =
        filter === "pending" ? "pending"
            : filter === "processing" ? "processing"
                : filter === "ready" ? "ready"
                    : filter === "completed" ? "delivered"
                        : "all";
    const specialFilter =
        filter === "overdue" ? "pending_overdue" as const
            : filter === "due" ? "payment_due" as const
                : filter === "scheduled" ? "scheduled_upcoming" as const
                    : null;

    // Date-range for the period chip. "Pickup / delivery" basis is applied
    // client-side below, because the query filters on createdAt.
    const { dateStart, dateEnd } = useMemo(() => rangeFor(timePeriod), [timePeriod]);

    const { orders: rawOrders, loading } = useOrdersPaginated({
        status: specialFilter ? "all" : statusArg,
        deliveryType: specialFilter ? "all" : orderType,
        searchTerm: search,
        specialFilter,
        dateStart: specialFilter || dateBasis === "scheduled" ? null : dateStart,
        dateEnd: specialFilter || dateBasis === "scheduled" ? null : dateEnd,
    });

    // Service chip + the "pickup / delivery" date basis filter client-side —
    // items[].categoryId isn't queryable and upcomingAt() is derived.
    const orders = useMemo(() => {
        let list = rawOrders;
        if (serviceFilter !== "all") list = list.filter((o) => (o.items || []).some((i) => i.categoryId === serviceFilter));
        if (dateBasis === "scheduled" && (dateStart || dateEnd)) {
            list = list.filter((o) => {
                const at = upcomingAt(o);
                if (!at) return false;
                if (dateStart && at < dateStart) return false;
                if (dateEnd && at > dateEnd) return false;
                return true;
            });
        }
        return list;
    }, [rawOrders, serviceFilter, dateBasis, dateStart, dateEnd]);

    const STATUS_FILTERS = [
        { key: "all", label: t("mobile.ordersFilterAll", "All") },
        { key: "pending", label: t("mobile.ordersFilterPending", "Pending") },
        { key: "processing", label: t("mobile.ordersFilterProcessing", "Processing") },
        { key: "ready", label: t("mobile.ordersFilterReady", "Ready") },
        { key: "overdue", label: t("mobile.ordersFilterOverdue", "Overdue") },
        { key: "scheduled", label: t("mobile.ordersFilterScheduled", "Scheduled") },
        { key: "completed", label: t("mobile.ordersFilterCompleted", "Completed") },
        { key: "due", label: t("mobile.ordersFilterDue", "Due") },
    ];

    // Stats card — same four numbers the app shows.
    const stats = useMemo(() => {
        const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
        let todayCollected = 0, active = 0, pending = 0, dueAmount = 0;
        orders.forEach((o) => {
            const s = o.status;
            if (s === "cancelled") return;
            const created = o.createdAt?.toDate?.();
            if (created && created >= startOfToday) todayCollected += o.financials?.amountPaid || 0;
            if (s === "pending") pending++;
            if (["confirmed", "processing", "ready", "out_for_delivery", "partially_delivered"].includes(s)) active++;
            const bal = o.financials?.balance ?? ((o.financials?.total || 0) - (o.financials?.amountPaid || 0));
            if (bal > 0) dueAmount += Math.round(bal);
        });
        return { todayCollected: Math.round(todayCollected), active, pending, dueAmount };
    }, [orders]);

    const dateChipLabel = timePeriod === "today" ? t("mobile.timeFilterToday", "Today")
        : timePeriod === "week" ? t("mobile.timeFilterWeek", "This Week")
            : timePeriod === "month" ? t("mobile.timeFilterMonth", "This Month")
                : timePeriod === "year" ? t("mobile.timeFilterYear", "This Year")
                    : t("mobile.timeFilterAll", "All Time");

    const quickStatus = async (o: Order, next: OrderStatus, label: string) => {
        setBusyId(o.id);
        try {
            await updateStatus(o.id, next);
            addToast({ type: "success", title: label });
        } catch (e) {
            console.error(e);
            addToast({ type: "error", title: t("common.error", "Something went wrong") });
        } finally {
            setBusyId(null);
        }
    };

    const card: CSSProperties = { background: "var(--c-surface)", borderRadius: 18, border: "1px solid var(--c-border)", boxShadow: "var(--sh-sm)" };
    const chip = (on: boolean): CSSProperties => ({
        cursor: "pointer", flex: "none", font: "inherit", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
        padding: "8px 14px", borderRadius: 999,
        border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`,
        background: on ? "var(--c-primary)" : "var(--c-surface)",
        color: on ? "#fff" : "var(--c-text-2)",
    });
    // Dropdown chip (date / type / service) — outlined, tinted when active.
    const dropChip = (on: boolean): CSSProperties => ({
        cursor: "pointer", flex: "none", display: "inline-flex", alignItems: "center", gap: 5, font: "inherit",
        fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", padding: "8px 12px", borderRadius: 999,
        border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`,
        background: on ? "var(--c-primary-soft)" : "var(--c-surface)",
        color: on ? "var(--c-primary)" : "var(--c-text-2)",
    });
    const actionBtn = (variant: "secondary" | "primary" | "success"): CSSProperties => ({
        cursor: "pointer", flex: 1, font: "inherit", fontSize: 13, fontWeight: 700, padding: "9px 10px", borderRadius: 10,
        border: variant === "secondary" ? "1px solid var(--c-border)" : 0,
        background: variant === "secondary" ? "var(--c-surface-2)" : variant === "success" ? "var(--c-success)" : "var(--c-primary)",
        color: variant === "secondary" ? "var(--c-text)" : "#fff",
    });

    return (
        <div style={{ minHeight: "100%", background: "var(--c-bg)", display: "flex", flexDirection: "column", position: "relative" }}>
            {/* Header (app s.header) */}
            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
                <button onClick={() => navigate(`${root}/dashboard`)} aria-label="Back" style={{ cursor: "pointer", flex: "none", width: 40, height: 40, borderRadius: 20, border: 0, background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={24} /></button>
                <div style={{ flex: 1, fontSize: 18, fontWeight: 700 }}>{t("mobile.ordersScreenTitle", "Orders")}</div>
                <button onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearch(""); }} aria-label={t("common.search", "Search")}
                    style={{ cursor: "pointer", flex: "none", width: 40, height: 40, borderRadius: 20, border: 0, background: showSearch ? "var(--c-primary-soft)" : "var(--c-surface-2)", color: showSearch ? "var(--c-primary)" : "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Search size={20} /></button>
            </div>

            <div style={{ flex: 1, padding: 16, paddingBottom: "calc(120px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Search (toggle) */}
                {showSearch && (
                    <div style={{ position: "relative" }}>
                        <Search size={20} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                        <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("mobile.ordersSearchPlaceholder", "Name, phone, email or order ID...")}
                            style={{ width: "100%", height: 46, font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "0 40px 0 46px", outline: "none" }} />
                        {search && <button onClick={() => setSearch("")} aria-label="Clear" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", cursor: "pointer", border: 0, background: "transparent", color: "var(--c-text-3)", display: "flex" }}><X size={18} /></button>}
                    </div>
                )}

                {/* Stats card (app s.statsCard) */}
                {!loading && (
                    <div style={{ ...card, padding: "10px 8px", display: "flex", alignItems: "stretch" }}>
                        {[
                            { label: t("mobile.ordersStatToday", "Today Rev"), value: formatAmount(stats.todayCollected) },
                            { label: t("mobile.ordersStatActive", "Active"), value: String(stats.active) },
                            { label: t("mobile.ordersStatPending", "Pending"), value: String(stats.pending) },
                            { label: t("mobile.ordersStatDue", "Due Amt"), value: formatAmount(stats.dueAmount), error: stats.dueAmount > 0, onClick: () => setFilter(filter === "due" ? "all" : "due") },
                        ].map((st, i) => (
                            <div key={st.label} style={{ flex: 1, display: "flex", minWidth: 0 }}>
                                {i > 0 && <span style={{ width: 1, background: "var(--c-border)", margin: "0 4px", flex: "none" }} />}
                                <div role={st.onClick ? "button" : undefined} onClick={st.onClick}
                                    style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: st.onClick ? "pointer" : "default" }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: ".3px", whiteSpace: "nowrap" }}>{st.label}</span>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: st.error ? "var(--c-error)" : "var(--c-text)" }}>{st.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Filter chips (app s.chipsRow) */}
                <div className="lb-thin" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, margin: "0 -16px", padding: "0 16px 2px" }}>
                    {/* Dropdown chips — date, order type, service (same three the app shows) */}
                    <button onClick={() => setSheet("date")} style={dropChip(timePeriod !== "all_time")}>
                        <CalendarDays size={15} />{dateChipLabel}<ChevronDown size={16} style={{ opacity: .7 }} />
                    </button>
                    <button onClick={() => setSheet("type")} style={dropChip(orderType !== "all")}>
                        <Truck size={15} />{orderType === "all" ? t("mobile.ordersType", "Order Type") : t(`orders.deliveryTypes.${orderType}`, orderType.replace(/_/g, " "))}<ChevronDown size={16} style={{ opacity: .7 }} />
                    </button>
                    {services.length > 0 && (
                        <button onClick={() => setSheet("service")} style={dropChip(serviceFilter !== "all")}>
                            <WashingMachine size={15} />{serviceFilter === "all" ? t("mobile.serviceFilter", "Service") : (services.find((sv) => sv.id === serviceFilter)?.name || t("mobile.serviceFilter", "Service"))}<ChevronDown size={16} style={{ opacity: .7 }} />
                        </button>
                    )}
                    {STATUS_FILTERS.map((f) => (
                        <button key={f.key} onClick={() => setFilter(f.key)} style={chip(filter === f.key)}>{f.label}</button>
                    ))}
                </div>

                {/* Orders list (app s.orderList) */}
                {loading ? (
                    <div style={{ padding: "48px 0", textAlign: "center", color: "var(--c-text-3)", fontSize: 13 }}>{t("common.loading", "Loading…")}</div>
                ) : orders.length === 0 ? (
                    <div style={{ ...card, padding: "48px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <Search size={40} style={{ color: "var(--c-text-3)" }} />
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)" }}>{t("mobile.ordersEmpty", "No orders found")}</div>
                        <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t("mobile.ordersEmptyHint", "Try searching for a different name, ID, or filter.")}</div>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {orders.map((o) => {
                            const status = o.status || "pending";
                            const sc = SC[status] || { color: "var(--c-text-2)", bg: "var(--c-surface-2)" };
                            const itemCount = (o.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
                            const itemSummary = (o.items || []).map((i) => i.serviceName || i.categoryName || "").filter(Boolean).slice(0, 2).join(", ");
                            const total = Math.round(o.financials?.total || 0);
                            const balance = Math.round(o.financials?.balance ?? ((o.financials?.total || 0) - (o.financials?.amountPaid || 0)));
                            const isPaid = balance <= 0;
                            const orderId = o.publicId || o.orderNumber || `ORD-${o.id.slice(-4)}`;
                            const sched = scheduledLabel(o);
                            const dtype = mapLegacyDeliveryType(o.deliveryType);
                            const showActions = (status !== "delivered" && status !== "picked_up" && status !== "cancelled") || !isPaid;
                            const busy = busyId === o.id;

                            return (
                                <div key={o.id} role="button" tabIndex={0}
                                    onClick={() => navigate(`${basePath}/${o.id}`)}
                                    onKeyDown={(e) => { if (e.key === "Enter") navigate(`${basePath}/${o.id}`); }}
                                    style={{ ...card, position: "relative", overflow: "hidden", padding: "12px 12px 12px 16px", display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}>
                                    <span style={{ position: "absolute", left: 0, top: 12, bottom: 12, width: 4, borderRadius: "0 4px 4px 0", background: sc.color }} />

                                    {/* Row 1 */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", color: sc.color, whiteSpace: "nowrap" }}>{orderId}</span>
                                            <span style={{ width: 4, height: 4, borderRadius: 2, background: "var(--c-text-3)", flex: "none" }} />
                                            <span style={{ background: sc.bg, color: sc.color, padding: "2px 6px", borderRadius: 8, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{(STATUS_LABELS[status] || status).toUpperCase()}</span>
                                            {o.orderSource === "online" && <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>Online</span>}
                                        </span>
                                        <span style={{ fontSize: 16, fontWeight: 700, whiteSpace: "nowrap" }}>{formatAmount(total)}</span>
                                    </div>

                                    {/* Row 2 */}
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customerName || t("mobile.guestCustomer", "Guest")}</div>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--c-text-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {itemCount} {t("mobile.items", "items")}{itemSummary ? ` · ${itemSummary}` : ""}
                                        </div>
                                        {sched && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                                                <CalendarDays size={12} style={{ color: "var(--c-primary)" }} />
                                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-primary)" }}>{sched}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Dashed separator */}
                                    <div style={{ borderTop: "1px dashed var(--c-border)" }} />

                                    {/* Row 3 */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                        <span style={{ display: "flex", gap: 6 }}>
                                            <span style={{ padding: "4px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: isPaid ? "var(--c-success-soft)" : "var(--c-error-soft)", color: isPaid ? "var(--c-success)" : "var(--c-error)" }}>
                                                {isPaid ? t("mobile.paid", "PAID") : t("mobile.unpaid", "UNPAID")}
                                            </span>
                                            <span style={{ padding: "4px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", color: "var(--c-text-2)", whiteSpace: "nowrap" }}>
                                                {t(`orders.deliveryTypes.${dtype}`, dtype.replace(/_/g, " "))}
                                            </span>
                                        </span>
                                        <span style={{ fontSize: 12, color: "var(--c-text-2)", whiteSpace: "nowrap" }}>{timeAgo(o.createdAt?.toDate?.() || null)}</span>
                                    </div>

                                    {/* Row 4 — quick actions */}
                                    {showActions && (
                                        <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                                            {!isPaid && (
                                                <button disabled={busy} onClick={() => navigate(`${basePath}/${o.id}`)} style={actionBtn("secondary")}>
                                                    {t("mobile.collect", "Collect")} {formatAmount(balance)}
                                                </button>
                                            )}
                                            {status === "pending" && (
                                                <button disabled={busy} onClick={() => quickStatus(o, "processing", t("mobile.startProcessing", "Start Processing"))} style={actionBtn("primary")}>
                                                    {t("mobile.startProcessing", "Start Processing")}
                                                </button>
                                            )}
                                            {status === "processing" && (
                                                <button disabled={busy} onClick={() => quickStatus(o, "ready", t("mobile.markReady", "Mark Ready"))} style={actionBtn("success")}>
                                                    {t("mobile.markReady", "Mark Ready")}
                                                </button>
                                            )}
                                            {status === "ready" && (
                                                <button disabled={busy} onClick={() => quickStatus(o, "delivered", t("mobile.deliverOrder", "Deliver Order"))} style={actionBtn("primary")}>
                                                    {t("mobile.deliverOrder", "Deliver Order")}
                                                </button>
                                            )}
                                            <button aria-label="Message" onClick={() => navigate(`${basePath}/${o.id}`)}
                                                style={{ cursor: "pointer", flex: "none", width: 40, height: 38, borderRadius: 10, border: "1px solid var(--c-border)", background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <MessageCircle size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Filter bottom sheets — same layout as the app's Modal sheets */}
            {sheet && (
                <>
                    <div onClick={() => setSheet(null)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,.45)" }} />
                    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 61, background: "var(--c-surface)", borderRadius: "20px 20px 0 0", padding: "10px 16px calc(16px + env(safe-area-inset-bottom, 0px))", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 -8px 30px rgba(15,23,42,.18)" }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--c-border)", margin: "0 auto 12px" }} />
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                            <span style={{ fontSize: 16, fontWeight: 700 }}>
                                {sheet === "date" ? t("mobile.filterByDate", "Filter by Date")
                                    : sheet === "type" ? t("mobile.ordersType", "Order Type")
                                        : t("mobile.serviceFilter", "Service")}
                            </span>
                            <button onClick={() => setSheet(null)} aria-label={t("common.close", "Close")} style={{ cursor: "pointer", border: 0, background: "transparent", color: "var(--c-text-3)", display: "flex" }}><X size={22} /></button>
                        </div>

                        {sheet === "date" && (
                            <>
                                {/* What the range applies to — "Pickup / delivery" unlocks future days */}
                                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                                    {([{ key: "created", label: t("mobile.dateBasisOrder", "Order date") }, { key: "scheduled", label: t("mobile.dateBasisScheduled", "Pickup / delivery") }] as const).map((opt) => (
                                        <button key={opt.key} onClick={() => setDateBasis(opt.key)} style={{ ...dropChip(dateBasis === opt.key), flex: 1, justifyContent: "center" }}>{opt.label}</button>
                                    ))}
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {(["today", "week", "month", "year", "all_time"] as TimePeriod[]).map((k) => (
                                        <button key={k} onClick={() => { setTimePeriod(k); setSheet(null); }} style={{ ...dropChip(timePeriod === k), flex: "1 1 45%", justifyContent: "center" }}>
                                            {k === "today" ? t("mobile.timeFilterToday", "Today")
                                                : k === "week" ? t("mobile.timeFilterWeek", "This Week")
                                                    : k === "month" ? t("mobile.timeFilterMonth", "This Month")
                                                        : k === "year" ? t("mobile.timeFilterYear", "This Year")
                                                            : t("mobile.timeFilterAll", "All Time")}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {sheet === "type" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {DELIVERY_TYPES.map((dt) => (
                                    <button key={dt} onClick={() => { setOrderType(dt); setSheet(null); }}
                                        style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 12px", borderRadius: 10, border: 0, font: "inherit", fontSize: 14, fontWeight: 600, textAlign: "left", background: orderType === dt ? "var(--c-primary-soft)" : "transparent", color: orderType === dt ? "var(--c-primary)" : "var(--c-text)" }}>
                                        {dt === "all" ? t("common.all", "All") : t(`orders.deliveryTypes.${dt}`, dt.replace(/_/g, " "))}
                                        {orderType === dt && <span style={{ fontWeight: 700 }}>✓</span>}
                                    </button>
                                ))}
                            </div>
                        )}

                        {sheet === "service" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {[{ id: "all", name: t("common.all", "All") }, ...services].map((sv) => (
                                    <button key={sv.id} onClick={() => { setServiceFilter(sv.id); setSheet(null); }}
                                        style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 12px", borderRadius: 10, border: 0, font: "inherit", fontSize: 14, fontWeight: 600, textAlign: "left", background: serviceFilter === sv.id ? "var(--c-primary-soft)" : "transparent", color: serviceFilter === sv.id ? "var(--c-primary)" : "var(--c-text)" }}>
                                        {sv.name}
                                        {serviceFilter === sv.id && <span style={{ fontWeight: 700 }}>✓</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* FAB — sits above the bottom nav, like the app */}
            <button onClick={() => navigate(basePath.startsWith("/staff") ? "/staff/orders/new" : "/new-order")} aria-label={t("orders.newOrder", "New Order")}
                style={{ position: "fixed", right: 18, bottom: "calc(86px + env(safe-area-inset-bottom, 0px))", zIndex: 41, cursor: "pointer", width: 56, height: 56, borderRadius: 28, border: 0, background: "var(--c-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(27,97,229,.35)" }}>
                <Plus size={28} />
            </button>
        </div>
    );
}
