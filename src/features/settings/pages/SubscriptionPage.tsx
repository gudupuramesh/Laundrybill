/**
 * Subscription Page (web)
 *
 * Read-only: current plan status and plan comparison. Paid subscriptions are
 * purchased only via the Android or iOS app (Google Play / App Store).
 */

import { useMemo } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import {
    LCard,
    LButton,
    LBadge,
    LSpinner,
} from "@/components/laundry";
import { usePlans, filterActivePlans } from "@/features/super-admin/hooks/use-plans";
import { useShopSubscription } from "@/hooks/use-shop-subscription";
import { useCurrency } from "@/hooks/use-currency";
import { Check, X, ChevronLeft, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { normalizePlanId } from "@/types/plans";

const GOOGLE_PLAY_URL =
    import.meta.env.VITE_GOOGLE_PLAY_URL || "https://play.google.com/store/apps";
const APP_STORE_URL =
    import.meta.env.VITE_APP_STORE_URL || "https://apps.apple.com";

export function SubscriptionPage() {
    const { plans, loading: plansLoading } = usePlans();
    const visiblePlans = useMemo(() => filterActivePlans(plans), [plans]);
    const { subscription, loading: subLoading } = useShopSubscription();
    const { formatAmount } = useCurrency();

    const isLoading = plansLoading || subLoading;

    const subscriptionStatus = subscription?.status;
    const isActiveSub =
        subscriptionStatus === "active" ||
        subscriptionStatus === "grace_period" ||
        (subscriptionStatus === "cancelled" &&
            subscription?.activeUntil &&
            subscription.activeUntil > new Date());

    const currentPlanId = isActiveSub
        ? normalizePlanId(subscription?.planId)
        : "free";

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <LSpinner size="lg" />
                <p className="text-muted-foreground">Loading plans...</p>
            </div>
        );
    }

    return (
        <PageWrapper>
            <div className="flex items-center gap-2 mb-6">
                <LButton variant="ghost" size="icon" onClick={() => window.history.back()}>
                    <ChevronLeft className="h-5 w-5" />
                </LButton>
                <h1 className="text-2xl font-bold">Subscription Plans</h1>
            </div>

            <div className="space-y-6 pb-20">
                <LCard
                    variant="elevated"
                    className={cn(
                        "border-l-4",
                        subscription?.status === "active"
                            ? "border-l-green-500"
                            : subscription?.status === "expired"
                              ? "border-l-red-500"
                              : subscription?.status === "cancelled"
                                ? "border-l-amber-500"
                                : "border-l-amber-500"
                    )}
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
                            <h2 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
                                {subscription?.status === "expired" ? "Free Plan" : subscription?.planName || "Free Plan"}
                                <LBadge
                                    variant={
                                        subscription?.status === "active"
                                            ? "success"
                                            : subscription?.status === "expired"
                                              ? "destructive"
                                              : subscription?.status === "cancelled"
                                                ? "warning"
                                                : "warning"
                                    }
                                >
                                    {subscription?.status === "active"
                                        ? "Active"
                                        : subscription?.status === "expired"
                                            ? "Expired"
                                            : subscription?.status === "cancelled"
                                              ? "Cancelled"
                                              : "Free"}
                                </LBadge>
                            </h2>
                            {subscription?.status === "expired" && (
                                <p className="text-sm text-red-600 dark:text-red-400 mt-1 font-medium">
                                    Your paid plan ended. Subscribe in the LaundryBill app to restore Pro features.
                                </p>
                            )}
                            {subscription?.status === "active" && subscription?.expiresAt && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    Renews on {format(subscription.expiresAt, "MMMM d, yyyy")}
                                </p>
                            )}
                            {subscription?.status === "cancelled" && subscription?.activeUntil && (
                                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                                    Access until{" "}
                                    {format(
                                        typeof subscription.activeUntil?.toDate === "function"
                                            ? subscription.activeUntil.toDate()
                                            : subscription.activeUntil,
                                        "MMMM d, yyyy"
                                    )}
                                </p>
                            )}
                            {subscription?.pendingDowngrade && (() => {
                                const ed = subscription.pendingDowngrade.effectiveDate;
                                const edStr =
                                    ed && typeof (ed as { toDate?: () => Date }).toDate === "function"
                                        ? format((ed as { toDate: () => Date }).toDate(), "MMMM d, yyyy")
                                        : ed
                                          ? String(ed)
                                          : "";
                                const toName =
                                    normalizePlanId(subscription.pendingDowngrade.toPlan) === "pro" ? "Pro" : "Free";
                                return (
                                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                                        Downgrade scheduled to {toName} on {edStr}
                                    </p>
                                );
                            })()}
                        </div>

                        {subscription?.usage && (
                            <div className="flex gap-4 text-center">
                                <div className="p-2 bg-muted rounded-lg min-w-[80px]">
                                    <p className="text-xs text-muted-foreground">Orders</p>
                                    <p className="font-bold">{subscription.usage.ordersThisMonth}</p>
                                </div>
                                <div className="p-2 bg-muted rounded-lg min-w-[80px]">
                                    <p className="text-xs text-muted-foreground">Customers</p>
                                    <p className="font-bold">{subscription.usage.totalCustomers}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </LCard>

                <LCard variant="elevated" className="border border-primary/20 bg-primary/5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                            <Smartphone className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground">Subscribe on mobile</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Upgrades and billing run through Google Play or the App Store. Install the LaundryBill app
                                on your phone and open Subscription to purchase Pro.
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                            <LButton
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => window.open(GOOGLE_PLAY_URL, "_blank", "noopener,noreferrer")}
                            >
                                Google Play
                            </LButton>
                            <LButton
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => window.open(APP_STORE_URL, "_blank", "noopener,noreferrer")}
                            >
                                App Store
                            </LButton>
                        </div>
                    </div>
                </LCard>

                <h3 className="text-lg font-bold mt-8 mb-4">Available Plans</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {visiblePlans.map((plan) => {
                        const isCurrent = normalizePlanId(plan.id) === currentPlanId;
                        const isPopular = normalizePlanId(plan.id) === "pro";
                        const isBusiness = normalizePlanId(plan.id) === "business";
                        return (
                            <div
                                key={plan.id}
                                className={cn(
                                    "relative rounded-xl border-2 transition-all duration-200 overflow-hidden flex flex-col",
                                    isCurrent ? "border-primary bg-primary/5" : "border-border bg-card",
                                    isPopular && !isCurrent ? "border-purple-500 shadow-md" : "",
                                    isBusiness && !isCurrent ? "border-blue-800 shadow-md" : ""
                                )}
                            >
                                {isPopular && (
                                    <div className="absolute top-0 right-0 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                                        POPULAR
                                    </div>
                                )}
                                {isBusiness && (
                                    <div className="absolute top-0 right-0 bg-blue-800 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                                        BEST VALUE
                                    </div>
                                )}

                                <div className="p-6 flex-1">
                                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                                    <div className="mb-4">
                                        {plan.prices.monthly > 0 && (
                                            <span className="text-xs text-muted-foreground block mb-1">Starting from</span>
                                        )}
                                        <span className="text-3xl font-bold">{formatAmount(plan.prices.monthly)}</span>
                                        <span className="text-muted-foreground">/month</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-6 min-h-[2.5rem]">
                                        {plan.description || "Full feature access on the paid tier."}
                                    </p>

                                    <ul className="space-y-3 mb-6">
                                        <PlanFeatureItem
                                            label={`${plan.limits.maxOrders === -1 ? "Unlimited" : plan.limits.maxOrders} Orders/mo`}
                                            included={true}
                                        />
                                        <PlanFeatureItem
                                            label={`${plan.limits.maxCustomers === -1 ? "Unlimited" : plan.limits.maxCustomers} Customers`}
                                            included={true}
                                        />
                                        <PlanFeatureItem
                                            label={`${plan.limits.maxStaff === -1 ? "Unlimited" : plan.limits.maxStaff} Staff Accounts`}
                                            included={true}
                                        />
                                        <PlanFeatureItem label="QR Code Scans" included={plan.features.qrScans} />
                                        <PlanFeatureItem label="Order Tracking" included={plan.features.orderTracking} />
                                        <PlanFeatureItem label="Staff Management" included={plan.features.staffManagement} />
                                        <PlanFeatureItem label="Payroll & Expenses" included={plan.features.payroll} />
                                        <PlanFeatureItem label="Reports & Analytics" included={plan.features.reports} />
                                        <PlanFeatureItem label="Driver / Agent App" included={plan.features.driverApp} />
                                        <PlanFeatureItem label="Plant Dashboard" included={plan.features.plantApp} />
                                        <PlanFeatureItem label="Public Ordering Page" included={plan.features.publicOrderingPage} />
                                        <PlanFeatureItem label="Web Dashboard Access" included={plan.features.webDashboard ?? false} />
                                    </ul>
                                </div>

                                <div className="p-6 pt-0 mt-auto">
                                    {isCurrent ? (
                                        <LButton variant="outline" fullWidth disabled>
                                            Current Plan
                                        </LButton>
                                    ) : normalizePlanId(plan.id) === "free" ? (
                                        <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 font-medium">
                                            <span className="text-lg">🎉</span>
                                            <span>Free forever</span>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-center text-muted-foreground py-3 px-2 rounded-lg border border-dashed border-border bg-muted/30">
                                            Use the <strong>Android</strong> or <strong>iOS</strong> app to subscribe.
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </PageWrapper>
    );
}

function PlanFeatureItem({ label, included }: { label: string; included: boolean }) {
    return (
        <li className="flex items-center gap-2 text-sm">
            {included ? (
                <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                </div>
            ) : (
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <X className="h-3 w-3 text-muted-foreground" />
                </div>
            )}
            <span
                className={cn(
                    included ? "text-foreground" : "text-muted-foreground line-through decoration-muted-foreground/50"
                )}
            >
                {label}
            </span>
        </li>
    );
}
