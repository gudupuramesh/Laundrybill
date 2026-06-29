/**
 * Shops List Page
 *
 * Lists all registered shops with search, filter, subscription, storage, and details view.
 * Mobile-friendly with bottom nav (in layout).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAllShops } from "../hooks/use-all-shops";
import { LCard, LPageLoader, LButton, LBottomSheet } from "@/components/laundry";
import {
    Search,
    Filter,
    ChevronRight,
    Store,
    Phone,
    Mail,
    Calendar,
    CreditCard,
    MapPin,
} from "lucide-react";
import { format } from "date-fns";
import type { PlanType } from "@/types/plans";
import { normalizePlanId } from "@/types/plans";
import { cn } from "@/lib/utils";

const PLAN_COLORS: Record<PlanType, string> = {
    free: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    pro: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    pro_plus: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
    business: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

const PLAN_LABELS: Record<PlanType, string> = {
    free: "Free",
    pro: "Pro",
    pro_plus: "Pro+",
    business: "Business",
};

const PLAN_OPTIONS: { value: PlanType | "all"; label: string }[] = [
    { value: "all", label: "All Plans" },
    { value: "free", label: "Free" },
    { value: "pro", label: "Pro" },
    { value: "business", label: "Business" },
];

export function ShopsPage() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [planFilter, setPlanFilter] = useState<PlanType | "all">("all");
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);

    const { shops, loading, error, hasMore, total, loadMore } = useAllShops({
        searchTerm,
        planFilter,
    });

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">All Shops</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {total} registered shops on the platform
                </p>
            </div>

            {/* Search + Filter (filter opens bottom sheet on mobile) */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by name, phone, or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setFilterSheetOpen(true)}
                    className={cn(
                        "h-10 px-3 rounded-lg border border-input bg-background flex items-center gap-2 shrink-0",
                        "hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                    )}
                    aria-label="Filter by plan"
                >
                    <Filter className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground hidden sm:inline">
                        {PLAN_OPTIONS.find((o) => o.value === planFilter)?.label ?? "Plan"}
                    </span>
                </button>
            </div>

            {/* Filter bottom sheet */}
            <LBottomSheet
                open={filterSheetOpen}
                onClose={() => setFilterSheetOpen(false)}
                title="Filter by plan"
                snapPoints={[0.4]}
            >
                <div className="p-4 space-y-2">
                    {PLAN_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => {
                                setPlanFilter(opt.value);
                                setFilterSheetOpen(false);
                            }}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors",
                                planFilter === opt.value
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/50 text-foreground hover:bg-muted"
                            )}
                        >
                            <CreditCard className="h-4 w-4 shrink-0" />
                            {opt.label}
                        </button>
                    ))}
                </div>
            </LBottomSheet>

            {/* Loading */}
            {loading && shops.length === 0 && (
                <div className="flex items-center justify-center h-40">
                    <LPageLoader message="Loading shops..." />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive">
                    {error}
                </div>
            )}

            {/* Shops List */}
            {!loading && shops.length === 0 && (
                <div className="text-center py-12">
                    <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-1">No shops found</h3>
                    <p className="text-muted-foreground">
                        {searchTerm || planFilter !== "all"
                            ? "Try adjusting your search or filters"
                            : "No shops have registered yet"}
                    </p>
                </div>
            )}

            {shops.length > 0 && (
                <div className="grid gap-3 md:gap-4">
                    {shops.map((shop) => {
                        const planKey = normalizePlanId(shop.subscription?.planId);
                        const subStatus = shop.subscription?.status || "free";
                        const statusColor =
                            subStatus === "active" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : subStatus === "expired" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            : subStatus === "cancelled" ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
                        const cityName = (shop as any).location?.city || "";
                        return (
                            <LCard
                                key={shop.id}
                                variant="elevated"
                                padding="md"
                                className="cursor-pointer hover:border-primary/50 transition-colors"
                                onClick={() => navigate(`/super-admin/shops/${shop.id}`)}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 md:gap-4 min-w-0 flex-1">
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <Store className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-foreground truncate">
                                                    {shop.name || "Unnamed Shop"}
                                                </h3>
                                                <span
                                                    className={cn(
                                                        "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                                                        PLAN_COLORS[planKey]
                                                    )}
                                                >
                                                    {PLAN_LABELS[planKey]}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "px-2 py-0.5 rounded-full text-[10px] font-medium capitalize shrink-0",
                                                        statusColor
                                                    )}
                                                >
                                                    {subStatus}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-muted-foreground">
                                                {cityName && (
                                                    <span className="flex items-center gap-1 shrink-0">
                                                        <MapPin className="h-3.5 w-3.5" />
                                                        {cityName}
                                                    </span>
                                                )}
                                                {shop.phone && (
                                                    <span className="flex items-center gap-1 truncate">
                                                        <Phone className="h-3.5 w-3.5 shrink-0" />
                                                        {shop.phone}
                                                    </span>
                                                )}
                                                {shop.email && (
                                                    <span className="flex items-center gap-1 truncate max-w-[180px] md:max-w-none">
                                                        <Mail className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="truncate">{shop.email}</span>
                                                    </span>
                                                )}
                                                {shop.createdAt && (
                                                    <span className="flex items-center gap-1 shrink-0">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        Joined{" "}
                                                        {format(
                                                            shop.createdAt.toDate?.() || new Date(),
                                                            "MMM yyyy"
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                                </div>
                            </LCard>
                        );
                    })}

                    {/* Load More */}
                    {hasMore && (
                        <div className="text-center pt-4">
                            <LButton
                                variant="outline"
                                onClick={loadMore}
                                loading={loading}
                            >
                                Load More Shops
                            </LButton>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
