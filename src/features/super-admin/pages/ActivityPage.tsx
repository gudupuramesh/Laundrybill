/**
 * Activity Page
 * 
 * Shows platform activity logs with filtering
 */

import { useState } from "react";
import { useActivityLogs, ACTIVITY_TYPE_CONFIG } from "../hooks/use-activity-logs";
import { LCard, LPageLoader, LButton } from "@/components/laundry";
import {
    Activity,
    Store,
    CreditCard,
    User,
    ChevronDown,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { ActivityType } from "@/types/super-admin";
import { cn } from "@/lib/utils";

const TYPE_FILTERS: { value: ActivityType | "all"; label: string }[] = [
    { value: "all", label: "All Activity" },
    { value: "subscription_created", label: "Subscriptions" },
    { value: "payment_received", label: "Payments" },
    { value: "shop_created", label: "Shops" },
    { value: "plan_override", label: "Overrides" },
];

const TYPE_ICONS: Partial<Record<ActivityType, typeof Activity>> = {
    shop_created: Store,
    shop_updated: Store,
    subscription_created: CreditCard,
    subscription_upgraded: CreditCard,
    subscription_downgraded: CreditCard,
    subscription_cancelled: CreditCard,
    subscription_expired: CreditCard,
    subscription_renewed: CreditCard,
    payment_received: CreditCard,
    payment_failed: CreditCard,
    plan_override: CreditCard,
    login: User,
    feature_used: Activity,
};

export function ActivityPage() {
    const [typeFilter, setTypeFilter] = useState<ActivityType | "all">("all");

    const { logs, loading, error, hasMore, loadMore } = useActivityLogs({
        typeFilter: typeFilter === "all" ? undefined : typeFilter,
    });

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">Activity Log</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Track platform events and changes
                </p>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2 flex-wrap">
                {TYPE_FILTERS.map((filter) => (
                    <button
                        key={filter.value}
                        onClick={() => setTypeFilter(filter.value)}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                            typeFilter === filter.value
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {loading && logs.length === 0 && (
                <div className="flex items-center justify-center h-40">
                    <LPageLoader message="Loading activity..." />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive">
                    {error}
                </div>
            )}

            {/* Empty State */}
            {!loading && logs.length === 0 && (
                <div className="text-center py-12">
                    <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-1">No activity found</h3>
                    <p className="text-muted-foreground">
                        {typeFilter !== "all"
                            ? "Try selecting a different filter"
                            : "No platform activity has been recorded yet"}
                    </p>
                </div>
            )}

            {/* Activity Timeline */}
            {logs.length > 0 && (
                <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

                    <div className="space-y-4">
                        {logs.map((log) => {
                            const config = ACTIVITY_TYPE_CONFIG[log.type] || {
                                label: log.type,
                                color: "gray",
                            };
                            const Icon = TYPE_ICONS[log.type] || Activity;
                            const createdAt = log.createdAt?.toDate?.();

                            return (
                                <div key={log.id} className="relative flex gap-4 pl-2">
                                    {/* Timeline dot */}
                                    <div className={cn(
                                        "relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                                        config.color === "green" && "bg-green-100 text-green-600",
                                        config.color === "blue" && "bg-blue-100 text-blue-600",
                                        config.color === "purple" && "bg-purple-100 text-purple-600",
                                        config.color === "orange" && "bg-orange-100 text-orange-600",
                                        config.color === "red" && "bg-red-100 text-red-600",
                                        config.color === "gray" && "bg-gray-100 text-gray-600"
                                    )}>
                                        <Icon className="h-3 w-3" />
                                    </div>

                                    {/* Content */}
                                    <LCard variant="elevated" padding="sm" className="flex-1">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-xs font-medium",
                                                        config.color === "green" && "bg-green-100 text-green-700",
                                                        config.color === "blue" && "bg-blue-100 text-blue-700",
                                                        config.color === "purple" && "bg-purple-100 text-purple-700",
                                                        config.color === "orange" && "bg-orange-100 text-orange-700",
                                                        config.color === "red" && "bg-red-100 text-red-700",
                                                        config.color === "gray" && "bg-gray-100 text-gray-700"
                                                    )}>
                                                        {config.label}
                                                    </span>
                                                    {log.shopName && (
                                                        <span className="text-sm text-muted-foreground">
                                                            {log.shopName}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm">{log.description}</p>
                                                {log.userEmail && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        By {log.userEmail}
                                                    </p>
                                                )}
                                            </div>
                                            {createdAt && (
                                                <div className="text-right shrink-0">
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDistanceToNow(createdAt, { addSuffix: true })}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground opacity-75">
                                                        {format(createdAt, "MMM d, HH:mm")}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </LCard>
                                </div>
                            );
                        })}
                    </div>

                    {/* Load More */}
                    {hasMore && (
                        <div className="text-center pt-6">
                            <LButton
                                variant="outline"
                                onClick={loadMore}
                                loading={loading}
                                leftIcon={<ChevronDown className="h-4 w-4" />}
                            >
                                Load More
                            </LButton>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
