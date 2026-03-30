/**
 * Plans Management Page
 * 
 * View and edit subscription plans
 */

import { useMemo, useState } from "react";
import { usePlans } from "../hooks/use-plans";
import { LCard, LButton, LPageLoader } from "@/components/laundry";
import { PlanEditorSheet } from "../components/PlanEditorSheet";
import { Check, X, Edit, Trash2 } from "lucide-react";
import type { Plan } from "@/types/plans";
import { normalizePlanId } from "@/types/plans";
import { cn } from "@/lib/utils";

const PLAN_COLORS: Record<string, string> = {
    free: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    pro: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

export function PlansPage() {
    const { plans, loading, error, updatePlan, deletePlan } = usePlans();
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [busyPlanId, setBusyPlanId] = useState<string | null>(null);

    const sortedPlans = useMemo(() => {
        return [...plans].sort((a, b) => a.prices.monthly - b.prices.monthly);
    }, [plans]);

    const handleSave = async (plan: Plan) => {
        await updatePlan(plan);
        setEditingPlan(null);
    };


    const handleDelete = async (plan: Plan) => {
        if (plan.id === "free") return;
        if (
            !confirm(
                `Permanently delete "${plan.name}" (${plan.id}) from Firestore?\n\n` +
                    `This removes the plans/${plan.id} document from the database (not just the UI). ` +
                    "Existing shops on this plan still fall back to app defaults until you change their subscription."
            )
        ) {
            return;
        }
        setBusyPlanId(plan.id);
        try {
            await deletePlan(plan.id);
        } catch (e) {
            console.error(e);
            alert(e instanceof Error ? e.message : "Failed to delete plan");
        } finally {
            setBusyPlanId(null);
        }
    };

    if (loading) return <LPageLoader message="Loading plans..." />;

    if (error) {
        return (
            <div className="p-8 text-center text-destructive">
                <p>{error}</p>
                <LButton onClick={() => window.location.reload()} className="mt-4">Retry</LButton>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold">Subscription Plans</h1>
                <p className="text-muted-foreground mt-1 max-w-3xl">
                    Control free tier limits (orders/month, staff, etc.). Pricing is managed in Google Play / App Store.
                    When a free user hits the limit, they are shown an upgrade prompt.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sortedPlans.map((plan) => {
                    const isPro = normalizePlanId(plan.id) === "pro";
                    return (
                    <LCard
                        key={plan.id}
                        padding="none"
                        className={cn(
                            "flex flex-col h-full overflow-visible",
                            isPro && "ring-2 ring-blue-500/30",
                        )}
                    >
                        <div className="p-5 md:p-6 flex-1 flex flex-col">
                            {/* Header: name + actions */}
                            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                    <div className={cn(
                                        "inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
                                        PLAN_COLORS[normalizePlanId(plan.id)] || "bg-gray-100 text-gray-800"
                                    )}>
                                        {plan.name}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                                    <LButton
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingPlan(plan)}
                                        leftIcon={<Edit className="h-4 w-4" />}
                                    >
                                        Edit
                                    </LButton>
                                    {plan.id !== "free" && (
                                        <LButton
                                            size="sm"
                                            variant="outline"
                                            className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                            disabled={busyPlanId === plan.id}
                                            onClick={() => handleDelete(plan)}
                                            leftIcon={<Trash2 className="h-4 w-4" />}
                                        >
                                            Delete
                                        </LButton>
                                    )}
                                </div>
                            </div>

                            <p className="text-sm text-muted-foreground mb-5">
                                {plan.description}
                            </p>

                            {/* Usage Limits */}
                            <div className="mb-5">
                                <h4 className="font-semibold text-sm mb-3 text-foreground">Usage Limits</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <LimitItem label="Orders / month" value={plan.limits.maxOrders} />
                                    <LimitItem label="Customers" value={plan.limits.maxCustomers} />
                                    <LimitItem label="Staff members" value={plan.limits.maxStaff} />
                                    <LimitItem label="Delivery agents" value={plan.limits.maxDeliveryAgents} />
                                    <LimitItem label="Plant staff" value={plan.limits.maxPlantStaff} />
                                    <LimitItem label="Storage" value={`${plan.limits.storageGB === -1 ? "Unlimited" : plan.limits.storageGB + " GB"}`} />
                                </div>
                            </div>

                            <div className="border-t border-border/60 pt-4" />

                            {/* All Features */}
                            <div>
                                <h4 className="font-semibold text-sm mb-3 text-foreground">Features</h4>
                                <div className="space-y-1.5">
                                    <FeatureRow label="Orders & POS" included={plan.features.orders} />
                                    <FeatureRow label="Customers" included={plan.features.customers} />
                                    <FeatureRow label="Services & Inventory" included={plan.features.services} />
                                    <FeatureRow label="Order Tracking" included={plan.features.orderTracking} />
                                    <FeatureRow label="WhatsApp Receipts" included={plan.features.whatsappReceipts} />
                                    <FeatureRow label="Multi-Language" included={plan.features.multiLanguage} />
                                    <FeatureRow label="Staff Management" included={plan.features.staffManagement} />
                                    <FeatureRow label="Attendance Tracking" included={plan.features.attendance} />
                                    <FeatureRow label="Payroll" included={plan.features.payroll} />
                                    <FeatureRow label="Expenses" included={plan.features.expenses} />
                                    <FeatureRow label="Reports & Analytics" included={plan.features.reports} />
                                    <FeatureRow label="Damage Photos" included={plan.features.damagePhotos} />
                                    <FeatureRow label="QR Code Scanning" included={plan.features.qrScans} />
                                    <FeatureRow label="Staff App" included={plan.features.staffApp} />
                                    <FeatureRow label="Driver / Agent App" included={plan.features.driverApp} />
                                    <FeatureRow label="Plant Dashboard" included={plan.features.plantApp} />
                                    <FeatureRow label="Public Ordering Page" included={plan.features.publicOrderingPage} />
                                </div>
                            </div>

                            {/* Apps included */}
                            {plan.apps && plan.apps.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-border/60">
                                    <h4 className="font-semibold text-sm mb-2 text-foreground">Apps Included</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {plan.apps.map((app) => (
                                            <span key={app} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                                                {app} App
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </LCard>
                    );
                })}
            </div>

            <PlanEditorSheet
                planId={editingPlan?.id || null}
                existingPlan={editingPlan}
                open={!!editingPlan}
                onClose={() => setEditingPlan(null)}
                onSave={handleSave}
            />
        </div>
    );
}

function LimitItem({ label, value }: { label: string; value: number | string }) {
    const isUnlimited = value === -1 || value === "Unlimited";
    return (
        <div className="rounded-lg bg-muted/50 p-2.5">
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            <p className={cn("text-sm font-semibold", isUnlimited ? "text-primary" : "text-foreground")}>
                {isUnlimited ? "Unlimited" : typeof value === "number" && value === 0 ? "—" : value}
            </p>
        </div>
    );
}

function FeatureRow({ label, included }: { label: string; included: boolean }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            {included ? (
                <Check className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
                <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            )}
            <span className={included ? "text-foreground" : "text-muted-foreground/60"}>{label}</span>
        </div>
    );
}
