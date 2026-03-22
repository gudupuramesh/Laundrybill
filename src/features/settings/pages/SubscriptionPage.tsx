/**
 * Subscription Page
 * 
 * Allows users to view their current plan and upgrade.
 * Integrates with Razorpay for payment processing.
 */

import { useState, useEffect } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import {
    LCard,
    LButton,
    LBadge,
    LSpinner,
    LResponsiveDialog,
    useLToast
} from "@/components/laundry";
import { usePlans } from "@/features/super-admin/hooks/use-plans";
import { useShopSubscription } from "@/hooks/use-shop-subscription";
import { useAuth } from "@/features/auth";
import { useCurrency } from "@/hooks/use-currency";
import { useShop } from "@/hooks/use-shop";
import { getFunctions, httpsCallable } from "firebase/functions";
import { initiatePayment, type BillingCycleOption } from "@/services/razorpay-checkout";
import {
    Check,
    X,
    Zap,
    ChevronLeft,
    Loader2,
    Ban
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Plan } from "@/types/plans";

const DURATION_OPTIONS: { value: BillingCycleOption; months: number; label: string }[] = [
    { value: "3_months", months: 3, label: "3 months" },
    { value: "6_months", months: 6, label: "6 months" },
    { value: "9_months", months: 9, label: "9 months" },
    { value: "12_months", months: 12, label: "1 year" },
];

