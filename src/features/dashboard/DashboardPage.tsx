/**
 * Dashboard Page — web-first, desktop-grade overview
 *
 * Layout (matches the brand desktop reference):
 *   Header (title + primary actions)
 *   → conditional banners (expiry / plan / order-limit)
 *   → 4 stat cards   (Collected · Outstanding · Active Orders · Customers)
 *   → 3-panel row    (Processing Queue · Staff Attendance · Quick Scan & Search)
 *   → 2fr·1fr grid   (Recent Store Activity table · Revenue Analytics)
 *   → Today's pickup & delivery strip
 * Fully responsive: collapses to a single stacked column on mobile.
 */

import { PageWrapper } from "@/components/PageWrapper";
import {
    LAvatar,
    LStatusBadge,
    LButton,
    LEmptyState,
    LCard,
    LAmount,
    LPageLoader,
    LAdSlot,
    LResponsiveDialog,
} from "@/components/laundry";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/hooks/use-dashboard";
import { useOrderSummary } from "@/hooks/use-order-summary";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useShop } from "@/hooks/use-shop";
import { useCurrency } from "@/hooks/use-currency";
import { useSupportSettings, hasWelcomeContent } from "@/hooks/use-support-settings";
import { useShopMutations } from "@/hooks/use-shop";
import { useAuth } from "@/features/auth/AuthContext";
import {
    Wallet,
    AlertCircle,
    Package,
    Users,
    ClipboardList,
    TrendingUp,
    TrendingDown,
    Clock,
    CheckCircle,
    Truck,
    Calendar,
    Store,
    Home,
    Globe,
    Search,
    ScanLine,
    ArrowRight,
    RefreshCw,
    Video,
    ExternalLink,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getYoutubeThumbnailUrl } from "@/lib/youtube-thumbnail";
import { format } from "date-fns";
import { useShopSubscription } from "@/hooks/use-shop-subscription";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { StoreHealth } from "@/features/dashboard/StoreHealth";

/** Semantic tint tones — inline styles so they're build-safe regardless of Tailwind colour mapping. */
type Tone = "blue" | "green" | "red" | "amber";
const TONES: Record<Tone, { bg: string; fg: string }> = {
    blue: { bg: "hsl(var(--primary) / 0.10)", fg: "hsl(var(--primary))" },
    green: { bg: "hsl(var(--success) / 0.12)", fg: "hsl(var(--success))" },
    red: { bg: "hsl(var(--destructive) / 0.10)", fg: "hsl(var(--destructive))" },
    amber: { bg: "hsl(var(--warning) / 0.16)", fg: "hsl(36 92% 38%)" },
};

