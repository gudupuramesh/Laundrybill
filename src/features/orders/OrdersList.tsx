/**
 * Orders List — 1000% to the design system (Order Management.dc.html):
 * header (title + count + search + Filters + New Order) · status pipeline tabs ·
 * full-width table (Order · Customer · Type · Status · Payment · Total · Updated) ·
 * infinite scroll. Wired to useOrdersPaginated + filter sheet + online-seen.
 */

import { useState, useEffect, useRef, useMemo, useContext, type CSSProperties } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SeenOnlineOrdersContext } from "@/hooks/use-seen-online-orders";
import { LEmptyState, LSpinner } from "@/components/laundry";
import { useOrdersPaginated, type OrderSourceFilter } from "@/hooks/use-orders-paginated";
import { useCurrency } from "@/hooks/use-currency";
import type { OrderStatus, DeliveryType } from "@/types/order";
import { mapLegacyDeliveryType, STATUS_LABELS } from "@/types/order";
import { ClipboardList, Search, SlidersHorizontal, Plus, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OrderFilterSheet } from "./OrderFilterSheet";

const MONO = "'IBM Plex Mono'";
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
    { key: "delivered", label: "Delivered", dot: "c-success" },
    { key: "cancelled", label: "Cancelled", dot: "c-error" },
];

const TH: CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-text-3)", borderBottom: "1px solid var(--c-border)", whiteSpace: "nowrap", background: "var(--c-surface-2)" };
const TD: CSSProperties = { padding: "11px 14px", borderBottom: "1px solid var(--c-border)" };