export function SubscriptionPage() {
    const { plans, loading: plansLoading } = usePlans();
    const { subscription, loading: subLoading } = useShopSubscription();
    const { shopId } = useAuth();
    const { shop } = useShop();
    const { formatAmount } = useCurrency();
    const { addToast } = useLToast();

    const [durationDiscounts, setDurationDiscounts] = useState<Record<number, number>>({ 3: 0, 6: 5, 9: 10, 12: 17 });
    /** Whether subscription buttons are enabled (controlled by Super Admin). Default true until loaded. */
    const [buttonsEnabled, setButtonsEnabled] = useState(true);

    useEffect(() => {
        const fn = httpsCallable(getFunctions(), "getSubscriptionSettings");
        fn().then((res: any) => {
            if (res?.data?.durationDiscounts) setDurationDiscounts(res.data.durationDiscounts);
            // buttonsEnabled: default true unless explicitly false from backend
            setButtonsEnabled(res?.data?.buttonsEnabled !== false);
        }).catch(() => {});
    }, []);

    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [billingCycle, setBillingCycle] = useState<BillingCycleOption>("3_months");
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false);
    const [selectedDowngradePlan, setSelectedDowngradePlan] = useState<Plan | null>(null);
    const [isSchedulingDowngrade, setIsSchedulingDowngrade] = useState(false);

    const isLoading = plansLoading || subLoading;

    const PLAN_ORDER: Record<string, number> = { free: 0, pro: 1, pro_plus: 2, business: 3 };

    // Determine effective plan based on subscription STATUS, not just planId.
    // When expired/cancelled(past activeUntil)/free, user is effectively on Free
    // so all paid plans show as "Upgrade Now" instead of broken downgrade buttons.
    const subscriptionStatus = subscription?.status;
    const isActiveSub =
        subscriptionStatus === "active" ||
        subscriptionStatus === "trial" ||
        subscriptionStatus === "grace_period" ||
        (subscriptionStatus === "cancelled" &&
         subscription?.activeUntil &&
         subscription.activeUntil > new Date());

    const currentPlanId = isActiveSub
        ? (subscription?.planId || "free")
        : "free";

    const isDowngrade = (plan: Plan) => {
        const to = PLAN_ORDER[plan.id] ?? 0;
        const from = PLAN_ORDER[currentPlanId] ?? 0;
        return to < from && plan.id !== "free";
    };

    const handleUpgradeClick = (plan: Plan) => {
        setSelectedPlan(plan);
        setUpgradeModalOpen(true);
    };

    const handleConfirmUpgrade = async () => {
        if (!selectedPlan || !shopId || !shop) {
            addToast({
                type: "error",
                title: "Error",
                description: "Unable to process payment. Please try again.",
            });
            return;
        }

        setIsProcessingPayment(true);

        try {
            const months = parseInt(billingCycle.replace("_months", ""), 10);
            const discountPct = durationDiscounts[months] ?? 0;
            const amount = Math.round(months * selectedPlan.prices.monthly * (1 - discountPct / 100));

            await initiatePayment(
                {
                    planId: selectedPlan.id,
                    planName: selectedPlan.name,
                    amount,
                    billingCycle,
                    shopId,
                    shopName: shop.name || "Shop Owner",
                    email: shop.email || "",
                    phone: shop.phone || "",
                },
                // Success callback
                (response) => {
                    console.log("Payment successful:", response);
                    setUpgradeModalOpen(false);
                    setIsProcessingPayment(false);
                    addToast({
                        type: "success",
                        title: "Payment Successful! 🎉",
                        description: `Welcome to ${selectedPlan.name}! Your subscription is now active.`,
                    });
                    // Refresh the page to show updated subscription
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                },
                // Failure callback
                (error) => {
                    console.error("Payment failed:", error);
                    setIsProcessingPayment(false);
                    addToast({
                        type: "error",
                        title: "Payment Failed",
                        description: error?.description || "Something went wrong. Please try again.",
                    });
                }
            );
        } catch (error) {
            console.error("Payment initiation error:", error);
            setIsProcessingPayment(false);
            addToast({
                type: "error",
                title: "Payment Error",
                description: "Could not initiate payment. Please try again.",
            });
        }
    };

    const handleCancelSubscription = async () => {
        if (!shopId) return;
        setIsCancelling(true);
        try {
            const functions = getFunctions();
            const cancelFn = httpsCallable<{ shopId: string }, { success: boolean; activeUntil: string | null; message: string }>(
                functions,
                "cancelSubscriptionAtPeriodEnd"
            );
            const res = await cancelFn({ shopId });
            const data = res.data;
            if (data?.success) {
                setCancelDialogOpen(false);
                addToast({
                    type: "success",
                    title: "Subscription cancelled",
                    description: data.message || "You keep access until the end of your billing period.",
                });
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (err: unknown) {
            const message = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Failed to cancel subscription.";
            addToast({
                type: "error",
                title: "Error",
                description: message,
            });
        } finally {
            setIsCancelling(false);
        }
    };

    const handleConfirmDowngrade = async () => {
        if (!shopId || !selectedDowngradePlan) return;
        setIsSchedulingDowngrade(true);
        try {
            const functions = getFunctions();
            const fn = httpsCallable<{ shopId: string; toPlan: string }, { success: boolean; effectiveDate: string | null; message: string }>(
                functions,
                "scheduleDowngrade"
            );
            const res = await fn({ shopId, toPlan: selectedDowngradePlan.id });
            const data = res.data;
            if (data?.success) {
                setDowngradeDialogOpen(false);
                setSelectedDowngradePlan(null);
                addToast({
                    type: "success",
                    title: "Downgrade scheduled",
                    description: data.message || `You'll move to ${selectedDowngradePlan.name} at the end of your billing period.`,
                });
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (err: unknown) {
            const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Failed to schedule downgrade.";
            addToast({ type: "error", title: "Error", description: msg });
        } finally {
            setIsSchedulingDowngrade(false);
        }
    };

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
                {/* Current Plan Status */}
                <LCard variant="elevated" className={cn(
                    "border-l-4",
                    subscription?.status === "active" || subscription?.status === "trial" ? "border-l-green-500" :
                        subscription?.status === "expired" ? "border-l-red-500" :
                            subscription?.status === "cancelled" ? "border-l-amber-500" : "border-l-amber-500"
                )}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                {subscription?.status === "expired" ? "Free Plan" : (subscription?.planName || "Free Plan")}
                                <LBadge variant={
                                    subscription?.status === "active" || subscription?.status === "trial" ? "success" :
                                        subscription?.status === "expired" ? "destructive" :
                                            subscription?.status === "cancelled" ? "warning" : "warning"
                                }>
                                    {subscription?.status === "active" ? "Active" :
                                        subscription?.status === "trial" ? "Trial" :
                                            subscription?.status === "expired" ? "Expired" :
                                                subscription?.status === "cancelled" ? "Cancelled" : "Free"}
                                </LBadge>
                            </h2>
                            {/* Show expiry message or renewal date */}
                            {subscription?.status === "expired" && (
                                <p className="text-sm text-red-600 dark:text-red-400 mt-1 font-medium">
                                    ⚠️ Your {subscription?.planName || "Pro"} plan expired today. Upgrade to continue using premium features.
                                </p>
                            )}
                            {subscription?.status === "active" && subscription?.expiresAt && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    Renews on {format(subscription.expiresAt, "MMMM d, yyyy")}
                                </p>
                            )}
                            {subscription?.status === "cancelled" && subscription?.activeUntil && (
                                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                                    Access until {format(typeof subscription.activeUntil?.toDate === "function" ? subscription.activeUntil.toDate() : subscription.activeUntil, "MMMM d, yyyy")}
                                </p>
                            )}
                            {subscription?.pendingDowngrade && (() => {
                                const ed = subscription.pendingDowngrade.effectiveDate;
                                const edStr = ed && typeof (ed as { toDate?: () => Date }).toDate === "function"
                                    ? format((ed as { toDate: () => Date }).toDate(), "MMMM d, yyyy")
                                    : ed ? String(ed) : "";
                                const toName = subscription.pendingDowngrade.toPlan === "pro" ? "Pro" : subscription.pendingDowngrade.toPlan === "pro_plus" ? "Pro Plus" : subscription.pendingDowngrade.toPlan === "business" ? "Business" : subscription.pendingDowngrade.toPlan;
                                return (
                                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                                        Downgrade scheduled to {toName} on {edStr}
                                    </p>
                                );
                            })()}
                            {(subscription?.status === "active" || subscription?.status === "trial") && subscription?.planId && subscription.planId !== "free" && (
                                <LButton
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    disabled={!buttonsEnabled}
                                    onClick={() => buttonsEnabled && setCancelDialogOpen(true)}
                                    leftIcon={<Ban className="h-4 w-4" />}
                                >
                                    Cancel subscription
                                </LButton>
                            )}
                        </div>

                        {/* Usage Stats Mini View */}
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

                {!buttonsEnabled && (
                    <p className="text-sm text-muted-foreground mb-4 p-3 rounded-lg bg-muted/50 border border-border">
                        Enjoy your trial. Upgrade options will be available soon.
                    </p>
                )}

                <h3 className="text-lg font-bold mt-8 mb-4">Available Plans</h3>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map((plan) => {
                        const isCurrent = plan.id === currentPlanId;
                        const isPopular = plan.id === "pro";
                        const downgrade = isDowngrade(plan);
                        return (
                            <div
                                key={plan.id}
                                className={cn(
                                    "relative rounded-xl border-2 transition-all duration-200 overflow-hidden flex flex-col",
                                    isCurrent ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
                                    isPopular && !isCurrent ? "border-purple-500 shadow-md" : ""
                                )}
                            >
                                {isPopular && (
                                    <div className="absolute top-0 right-0 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                                        MOST POPULAR
                                    </div>
                                )}

                                <div className="p-6 flex-1">
                                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                                    <div className="mb-4">
                                        <span className="text-3xl font-bold">{formatAmount(plan.prices.monthly)}</span>
                                        <span className="text-muted-foreground">/month</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-6 h-10">
                                        {/* Description placeholder if needed */}
                                        Best for growing businesses
                                    </p>

                                    <ul className="space-y-3 mb-6">
                                        {/* Limits */}
                                        <PlanFeatureItem label={`${plan.limits.maxOrders === -1 ? 'Unlimited' : plan.limits.maxOrders} Orders/mo`} included={true} />
                                        <PlanFeatureItem label={`${plan.limits.maxCustomers === -1 ? 'Unlimited' : plan.limits.maxCustomers} Customers`} included={true} />
                                        <PlanFeatureItem label={`${plan.limits.maxStaff === -1 ? 'Unlimited' : plan.limits.maxStaff} Staff Accounts`} included={true} />

                                        {/* Key Features */}
                                        <PlanFeatureItem label="QR Code Scans" included={plan.features.qrScans} />
                                        <PlanFeatureItem label="Order Tracking" included={plan.features.orderTracking} />
                                        <PlanFeatureItem label="Staff Management" included={plan.features.staffManagement} />
                                        <PlanFeatureItem label="Payroll & Expenses" included={plan.features.payroll} />
                                        <PlanFeatureItem label="Reports & Analytics" included={plan.features.reports} />
                                    </ul>
                                </div>

                                <div className="p-6 pt-0 mt-auto">
                                    {isCurrent ? (
                                        <LButton variant="outline" fullWidth disabled>
                                            Current Plan
                                        </LButton>
                                    ) : downgrade ? (
                                        <LButton variant="outline" fullWidth disabled>
                                            Available after plan expires
                                        </LButton>
                                    ) : plan.id === "free" ? (
                                        <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 font-medium">
                                            <span className="text-lg">🎉</span>
                                            <span>Free forever</span>
                                        </div>
                                    ) : (
                                        <LButton
                                            variant="primary"
                                            fullWidth
                                            disabled={!buttonsEnabled}
                                            onClick={() => handleUpgradeClick(plan)}
                                            className={cn(isPopular ? "bg-purple-600 hover:bg-purple-700" : "")}
                                        >
                                            Upgrade Now
                                        </LButton>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Upgrade Confirmation Modal */}
            <LResponsiveDialog
                open={upgradeModalOpen}
                onClose={() => setUpgradeModalOpen(false)}
                title={`Upgrade to ${selectedPlan?.name}`}
            >
                <div className="space-y-4 pt-4">
                    <p className="text-muted-foreground text-center">
                        Select duration (longer = more discount)
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        {DURATION_OPTIONS.map((opt) => {
                            const discountPct = durationDiscounts[opt.months] ?? 0;
                            const price = Math.round(opt.months * (selectedPlan?.prices.monthly ?? 0) * (1 - discountPct / 100));
                            return (
                                <div
                                    key={opt.value}
                                    className={cn(
                                        "border-2 rounded-xl p-4 cursor-pointer transition-all text-center relative",
                                        billingCycle === opt.value ? "border-primary bg-primary/5" : "border-border"
                                    )}
                                    onClick={() => setBillingCycle(opt.value)}
                                >
                                    {discountPct > 0 && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                            SAVE {discountPct}%
                                        </div>
                                    )}
                                    <p className="font-semibold">{opt.label}</p>
                                    <p className="text-xl font-bold mt-1">{formatAmount(price)}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{formatAmount(selectedPlan?.prices.monthly ?? 0)}/mo</p>
                                </div>
                            );
                        })}
                    </div>

                    <div className="pt-4">
                        <LButton
                            fullWidth
                            size="lg"
                            onClick={handleConfirmUpgrade}
                            disabled={!buttonsEnabled || isProcessingPayment}
                            leftIcon={isProcessingPayment ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                        >
                            {isProcessingPayment ? "Processing..." : "Proceed to Payment"}
                        </LButton>
                        <p className="text-xs text-muted-foreground text-center mt-3">
                            Secure payment powered by Razorpay
                        </p>
                    </div>
                </div>
            </LResponsiveDialog>

            {/* Cancel subscription confirmation */}
            <LResponsiveDialog
                open={cancelDialogOpen}
                onClose={() => !isCancelling && setCancelDialogOpen(false)}
                title="Cancel subscription?"
            >
                <div className="space-y-4 pt-4">
                    <p className="text-muted-foreground">
                        You will keep access to <strong>{subscription?.planName || "your plan"}</strong> until{" "}
                        {subscription?.expiresAt ? format(subscription.expiresAt, "MMMM d, yyyy") : "the end of your billing period"}.
                        After that, your account will move to the Free plan.
                    </p>
                    <div className="flex gap-3 pt-2">
                        <LButton variant="outline" fullWidth onClick={() => setCancelDialogOpen(false)} disabled={isCancelling}>
                            Keep subscription
                        </LButton>
                        <LButton variant="destructive" fullWidth onClick={handleCancelSubscription} disabled={isCancelling} leftIcon={isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>
                            {isCancelling ? "Cancelling..." : "Cancel subscription"}
                        </LButton>
                    </div>
                </div>
            </LResponsiveDialog>

            {/* Downgrade confirmation */}
            <LResponsiveDialog
                open={downgradeDialogOpen}
                onClose={() => !isSchedulingDowngrade && setDowngradeDialogOpen(false)}
                title={`Switch to ${selectedDowngradePlan?.name}?`}
            >
                <div className="space-y-4 pt-4">
                    <p className="text-muted-foreground">
                        You will keep <strong>{subscription?.planName || "your current plan"}</strong> until{" "}
                        {subscription?.expiresAt ? format(subscription.expiresAt, "MMMM d, yyyy") : "the end of your billing period"}.
                        After that, your plan will change to <strong>{selectedDowngradePlan?.name}</strong>.
                    </p>
                    <div className="flex gap-3 pt-2">
                        <LButton variant="outline" fullWidth onClick={() => setDowngradeDialogOpen(false)} disabled={isSchedulingDowngrade}>
                            Keep current plan
                        </LButton>
                        <LButton variant="secondary" fullWidth onClick={handleConfirmDowngrade} disabled={isSchedulingDowngrade} leftIcon={isSchedulingDowngrade ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>
                            {isSchedulingDowngrade ? "Scheduling..." : "Switch to " + (selectedDowngradePlan?.name ?? "")}
                        </LButton>
                    </div>
                </div>
            </LResponsiveDialog>
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
            <span className={cn(included ? "text-foreground" : "text-muted-foreground line-through decoration-muted-foreground/50")}>
                {label}
            </span>
        </li>
    );
}
