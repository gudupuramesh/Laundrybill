import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, limit, startAfter, getDocs, Timestamp, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDriverAuth } from "@/features/driver-app/DriverAuthContext";
import { LCard, LButton, LSpinner, LBadge, LSelect, LBottomSheet } from "@/components/laundry";
import { CheckCircle2, Package, Truck, Store, Home, Filter, Calendar as CalendarIcon, Search } from "lucide-react";
import type { Order, DeliveryType } from "@/types/order";
import { DELIVERY_TYPE_LABELS, STATUS_LABELS } from "@/types/order";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { cn } from "@/lib/utils";

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
            case "pickup_store": return <Store className="h-3 w-3" />;
            case "delivery_home": return <Truck className="h-3 w-3" />;
            case "pickup_home": return <Home className="h-3 w-3" />;
            default: return <Package className="h-3 w-3" />;
        }
    };

    // Render Filter Controls
    const FilterControls = () => (
        <div className="space-y-6">
            <div className="space-y-3">
                <label className="text-sm font-medium text-foreground block">Time Period</label>

                {/* Mobile Dropdown for Date Presets */}
                <div className="block md:hidden">
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

                {/* Desktop Buttons for Date Presets */}
                <div className="hidden md:flex flex-wrap gap-2">
                    {["today", "yesterday", "week", "month", "all"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setDateFilter(f as DateFilterType)}
                            className={cn(
                                "px-4 py-2 text-sm rounded-full border transition-all duration-200 font-medium",
                                dateFilter === f
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                    <button
                        onClick={() => setDateFilter("custom")}
                        className={cn(
                            "px-4 py-2 text-sm rounded-full border transition-all duration-200 font-medium flex items-center gap-2",
                            dateFilter === "custom"
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <CalendarIcon className="h-4 w-4" />
                        Custom
                    </button>
                </div>
            </div>

            {/* Custom Date Range Picker - Collapsible */}
            <div className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                dateFilter === "custom" ? "max-h-[400px] opacity-100 mb-4" : "max-h-0 opacity-0"
            )}>
                <div className="border rounded-xl p-4 bg-card shadow-sm flex flex-col items-center">
                    <p className="text-sm text-muted-foreground mb-3 font-medium">Select Start and End Date</p>
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
                            <div className="mt-4 text-center text-sm font-medium text-primary">
                                {customDateRange?.from && customDateRange?.to
                                    ? `${format(customDateRange.from, 'MMM dd')} – ${format(customDateRange.to, 'MMM dd, yyyy')}`
                                    : "Pick a date range"}
                            </div>
                        }
                    />
                </div>
            </div>

            <div className="space-y-3">
                <label className="text-sm font-medium text-foreground block">Order Type</label>
                <LSelect
                    value={typeFilter}
                    onChange={(v) => setTypeFilter(v as DeliveryType | "all")}
                    options={[
                        { value: "all", label: "All Types" },
                        { value: "pickup_store", label: "Shop Pickup" },
                        { value: "delivery_home", label: "Home Delivery" },
                        { value: "pickup_home", label: "Pickup & Delivery" },
                    ]}
                    className="w-full md:w-64"
                />
            </div>

            <LButton fullWidth onClick={() => setIsFilterOpen(false)} className="md:hidden mt-6">
                Apply Filters
            </LButton>
        </div>
    );

    return (
        <div className="space-y-6 md:pb-0">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold font-display text-gray-900 dark:text-gray-100">
                    {t('plant.completed.title', 'Completed Orders')}
                </h1>
                <p className="text-gray-500 text-sm">
                    {t('plant.completed.subtitle', 'Delivered & Picked up orders')}
                </p>
            </div>

            {/* Stats Cards - Vertical Stack on Mobile */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <LCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">Total Loaded</div>
                </LCard>
                {/* Always visible now, grid layout handles stacking */}
                <LCard className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <Store className="h-4 w-4 text-blue-500" />
                        <span className="text-xl font-bold">{stats.shopPickup}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Shop Pickup</div>
                </LCard>
                <LCard className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <Truck className="h-4 w-4 text-green-500" />
                        <span className="text-xl font-bold">{stats.homeDelivery}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Home Delivery</div>
                </LCard>
                <LCard className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <Home className="h-4 w-4 text-purple-500" />
                        <span className="text-xl font-bold">{stats.pickupDelivery}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Pickup & Delivery</div>
                </LCard>
            </div>

            {/* Desktop Filters */}
            <div className="hidden md:block">
                <LCard className="p-4">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground mr-2">Period:</span>
                                {["today", "yesterday", "week", "month", "all"].map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setDateFilter(f as DateFilterType)}
                                        className={cn(
                                            "px-3 py-1.5 text-sm rounded-full border transition-all duration-200 font-medium",
                                            dateFilter === f
                                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setDateFilter("custom")}
                                    className={cn(
                                        "px-3 py-1.5 text-sm rounded-full border transition-all duration-200 font-medium flex items-center gap-2",
                                        dateFilter === "custom"
                                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                            : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <CalendarIcon className="h-3.5 w-3.5" />
                                    Custom
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-[180px]">
                                    <LSelect
                                        value={typeFilter}
                                        onChange={(v) => setTypeFilter(v as DeliveryType | "all")}
                                        options={[
                                            { value: "all", label: "All Types" },
                                            { value: "pickup_store", label: "Shop Pickup" },
                                            { value: "delivery_home", label: "Home Delivery" },
                                            { value: "pickup_home", label: "Pickup & Delivery" },
                                        ]}
                                        placeholder="Order Type"
                                    />
                                </div>
                                <div className="relative w-[220px]">
                                    <input
                                        type="text"
                                        placeholder="Search Order ID..."
                                        className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                // Handle search logic here
                                            }
                                        }}
                                        onChange={() => {
                                            // Optional: live search or state update
                                        }}
                                    />
                                    <div className="absolute left-3 top-2.5 text-muted-foreground">
                                        <Search className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Custom Date Range Picker - Collapsible */}
                        <div className={cn(
                            "overflow-hidden transition-all duration-300 ease-in-out",
                            dateFilter === "custom" ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
                        )}>
                            <div className="border-t pt-4 mt-2 flex justify-center">
                                <DayPicker
                                    mode="range"
                                    selected={customDateRange}
                                    onSelect={setCustomDateRange}
                                    numberOfMonths={2}
                                    className="border rounded-lg p-4 bg-card"
                                    classNames={{
                                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                                        day_today: "bg-accent text-accent-foreground font-bold",
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </LCard>
            </div>

            {/* Mobile Filter Button */}
            <div className="md:hidden">
                <LButton
                    variant="outline"
                    fullWidth
                    onClick={() => setIsFilterOpen(true)}
                    leftIcon={<Filter className="h-4 w-4" />}
                >
                    Filters: {dateFilter === 'custom' ? 'Custom Range' : dateFilter.charAt(0).toUpperCase() + dateFilter.slice(1)} • {typeFilter === 'all' ? 'All Types' : typeFilter}
                </LButton>
            </div>

            {/* Mobile Filter Sheet */}
            <LBottomSheet
                open={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                title="Filter Orders"
                snapPoints={[0.85]}
            >
                <div className="p-4">
                    <FilterControls />
                </div>
            </LBottomSheet>

            {/* Orders List */}
            <LCard className="divide-y relative">
                <div className="p-3 bg-muted/20 text-xs text-center text-muted-foreground md:hidden border-b">
                    Showing {orders.length} orders
                </div>

                {loading ? (
                    <div className="p-8 flex justify-center">
                        <LSpinner size="lg" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p>{t('plant.completed.empty', 'No completed orders found')}</p>
                    </div>
                ) : (
                    <>
                        {orders.map((order) => (
                            <div
                                key={order.id}
                                className="p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                                onClick={() => navigate(`/plant/orders/${order.id}`)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{order.orderNumber}</span>
                                                <LBadge variant="success" className="text-[10px] px-1.5 py-0 h-5">
                                                    {STATUS_LABELS[order.status]}
                                                </LBadge>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                                                <span className="truncate max-w-[120px]">{order.customerName}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    {getDeliveryIcon(order.deliveryType)}
                                                    <span className="hidden sm:inline">{DELIVERY_TYPE_LABELS[order.deliveryType]}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right text-xs text-muted-foreground">
                                        {order.updatedAt?.toDate
                                            ? format(order.updatedAt.toDate(), "dd MMM, hh:mm a")
                                            : "N/A"
                                        }
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </LCard>

            {!loading && hasMore && (
                <div className="text-center pb-8">
                    <LButton
                        variant="outline"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="min-w-[200px]"
                    >
                        {loadingMore ? <LSpinner size="sm" /> : "Load More Orders"}
                    </LButton>
                </div>
            )}
        </div>
    );
}
