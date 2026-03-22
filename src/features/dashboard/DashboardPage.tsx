/**
 * Dashboard Page
 * 
 * Main dashboard with real-time stats from Firebase
 * Desktop: Multi-column layout with detailed widgets
 * Mobile: Simplified card-based layout
 */

import { PageWrapper } from "@/components/PageWrapper";
import {
    LStatCard,
    LList,
    LListItem,
    LAvatar,
    LStatusBadge,
    LButton,
    LEmptyState,
    LCard,
    LAmount,
    LPageLoader,
    LBadge,
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
    IndianRupee,
    ShoppingBag,
    Package,
    Users,
    PlusCircle,
    ClipboardList,
    TrendingUp,
    TrendingDown,
    Clock,
    CheckCircle,
    Truck,
    AlertCircle,
    UserPlus,
    Calendar,
    Store,
    Home,
    MapPin,
    CreditCard,
    Wallet,
    ArrowRight,
    RefreshCw,
    Video,
    ExternalLink,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getYoutubeThumbnailUrl } from "@/lib/youtube-thumbnail";
import { format, formatDistanceToNow } from "date-fns";
import { useShopSubscription } from "@/hooks/use-shop-subscription";
import { useShopLimits } from "@/hooks/use-shop-limits";

export function DashboardPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { role } = useAuth();
    const { hasFeature, checkLimit } = useShopLimits();
    const { formatAmount } = useCurrency();
    const {
        stats,
        recentOrders,
        pendingOrdersList,
        staffAttendance,
        loading,
        error,
    } = useDashboard();

    // Use the robust financial hook (same as Order List) to avoid 'limit 50' bugs
    const financialMetrics = useOrderSummary();

    const orderLimit = checkLimit("maxOrders", stats.monthlyOrders);
    const isOrderLimitReached = !orderLimit.allowed;
    const isOrderLimitNear = orderLimit.limit !== -1 && (orderLimit.remaining ?? 100) <= 10;

    const { subscription } = useShopSubscription();
    const { shop } = useShop();
    const { data: supportData, loading: supportLoading } = useSupportSettings();
    const { markWelcomeSeen } = useShopMutations();
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
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
        // Fire-and-forget: persist to Firestore so it never shows again
        markWelcomeSeen().catch(() => { /* ignore */ });
    };

    // Use minimum loading duration to show animation properly
    const showLoading = useMinLoading(loading, { minDuration: 800 });

    // Show page loader while initial data loads
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
                    action={{
                        label: "Retry",
                        onClick: () => window.location.reload(),
                    }}
                />
            </PageWrapper>
        );
    }



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

                    {/* Video thumbnail preview */}
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
                                        {/* Play button overlay */}
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
                        <LButton
                            type="button"
                            onClick={handleCloseWelcome}
                        >
                            {t("common.gotIt", "Got it")}
                        </LButton>
                    </div>
                </div>
            </LResponsiveDialog>

            <PageWrapper maxWidth="full">
                {/* ============================================ */}
            {/* EXPIRY ALERT BANNER - Show if subscription expired */}
            {/* ============================================ */}
            {subscription?.status === "expired" && (
                <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border border-red-500/20">
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

            {/* Trial: single line – plan name, in trial, days left, Upgrade only */}
            {subscription?.status === "trial" && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3 p-3 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
                    <div className="flex flex-wrap items-center gap-2 gap-y-0">
                        <span className="font-semibold text-foreground">{subscription.planName || 'Pro'}</span>
                        <span className="text-sm text-muted-foreground">{t('dashboard.inTrial', 'in trial')}</span>
                        {subscription.daysRemaining != null && subscription.daysRemaining > 0 && (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {subscription.daysRemaining === 1
                                    ? t('dashboard.trialDaysLeftOne')
                                    : t('dashboard.trialDaysLeft', { count: subscription.daysRemaining })}
                            </span>
                        )}
                        {subscription.daysRemaining != null && subscription.daysRemaining <= 0 && (
                            <span className="text-sm text-destructive font-medium">{t('dashboard.trialEnded')}</span>
                        )}
                    </div>
                    <LButton variant="primary" size="sm" onClick={() => navigate("/settings/subscription")}>
                        {t('dashboard.upgrade')}
                    </LButton>
                </div>
            )}

            {/* Paid plan: single line – plan name, days/expiry; Upgrade only if not highest plan */}
            {subscription && subscription.planId !== "free" && subscription.status !== "expired" && subscription.status !== "trial" && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3 p-3 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
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
                    {subscription.planId !== "business" && (
                        <LButton variant="primary" size="sm" onClick={() => navigate("/settings/subscription")}>
                            {t('dashboard.upgrade')}
                        </LButton>
                    )}
                </div>
            )}

            {/* Plan Limit Alert (Show for Free Plan or any capped plan) */}
            {orderLimit.limit !== -1 && (
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
                                {/* Always show upgrade button for free/limited plans */}
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

            {/* Primary Stats Grid - Full Width with larger gap on desktop */}
            <div className="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
                <LStatCard
                    icon={<IndianRupee className="h-5 w-5" />}
                    variant="primary"
                    title={t('dashboard.todaysRevenue')}
                    value={formatAmount(stats.todayRevenue)}
                    trend={stats.revenueTrend !== 0 ? { value: stats.revenueTrend } : undefined}
                />
                <LStatCard
                    icon={<ShoppingBag className="h-5 w-5" />}
                    variant="default"
                    title={t('dashboard.todaysOrders')}
                    value={stats.todayOrders}
                    trend={stats.ordersTrend !== 0 ? { value: stats.ordersTrend } : undefined}
                />
                <LStatCard
                    icon={<Package className="h-5 w-5" />}
                    variant="success"
                    title={t('dashboard.readyForPickup')}
                    value={stats.readyOrders}
                    onClick={() => navigate("/orders?status=ready")}
                />
                <LStatCard
                    icon={<Users className="h-5 w-5" />}
                    variant="warning"
                    title={t('dashboard.activeCustomers')}
                    value={stats.totalCustomers}
                    onClick={() => navigate("/customers")}
                />
            </div>

            {/* Desktop: 2-column layout for content (65:35 ratio) */}
            <div className={cn(
                "w-full",
                !isMobile && "grid grid-cols-1 lg:grid-cols-12 gap-6"
            )}>
                {/* Main Content - Left side on desktop */}
                <div className={cn(!isMobile && "lg:col-span-8", "space-y-6")}>
                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        <LButton
                            variant="primary"
                            size={isMobile ? "md" : "lg"}
                            leftIcon={<PlusCircle className="h-5 w-5" />}
                            onClick={() => navigate("/new-order")}
                            fullWidth
                            disabled={subscription?.planId === "free" && stats.monthlyOrders >= 50}
                        >
                            {t('dashboard.newOrder')}
                        </LButton>

                        {hasFeature("qrScans") && (
                            <LButton
                                variant="outline"
                                size={isMobile ? "md" : "lg"}
                                leftIcon={<RefreshCw className="h-5 w-5" />}
                                onClick={() => navigate("/scan")}
                                fullWidth
                                className="bg-accent/50 hover:bg-accent border-primary/20 text-primary"
                            >
                                {t('dashboard.scanOrder')}
                            </LButton>
                        )}

                        <LButton
                            variant="outline"
                            size={isMobile ? "md" : "lg"}
                            leftIcon={<ClipboardList className="h-5 w-5" />}
                            onClick={() => navigate("/orders")}
                            fullWidth
                            className={cn(isMobile && !hasFeature("qrScans") && "col-span-2")}
                        >
                            {t('dashboard.viewOrders')}
                        </LButton>
                    </div>

                    {/* Order Status Summary - Visible on all devices */}
                    <LCard className="p-0 overflow-hidden">
                        <div className="p-4 border-b border-border">
                            <h3 className="font-semibold text-foreground">{t('dashboard.orderPipeline')}</h3>
                        </div>
                        <div className="flex md:grid md:grid-cols-4 overflow-x-auto divide-x divide-border snap-x scrollbar-hide pb-2 md:pb-0">
                            <StatusBlock
                                icon={<Clock className="h-5 w-5 text-primary" />}
                                label={t('dashboard.pending')}
                                count={stats.pendingOrders}
                                color=""
                                onClick={() => navigate("/orders?status=pending")}
                                className="min-w-[100px] flex-shrink-0 snap-start"
                            />
                            <StatusBlock
                                icon={<RefreshCw className="h-5 w-5 text-primary" />}
                                label={t('dashboard.processing')}
                                count={stats.processingOrders}
                                color=""
                                onClick={() => navigate("/orders?status=processing")}
                                className="min-w-[100px] flex-shrink-0 snap-start"
                            />
                            <StatusBlock
                                icon={<CheckCircle className="h-5 w-5 text-primary" />}
                                label={t('dashboard.ready')}
                                count={stats.readyOrders}
                                color=""
                                onClick={() => navigate("/orders?status=ready")}
                                className="min-w-[100px] flex-shrink-0 snap-start"
                            />
                            <StatusBlock
                                icon={<Truck className="h-5 w-5 text-primary" />}
                                label={t('dashboard.outForDelivery')}
                                count={stats.outForDeliveryOrders}
                                color=""
                                onClick={() => navigate("/orders?status=out_for_delivery")}
                                className="min-w-[100px] flex-shrink-0 snap-start"
                            />
                        </div>
                    </LCard>

                    {/* Pending Orders List */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-foreground">{t('dashboard.pendingOrders')}</h2>
                            <button
                                onClick={() => navigate("/orders")}
                                className="text-sm text-primary font-medium flex items-center gap-1"
                            >
                                {t('common.viewAll')}
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>

                        {pendingOrdersList.length > 0 ? (
                            <LList>
                                {pendingOrdersList.map((order) => (
                                    <LListItem
                                        key={order.id}
                                        title={`Order #${order.publicId}`}
                                        subtitle={
                                            <span className="flex items-center gap-2 text-xs">
                                                <span>{order.customerName}</span>
                                                <span>•</span>
                                                <span>{order.itemCount} items</span>
                                                <span>•</span>
                                                <LAmount value={order.total} size="xs" />
                                            </span>
                                        }
                                        leftContent={<LAvatar name={order.customerName} size="sm" />}
                                        rightContent={
                                            <div className="flex items-center gap-2">
                                                <LStatusBadge status={order.status} size="sm" />
                                                {order.balance > 0 && (
                                                    <LBadge variant="warning" size="sm">Due</LBadge>
                                                )}
                                            </div>
                                        }
                                        showChevron
                                        onClick={() => navigate(`/orders/${order.id}`)}
                                    />
                                ))}
                            </LList>
                        ) : (
                            <LCard variant="outlined" className="p-0">
                                <LEmptyState
                                    icon={<ClipboardList className="h-8 w-8" />}
                                    title={t('dashboard.noPendingOrders')}
                                    description={t('dashboard.allCaughtUp')}
                                    action={{
                                        label: t('dashboard.createOrder'),
                                        onClick: () => navigate("/new-order"),
                                    }}
                                />
                            </LCard>
                        )}
                    </div>

                    {/* Mobile Ad Slot */}
                    {isMobile && (
                        <LAdSlot variant="card" position="dashboard-mobile" />
                    )}

                    {/* Recent Orders - Visible on all devices */}
                    {recentOrders.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-semibold text-foreground">{t('dashboard.recentOrders')}</h2>
                                <button
                                    onClick={() => navigate("/orders")}
                                    className="text-sm text-primary font-medium flex items-center gap-1"
                                >
                                    {t('common.viewAll')}
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                            <LCard className="p-0 overflow-hidden">
                                <div className="divide-y divide-border">
                                    {recentOrders.slice(0, 5).map((order) => (
                                        <div
                                            key={order.id}
                                            className="p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                            onClick={() => navigate(`/orders/${order.id}`)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <LAvatar name={order.customerName} size="sm" />
                                                    <div>
                                                        <p className="font-medium text-sm text-foreground">
                                                            #{order.publicId}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {order.customerName} • {order.itemCount} items
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <LAmount value={order.total} size="sm" />
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </LCard>
                        </div>
                    )}
                </div>

                {/* Sidebar Widgets - Right side on desktop */}
                {!isMobile && (
                    <div className="lg:col-span-4 space-y-6">
                        {/* Financial Summary */}
                        <LCard className="p-0 overflow-hidden">
                            <div className="p-4 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
                                <h3 className="font-semibold text-foreground flex items-center gap-2">
                                    <Wallet className="h-5 w-5 text-primary" />
                                    {t('dashboard.financialSummary')}
                                </h3>
                            </div>
                            <div className="p-4 space-y-4">
                                <FinancialRow
                                    label={t('dashboard.todaysCollection')}
                                    value={stats.todayCollected}
                                    icon={<CreditCard className="h-4 w-4" />}
                                    variant="success"
                                    formatAmount={formatAmount}
                                />
                                <FinancialRow
                                    label={t('dashboard.outstandingDues')}
                                    value={financialMetrics.loading ? stats.outstandingAmount : financialMetrics.due}
                                    icon={<AlertCircle className="h-4 w-4" />}
                                    variant="warning"
                                    formatAmount={formatAmount}
                                />
                                <FinancialRow
                                    label={t('dashboard.monthlyRevenue')}
                                    value={financialMetrics.loading ? stats.monthlyRevenue : financialMetrics.revenue}
                                    icon={<TrendingUp className="h-4 w-4" />}
                                    variant="primary"
                                    formatAmount={formatAmount}
                                />
                                <FinancialRow
                                    label={t('dashboard.monthlyExpenses')}
                                    value={stats.monthlyExpenses}
                                    icon={<TrendingDown className="h-4 w-4" />}
                                    variant="destructive"
                                    formatAmount={formatAmount}
                                />
                                <div className="pt-2 border-t border-border">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-foreground">{t('dashboard.netProfit')}</span>
                                        <span className={cn(
                                            "font-bold",
                                            ((financialMetrics.loading ? stats.monthlyRevenue : financialMetrics.revenue) - stats.monthlyExpenses) >= 0
                                                ? "text-green-600"
                                                : "text-red-600"
                                        )}>
                                            {formatAmount((financialMetrics.loading ? stats.monthlyRevenue : financialMetrics.revenue) - stats.monthlyExpenses)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 bg-muted/30 border-t border-border">
                                <LButton
                                    variant="ghost"
                                    size="sm"
                                    fullWidth
                                    onClick={() => navigate("/reports")}
                                    rightIcon={<ArrowRight className="h-4 w-4" />}
                                >
                                    {t('dashboard.viewFullReports')}
                                </LButton>
                            </div>
                        </LCard>

                        {/* Order Type Breakdown */}
                        <LCard className="p-0 overflow-hidden">
                            <div className="p-4 border-b border-border">
                                <h3 className="font-semibold text-foreground flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-primary" />
                                    {t('dashboard.todaysOrderTypes')}
                                </h3>
                            </div>
                            <div className="p-4 space-y-3">
                                <OrderTypeRow
                                    icon={<Store className="h-4 w-4" />}
                                    label={t('dashboard.storePickup')}
                                    count={stats.storePickupOrders}
                                    color="bg-blue-100 text-blue-600"
                                />
                                <OrderTypeRow
                                    icon={<Home className="h-4 w-4" />}
                                    label={t('dashboard.homePickup')}
                                    count={stats.homePickupOrders}
                                    color="bg-amber-100 text-amber-600"
                                />
                                <OrderTypeRow
                                    icon={<Truck className="h-4 w-4" />}
                                    label={t('dashboard.homeDelivery')}
                                    count={stats.homeDeliveryOrders}
                                    color="bg-green-100 text-green-600"
                                />
                            </div>
                        </LCard>

                        {/* Staff Attendance */}
                        <LCard className="p-0 overflow-hidden">
                            <div className="p-4 border-b border-border">
                                <h3 className="font-semibold text-foreground flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-primary" />
                                    {t('dashboard.staffAttendance')}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {format(new Date(), "EEEE, MMMM d")}
                                </p>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="p-3 rounded-lg bg-green-50">
                                        <p className="text-2xl font-bold text-green-600">
                                            {staffAttendance.presentToday}
                                        </p>
                                        <p className="text-xs text-green-700">{t('attendance.present')}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-red-50">
                                        <p className="text-2xl font-bold text-red-600">
                                            {staffAttendance.absentToday}
                                        </p>
                                        <p className="text-xs text-red-700">{t('attendance.absent')}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-amber-50">
                                        <p className="text-2xl font-bold text-amber-600">
                                            {staffAttendance.onLeaveToday}
                                        </p>
                                        <p className="text-xs text-amber-700">{t('attendance.leave')}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground text-center mt-3">
                                    {t('dashboard.totalStaff')}: {staffAttendance.totalStaff}
                                </p>
                            </div>
                            <div className="p-3 bg-muted/30 border-t border-border">
                                <LButton
                                    variant="ghost"
                                    size="sm"
                                    fullWidth
                                    onClick={() => navigate("/attendance")}
                                    rightIcon={<ArrowRight className="h-4 w-4" />}
                                >
                                    {t('attendance.markAttendance')}
                                </LButton>
                            </div>
                        </LCard>

                        {/* Customer Stats */}
                        <LCard className="p-0 overflow-hidden">
                            <div className="p-4 border-b border-border">
                                <h3 className="font-semibold text-foreground flex items-center gap-2">
                                    <Users className="h-5 w-5 text-primary" />
                                    {t('dashboard.customerStats')}
                                </h3>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">{t('dashboard.activeCustomers')}</span>
                                    <span className="font-semibold text-foreground">{stats.totalCustomers}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                                        <UserPlus className="h-3 w-3" /> {t('dashboard.newToday')}
                                    </span>
                                    <LBadge variant={stats.newCustomersToday > 0 ? "success" : "muted"} size="sm">
                                        +{stats.newCustomersToday}
                                    </LBadge>
                                </div>
                            </div>
                            <div className="p-3 bg-muted/30 border-t border-border">
                                <LButton
                                    variant="ghost"
                                    size="sm"
                                    fullWidth
                                    onClick={() => navigate("/customers")}
                                    rightIcon={<ArrowRight className="h-4 w-4" />}
                                >
                                    {t('common.viewAll')}
                                </LButton>
                            </div>
                        </LCard>

                        {/* Desktop Ad Slot */}
                        <LAdSlot variant="card" position="dashboard-sidebar" />
                    </div>
                )}
            </div>
            </PageWrapper>
        </>
    );
}

// Helper Components

function StatusBlock({
    icon,
    label,
    count,
    color,
    onClick,
    className,
}: {
    icon: React.ReactNode;
    label: string;
    count: number;
    color: string;
    onClick?: () => void;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "p-2 text-center cursor-pointer hover:bg-muted/50 transition-colors",
                color,
                className
            )}
            onClick={onClick}
        >
            <div className="flex justify-center mb-2">{icon}</div>
            <p className="text-2xl font-bold text-foreground">{count}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}

function FinancialRow({
    label,
    value,
    icon,
    variant,
    formatAmount: fmt,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    variant: "success" | "warning" | "primary" | "destructive";
    formatAmount: (v: number) => string;
}) {
    const colors = {
        success: "text-green-600",
        warning: "text-amber-600",
        primary: "text-primary",
        destructive: "text-red-600",
    };

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className={colors[variant]}>{icon}</span>
                <span>{label}</span>
            </div>
            <span className={cn("font-semibold", colors[variant])}>
                {fmt(value)}
            </span>
        </div>
    );
}

function OrderTypeRow({
    icon,
    label,
    count,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    count: number;
    color: string;
}) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-lg", color)}>
                    {icon}
                </div>
                <span className="text-sm text-foreground">{label}</span>
            </div>
            <span className="font-semibold text-foreground">{count}</span>
        </div>
    );
}
