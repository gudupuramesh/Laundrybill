import { LButton, LTextInput, LResponsiveDialog } from "@/components/laundry";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Plan, PlanFeatures } from "@/types/plans";
import { useState, useEffect } from "react";
import { PLANS } from "@/config/plans";

interface PlanEditorSheetProps {
    planId: string | null;
    open: boolean;
    onClose: () => void;
    onSave: (plan: Plan) => Promise<void>;
    existingPlan?: Plan | null;
}

const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
    // Core
    orders: "Unlimited Orders",
    customers: "Unlimited Customers",
    services: "Service Menu",
    orderTracking: "Public Tracking",
    whatsappReceipts: "WhatsApp Receipts",
    multiLanguage: "Multi-language",

    // Staff & Ops
    staffManagement: "Staff Management",
    attendance: "Attendance",
    payroll: "Payroll",
    expenses: "Expenses",
    reports: "Reports & Analytics",

    // Advanced
    damagePhotos: "Damage Photos",
    staffApp: "Staff Usage",
    driverApp: "Driver App",
    plantApp: "Plant Dashboard",
    qrScans: "QR Code System",
    publicOrderingPage: "Public Ordering Page",
    webDashboard: "Web Dashboard Access",
};

export function PlanEditorSheet({
    planId,
    open,
    onClose,
    onSave,
    existingPlan,
}: PlanEditorSheetProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Plan | null>(null);

    useEffect(() => {
        if (open && planId) {
            // Load existing or default from config
            const configPlan = PLANS[planId as keyof typeof PLANS];
            let initialData: Plan = existingPlan || configPlan || {
                id: planId as Plan["id"],
                name: "",
                prices: { monthly: 0, yearly: 0 },
                features: {} as PlanFeatures,
                limits: {
                    maxOrders: 50,
                    maxCustomers: 100,
                    maxStaff: 1,
                    maxServices: -1,
                    storageGB: 1,
                },
                apps: ["admin"],
                isActive: true,
            };
            // Merge features with config defaults so new features (e.g. publicOrderingPage) appear correctly
            if (configPlan?.features && initialData.features) {
                initialData = {
                    ...initialData,
                    features: { ...configPlan.features, ...initialData.features },
                };
            }
            setFormData(JSON.parse(JSON.stringify(initialData)));
        }
    }, [open, planId, existingPlan]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData) return;

        setLoading(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error("Error saving plan:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!formData) return null;

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={formData ? `Edit Plan: ${formData.name}` : "Edit Plan"}
            size="lg"
        >
            <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                    Configure limits, pricing, and features for this plan.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="font-medium border-b pb-2">Basic Info</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <LTextInput
                                label="Plan Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                            <LTextInput
                                label="Badge (Optional)"
                                value={formData.badge || ""}
                                onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                                placeholder="e.g. Most Popular"
                            />
                        </div>
                        <LTextInput
                            label="Description"
                            value={formData.description || ""}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    {/* Pricing */}
                    <div className="space-y-4">
                        <h3 className="font-medium border-b pb-2">Pricing (₹)</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <LTextInput
                                label="Monthly Price"
                                type="number"
                                value={formData.prices.monthly}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    prices: { ...formData.prices, monthly: Number(e.target.value) }
                                })}
                                required
                            />
                            <LTextInput
                                label="Yearly Price"
                                type="number"
                                value={formData.prices.yearly}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    prices: { ...formData.prices, yearly: Number(e.target.value) }
                                })}
                                required
                            />
                        </div>
                    </div>

                    {/* Limits */}
                    <div className="space-y-4">
                        <h3 className="font-medium border-b pb-2">Hard Limits (-1 for Unlimited)</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <LTextInput
                                label="Max Orders/Mo"
                                type="number"
                                value={formData.limits.maxOrders}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    limits: { ...formData.limits, maxOrders: Number(e.target.value) }
                                })}
                            />
                            <LTextInput
                                label="Max Customers"
                                type="number"
                                value={formData.limits.maxCustomers}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    limits: { ...formData.limits, maxCustomers: Number(e.target.value) }
                                })}
                            />
                            <LTextInput
                                label="Max Staff (Admins/Mgr)"
                                type="number"
                                value={formData.limits.maxStaff}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    limits: { ...formData.limits, maxStaff: Number(e.target.value) }
                                })}
                            />
                            <LTextInput
                                label="Max Delivery Agents"
                                type="number"
                                value={formData.limits.maxDeliveryAgents ?? 0}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    limits: { ...formData.limits, maxDeliveryAgents: Number(e.target.value) }
                                })}
                            />
                            <LTextInput
                                label="Max Plant Staff"
                                type="number"
                                value={formData.limits.maxPlantStaff ?? 0}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    limits: { ...formData.limits, maxPlantStaff: Number(e.target.value) }
                                })}
                            />
                            <LTextInput
                                label="Storage (GB)"
                                type="number"
                                value={formData.limits.storageGB}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    limits: { ...formData.limits, storageGB: Number(e.target.value) }
                                })}
                            />
                        </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-4">
                        <h3 className="font-medium border-b pb-2">Features</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                                <div key={key} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`feature-${key}`}
                                        checked={!!formData.features[key as keyof PlanFeatures]}
                                        onCheckedChange={(checked) => {
                                            setFormData({
                                                ...formData,
                                                features: {
                                                    ...formData.features,
                                                    [key]: checked === true
                                                }
                                            });
                                        }}
                                    />
                                    <Label htmlFor={`feature-${key}`}>{label}</Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex gap-3">
                        <LButton
                            type="submit"
                            loading={loading}
                            fullWidth
                        >
                            Save Changes
                        </LButton>
                        <LButton
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            fullWidth
                        >
                            Cancel
                        </LButton>
                    </div>
                </form>
            </div>
        </LResponsiveDialog>
    );
}
