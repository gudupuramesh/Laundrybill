/**
 * Super Admin Dashboard
 * 
 * Overview page with platform statistics and quick actions
 */

import { usePlatformStats } from "../hooks/use-platform-stats";
import { formatStorageBytes } from "../hooks/use-shop-storage-stats";
import { useIsMobile } from "@/hooks/use-mobile";
import { LCard, LPageLoader } from "@/components/laundry";
import {
    Store,
    Users,
    CreditCard,
    TrendingUp,
    AlertTriangle,
    Package,
    Calendar,
    RefreshCw,
    HardDrive,
    MapPin,
    FileText,
    Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export function SuperAdminDashboard() {
    const { stats, loading, error, refetch } = usePlatformStats();
    const isMobile = useIsMobile();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <LPageLoader message="Loading dashboard..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto min-w-0 overflow-x-hidden">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground">Platform Dashboard</h1>
                    <p className="text-sm text-muted-foreground">
                        Overview of LaundryBill platform metrics
                    </p>
                </div>
                <button
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    aria-label="Refresh"
                    onClick={() => refetch()}
                >
                    <RefreshCw className="h-5 w-5 text-muted-foreground" />
                </button>
            </div>

            {/* Stats: horizontal scroll on mobile (small, label only), grid on desktop */}
            <div
                className={cn(
                    isMobile
                        ? "w-full overflow-x-auto overflow-y-hidden scrollbar-hide pb-1 -mx-1 touch-pan-x"
                        : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                )}
                style={isMobile ? { WebkitOverflowScrolling: "touch" } : undefined}
            >
                {isMobile ? (
                    <div className="flex gap-2 flex-nowrap w-max min-w-full px-0.5">
                        <div className="min-w-[100px] shrink-0">
                            <StatCard
                                icon={Store}
                                label="Shops"
                                value={stats?.totalShops || 0}
                                color="blue"
                                compact
                            />
                        </div>
                        <div className="min-w-[100px] shrink-0">
                            <StatCard
                                icon={Users}
                                label="Subs"
                                value={stats?.activeSubscriptions || 0}
                                color="green"
                                compact
                            />
                        </div>
                        <div className="min-w-[100px] shrink-0">
                            <StatCard
                                icon={CreditCard}
                                label="Revenue"
                                value={formatCurrency(stats?.monthlyRevenue || 0)}
                                color="purple"
                                compact
                            />
                        </div>
                        <div className="min-w-[100px] shrink-0">
                            <StatCard
                                icon={AlertTriangle}
                                label="Expiring"
                                value={stats?.expiringSoon || 0}
                                color={stats?.expiringSoon ? "orange" : "gray"}
                                compact
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <StatCard
                            icon={Store}
                            label="Total Shops"
                            value={stats?.totalShops || 0}
                            change={stats?.newShopsThisMonth || 0}
                            changeLabel="new this month"
                            color="blue"
                        />
                        <StatCard
                            icon={Users}
                            label="Active Subscriptions"
                            value={stats?.activeSubscriptions || 0}
                            color="green"
                        />
                        <StatCard
                            icon={CreditCard}
                            label="Monthly Revenue"
                            value={formatCurrency(stats?.monthlyRevenue || 0)}
                            subValue={`${formatCurrency(stats?.revenueToday || 0)} today`}
                            color="purple"
                        />
                        <StatCard
                            icon={AlertTriangle}
                            label="Expiring Soon"
                            value={stats?.expiringSoon || 0}
                            subValue="next 7 days"
                            color={stats?.expiringSoon ? "orange" : "gray"}
                        />
                    </>
                )}
            </div>

            {/* Plan Distribution & Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 min-w-0">
                {/* Plan Distribution - prevent overflow on mobile */}
                <LCard variant="elevated" padding={isMobile ? "md" : "lg"} className="min-w-0 overflow-hidden">
                    <h2 className={cn("font-semibold mb-3", isMobile ? "text-base" : "text-lg")}>Plan Distribution</h2>
                    <div className="space-y-3 min-w-0">
                        <PlanBar
                            label="Free"
                            count={stats?.planDistribution?.free || 0}
                            total={stats?.totalShops || 1}
                            color="gray"
                        />
                        <PlanBar
                            label="Pro"
                            count={stats?.planDistribution?.pro || 0}
                            total={stats?.totalShops || 1}
                            color="blue"
                        />
                    </div>
                </LCard>

                {/* Quick Stats - smaller on mobile */}
                <LCard variant="elevated" padding={isMobile ? "md" : "lg"} className="min-w-0 overflow-hidden">
                    <h2 className={cn("font-semibold mb-3", isMobile ? "text-base" : "text-lg")}>Platform Activity</h2>
                    <div className={cn("grid grid-cols-2 gap-2", !isMobile && "gap-4")}>
                        <QuickStat
                            icon={Package}
                            label="Orders"
                            value={stats?.totalOrders?.toLocaleString() || "0"}
                            compact={isMobile}
                        />
                        <QuickStat
                            icon={Users}
                            label="Customers"
                            value={stats?.totalCustomers?.toLocaleString() || "0"}
                            compact={isMobile}
                        />
                        <QuickStat
                            icon={Calendar}
                            label="Today"
                            value={stats?.ordersToday?.toLocaleString() || "0"}
                            compact={isMobile}
                        />
                        <QuickStat
                            icon={TrendingUp}
                            label="Revenue"
                            value={formatCurrency(stats?.revenueToday || 0)}
                            compact={isMobile}
                        />
                        <QuickStat
                            icon={Store}
                            label="New Shops"
                            value={stats?.newShopsThisMonth?.toString() || "0"}
                            subValue="this month"
                            compact={isMobile}
                        />
                        <QuickStat
                            icon={HardDrive}
                            label="Storage (All Shops)"
                            value={formatStorageBytes(stats?.totalStorageBytes || 0)}
                            subValue={stats?.totalStorageImageCount != null ? `${(stats.totalStorageImageCount).toLocaleString()} images` : undefined}
                            compact={isMobile}
                        />
                    </div>
                </LCard>
            </div>

            {/* Quick Actions - horizontal scroll on mobile to prevent truncation */}
            <div className={cn(isMobile ? "overflow-x-auto scrollbar-hide -mx-1 touch-pan-x" : "")} style={isMobile ? { WebkitOverflowScrolling: "touch" } : undefined}>
                <LCard variant="elevated" padding={isMobile ? "md" : "lg"} className={cn(isMobile && "w-max min-w-full")}>
                    <h2 className={cn("font-semibold mb-3", isMobile ? "text-base" : "text-lg")}>Quick Actions</h2>
                    <div className={cn(
                        isMobile ? "flex gap-2 flex-nowrap" : "grid grid-cols-2 sm:grid-cols-4 gap-4"
                    )}>
                        <QuickAction
                            label="Shops"
                            icon={Store}
                            href="/super-admin/shops"
                            compact={isMobile}
                        />
                        <QuickAction
                            label="Subscriptions"
                            icon={CreditCard}
                            href="/super-admin/subscriptions"
                            compact={isMobile}
                        />
                        <QuickAction
                            label="Payments"
                            icon={TrendingUp}
                            href="/super-admin/payments"
                            compact={isMobile}
                        />
                        <QuickAction
                            label="Map"
                            icon={MapPin}
                            href="/super-admin/map"
                            compact={isMobile}
                        />
                        <QuickAction
                            label="Plans"
                            icon={FileText}
                            href="/super-admin/plans"
                            compact={isMobile}
                        />
                        <QuickAction
                            label="Notifications"
                            icon={Bell}
                            href="/super-admin/notifications"
                            compact={isMobile}
                        />
                    </div>
                </LCard>
            </div>

            {/* Alerts - wrap text, no overflow */}
            {(stats?.expiringSoon ?? 0) > 0 && (
                <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 md:p-6 min-w-0 overflow-hidden">
                    <h2 className={cn("font-semibold text-warning mb-2", isMobile ? "text-base" : "text-lg")}>
                        ⚠️ Attention Required
                    </h2>
                    <p className="text-sm text-foreground break-words">
                        <strong>{stats?.expiringSoon}</strong> subscriptions are expiring in the next 7 days.
                        Consider sending renewal reminders.
                    </p>
                    <Link
                        to="/super-admin/subscriptions?filter=expiring"
                        className="inline-block mt-3 text-sm text-primary hover:underline break-words"
                    >
                        View Expiring Subscriptions →
                    </Link>
                </div>
            )}
        </div>
    );
}

