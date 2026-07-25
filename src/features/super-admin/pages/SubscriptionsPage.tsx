/**
 * Subscriptions Page (super-admin)
 *
 * Revenue-focused view: defaults to ACTIVE PAID subscriptions (so it no longer
 * mirrors the Shops list of every free shop), with a KPI header (active count,
 * estimated MRR, trialing, expiring) and view tabs. Fast: the data comes from a
 * cached 2-read batch (see useSubscriptions) with skeleton + retry.
 */

import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscriptions, type SubscriptionView } from "../hooks/use-subscriptions";
import { monthlyPrice } from "../lib/subscription-events";
import { LCard, LSkeletonList, LButton } from "@/components/laundry";
import {
    Search,
    Calendar,
    AlertTriangle,
    ChevronRight,
    Store,
    Phone,
    Mail,
    Wallet,
    RefreshCw,
    IndianRupee,
    Users,
    Clock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { PlanType } from "@/types/plans";
import { normalizePlanId } from "@/types/plans";
import { cn } from "@/lib/utils";

const VIEWS: { value: SubscriptionView; label: string }[] = [
    { value: "active", label: "Active" },
    { value: "trialing", label: "Trialing" },
    { value: "expiring", label: "Expiring" },
    { value: "past", label: "Expired / Cancelled" },
    { value: "free", label: "Free" },
    { value: "all", label: "All" },
];

const PLAN_COLORS: Record<PlanType, string> = {
    free: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    pro: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    pro_plus: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
    business: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    franchise: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

const PLAN_LABELS: Record<PlanType, string> = {
    free: "Free",
    pro: "Pro",
    pro_plus: "Pro+",
    business: "Business",
    franchise: "Franchise",
};

const STATUS_COLORS: Record<string, string> = {
    active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    trial: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    expired: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    free: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    grace_period: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

const PLAN_OPTIONS: { value: PlanType | "all"; label: string }[] = [
    { value: "all", label: "All Plans" },
    { value: "pro", label: "Pro" },
    { value: "pro_plus", label: "Pro+" },
    { value: "business", label: "Business" },
    { value: "franchise", label: "Franchise" },
    { value: "free", label: "Free" },
];

function providerLabel(provider?: string): string {
    switch (provider) {
        case "apple_iap":
            return "Apple IAP";
        case "google_play":
            return "Google Play";
        case "razorpay":
            return "Razorpay";
        case "manual":
            return "Manual";
        default:
            return provider || "";
    }
}

function Kpi({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone?: string }) {
    return (
        <LCard variant="outlined" padding="sm" className="min-w-0">
            <div className="flex items-center gap-2 text-muted-foreground">
                <span className={cn("shrink-0", tone)}>{icon}</span>
                <span className="text-[11px] font-medium uppercase tracking-wide truncate">{label}</span>
            </div>
            <p className="mt-1 text-xl font-bold text-foreground truncate">{value}</p>
        </LCard>
    );
}

export function SubscriptionsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [view, setView] = useState<SubscriptionView>("active");
    const [planFilter, setPlanFilter] = useState<PlanType | "all">("all");
    const navigate = useNavigate();

    const { subscriptions, kpis, loading, error, matchedCount, refresh } = useSubscriptions({
        view,
        planFilter,
        searchTerm,
    });

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground">Subscriptions</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {kpis.activePaid} active paid · {kpis.trialing} trialing · {kpis.free} free
                    </p>
                </div>
                <button
                    type="button"
                    onClick={refresh}
                    className="h-9 w-9 shrink-0 rounded-lg border border-input bg-background flex items-center justify-center hover:bg-muted transition-colors"
                    aria-label="Refresh"
                >
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi icon={<Users className="h-4 w-4" />} label="Active paid" value={String(kpis.activePaid)} tone="text-green-600" />
                <Kpi icon={<IndianRupee className="h-4 w-4" />} label="Est. MRR" value={`₹${kpis.mrr.toLocaleString("en-IN")}`} tone="text-primary" />
                <Kpi icon={<Clock className="h-4 w-4" />} label="Trialing" value={String(kpis.trialing)} tone="text-blue-600" />
                <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Expiring 7d" value={String(kpis.expiring)} tone="text-amber-600" />
            </div>

            {/* View tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
                {VIEWS.map((v) => (
                    <button
                        key={v.value}
                        onClick={() => setView(v.value)}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap shrink-0",
                            view === v.value
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                    >
                        {v.label}
                    </button>
                ))}
            </div>

            {/* Search + Plan dropdown */}
            <div className="flex gap-2">
                <div className="relative flex-1 min-w-[140px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search shop, email, phone, gateway ref…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm md:text-base"
                    />
                </div>
                <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value as PlanType | "all")}
                    className="h-11 px-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm min-w-[110px] shrink-0"
                    aria-label="Plan"
                >
                    {PLAN_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Loading — instant skeleton */}
            {loading && <LSkeletonList count={6} />}

            {/* Error */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-destructive">{error}</span>
                    <LButton variant="outline" size="sm" onClick={refresh}>
                        Retry
                    </LButton>
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && subscriptions.length === 0 && (
                <div className="text-center py-12">
                    <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-1">No subscriptions here</h3>
                    <p className="text-muted-foreground">
                        {searchTerm || planFilter !== "all"
                            ? "Try adjusting your search or filters"
                            : `No ${VIEWS.find((v) => v.value === view)?.label.toLowerCase()} subscriptions`}
                    </p>
                </div>
            )}

            {/* Subscriptions List */}
            {!loading && subscriptions.length > 0 && (
                <div className="grid gap-3">
                    {view !== "all" && (
                        <p className="text-xs text-muted-foreground">{matchedCount} shown</p>
                    )}
                    {subscriptions.map((sub) => {
                        const planId = normalizePlanId(sub.planId);
                        const endDate = sub.endDate?.toDate?.();
                        const startDate = sub.startDate?.toDate?.();
                        const nextDate = sub.nextPaymentDate?.toDate?.() || sub.currentPeriodEnd?.toDate?.();
                        const isExpiringSoon =
                            endDate &&
                            endDate <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
                            endDate >= new Date() &&
                            sub.status === "active";
                        const price = monthlyPrice(sub.planId, sub.billingCycle);
                        const phoneDisplay = sub.shopPhone || sub.ownerPhone || "";

                        return (
                            <LCard
                                key={sub.id}
                                variant="elevated"
                                padding="md"
                                className="cursor-pointer hover:border-primary/50 transition-colors"
                                onClick={() => navigate(`/super-admin/shops/${sub.shopId || sub.id}`)}
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
                                                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0", PLAN_COLORS[planId])}>
                                                    {PLAN_LABELS[planId]}
                                                </span>
                                                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium capitalize shrink-0", STATUS_COLORS[sub.status] || STATUS_COLORS.free)}>
                                                    {sub.status?.replace("_", " ")}
                                                </span>
                                                {sub.provider && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 inline-flex items-center gap-1 shrink-0">
                                                        <Wallet className="h-3 w-3" />
                                                        {providerLabel(sub.provider)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Row 2: Price + contact */}
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                                {price > 0 && (
                                                    <span className="font-medium text-foreground">
                                                        ₹{price.toLocaleString("en-IN")}/mo
                                                    </span>
                                                )}
                                                {phoneDisplay && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{phoneDisplay}</span>
                                                    </span>
                                                )}
                                                {sub.ownerEmail && (
                                                    <span className="flex items-center gap-1 truncate max-w-[180px]">
                                                        <Mail className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{sub.ownerEmail}</span>
                                                    </span>
                                                )}
                                            </div>

                                            {/* Row 3: Dates */}
                                            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
                                                {endDate && (
                                                    <span className={cn("flex items-center gap-1", isExpiringSoon && "text-amber-600 font-medium")}>
                                                        {isExpiringSoon && <AlertTriangle className="h-3 w-3" />}
                                                        <Calendar className="h-3 w-3" />
                                                        {isExpiringSoon
                                                            ? `Expires ${formatDistanceToNow(endDate, { addSuffix: true })}`
                                                            : `${sub.status === "cancelled" || sub.status === "expired" ? "Ended" : "Renews"} ${format(nextDate || endDate, "MMM d, yyyy")}`}
                                                    </span>
                                                )}
                                                {startDate && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        Since {format(startDate, "MMM d, yyyy")}
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
