/**
 * Subscriptions Page
 * 
 * Lists all subscriptions with filtering
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscriptions } from "../hooks/use-subscriptions";
import { LCard, LPageLoader, LBottomSheet } from "@/components/laundry";
import {
    Search,
    Filter,
    CreditCard,
    Calendar,
    AlertTriangle,
    ChevronRight,
    Store,
    Phone,
    Mail,
    UserPlus,
    Wallet,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { SubscriptionStatus } from "@/types/super-admin";
import type { PlanType } from "@/types/plans";
import { normalizePlanId } from "@/types/plans";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: { value: SubscriptionStatus | "all" | "expiring"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "free", label: "Free" },
    { value: "expiring", label: "Expiring Soon" },
    { value: "expired", label: "Expired" },
    { value: "cancelled", label: "Cancelled" },
];

const PLAN_COLORS: Record<PlanType, string> = {
    free: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    pro: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    business: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

const PLAN_LABELS: Record<PlanType, string> = {
    free: "Free",
    pro: "Pro",
    business: "Business",
};

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
    active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    trial: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    expired: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    free: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    grace_period: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

const PLAN_OPTIONS: { value: PlanType | "all"; label: string }[] = [
    { value: "all", label: "All Plans" },
    { value: "free", label: "Free" },
    { value: "pro", label: "Pro" },
    { value: "business", label: "Business" },
];

export function SubscriptionsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "all" | "expiring">("all");
    const [planFilter, setPlanFilter] = useState<PlanType | "all">("all");
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const navigate = useNavigate();

    const { subscriptions, loading, error } = useSubscriptions({
        statusFilter,
        planFilter,
        searchTerm,
    });

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">Subscriptions</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Manage shop subscriptions and plans
                </p>
            </div>

            {/* Search + Plan dropdown (above) + Filter button (opens bottom sheet for status + plan) */}
            <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[140px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by shop name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                    />
                </div>
                <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value as PlanType | "all")}
                    className="h-10 px-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm min-w-[100px] shrink-0"
                    aria-label="Plan"
                >
                    {PLAN_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => setFilterSheetOpen(true)}
                    className={cn(
                        "h-10 px-3 rounded-lg border border-input bg-background flex items-center gap-2 shrink-0",
                        "hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                    )}
                    aria-label="Filter"
                >
                    <Filter className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground hidden sm:inline">Filter</span>
                </button>
            </div>

            {/* Filter bottom sheet: Status chips + Plan dropdown + Apply/Reset */}
            <LBottomSheet
                open={filterSheetOpen}
                onClose={() => setFilterSheetOpen(false)}
                title="Filters"
                snapPoints={[0.5]}
            >
                <div className="p-4 space-y-4">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {STATUS_FILTERS.map((f) => (
                                <button
                                    key={f.value}
                                    onClick={() => setStatusFilter(f.value)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                                        statusFilter === f.value
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    )}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Plan</p>
                        <select
                            value={planFilter}
                            onChange={(e) => setPlanFilter(e.target.value as PlanType | "all")}
                            className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        >
                            {PLAN_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setStatusFilter("all");
                                setPlanFilter("all");
                                setFilterSheetOpen(false);
                            }}
                            className="flex-1 py-3 rounded-lg border border-input bg-muted/50 text-foreground font-medium text-sm hover:bg-muted transition-colors"
                        >
                            Reset
                        </button>
                        <button
                            onClick={() => setFilterSheetOpen(false)}
                            className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            </LBottomSheet>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center h-40">
                    <LPageLoader message="Loading subscriptions..." />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive">
                    {error}
                </div>
            )}

            {/* Empty State */}
            {!loading && subscriptions.length === 0 && (
                <div className="text-center py-12">
                    <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-1">No subscriptions found</h3>
                    <p className="text-muted-foreground">
                        {searchTerm || statusFilter !== "all" || planFilter !== "all"
                            ? "Try adjusting your filters"
                            : "No subscriptions have been created yet"}
                    </p>
                </div>
            )}

            {/* Subscriptions List */}
            {!loading && subscriptions.length > 0 && (
                <div className="grid gap-3">
                    {subscriptions.map((sub) => {
                        const endDate = sub.endDate?.toDate?.();
                        const joinedDate = sub.shopJoinedAt?.toDate?.() || sub.createdAt?.toDate?.();
                        const isExpiringSoon = endDate &&
                            endDate <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
                            sub.status === "active";
                        const phoneDisplay = sub.shopPhone || sub.ownerPhone || "";
                        const displayPlanId = normalizePlanId(sub.planId);

                        return (
                            <LCard
                                key={sub.id}
                                variant="elevated"
                                padding="md"
                                className="cursor-pointer hover:border-primary/50 transition-colors"
                                onClick={() => navigate(`/super-admin/shops/${sub.shopId}`)}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                            <Store className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            {/* Row 1: Shop name + badges */}
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <h3 className="font-semibold text-sm truncate max-w-[160px] md:max-w-none">
                                                    {sub.shopName || "Unnamed Shop"}
                                                </h3>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0",
                                                    PLAN_COLORS[displayPlanId]
                                                )}>
                                                    {PLAN_LABELS[displayPlanId]}
                                                </span>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-medium capitalize shrink-0",
                                                    STATUS_COLORS[sub.status]
                                                )}>
                                                    {sub.status}
                                                </span>
                                                {sub.provider && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 inline-flex items-center gap-1">
                                                        <Wallet className="h-3 w-3" />
                                                        {sub.provider === "apple_iap"
                                                            ? "Apple IAP"
                                                            : sub.provider === "google_play"
                                                                ? "Google Play"
                                                                : sub.provider === "razorpay"
                                                                    ? "Legacy"
                                                                    : sub.provider}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Row 2: Contact info */}
                                            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                                {/* Phone */}
                                                {phoneDisplay && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{phoneDisplay}</span>
                                                    </span>
                                                )}
                                                {/* Email */}
                                                {sub.ownerEmail && (
                                                    <span className="flex items-center gap-1">
                                                        <Mail className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{sub.ownerEmail}</span>
                                                    </span>
                                                )}
                                                {(sub.providerRef || sub.providerOrderId) && (
                                                    <span className="truncate">
                                                        Ref: {sub.providerRef || sub.providerOrderId}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Row 3: Dates */}
                                            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
                                                {endDate && (
                                                    <span className={cn(
                                                        "flex items-center gap-1",
                                                        isExpiringSoon && "text-warning font-medium"
                                                    )}>
                                                        {isExpiringSoon && <AlertTriangle className="h-3 w-3" />}
                                                        <Calendar className="h-3 w-3" />
                                                        {isExpiringSoon
                                                            ? `Expires ${formatDistanceToNow(endDate, { addSuffix: true })}`
                                                            : `Expires ${format(endDate, "MMM d, yyyy")}`
                                                        }
                                                    </span>
                                                )}
                                                {joinedDate && (
                                                    <span className="flex items-center gap-1">
                                                        <UserPlus className="h-3 w-3" />
                                                        Joined {format(joinedDate, "MMM d, yyyy")}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-2" />
                                </div>
                            </LCard>
                        );
                    })}
                </div>
            )}

        </div>
    );
}
