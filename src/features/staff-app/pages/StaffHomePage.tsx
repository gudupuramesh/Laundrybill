/**
 * Staff Home Page
 * 
 * Main dashboard for Staff - Cloned from Admin DashboardPage for consistency
 */

import { PageWrapper } from "@/components/PageWrapper";
import {
    LStatCard,
    LButton,
    LEmptyState,
    LCard,
    LPageLoader,
    LBadge,
    LList,
    LListItem,
    LAvatar,
    LAmount,
    LStatusBadge,
} from "@/components/laundry";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/hooks/use-dashboard";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMinLoading } from "@/hooks/use-min-loading";
import {
    IndianRupee,
    ShoppingBag,
    Package,
    Users,
    PlusCircle,
    ClipboardList,
    Clock,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    RefreshCw,
    Truck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

export function StaffHomePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { formatAmount } = useCurrency();

    // Using the same hook as Admin
    const {
        stats,
        pendingOrdersList,
        loading,
        error,
    } = useDashboard();

    // Use minimum loading duration to show animation properly
    const showLoading = useMinLoading(loading, { minDuration: 800 });

    // Show page loader while initial data loads
    if (showLoading) {
        return (
            <div className="h-full">
                <LPageLoader variant="machine" message={t('common.loading')} />
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
                        label: t("common.retry"),
                        onClick: () => window.location.reload(),
                    }}
                />
            </PageWrapper>
        );
    }

    return (
        <PageWrapper maxWidth="full">
            {/* Greeting (Optional, Admin doesn't have it but nice for Staff) - Keeping minimal to match Admin */}

            {/* Primary Stats Grid - Full Width with larger gap on desktop */}
            {/* Matching Admin Grid exactly: grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4 mb-6 */}
            <div className="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
                {/* 1. Revenue (Admin uses generic revenue, Staff sees same) */}
                <LStatCard
                    icon={<IndianRupee className="h-5 w-5" />}
                    variant="primary"
                    title={t('dashboard.todaysRevenue')}
                    value={formatAmount(stats.todayRevenue)}
                    trend={stats.revenueTrend !== 0 ? { value: stats.revenueTrend } : undefined}
                />
                {/* 2. Today's Orders */}
                <LStatCard
                    icon={<ShoppingBag className="h-5 w-5" />}
                    variant="default"
                    title={t('dashboard.todaysOrders')}
                    value={stats.todayOrders}
                    trend={stats.ordersTrend !== 0 ? { value: stats.ordersTrend } : undefined}
                />
                {/* 3. Ready for Pickup */}
                <LStatCard
                    icon={<Package className="h-5 w-5" />}
                    variant="success"
                    title={t('dashboard.readyForPickup')}
                    value={stats.readyOrders}
                    onClick={() => navigate("/staff/orders?status=ready")}
                />
                {/* 4. Active Customers (Admin has this) */}
                <LStatCard
                    icon={<Users className="h-5 w-5" />}
                    variant="warning"
                    title={t('dashboard.activeCustomers')}
                    value={stats.totalCustomers}
                    onClick={() => navigate("/staff/customers")}
                />
            </div>

            {/* Desktop: 2-column layout for content (65:35 ratio) */}
            <div className={cn(
                "w-full",
                !isMobile && "grid grid-cols-1 lg:grid-cols-12 gap-6"
            )}>
                {/* Main Content - Left side on desktop (col-span-8) */}
                <div className={cn(!isMobile && "lg:col-span-8", "space-y-6")}>
                    {/* Quick Actions - Grid cols 2 to match Admin style */}
                    <div className="grid grid-cols-2 gap-3">
                        <LButton
                            variant="primary"
                            size={isMobile ? "md" : "lg"}
                            leftIcon={<PlusCircle className="h-5 w-5" />}
                            onClick={() => navigate("/staff/orders/new")}
                            fullWidth
                        >
                            {t('dashboard.newOrder')}
                        </LButton>
                        <LButton
                            variant="outline"
                            size={isMobile ? "md" : "lg"}
                            leftIcon={<ClipboardList className="h-5 w-5" />}
                            onClick={() => navigate("/staff/orders")}
                            fullWidth
                        >
                            {t('dashboard.viewOrders')}
                        </LButton>
                    </div>

                    {/* Order Status Summary (Pipeline) - Desktop only (Admin logic) */}
                    {!isMobile && (
                        <LCard className="p-0 overflow-hidden">
                            <div className="p-4 bg-muted/40 border-b border-border">
                                <h3 className="font-semibold text-foreground">{t('dashboard.orderPipeline')}</h3>
                                <p className="text-xs text-muted-foreground">{t('dashboard.pipelineDesc')}</p>
                            </div>
                            <div className="grid grid-cols-4 divide-x divide-border">
                                <StatusBlock
                                    icon={<Clock className="h-5 w-5 text-amber-500" />}
                                    label={t("dashboard.pending")}
                                    count={stats.pendingOrders}
                                    color="bg-amber-50"
                                    onClick={() => navigate("/staff/orders?status=pending")}
                                />
                                <StatusBlock
                                    icon={<RefreshCw className="h-5 w-5 text-blue-500" />}
                                    label={t("dashboard.processing")}
                                    count={stats.processingOrders}
                                    color="bg-blue-50"
                                    onClick={() => navigate("/staff/orders?status=processing")}
                                />
                                <StatusBlock
                                    icon={<CheckCircle className="h-5 w-5 text-green-500" />}
                                    label={t("dashboard.ready")}
                                    count={stats.readyOrders}
                                    color="bg-green-50"
                                    onClick={() => navigate("/staff/orders?status=ready")}
                                />
                                <StatusBlock
                                    icon={<Truck className="h-5 w-5 text-purple-500" />}
                                    label={t("dashboard.outForDelivery")}
                                    count={stats.outForDeliveryOrders}
                                    color="bg-purple-50"
                                    onClick={() => navigate("/staff/orders?status=out_for_delivery")}
                                />
                            </div>
                        </LCard>
                    )}
                </div>

                {/* Right Side - Pending Orders List (col-span-4) */}
                <div className={cn(!isMobile && "lg:col-span-4", "space-y-6", isMobile && "mt-6")}>
                    {/* Pending Orders Widget */}
                    <LCard className="h-full max-h-[500px] flex flex-col">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-semibold">{t('staff.home.pending')}</h3>
                            <LBadge variant="warning" size="sm">
                                {stats.pendingOrders}
                            </LBadge>
                        </div>
                        <div className="overflow-y-auto flex-1 p-0">
                            {pendingOrdersList.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    {t("orders.empty")}
                                </div>
                            ) : (
                                <LList>
                                    {pendingOrdersList.slice(0, 5).map((order) => (
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
                                            onClick={() => navigate(`/staff/orders/${order.id}`)}
                                        />
                                    ))}
                                </LList>
                            )}
                        </div>
                        <div className="p-3 bg-muted/30 border-t border-border">
                            <LButton
                                variant="ghost"
                                size="sm"
                                fullWidth
                                onClick={() => navigate("/staff/orders")}
                                rightIcon={<ArrowRight className="h-4 w-4" />}
                            >
                                {t('common.viewAll')}
                            </LButton>
                        </div>
                    </LCard>
                </div>
            </div>
        </PageWrapper>
    );
}

// Helper Components (Cloned from DashboardPage)

function StatusBlock({
    icon,
    label,
    count,
    color,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    count: number;
    color: string;
    onClick?: () => void;
}) {
    return (
        <div
            className={cn(
                "p-4 text-center cursor-pointer transition-colors",
                color
            )}
            onClick={onClick}
        >
            <div className="flex justify-center mb-2">{icon}</div>
            <p className="text-2xl font-bold text-foreground">{count}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}