// Helper Components

interface StatCardProps {
    icon: React.ElementType;
    label: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
    subValue?: string;
    color: "blue" | "green" | "purple" | "orange" | "gray";
    compact?: boolean;
}

function StatCard({ icon: Icon, label, value, change, changeLabel, subValue, color, compact }: StatCardProps) {
    const colorClasses = {
        blue: "bg-blue-500/10 text-blue-600",
        green: "bg-green-500/10 text-green-600",
        purple: "bg-purple-500/10 text-purple-600",
        orange: "bg-orange-500/10 text-orange-600",
        gray: "bg-gray-500/10 text-gray-600",
    };

    if (compact) {
        return (
            <LCard variant="elevated" padding="sm" className="min-w-0 overflow-hidden">
                <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-md shrink-0", colorClasses[color])}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold leading-tight">{value}</p>
                        <p className="text-xs text-muted-foreground truncate">{label}</p>
                    </div>
                </div>
            </LCard>
        );
    }

    return (
        <LCard variant="elevated" padding="md">
            <div className="flex items-start justify-between">
                <div className={cn("p-2 rounded-lg", colorClasses[color])}>
                    <Icon className="h-5 w-5" />
                </div>
                {change !== undefined && change > 0 && (
                    <span className="text-xs text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                        +{change} {changeLabel}
                    </span>
                )}
            </div>
            <div className="mt-3">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
                {subValue && (
                    <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
                )}
            </div>
        </LCard>
    );
}

