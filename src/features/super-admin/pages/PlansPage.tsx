/**
 * Plans Management Page
 * 
 * View and edit subscription plans
 */

import { useState } from "react";
import { usePlans } from "../hooks/use-plans";
import { LCard, LButton, LPageLoader } from "@/components/laundry";
import { PlanEditorSheet } from "../components/PlanEditorSheet";
import { Check, Edit, RotateCcw } from "lucide-react";
import type { Plan } from "@/types/plans";
import { cn } from "@/lib/utils";
import { formatCurrencyValue } from "@/hooks/use-currency";

const PLAN_COLORS: Record<string, string> = {
    free: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    pro: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    pro_plus: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    business: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

export function PlansPage() {
    const { plans, loading, error, updatePlan, resetPlans } = usePlans();
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [isResetting, setIsResetting] = useState(false);

    const handleSave = async (plan: Plan) => {
        await updatePlan(plan);
        setEditingPlan(null);
    };

    const handleReset = async () => {
        if (confirm("Are you sure you want to reset all plans to default configuration? This will overwrite recent changes.")) {
            setIsResetting(true);
            try {
                await resetPlans();
            } finally {
                setIsResetting(false);
            }
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Subscription Plans</h1>
                    <p className="text-muted-foreground">Manage plan features, pricing, and limits</p>
                </div>
                <LButton
                    variant="outline"
                    onClick={handleReset}
                    loading={isResetting}
                    leftIcon={<RotateCcw className="h-4 w-4" />}
                >
                    Reset to Defaults
                </LButton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {plans.map((plan) => (
                    <LCard key={plan.id} className="flex flex-col h-full relative group">
                        <div className="absolute top-4 right-4">
                            <LButton
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingPlan(plan)}
                            >
                                <Edit className="h-4 w-4" />
                            </LButton>
                        </div>

                        <div className="p-6 flex-1">
                            <div className={cn(
                                "inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4",
                                PLAN_COLORS[plan.id] || "bg-gray-100 text-gray-800"
                            )}>
                                {plan.name}
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
