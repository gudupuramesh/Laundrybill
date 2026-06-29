import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, limit, startAfter, getDocs, Timestamp, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDriverAuth } from "@/features/driver-app/DriverAuthContext";
import { LSelect, LBottomSheet } from "@/components/laundry";
import { CheckCircle2, Package, Truck, Store, Home, Filter, Calendar as CalendarIcon, Search, Loader2 } from "lucide-react";
import type { Order, DeliveryType } from "@/types/order";
import { DELIVERY_TYPE_LABELS, STATUS_LABELS } from "@/types/order";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";

const PAGE_SIZE = 15;

type DateFilterType = "today" | "yesterday" | "week" | "month" | "custom" | "all";

export function PlantCompletedPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { shopId } = useDriverAuth();

    // State
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // Filters
    const [dateFilter, setDateFilter] = useState<DateFilterType>("today");
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
    const [typeFilter, setTypeFilter] = useState<DeliveryType | "all">("all");
    const [searchTerm] = useState(""); // Add search state
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        total: 0,
        shopPickup: 0,
        homeDelivery: 0,
        pickupDelivery: 0
    });

    // Calculate date range based on filter
    const getEffectiveDateRange = () => {
        const now = new Date();
        switch (dateFilter) {
            case "today":
                return { start: startOfDay(now), end: endOfDay(now) };
            case "yesterday":
                const yesterday = subDays(now, 1);
                return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
            case "week":
                return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
            case "month":
                return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
            case "custom":
                if (customDateRange?.from && customDateRange?.to) {
                    return { start: startOfDay(customDateRange.from), end: endOfDay(customDateRange.to) };
                }
                return null;
            default:
                return null;
        }
    };

    // Fetch orders
    const fetchOrders = async (loadMore = false) => {
        if (!shopId) return;

        if (loadMore) {
            setLoadingMore(true);
        } else {
            setLoading(true);
            setOrders([]);
            setLastDoc(null);
        }

        try {
            const ordersRef = collection(db, "shops", shopId, "orders");

            // Build query constraints
            let constraints: any[] = [];

            if (searchTerm.trim()) {
                // If searching, ignore date/status filters and search strictly by ID
                const term = searchTerm.trim();
                // Try searching by publicId (Order Number)
                // Note: This requires an exact match or strictly indexed query.
                // For 'completed' page, usually we want to find a specific past order.
                // We'll search for exact match on 'publicId' OR 'orderNumber'
                constraints = [
                    where("publicId", "==", term),
                    limit(5)
                ];

                // Note: Boolean-OR queries in Firebase are tricky, so we might need two queries
                // or just rely on publicId which is the main ID used.
            } else {
                // Standard Filter Logic
                constraints = [
                    where("status", "in", ["delivered", "picked_up"]),
                    orderBy("updatedAt", "desc"),
                    limit(PAGE_SIZE)
                ];

                // Add date filter
                const dateRange = getEffectiveDateRange();
                if (dateRange) {
                    constraints.splice(1, 0, where("updatedAt", ">=", Timestamp.fromDate(dateRange.start)));
                    constraints.splice(2, 0, where("updatedAt", "<=", Timestamp.fromDate(dateRange.end)));
                }

                // Add pagination
                if (loadMore && lastDoc) {
                    constraints.push(startAfter(lastDoc));
                }
            }

            const q = query(ordersRef, ...constraints);
            const snapshot = await getDocs(q);

            const newOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Order[];

            const filteredOrders = typeFilter === "all"
                ? newOrders
                : newOrders.filter(o => o.deliveryType === typeFilter);

            if (loadMore) {
                setOrders(prev => [...prev, ...filteredOrders]);
            } else {
                setOrders(filteredOrders);
                // Stats only update on full load without search? Or keep them?
                // Let's keep stats for now.
                if (!searchTerm) {
                    const allTypesOrders = newOrders;
                    setStats({
                        total: allTypesOrders.length,
                        shopPickup: allTypesOrders.filter(o => o.deliveryType === "pickup_store").length,
                        homeDelivery: allTypesOrders.filter(o => o.deliveryType === "delivery_home").length,
                        pickupDelivery: allTypesOrders.filter(o => o.deliveryType === "pickup_home").length
                    });
                }
            }

            setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMore(snapshot.docs.length === PAGE_SIZE);

        } catch (error) {
            console.error("Error fetching completed orders:", error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        if (dateFilter !== "custom" || (customDateRange?.from && customDateRange?.to)) {
            fetchOrders();
        }
    }, [shopId, dateFilter, customDateRange, typeFilter]);

    const loadMore = () => {
        if (!loadingMore && hasMore) {
            fetchOrders(true);
        }
    };

    const getDeliveryIcon = (type: DeliveryType) => {
        switch (type) {
            case "pickup_store": return <Store size={12} />;
            case "delivery_home": return <Truck size={12} />;
            case "pickup_home": return <Home size={12} />;
            default: return <Package size={12} />;
        }
    };

    // KPI tiles for summary stats
    const kpis = [
        { label: "Total Loaded", value: stats.total, ref: "c-primary", soft: "c-primary-soft", icon: <CheckCircle2 size={15} /> },
        { label: "Shop Pickup", value: stats.shopPickup, ref: "c-info", soft: "c-info-soft", icon: <Store size={15} /> },
        { label: "Home Delivery", value: stats.homeDelivery, ref: "c-success", soft: "c-success-soft", icon: <Truck size={15} /> },
        { label: "Pickup & Delivery", value: stats.pickupDelivery, ref: "c-violet", soft: "c-violet-soft", icon: <Home size={15} /> },
    ];

    const datePresets: DateFilterType[] = ["today", "yesterday", "week", "month", "all"];
    const typeOptions = [
        { value: "all", label: "All Types" },
        { value: "pickup_store", label: "Shop Pickup" },
        { value: "delivery_home", label: "Home Delivery" },
        { value: "pickup_home", label: "Pickup & Delivery" },
    ];

    // Segmented date-preset chip
    const segChip = (active: boolean): CSSProperties => ({
        cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600,
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 14px", borderRadius: 20,
        background: active ? "var(--c-primary)" : "var(--c-surface)",
        color: active ? "#fff" : "var(--c-text-2)",
        border: active ? "1px solid var(--c-primary)" : "1px solid var(--c-border)",
        boxShadow: active ? "var(--sh-sm)" : "none",
    });

    const inputStyle: CSSProperties = {
        width: "100%", font: "inherit", fontSize: 14, color: "var(--c-text)",
        background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
        borderRadius: 9, padding: "11px 13px 11px 38px", outline: "none",
    };

    // Render Filter Controls (mobile bottom sheet)
    const FilterControls = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>Time Period</label>
                <LSelect
                    value={dateFilter === 'custom' ? 'custom' : dateFilter}
                    onChange={(v) => {
                        if (v === 'custom') {
                            setDateFilter('custom');
                        } else {
                            setDateFilter(v as DateFilterType);
                        }
                    }}
                    options={[
                        { value: "today", label: "Today" },
                        { value: "yesterday", label: "Yesterday" },
                        { value: "week", label: "Last 7 Days" },
                        { value: "month", label: "Last 30 Days" },
                        { value: "all", label: "All Time" },
                        { value: "custom", label: "Custom Range" },
                    ]}
                />
            </div>

            {/* Custom Date Range Picker - Collapsible */}
            <div style={{
                overflow: "hidden", transition: "all .3s ease-in-out",
                maxHeight: dateFilter === "custom" ? 400 : 0,
                opacity: dateFilter === "custom" ? 1 : 0,
            }}>
                <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <p style={{ fontSize: 13, color: "var(--c-text-3)", marginBottom: 12, fontWeight: 500 }}>Select Start and End Date</p>
                    <DayPicker
                        mode="range"
                        selected={customDateRange}
                        onSelect={setCustomDateRange}
                        numberOfMonths={1}
                        className="border-0"
                        classNames={{
                            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                            day_today: "bg-accent text-accent-foreground font-bold",
                        }}
                        footer={
                            <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--c-primary)" }}>
                                {customDateRange?.from && customDateRange?.to
                                    ? `${format(customDateRange.from, 'MMM dd')} – ${format(customDateRange.to, 'MMM dd, yyyy')}`
                                    : "Pick a date range"}
                            </div>
                        }
                    />
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>Order Type</label>
                <LSelect
                    value={typeFilter}
                    onChange={(v) => setTypeFilter(v as DeliveryType | "all")}
                    options={typeOptions}
                    className="w-full"
                />
            </div>

            <button onClick={() => setIsFilterOpen(false)} style={{ ...btnPrimary, width: "100%", marginTop: 4 }}>
                Apply Filters
            </button>
        </div>
    );

    const th: CSSProperties = { textAlign: "left", padding: "8px 14px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-text-3)", borderBottom: "1px solid var(--c-border)" };

    return (
        <div style={{ color: "var(--c-text)", fontSize: 14, lineHeight: 1.45, padding: "20px 22px 40px" }}>

            {/* ===== Header ===== */}
            <div style={{ marginBottom: 16 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", margin: 0 }}>
                    {t('plant.completed.title', 'Completed Orders')}
                </h1>
                <p style={{ fontSize: 13, color: "var(--c-text-3)", margin: "4px 0 0" }}>
                    {t('plant.completed.subtitle', 'Delivered & Picked up orders')}
                </p>
            </div>

            {/* ===== KPI ROW ===== */}
            <div className="lb-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
                {kpis.map((k) => (
                    <div key={k.label} style={{ ...card, padding: "15px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <ChipIcon soft={k.soft} refColor={k.ref}>{k.icon}</ChipIcon>
                            <span style={{ fontSize: 11.5, color: "var(--c-text-3)", fontWeight: 500 }}>{k.label}</span>
                        </div>
                        <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 25, letterSpacing: "-.02em", marginTop: 11, color: `var(--${k.ref})` }}>{k.value}</div>
                    </div>
                ))}
            </div>

            {/* ===== Desktop Filters ===== */}
            <div className="hidden md:block" style={{ marginBottom: 16 }}>
                <div style={{ ...card, padding: "16px 18px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-text-3)", marginRight: 4 }}>Period:</span>
                                {datePresets.map((f) => (
                                    <button key={f} onClick={() => setDateFilter(f)} style={segChip(dateFilter === f)}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                                <button onClick={() => setDateFilter("custom")} style={segChip(dateFilter === "custom")}>
                                    <CalendarIcon size={13.5} />
                                    Custom
                                </button>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 180 }}>
                                    <LSelect
                                        value={typeFilter}
                                        onChange={(v) => setTypeFilter(v as DeliveryType | "all")}
                                        options={typeOptions}
                                        placeholder="Order Type"
                                    />
                                </div>
                                <div style={{ position: "relative", width: 220 }}>
                                    <Search size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                                    <input
                                        type="text"
                                        placeholder="Search Order ID..."
                                        style={inputStyle}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                // Handle search logic here
                                            }
                                        }}
                                        onChange={() => {
                                            // Optional: live search or state update
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Custom Date Range Picker - Collapsible */}
                        <div style={{
                            overflow: "hidden", transition: "all .3s ease-in-out",
                            maxHeight: dateFilter === "custom" ? 400 : 0,
                            opacity: dateFilter === "custom" ? 1 : 0,
                        }}>
                            <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 16, marginTop: 8, display: "flex", justifyContent: "center" }}>
                                <DayPicker
                                    mode="range"
                                    selected={customDateRange}
                                    onSelect={setCustomDateRange}
                                    numberOfMonths={2}
                                    className="border rounded-lg p-4"
                                    classNames={{
                                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                                        day_today: "bg-accent text-accent-foreground font-bold",
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== Mobile Filter Button ===== */}
            <div className="md:hidden" style={{ marginBottom: 16 }}>
                <button onClick={() => setIsFilterOpen(true)} style={{ ...btnOutline, width: "100%" }}>
                    <Filter size={16} />
                    Filters: {dateFilter === 'custom' ? 'Custom Range' : dateFilter.charAt(0).toUpperCase() + dateFilter.slice(1)} • {typeFilter === 'all' ? 'All Types' : typeFilter}
                </button>
            </div>

            {/* ===== Mobile Filter Sheet ===== */}
            <LBottomSheet
                open={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                title="Filter Orders"
                snapPoints={[0.85]}
            >
                <div style={{ padding: 16 }}>
                    <FilterControls />
                </div>
            </LBottomSheet>

            {/* ===== Orders List ===== */}
            <div style={{ ...card, overflow: "hidden" }}>
                {/* Section header */}
                <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 18px 12px", borderBottom: "1px solid var(--c-border)" }}>
                    <ChipIcon soft="c-success-soft" refColor="c-success"><CheckCircle2 size={17} /></ChipIcon>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>Completed orders</div>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>Showing {orders.length} orders</div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
                        <Loader2 className="animate-spin" size={26} style={{ color: "var(--c-primary)" }} />
                    </div>
                ) : orders.length === 0 ? (
                    <div style={{ padding: "48px 12px", textAlign: "center", color: "var(--c-text-3)" }}>
                        <CheckCircle2 size={44} style={{ margin: "0 auto 14px", display: "block", color: "var(--c-border-strong)" }} />
                        <p style={{ margin: 0 }}>{t('plant.completed.empty', 'No completed orders found')}</p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead><tr style={{ background: "var(--c-surface-2)" }}>
                                {["Order", "Customer", "Type", "Status", "Completed"].map((h) => <th key={h} style={th}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {orders.map((order) => (
                                    <tr
                                        key={order.id}
                                        onClick={() => navigate(`/plant/orders/${order.id}`)}
                                        style={{ borderBottom: "1px solid var(--c-border)", cursor: "pointer" }}
                                    >
                                        <td style={{ padding: "9px 14px" }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ width: 26, height: 26, flex: "none", borderRadius: 7, background: "var(--c-success-soft)", color: "var(--c-success)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                                                    <CheckCircle2 size={14} />
                                                </span>
                                                <span style={{ fontFamily: MONO, fontWeight: 700 }}>{order.orderNumber}</span>
                                            </span>
                                        </td>
                                        <td style={{ padding: "9px 14px", fontWeight: 500 }}>
                                            <span style={{ display: "inline-block", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{order.customerName}</span>
                                        </td>
                                        <td style={{ padding: "9px 14px" }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--c-text-2)" }}>
                                                {getDeliveryIcon(order.deliveryType)}
                                                {DELIVERY_TYPE_LABELS[order.deliveryType]}
                                            </span>
                                        </td>
                                        <td style={{ padding: "9px 14px" }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: "var(--c-success-soft)", color: "var(--c-success)" }}>
                                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--c-success)" }} />
                                                {STATUS_LABELS[order.status]}
                                            </span>
                                        </td>
                                        <td style={{ padding: "9px 14px", fontFamily: MONO, color: "var(--c-text-3)", whiteSpace: "nowrap" }}>
                                            {order.updatedAt?.toDate
                                                ? format(order.updatedAt.toDate(), "dd MMM, hh:mm a")
                                                : "N/A"
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {!loading && hasMore && (
                <div style={{ textAlign: "center", paddingTop: 16 }}>
                    <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        style={{ ...btnOutline, minWidth: 200, opacity: loadingMore ? 0.6 : 1, cursor: loadingMore ? "default" : "pointer" }}
                    >
                        {loadingMore ? <Loader2 className="animate-spin" size={16} /> : "Load More Orders"}
                    </button>
                </div>
            )}
        </div>
    );
}

/* ===== helpers ===== */
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)" };
const btnPrimary: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "10px 16px", boxShadow: "var(--sh-sm)" };
const btnOutline: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-surface)", border: "1px solid var(--c-primary)", borderRadius: 9, padding: "10px 16px" };

function ChipIcon({ children, soft, refColor }: { children: ReactNode; soft: string; refColor: string }) {
    return <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${soft})`, color: `var(--${refColor})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>;
}
