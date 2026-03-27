/**
 * Plans Management Page
 * 
 * View and edit subscription plans
 */

import { useMemo, useState } from "react";
import { usePlans } from "../hooks/use-plans";
import { LCard, LButton, LPageLoader } from "@/components/laundry";
import { PlanEditorSheet } from "../components/PlanEditorSheet";
import { Check, Edit, Trash2 } from "lucide-react";
import type { Plan } from "@/types/plans";
import { normalizePlanId } from "@/types/plans";
import { cn } from "@/lib/utils";
import { formatCurrencyValue } from "@/hooks/use-currency";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const PLAN_COLORS: Record<string, string> = {
    free: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    pro: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

export function PlansPage() {
    const { plans, loading, error, updatePlan, deletePlan } = usePlans();
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [busyPlanId, setBusyPlanId] = useState<string | null>(null);

    const sortedPlans = useMemo(() => {
        return [...plans].sort((a, b) => {
            const aOn = a.isActive !== false ? 0 : 1;
            const bOn = b.isActive !== false ? 0 : 1;
            if (aOn !== bOn) return aOn - bOn;
            return a.prices.monthly - b.prices.monthly;
        });
    }, [plans]);

    const handleSave = async (plan: Plan) => {
        await updatePlan(plan);
        setEditingPlan(null);
    };

    const handleToggleActive = async (plan: Plan, next: boolean) => {
        setBusyPlanId(plan.id);
        try {
            await updatePlan({ ...plan, isActive: next });
        } finally {
            setBusyPlanId(null);
        }
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
                    Keep <strong>Free</strong> plus one paid tier (e.g. <strong>Pro</strong>). Turn <strong>Active</strong> off or <strong>Delete</strong> extra tiers you do not sell.
                    Delete removes the document from Firestore; Active off only hides it from upgrades.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {sortedPlans.map((plan) => (
                    <LCard
                        key={plan.id}
                        padding="none"
                        className={cn(
                            "flex flex-col h-full overflow-visible",
                            plan.isActive === false && "opacity-75 ring-1 ring-muted-foreground/20"
                        )}
                    >
                        <div className="p-6 flex-1 flex flex-col">
                            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                    <div className={cn(
                                        "inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
                                        PLAN_COLORS[normalizePlanId(plan.id)] || "bg-gray-100 text-gray-800"
                                    )}>
                                        {plan.name}
                                    </div>
                                    {plan.isActive === false && (
                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                            Inactive
                                        </span>
                                    )}
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

                            <div className="flex items-center justify-between gap-3 mb-4 pb-4 border-b border-border/60">
                                <Label htmlFor={`active-${plan.id}`} className="text-sm font-medium cursor-pointer">
                                    Active (show in shop upgrade)
                                </Label>
                                <Switch
                                    id={`active-${plan.id}`}
                                    checked={plan.isActive !== false}
                                    disabled={busyPlanId === plan.id}
                                    onCheckedChange={(checked) => handleToggleActive(plan, checked)}
                                />
                            </div>

                            <div className="mb-6">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-bold">{formatCurrencyValue(plan.prices.monthly)}</span>
                                    <span className="text-muted-foreground">/mo</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {formatCurrencyValue(plan.prices.yearly)}/yr (billed annually)
                                </div>
                            </div>

                            <p className="text-sm text-muted-foreground mb-6 h-10">
                                {plan.description}
                            </p>

                            <div className="space-y-3">
                                <h4 className="font-medium text-sm">Limits</h4>
                                <ul className="text-sm space-y-2 text-muted-foreground">
                                    <li className="flex justify-between">
                                        <span>Orders</span>
                                        <span className="font-medium text-foreground">{plan.limits.maxOrders === -1 ? "Unlimited" : plan.limits.maxOrders}</span>
                                    </li>
                                    <li className="flex justify-between">
                                        <span>Staff</span>
                                        <span className="font-medium text-foreground">{plan.limits.maxStaff === -1 ? "Unlimited" : plan.limits.maxStaff}</span>
                                    </li>
                                    <li className="flex justify-between">
                                        <span>Delivery Agents</span>
                                        <span className="font-medium text-foreground">{plan.limits.maxDeliveryAgents === -1 ? "Unlimited" : (plan.limits.maxDeliveryAgents || 0)}</span>
                                    </li>
                                    <li className="flex justify-between">
                                        <span>Plant Staff</span>
                                        <span className="font-medium text-foreground">{plan.limits.maxPlantStaff === -1 ? "Unlimited" : (plan.limits.maxPlantStaff || 0)}</span>
                                    </li>
                                </ul>

                                <div className="border-t my-4" />

                                <h4 className="font-medium text-sm">Key Features</h4>
                                <ul className="space-y-2">
                                    {plan.features.staffManagement && (
                                        <li className="flex items-center gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500" /> Staff Management
                                        </li>
                                    )}
                                    {plan.features.damagePhotos && (
                                        <li className="flex items-center gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500" /> Damage Photos
                                        </li>
                                    )}
                                    {plan.features.driverApp && (
                                        <li className="flex items-center gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500" /> Driver App
                                        </li>
                                    )}
                                    {plan.features.plantApp && (
                                        <li className="flex items-center gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500" /> Plant Dashboard
                                        </li>
                                    )}
                                    {plan.features.publicOrderingPage && (
                                        <li className="flex items-center gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500" /> Public Ordering Page
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </LCard>
                ))}
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