function timeAgo(d: Date): string {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

interface OrdersListProps {
    selectedId?: string | null;
    onSelect?: (orderId: string) => void;
}

export function OrdersList({ selectedId, onSelect }: OrdersListProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { markSeen } = useContext(SeenOnlineOrdersContext);
    const { formatAmount } = useCurrency();

    const basePath = location.pathname.startsWith("/staff") ? "/staff/orders" : "/orders";

    const [selectedDeliveryType, setSelectedDeliveryType] = useState<DeliveryType | "all">("all");
    const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "all">("all");
    const [selectedOrderSource, setSelectedOrderSource] = useState<OrderSourceFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [specialFilter, setSpecialFilter] = useState<"pending_overdue" | "payment_due" | null>(null);

    const { orders, loading, loadingMore, hasMore, loadMore } = useOrdersPaginated({
        status: specialFilter ? "all" : selectedStatus,
        deliveryType: specialFilter ? "all" : selectedDeliveryType,
        orderSource: specialFilter ? "all" : selectedOrderSource,
        searchTerm: searchQuery,
        specialFilter,
    });

    const handleFilterApply = (
        type: DeliveryType | "all",
        status: OrderStatus | "all",
        newSpecialFilter: "pending_overdue" | "payment_due" | null = null,
        orderSource: OrderSourceFilter = "all"
    ) => {
        if (newSpecialFilter) {
            setSpecialFilter(newSpecialFilter);
            setSelectedDeliveryType("all");
            setSelectedStatus("all");
            setSelectedOrderSource("all");
        } else {
            setSelectedDeliveryType(type);
            setSelectedStatus(status);
            setSelectedOrderSource(orderSource);
            setSpecialFilter(null);
        }
    };

    // mark online order as seen on open
    useEffect(() => {
        if (!selectedId || !markSeen) return;
        const sel = orders.find((o) => o.id === selectedId);
        if (sel?.orderSource === "online") markSeen(selectedId);
    }, [selectedId, orders, markSeen]);

    const activeFiltersCount = (selectedDeliveryType !== "all" ? 1 : 0) + (selectedOrderSource !== "all" ? 1 : 0) + (specialFilter ? 1 : 0);

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

    const rows = useMemo(() => orders.map((order, i) => {
        const dtype = mapLegacyDeliveryType(order.deliveryType);
        const total = order.financials?.total || 0;
        const paid = order.financials?.amountPaid || 0;
        const balance = order.financials?.balance ?? (total - paid);
        const pay = balance <= 0 && total > 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
        const payRef = pay === "Paid" ? "c-success" : pay === "Partial" ? "c-warning" : "c-error";
        const av = AV[i % AV.length];
        return { order, dtype, total, pay, payRef, av };
    }), [orders]);

    const handleOpen = (id: string) => { if (onSelect) onSelect(id); else navigate(`${basePath}/${id}`); };

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--c-bg)", minHeight: 0 }}>
            {/* header */}
            <header style={{ flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "10px 22px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                    <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em" }}>{t("orders.title", "Orders")}</span>
                    <span style={{ fontSize: 12, color: "var(--c-text-3)", fontFamily: MONO }}>{orders.length}{hasMore ? "+" : ""} {t("orders.stats.total", "total")}</span>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ position: "relative" }}>
                    <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="search" placeholder={t("orders.searchOrders", "Search order, customer, phone…")}
                        style={{ width: 240, maxWidth: "60vw", font: "inherit", fontSize: 13, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "8px 11px 8px 33px", outline: "none" }} />
                </div>
                <button onClick={() => setFilterSheetOpen(true)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: activeFiltersCount ? "var(--c-primary)" : "var(--c-text-2)", background: activeFiltersCount ? "var(--c-primary-soft)" : "var(--c-surface)", border: `1px solid ${activeFiltersCount ? "var(--c-primary)" : "var(--c-border-strong)"}`, borderRadius: 8, padding: "8px 13px" }}>
                    <SlidersHorizontal size={15} />{t("orders.filters.title", "Filters")}{activeFiltersCount ? ` · ${activeFiltersCount}` : ""}
                </button>
                <button onClick={() => navigate(`${basePath}/new`)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 8, padding: "8px 14px", boxShadow: "var(--sh-sm)" }}>
                    <Plus size={15} />{t("orders.newOrder", "New Order")}
                </button>
            </header>

            {/* pipeline tabs */}
            <div className="lb-thin" style={{ flex: "none", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", padding: "10px 22px", display: "flex", gap: 8, overflowX: "auto" }}>
                {TABS.map((tb) => {
                    const on = selectedStatus === tb.key && !specialFilter;
                    return (
                        <button key={tb.key} onClick={() => { setSelectedStatus(tb.key); setSpecialFilter(null); }}
                            style={{ cursor: "pointer", whiteSpace: "nowrap", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 9, border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--${tb.dot})` }} />{tb.label}
                        </button>
                    );
                })}
            </div>

            {/* table */}
            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: "18px 22px 40px", minHeight: 0 }}>
                <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)", overflow: "hidden" }}>
                    {loading ? (
                        <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><LSpinner /></div>
                    ) : orders.length === 0 ? (
                        <LEmptyState icon={<ClipboardList className="h-8 w-8" />} title={t("orders.empty", "No orders found")} description={t("orders.tryDifferentFilter", "Try another tab, filter, or search.")} />
                    ) : (
                        <div className="lb-scroll" style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 880 }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...TH, textAlign: "left", paddingLeft: 18 }}>{t("orders.order", "Order")}</th>
                                        <th style={TH}>{t("customer.title", "Customer")}</th>
                                        <th style={TH}>{t("orders.type", "Type")}</th>
                                        <th style={TH}>{t("orders.status", "Status")}</th>
                                        <th style={TH}>{t("checkout.payment", "Payment")}</th>
                                        <th style={{ ...TH, textAlign: "right" }}>{t("pos.total", "Total")}</th>
                                        <th style={{ ...TH, textAlign: "right", paddingRight: 18 }}>{t("orders.updated", "Updated")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(({ order, dtype, total, pay, payRef, av }) => {
                                        const stRef = STATUS_TINT[order.status] || "c-slate";
                                        const tyRef = TYPE_TINT[dtype];
                                        const updated = (order.updatedAt || order.createdAt)?.toDate?.() || order.createdAt.toDate();
                                        return (
                                            <tr key={order.id} onClick={() => handleOpen(order.id)} tabIndex={0} role="button"
                                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpen(order.id); } }}
                                                style={{ cursor: "pointer", background: selectedId === order.id ? "var(--c-primary-soft)" : "transparent" }}
                                                onMouseEnter={(e) => { if (selectedId !== order.id) e.currentTarget.style.background = "var(--c-surface-2)"; }}
                                                onMouseLeave={(e) => { if (selectedId !== order.id) e.currentTarget.style.background = "transparent"; }}>
                                                <td style={{ ...TD, paddingLeft: 18, fontFamily: MONO, fontWeight: 600 }}>#{order.publicId}</td>
                                                <td style={TD}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                        <span style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: `var(--${av}-soft)`, color: `var(--${av})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 600 }}>{(order.customerName || "?").trim()[0]?.toUpperCase()}</span>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                                                                {order.customerName || t("customer.guest", "Guest")}
                                                                {order.orderSource === "online" && <Globe size={12} style={{ color: "var(--c-cyan)" }} />}
                                                            </div>
                                                            <div style={{ fontSize: 11, color: "var(--c-text-3)", fontFamily: MONO }}>{order.items.length} {t("pos.items", "pcs")}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={TD}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: `var(--${tyRef})`, whiteSpace: "nowrap" }}>
                                                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: `var(--${tyRef})` }} />{t(`orders.deliveryTypes.${dtype}`, dtype.replace("_", " "))}
                                                    </span>
                                                </td>
                                                <td style={TD}>
                                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: `var(--${stRef}-soft)`, color: `var(--${stRef})`, whiteSpace: "nowrap" }}>
                                                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: `var(--${stRef})` }} />{STATUS_LABELS[order.status]}
                                                    </span>
                                                </td>
                                                <td style={TD}><span style={{ fontSize: 12, fontWeight: 600, color: `var(--${payRef})` }}>{pay}</span></td>
                                                <td style={{ ...TD, textAlign: "right", fontFamily: MONO, fontWeight: 600 }}>{formatAmount(total)}</td>
                                                <td style={{ ...TD, paddingRight: 18, textAlign: "right", color: "var(--c-text-3)", fontSize: 12 }}>{timeAgo(updated)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!loading && orders.length > 0 && (
                        <div ref={loadMoreRef} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderTop: "1px solid var(--c-border)", fontSize: 12, color: "var(--c-text-3)" }}>
                            <span>{t("orders.showing", "Showing")} {orders.length}</span>
                            <span style={{ marginLeft: "auto" }}>{loadingMore ? <LSpinner size="sm" /> : !hasMore ? t("orders.noMore", "End of list") : ""}</span>
                        </div>
                    )}
                </div>
                {/* keep observer target alive even while empty list footer hidden */}
                {(!orders.length || loading) && <div ref={loadMoreRef} style={{ height: 1 }} />}
            </div>

            <OrderFilterSheet
                key="order-filter-sheet"
                open={filterSheetOpen}
                onClose={() => setFilterSheetOpen(false)}
                selectedDeliveryType={selectedDeliveryType}
                selectedStatus={selectedStatus}
                selectedOrderSource={selectedOrderSource}
                selectedSpecialFilter={specialFilter}
                onApply={handleFilterApply}
            />
        </div>
    );
}