interface PlanBarProps {
    label: string;
    count: number;
    total: number;
    color: "gray" | "blue" | "purple" | "orange";
}

function PlanBar({ label, count, total, color }: PlanBarProps) {
    const percentage = total > 0 ? (count / total) * 100 : 0;

    const colorClasses = {
        gray: "bg-gray-500",
        blue: "bg-blue-500",
        purple: "bg-purple-500",
        orange: "bg-orange-500",
    };

    return (
        <div className="min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                <span className="text-sm font-medium truncate">{label}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                    {count} ({percentage.toFixed(0)}%)
                </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden min-w-0">
                <div
                    className={cn("h-full rounded-full transition-all", colorClasses[color])}
                    style={{ width: `${Math.max(percentage, 2)}%` }}
                />
            </div>
        </div>
    );
}

interface QuickStatProps {
    icon: React.ElementType;
    label: string;
    value: string;
    subValue?: string;
    compact?: boolean;
}

function QuickStat({ icon: Icon, label, value, subValue, compact }: QuickStatProps) {
    return (
        <div className={cn("rounded-lg bg-muted/50 min-w-0 overflow-hidden", compact ? "p-2" : "p-4")}>
            <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                <Icon className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                <span className="text-xs truncate">{label}</span>
            </div>
            <p className={cn("font-semibold truncate", compact ? "text-base" : "text-xl")}>{value}</p>
            {subValue && <p className="text-xs text-muted-foreground truncate mt-0.5">{subValue}</p>}
        </div>
    );
}

interface QuickActionProps {
    label: string;
    icon: React.ElementType;
    href: string;
    compact?: boolean;
}

function QuickAction({ label, icon: Icon, href, compact }: QuickActionProps) {
    return (
        <Link
            to={href}
            className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-center shrink-0 min-w-0 overflow-hidden",
                compact ? "p-3 min-w-[80px]" : "p-4 gap-2"
            )}
        >
            <Icon className={cn("text-muted-foreground shrink-0", compact ? "h-5 w-5" : "h-6 w-6")} />
            <span className={cn("font-medium truncate w-full px-0.5", compact ? "text-xs" : "text-sm")}>{label}</span>
        </Link>
    );
}

function formatCurrency(amount: number, symbol: string = "₹"): string {
    if (amount >= 100000) {
        return `${symbol}${(amount / 100000).toFixed(1)}L`;
    }
    if (amount >= 1000) {
        return `${symbol}${(amount / 1000).toFixed(1)}K`;
    }
    return `${symbol}${amount.toLocaleString()}`;
}
