/**
 * Shop Detail Sheet
 * 
 * Shows shop info, subscription details, and plan override
 */

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useOverridePlan, useCreateSubscription } from "../hooks/use-subscriptions";
import { usePayments } from "../hooks/use-payments";
import { useShopStorageEvents } from "../hooks/use-shop-storage-events";
import { useShopStorageStats, formatStorageBytes } from "../hooks/use-shop-storage-stats";
import { useSuperAdmin } from "../SuperAdminAuthContext";
import { LButton, LCard, LResponsiveDialog } from "@/components/laundry";
import {
    Mail,
    Phone,
    Calendar,
    CreditCard,
    Package,
    Settings,
    Check,
    X,
    Image as ImageIcon,
    Upload,
    Trash2,
} from "lucide-react";
import { format } from "date-fns";
import type { Shop } from "@/types/shop";
import type { Subscription } from "@/types/super-admin";
import type { PlanType } from "@/types/plans";
import { PLANS } from "@/config/plans";
import { cn } from "@/lib/utils";
import { formatCurrencyValue } from "@/hooks/use-currency";

interface ShopDetailSheetProps {
    shopId: string | null;
    open: boolean;
    onClose: () => void;
    onUpdate?: () => void;
}

export function ShopDetailSheet({ shopId, open, onClose, onUpdate }: ShopDetailSheetProps) {
    const { superAdmin } = useSuperAdmin();
    const [shop, setShop] = useState<Shop | null>(null);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);
    const [showOverride, setShowOverride] = useState(false);
    const [showCreate, setShowCreate] = useState(false);

    // Override form state
    const [newPlan, setNewPlan] = useState<PlanType>("pro");
    const [newEndDate, setNewEndDate] = useState("");
    const [overrideReason, setOverrideReason] = useState("");

    const { overridePlan, loading: overriding } = useOverridePlan();
    const { createSubscription, loading: creating } = useCreateSubscription();
    const { payments } = usePayments({ shopId: shopId || undefined });
    const { events: storageEvents, loading: storageLoading } = useShopStorageEvents(shopId);
    const { stats: storageStats, loading: storageStatsLoading } = useShopStorageStats(shopId);

    useEffect(() => {
        async function fetchData() {
            if (!shopId) return;

            setLoading(true);
            try {
                // Fetch shop
                const shopDoc = await getDoc(doc(db, "shops", shopId));
                if (shopDoc.exists()) {
                    setShop({ id: shopDoc.id, ...shopDoc.data() } as Shop);
                }

                // Fetch subscription
                const subDoc = await getDoc(doc(db, "subscriptions", shopId));
                if (subDoc.exists()) {
                    setSubscription({ id: subDoc.id, ...subDoc.data() } as Subscription);
                    const endDate = subDoc.data().endDate?.toDate?.();
                    if (endDate) {
                        setNewEndDate(format(endDate, "yyyy-MM-dd"));
                    }
                    setNewPlan(subDoc.data().planId || "pro");
                } else {
                    setSubscription(null);
                }
            } catch (err) {
                console.error("Failed to fetch shop data:", err);
            } finally {
                setLoading(false);
            }
        }

        if (open && shopId) {
            fetchData();
            setShowOverride(false);
        }
    }, [shopId, open]);

    const handleOverride = async () => {
        if (!subscription || !superAdmin) return;

        const result = await overridePlan(
            subscription.id,
            newPlan,
            new Date(newEndDate),
            overrideReason,
            superAdmin.id,
            shopId ?? undefined // Pass explicit Shop ID to ensure correct updates
        );

        if (result && result.success) {
            // NUCLEAR OPTION: Verify ID
            const msg = `SUCCESS: Plan Force-Updated!\n\nTarget Shop ID: ${result.shopId}\nNew Plan: ${newPlan}\n\nPlease check if User's ID matches: ${result.shopId}`;
            alert(msg);

            setShowOverride(false);
            onUpdate?.();
            onClose();
        }
    };

    const handleCreate = async () => {
        if (!shop || !shopId || !superAdmin) return;

        const success = await createSubscription(
            shopId,
            shop.name || "Shop",
            shop.email || "",
            newPlan,
            new Date(newEndDate),
            overrideReason,
            superAdmin.id
        );

        if (success) {
            setShowCreate(false);
            onUpdate?.();
            onClose();
        }
    };

    return (<LResponsiveDialog open={open} onClose={onClose} title="Shop Details">
        {loading ? (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        ) : shop ? (
            <div className="mt-6 space-y-6">
                {/* Shop Info */}
                <div>
                    <h3 className="text-lg font-semibold mb-3">{shop.name}</h3>
                    <div className="space-y-2 text-sm">
                        {shop.email && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                {shop.email}
                            </div>
                        )}
                        {shop.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                {shop.phone}
                            </div>
                        )}
                        {shop.createdAt && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                Joined {format(shop.createdAt.toDate?.() || new Date(), "MMM d, yyyy")}
                            </div>
                        )}
                    </div>
                </div>

                {/* Subscription Info */}
                <LCard variant="elevated" padding="md">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Subscription
                    </h4>

                    {subscription ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Plan</span>
                                <span className="font-medium capitalize">
                                    {subscription.planId.replace("_", " ")}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <span className={cn(
                                    "font-medium capitalize",
                                    subscription.status === "active" && "text-green-600",
                                    subscription.status === "expired" && "text-red-600"
                                )}>
                                    {subscription.status}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Expires</span>
                                <span className="font-medium">
                                    {subscription.endDate?.toDate?.()
                                        ? format(subscription.endDate.toDate(), "MMM d, yyyy")
                                        : "N/A"
                                    }
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Billing</span>
                                <span className="font-medium capitalize">
                                    {subscription.billingCycle}
                                </span>
                            </div>

                            {subscription.manualOverride && (
                                <div className="pt-2 border-t border-border">
                                    <p className="text-xs text-muted-foreground">
                                        ⚠️ Manual override by {subscription.manualOverride.overriddenBy}
                                    </p>
                                </div>
                            )}

                            {!showOverride ? (
                                <LButton
                                    variant="outline"
                                    size="sm"
                                    fullWidth
                                    leftIcon={<Settings className="h-4 w-4" />}
                                    onClick={() => setShowOverride(true)}
                                >
                                    Override Plan
                                </LButton>
                            ) : (
                                <div className="pt-3 border-t border-border space-y-3">
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">New Plan</label>
                                        <select
                                            value={newPlan}
                                            onChange={(e) => setNewPlan(e.target.value as PlanType)}
                                            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                        >
                                            {Object.values(PLANS).map((plan) => (
                                                <option key={plan.id} value={plan.id}>
                                                    {plan.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">New End Date</label>
                                        <input
                                            type="date"
                                            value={newEndDate}
                                            onChange={(e) => setNewEndDate(e.target.value)}
                                            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Reason</label>
                                        <input
                                            type="text"
                                            value={overrideReason}
                                            onChange={(e) => setOverrideReason(e.target.value)}
                                            placeholder="e.g. Customer request, Trial extension"
                                            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <LButton
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowOverride(false)}
                                            leftIcon={<X className="h-4 w-4" />}
                                        >
                                            Cancel
                                        </LButton>
                                        <LButton
                                            variant="primary"
                                            size="sm"
                                            onClick={handleOverride}
                                            loading={overriding}
                                            disabled={!newEndDate || !overrideReason}
                                            leftIcon={<Check className="h-4 w-4" />}
                                        >
                                            Apply Override
                                        </LButton>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-muted-foreground text-sm">
                                No subscription found. This shop is on the Free plan.
                            </p>
                            {!showCreate ? (
                                <LButton
                                    variant="primary"
                                    size="sm"
                                    fullWidth
                                    leftIcon={<Settings className="h-4 w-4" />}
                                    onClick={() => setShowCreate(true)}
                                >
                                    Create Subscription
                                </LButton>
                            ) : (
                                <div className="pt-3 border-t border-border space-y-3">
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Plan</label>
                                        <select
                                            value={newPlan}
                                            onChange={(e) => setNewPlan(e.target.value as PlanType)}
                                            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                        >
                                            {Object.values(PLANS).map((plan) => (
                                                <option key={plan.id} value={plan.id}>
                                                    {plan.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">End Date</label>
                                        <input
                                            type="date"
                                            value={newEndDate}
                                            onChange={(e) => setNewEndDate(e.target.value)}
                                            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Reason</label>
                                        <input
                                            type="text"
                                            value={overrideReason}
                                            onChange={(e) => setOverrideReason(e.target.value)}
                                            placeholder="e.g. Manual upgrade, Testing"
                                            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <LButton
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowCreate(false)}
                                            leftIcon={<X className="h-4 w-4" />}
                                        >
                                            Cancel
                                        </LButton>
                                        <LButton
                                            variant="primary"
                                            size="sm"
                                            onClick={handleCreate}
                                            loading={creating}
                                            disabled={!newEndDate || !overrideReason}
                                            leftIcon={<Check className="h-4 w-4" />}
                                        >
                                            Create
                                        </LButton>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </LCard>

                {/* Usage Stats */}
                {subscription?.usage && (
                    <LCard variant="elevated" padding="md">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Usage This Month
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Orders</span>
                                <span className="font-medium">{subscription.usage.ordersThisMonth}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Customers</span>
                                <span className="font-medium">{subscription.usage.totalCustomers}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Staff</span>
                                <span className="font-medium">{subscription.usage.totalStaff}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Services</span>
                                <span className="font-medium">{subscription.usage.totalServices}</span>
                            </div>
                        </div>
                    </LCard>
                )}

                {/* Recent Payments */}
                {payments.length > 0 && (
                    <LCard variant="elevated" padding="md">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Recent Payments
                        </h4>
                        <div className="space-y-2">
                            {payments.slice(0, 5).map((payment) => (
                                <div key={payment.id} className="flex items-center justify-between text-sm">
                                    <div>
                                        <span className="font-medium">{formatCurrencyValue(payment.amount ?? 0)}</span>
                                        <span className="text-muted-foreground ml-2">
                                            {payment.createdAt?.toDate?.()
                                                ? format(payment.createdAt.toDate(), "MMM d, yyyy")
                                                : "N/A"
                                            }
                                        </span>
                                    </div>
                                    <span className={cn(
                                        "text-xs capitalize",
                                        payment.status === "success" && "text-green-600",
                                        payment.status === "failed" && "text-red-600",
                                        payment.status === "pending" && "text-yellow-600"
                                    )}>
                                        {payment.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </LCard>
                )}

                {/* Storage used (compressed) + recent activity */}
                <LCard variant="elevated" padding="md">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Storage
                    </h4>
                    {storageStatsLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4 mb-4 p-3 rounded-lg bg-muted/50">
                                <div>
                                    <p className="text-xs text-muted-foreground">Total storage (compressed)</p>
                                    <p className="font-semibold text-foreground">
                                        {storageStats ? formatStorageBytes(storageStats.totalBytes) : "0 B"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Total images</p>
                                    <p className="font-semibold text-foreground">
                                        {storageStats?.imageCount ?? 0}
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">Recent activity (uploads & deletes)</p>
                            {storageLoading ? (
                                <div className="flex justify-center py-4">
                                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                                </div>
                            ) : storageEvents.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">No storage events yet.</p>
                            ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {storageEvents.map((ev) => (
                                        <div
                                            key={ev.id}
                                            className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border last:border-0"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {ev.action === "upload" ? (
                                                    <Upload className="h-4 w-4 text-green-600 flex-shrink-0" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4 text-destructive flex-shrink-0" />
                                                )}
                                                <span className="font-medium capitalize">{ev.action}</span>
                                                <span className="text-muted-foreground truncate">{ev.folder}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {ev.createdAt && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {format(ev.createdAt, "MMM d, HH:mm")}
                                                    </span>
                                                )}
                                                {ev.action === "upload" && ev.url && (
                                                    <a
                                                        href={ev.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary text-xs hover:underline"
                                                    >
                                                        View
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </LCard>
            </div>
        ) : (
            <div className="text-center py-12 text-muted-foreground">
                Shop not found
            </div>
        )}
    </LResponsiveDialog>
    );
}