export function DashboardPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { role } = useAuth();
    const { hasFeature, checkLimit, loading: limitsLoading } = useShopLimits();
    const { formatAmount } = useCurrency();
    const {
        stats,
        recentOrders,
        staffAttendance,
        loading,
        error,
    } = useDashboard();

    // Robust financial hook (same source as Order List) — avoids the recent-50 window bug.
    const financialMetrics = useOrderSummary();

    const orderLimit = checkLimit("maxOrders", stats.monthlyOrders);
    const isOrderLimitReached = !orderLimit.allowed;
    const isOrderLimitNear = orderLimit.limit !== -1 && (orderLimit.remaining ?? 100) <= 10;

    const { subscription } = useShopSubscription();
    const { shop } = useShop();
    const { data: supportData, loading: supportLoading } = useSupportSettings();
    const { markWelcomeSeen } = useShopMutations();
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    // Prevent useEffect from re-opening the modal after user dismisses it
    const welcomeDismissedRef = useRef(false);

    // Show first-time welcome modal once per shop (admin only)
    useEffect(() => {
        if (welcomeDismissedRef.current) return;          // user already dismissed
        if (supportLoading || !shop || role !== "admin") return;
        if (shop.welcomeModalSeenAt) return;
        if (!supportData || !hasWelcomeContent(supportData)) return;
        setShowWelcomeModal(true);
    }, [shop, supportData, supportLoading, role]);

    const handleCloseWelcome = () => {
        welcomeDismissedRef.current = true;   // block re-open from useEffect
        setShowWelcomeModal(false);
        markWelcomeSeen().catch(() => { /* ignore */ });
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const q = searchQuery.trim();
        navigate(q ? `/orders?search=${encodeURIComponent(q)}` : "/orders");
    };

    // Use minimum loading duration to show animation properly
    const showLoading = useMinLoading(loading, { minDuration: 800 });

    if (showLoading) {
        return (
            <div className="h-full">
                <LPageLoader variant="machine" message={t('dashboard.loading')} />
            </div>
        );
    }

    if (error) {
        return (
            <PageWrapper>
                <LEmptyState
                    icon={<AlertCircle className="h-8 w-8" />}
                    title="Error loading dashboard"
                    description={error}
                    action={{ label: "Retry", onClick: () => window.location.reload() }}
                />
            </PageWrapper>
        );
    }

    // ---- Derived metrics ----
    const activeOrders =
        stats.pendingOrders + stats.processingOrders + stats.readyOrders + stats.outForDeliveryOrders;

    const collected = financialMetrics.loading ? stats.todayCollected : financialMetrics.collected;
    const outstanding = financialMetrics.loading ? stats.outstandingAmount : financialMetrics.due;
    const sales = financialMetrics.loading ? stats.monthlyRevenue : financialMetrics.revenue;
    const expenses = stats.monthlyExpenses;
    const netProfit = collected - expenses;

    // Month-consistent collection progress (avoids mixing all-time due with month sales)
    const uncollected = Math.max(0, sales - collected);
    const collectionPct = sales > 0 ? Math.round((collected / sales) * 100) : (collected > 0 ? 100 : 0);
    const collectedShare = Math.min(100, Math.max(0, collectionPct));

    return (
        <>
            {/* First-time welcome modal (shown once to new shop owners) */}
            <LResponsiveDialog
                open={showWelcomeModal}
                onClose={handleCloseWelcome}
                title={t("help.welcomeTitle", "Thank you for registering with LaundryBill")}
                size="lg"
            >
                <div className="space-y-4">
                    <p className="text-foreground whitespace-pre-wrap text-sm md:text-base">
                        {supportData?.welcomeMessage?.trim() ||
                            t("help.welcomeDefault", "Welcome! We're glad to have you. Watch the short video below to see how to place your first order and get an overview of your dashboard.")}
                    </p>

                    {supportData?.gettingStartedVideoUrl?.trim() && (() => {
                        const videoUrl = supportData.gettingStartedVideoUrl.trim();
                        const thumbUrl = getYoutubeThumbnailUrl(videoUrl);
                        return (
                            <a
                                href={videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block group rounded-xl overflow-hidden border border-border hover:border-primary/40 transition-all hover:shadow-md"
                            >
                                {thumbUrl ? (
                                    <div className="relative aspect-video bg-muted">
                                        <img
                                            src={thumbUrl}
                                            alt="Getting started tutorial"
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                                <svg className="w-5 h-5 md:w-6 md:h-6 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                                                <Video className="h-6 w-6 text-primary" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="px-3 py-2 bg-muted/30 flex items-center gap-2">
                                    <Video className="h-4 w-4 text-primary shrink-0" />
                                    <span className="text-sm font-medium text-foreground truncate">
                                        {t("help.watchTutorial", "Watch getting started video")}
                                    </span>
                                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto" />
                                </div>
                            </a>
                        );
                    })()}

                    <div className="flex justify-end pt-2">
                        <LButton type="button" onClick={handleCloseWelcome}>
                            {t("common.gotIt", "Got it")}
                        </LButton>
                    </div>
                </div>
            </LResponsiveDialog>

            <PageWrapper maxWidth="full">
                {/* ============ Banners ============ */}
                {/* Page title + New Order + plan pill live in the top bar (see DashboardHeaderActions). */}
                {subscription?.status === "expired" && (
                    <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border border-red-500/20">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-red-700 dark:text-red-400">
                                        Your {subscription?.planName || "Pro"} Plan Has Expired
                                    </p>
                                    <p className="text-sm text-red-600/80 dark:text-red-400/80">
                                        You're now on the Free plan. Upgrade to continue using premium features.
                                    </p>
                                </div>
                            </div>
                            <LButton
                                variant="primary"
                                size="sm"
                                onClick={() => navigate("/settings/subscription")}
                                className="bg-red-600 hover:bg-red-700 shrink-0"
                            >
                                Upgrade Now
                            </LButton>
                        </div>
                    </div>
                )}

                {isMobile && subscription && subscription.planId !== "free" && subscription.status !== "expired" && (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3 p-3 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
                        <div className="flex flex-wrap items-center gap-2 gap-y-0">
                            <span className="font-semibold text-foreground">{subscription.planName}</span>
                            {subscription.daysRemaining != null && subscription.daysRemaining <= 15 && subscription.expiresAt ? (
                                <span className="text-sm text-destructive font-medium flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {t('dashboard.planExpires')} {format(subscription.expiresAt, "MMM d, yyyy")}
                                </span>
                            ) : (
                                <span className="text-sm text-muted-foreground">{t('dashboard.planEnjoyMessage')}</span>
                            )}
                        </div>
                    </div>
                )}

                {!limitsLoading && orderLimit.limit > 0 && (
                    <div className="mb-4">
                        <LCard variant="elevated" className={cn(
                            "border-l-4",
                            isOrderLimitReached ? "border-l-destructive" : "border-l-primary"
                        )}>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Monthly Order Limit
                                </h3>
                                <div className="flex items-center gap-3">
                                    <span className={cn(
                                        "text-sm font-bold",
                                        isOrderLimitReached ? "text-destructive" : "text-primary"
                                    )}>
                                        {stats.monthlyOrders} / {orderLimit.limit}
                                    </span>
                                    <LButton
                                        size="sm"
                                        variant="outline"
                                        onClick={() => navigate("/settings/subscription")}
                                        className="hidden md:inline-flex"
                                    >
                                        Upgrade
                                    </LButton>
                                </div>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mb-3">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-500",
                                        isOrderLimitReached ? "bg-destructive" : "bg-primary"
                                    )}
                                    style={{ width: `${Math.min((stats.monthlyOrders / orderLimit.limit) * 100, 100)}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <p className="text-muted-foreground">
                                    {isOrderLimitReached
                                        ? "You have reached your limit. Upgrade to continue."
                                        : isOrderLimitNear
                                            ? "You are nearing your order limit."
                                            : `${orderLimit.remaining} orders remaining this month`}
                                </p>
                                <LButton
                                    size="sm"
                                    variant="primary"
                                    onClick={() => navigate("/settings/subscription")}
                                    className="md:hidden"
                                >
                                    Upgrade Plan
                                </LButton>
                            </div>
                        </LCard>
                    </div>
                )}

                {/* ============ Stat cards ============ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5 mb-5 lg:mb-6">
                    <StatCard
                        tone="green"
                        icon={<Wallet className="h-5 w-5" />}
                        label={t('dashboard.collected', 'Collected')}
                        value={formatAmount(collected)}
                        meta={t('dashboard.thisMonth', 'This month')}
                        onClick={() => navigate("/reports")}
                    />
                    <StatCard
                        tone="red"
                        icon={<AlertCircle className="h-5 w-5" />}
                        label={t('dashboard.outstandingDues', 'Outstanding Due')}
                        value={formatAmount(outstanding)}
                        meta={t('dashboard.receivables', 'Receivables')}
                        onClick={() => navigate("/orders?filter=unpaid")}
                    />
                    <StatCard
                        tone="blue"
                        icon={<Package className="h-5 w-5" />}
                        label={t('dashboard.activeOrders', 'Active Orders')}
                        value={activeOrders}
                        meta={t('dashboard.inQueue', 'In processing queue')}
                        onClick={() => navigate("/orders")}
                    />
                    <StatCard
                        tone="amber"
                        icon={<Users className="h-5 w-5" />}
                        label={t('dashboard.totalCustomers', 'Total Customers')}
                        value={stats.totalCustomers}
                        meta={stats.newCustomersToday > 0
                            ? `+${stats.newCustomersToday} ${t('dashboard.newToday', 'new today')}`
                            : t('dashboard.activeCustomers', 'Active customers')}
                        onClick={() => navigate("/customers")}
                    />
                </div>

                {/* ============ 3-panel row ============ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-5 lg:mb-6">
                    {/* Processing Queue */}
                    <Panel
                        icon={<RefreshCw className="h-[18px] w-[18px]" />}
                        title={t('dashboard.processingQueue', 'Processing Queue')}
                        subtitle={t('dashboard.orderPipeline', 'Order pipeline')}
                        action={
                            <button onClick={() => navigate("/orders")} className="text-xs font-bold text-primary hover:underline">
                                {t('common.viewAll')}
                            </button>
                        }
                    >
                        <div className="grid grid-cols-2 gap-3">
                            <QueueStat tone="amber" icon={<Clock className="h-4 w-4" />} label={t('dashboard.pending')} count={stats.pendingOrders} onClick={() => navigate("/orders?status=pending")} />
                            <QueueStat tone="blue" icon={<RefreshCw className="h-4 w-4" />} label={t('dashboard.processing')} count={stats.processingOrders} onClick={() => navigate("/orders?status=processing")} />
                            <QueueStat tone="green" icon={<CheckCircle className="h-4 w-4" />} label={t('dashboard.ready')} count={stats.readyOrders} onClick={() => navigate("/orders?status=ready")} />
                            <QueueStat tone="blue" icon={<Truck className="h-4 w-4" />} label={t('dashboard.outForDelivery')} count={stats.outForDeliveryOrders} onClick={() => navigate("/orders?status=out_for_delivery")} />
                        </div>
                    </Panel>

                    {/* Staff Attendance */}
                    <Panel
                        icon={<Calendar className="h-[18px] w-[18px]" />}
                        title={t('dashboard.staffAttendance', 'Staff Attendance')}
                        subtitle={format(new Date(), "EEEE, MMM d")}
                        action={
                            <button onClick={() => navigate("/attendance")} className="text-xs font-bold text-primary hover:underline">
                                {t('attendance.markAttendance', 'Mark')}
                            </button>
                        }
                    >
                        <div className="grid grid-cols-3 gap-2.5 text-center">
                            <AttCell tone="green" count={staffAttendance.presentToday} label={t('attendance.present')} />
                            <AttCell tone="red" count={staffAttendance.absentToday} label={t('attendance.absent')} />
                            <AttCell tone="amber" count={staffAttendance.onLeaveToday} label={t('attendance.leave')} />
                        </div>
                        <p className="text-xs text-muted-foreground text-center mt-3">
                            {t('dashboard.totalStaff', 'Total staff')}: <span className="font-semibold text-foreground">{staffAttendance.totalStaff}</span>
                        </p>
                    </Panel>

                    {/* Quick Scan & Search */}
                    <Panel
                        icon={<Search className="h-[18px] w-[18px]" />}
                        title={t('dashboard.quickScanSearch', 'Quick Scan & Search')}
                        subtitle={t('dashboard.findOrderCustomer', 'Find an order or customer')}
                    >
                        <form onSubmit={handleSearch} className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('dashboard.searchPlaceholder', 'Search orders, customers…')}
                                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div className={cn("grid gap-2", hasFeature("qrScans") ? "grid-cols-2" : "grid-cols-1")}>
                                <LButton type="submit" variant="primary" leftIcon={<Search className="h-4 w-4" />} fullWidth>
                                    {t('common.search', 'Search')}
                                </LButton>
                                {hasFeature("qrScans") && (
                                    <LButton type="button" variant="outline" leftIcon={<ScanLine className="h-4 w-4" />} fullWidth onClick={() => navigate("/scan")}>
                                        {t('dashboard.scanOrder', 'Scan')}
                                    </LButton>
                                )}
                            </div>
                        </form>
                    </Panel>
                </div>

                {/* ============ Recent activity + Revenue analytics ============ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                    {/* Recent Store Activity */}
                    <Panel
                        className="lg:col-span-2"
                        bodyClassName="p-0"
                        icon={<ClipboardList className="h-[18px] w-[18px]" />}
                        title={t('dashboard.recentActivity', 'Recent Store Activity')}
                        subtitle={t('dashboard.recentOrders', 'Latest orders')}
                        action={
                            <button onClick={() => navigate("/orders")} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                {t('common.viewAll')} <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                        }
                    >
                        {recentOrders.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr>
                                            {[
                                                t('orders.orderId', 'Order'),
                                                t('orders.customer', 'Customer'),
                                                t('common.date', 'Date'),
                                                t('common.status', 'Status'),
                                                t('orders.payment', 'Payment'),
                                            ].map((h) => (
                                                <th key={h} className="bg-muted/40 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                                            ))}
                                            <th className="bg-muted/40 px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{t('common.amount', 'Amount')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {recentOrders.slice(0, 6).map((order) => {
                                            const isPaid = order.total > 0 && order.balance <= 0;
                                            const isPartial = order.amountPaid > 0 && order.balance > 0;
                                            const payTone: Tone = isPaid ? "green" : isPartial ? "amber" : "red";
                                            const payLabel = isPaid
                                                ? t('orders.paid', 'Paid')
                                                : isPartial ? t('orders.partial', 'Partial') : t('orders.unpaid', 'Unpaid');
                                            return (
                                                <tr
                                                    key={order.id}
                                                    onClick={() => navigate(`/orders/${order.id}`)}
                                                    className="cursor-pointer transition-colors hover:bg-muted/40"
                                                >
                                                    <td className="px-5 py-3 text-sm font-bold text-foreground whitespace-nowrap">#{order.publicId}</td>
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <LAvatar name={order.customerName} size="sm" />
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-foreground truncate max-w-[160px]">{order.customerName}</p>
                                                                <p className="text-xs text-muted-foreground">{order.itemCount} {t('orders.items', 'items')}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">{format(order.createdAt, "MMM d")}</td>
                                                    <td className="px-5 py-3"><LStatusBadge status={order.status} size="sm" /></td>
                                                    <td className="px-5 py-3">
                                                        <span
                                                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap"
                                                            style={{ background: TONES[payTone].bg, color: TONES[payTone].fg }}
                                                        >
                                                            {payLabel}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-right whitespace-nowrap"><LAmount value={order.total} size="sm" /></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-2">
                                <LEmptyState
                                    icon={<ClipboardList className="h-8 w-8" />}
                                    title={t('dashboard.noPendingOrders', 'No orders yet')}
                                    description={t('dashboard.allCaughtUp', "You're all caught up.")}
                                    action={{ label: t('dashboard.createOrder', 'Create order'), onClick: () => navigate("/new-order") }}
                                />
                            </div>
                        )}
                    </Panel>

                    {/* Right column: Store Health (compact) + Revenue Analytics */}
                    <div className="space-y-4 lg:space-y-6">
                        <StoreHealth />

                        {/* Revenue Analytics */}
                        <Panel
                        icon={<TrendingUp className="h-[18px] w-[18px]" />}
                        title={t('dashboard.revenueAnalytics', 'Revenue Analytics')}
                        subtitle={t('dashboard.thisMonthOverview', 'This month overview')}
                    >
                        {/* Collection progress — collected vs uncollected of this month's billings */}
                        <div>
                            <div className="flex items-baseline justify-between mb-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    {t('dashboard.collectionProgress', 'Collection progress')}
                                </span>
                                <span className="text-sm font-extrabold text-success">{collectionPct}%</span>
                            </div>
                            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full"
                                    style={{ width: `${collectedShare}%`, background: "hsl(var(--success))", transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }}
                                />
                                <div
                                    className="h-full"
                                    style={{ width: `${100 - collectedShare}%`, background: "hsl(var(--destructive))", opacity: 0.85 }}
                                />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full" style={{ background: "hsl(var(--success))" }} />
                                    {formatAmount(collected)} {t('dashboard.collectedLower', 'collected')}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    {formatAmount(uncollected)} {t('dashboard.pendingLower', 'pending')}
                                    <span className="h-2 w-2 rounded-full" style={{ background: "hsl(var(--destructive))" }} />
                                </span>
                            </div>
                        </div>

                        {/* Breakdown */}
                        <div className="mt-5 space-y-2.5 border-t border-border pt-4">
                            <BreakRow tone="blue" label={t('dashboard.sales', 'Sales')} value={formatAmount(sales)} />
                            <BreakRow tone="green" label={t('dashboard.collected', 'Collected')} value={formatAmount(collected)} />
                            <BreakRow tone="red" label={t('dashboard.uncollected', 'Uncollected')} value={formatAmount(uncollected)} />
                            <BreakRow tone="amber" label={t('dashboard.monthlyExpenses', 'Expenses')} value={formatAmount(expenses)} />
                            <div className="flex items-center justify-between border-t border-border pt-2.5">
                                <span className="text-sm font-bold text-foreground">{t('dashboard.netProfit', 'Net Profit')}</span>
                                <span className={cn("text-sm font-extrabold", netProfit >= 0 ? "text-success" : "text-destructive")}>
                                    {formatAmount(netProfit)}
                                </span>
                            </div>
                        </div>

                        <LButton
                            variant="ghost"
                            size="sm"
                            fullWidth
                            onClick={() => navigate("/reports")}
                            rightIcon={<ArrowRight className="h-4 w-4" />}
                            className="mt-3"
                        >
                            {t('dashboard.viewFullReports', 'View full reports')}
                        </LButton>
                        </Panel>
                    </div>
                </div>

                {/* ============ Order Channels (combined) ============ */}
                <div className="mt-5 lg:mt-6">
                    <Panel
                        icon={<Globe className="h-[18px] w-[18px]" />}
                        title={t('dashboard.orderChannels', 'Order Channels')}
                        subtitle={t('dashboard.todayByChannel', "Today's orders by channel")}
                        bodyClassName="p-0"
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y divide-border sm:divide-y-0 sm:divide-x">
                            <ChannelCell tone="blue" icon={<Store className="h-5 w-5" />} label={t('dashboard.storePickup', 'Store Pickup')} count={stats.storePickupOrders} />
                            <ChannelCell tone="amber" icon={<Home className="h-5 w-5" />} label={t('dashboard.homePickup', 'Home Pickup')} count={stats.homePickupOrders} />
                            <ChannelCell tone="green" icon={<Truck className="h-5 w-5" />} label={t('dashboard.homeDelivery', 'Home Delivery')} count={stats.homeDeliveryOrders} />
                            <ChannelCell tone="blue" icon={<Globe className="h-5 w-5" />} label={t('dashboard.online', 'Online')} count={financialMetrics.onlineOrdersCount} />
                        </div>
                    </Panel>
                </div>

                {/* Ad slot */}
                <div className="mt-6">
                    <LAdSlot variant="card" position={isMobile ? "dashboard-mobile" : "dashboard-sidebar"} />
                </div>
            </PageWrapper>
        </>
    );
}

/* ============ Helper components ============ */

function StatCard({
    tone, icon, label, value, meta, trend, onClick,
}: {
    tone: Tone;
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    meta?: string;
    trend?: number;
    onClick?: () => void;
}) {
    const c = TONES[tone];
    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 lg:p-6 shadow-sm transition-all",
                onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
            )}
        >
            <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
                <p className="mt-2 text-xl lg:text-[26px] font-extrabold leading-none text-foreground truncate">{value}</p>
                <div className="mt-2 flex items-center gap-2">
                    {trend != null && trend !== 0 && (
                        <span className={cn("inline-flex items-center gap-0.5 text-xs font-bold", trend > 0 ? "text-success" : "text-destructive")}>
                            {trend > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                            {Math.abs(trend)}%
                        </span>
                    )}
                    {meta && <span className="text-xs font-medium text-muted-foreground truncate">{meta}</span>}
                </div>
            </div>
            <div className="flex h-11 w-11 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: c.bg, color: c.fg }}>
                {icon}
            </div>
        </div>
    );
}

function Panel({
    icon, title, subtitle, action, children, className, bodyClassName,
}: {
    icon?: React.ReactNode;
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <div className={cn("flex flex-col rounded-2xl border border-border bg-card shadow-sm", className)}>
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="flex items-center gap-2.5 min-w-0">
                    {icon && <span className="text-primary shrink-0">{icon}</span>}
                    <div className="min-w-0">
                        <h3 className="text-[15px] font-extrabold text-foreground leading-tight truncate">{title}</h3>
                        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
                    </div>
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </div>
            <div className={cn("p-5", bodyClassName)}>{children}</div>
        </div>
    );
}

function QueueStat({
    tone, icon, label, count, onClick,
}: {
    tone: Tone;
    icon: React.ReactNode;
    label: string;
    count: number;
    onClick?: () => void;
}) {
    const c = TONES[tone];
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
        >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: c.bg, color: c.fg }}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-lg font-extrabold leading-none text-foreground">{count}</p>
                <p className="text-[11px] font-medium text-muted-foreground mt-1 truncate">{label}</p>
            </div>
        </button>
    );
}

function AttCell({ tone, count, label }: { tone: Tone; count: number; label: string }) {
    const c = TONES[tone];
    return (
        <div className="rounded-xl p-3" style={{ background: c.bg }}>
            <p className="text-2xl font-extrabold leading-none" style={{ color: c.fg }}>{count}</p>
            <p className="text-[11px] font-semibold mt-1.5" style={{ color: c.fg }}>{label}</p>
        </div>
    );
}

function BreakRow({ tone, label, value }: { tone: Tone; label: string; value: string }) {
    const c = TONES[tone];
    return (
        <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.fg }} />
                {label}
            </span>
            <span className="text-sm font-bold text-foreground">{value}</span>
        </div>
    );
}

function ChannelCell({
    tone, icon, label, count,
}: {
    tone: Tone;
    icon: React.ReactNode;
    label: string;
    count: number;
}) {
    const c = TONES[tone];
    return (
        <div className="flex items-center gap-3 p-4 lg:p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: c.bg, color: c.fg }}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-xl font-extrabold leading-none text-foreground">{count}</p>
                <p className="text-xs font-medium text-muted-foreground mt-1 truncate">{label}</p>
            </div>
        </div>
    );
}
