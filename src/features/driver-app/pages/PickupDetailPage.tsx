/**
 * Pickup Detail Page - Driver App
 * 
 * Shows full details of a pickup task with:
 * - Customer info with call button
 * - Address with navigate button
 * - Order info (item count, time slot)
 * - Special instructions
 * - Complete pickup button
 */

import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDriverTasks } from "../hooks/use-driver-tasks";
import { CompletePickupSheet } from "../components/CompletePickupSheet";
import {
    LCard,
    LButton,
    LBadge,
    LSpinner,
    LEmptyState,
} from "@/components/laundry";
import { PageWrapper } from "@/components/PageWrapper";
import {
    MapPin,
    Phone,
    Navigation,
    Clock,
    Package,
    User,
    MessageCircle,
    CheckCircle2,
    AlertTriangle,
    Edit2,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { AgentEditOrderSheet } from "../components/AgentEditOrderSheet";
import { LOrderSummary } from "@/components/laundry/LOrderSummary";

export function PickupDetailPage() {
    const { t } = useTranslation();
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [showCompleteSheet, setShowCompleteSheet] = useState(false);
    const [showEditSheet, setShowEditSheet] = useState(false);

    // Force refresh is handled by the hook if we use a refresh signal, 
    // but useDriverTasks is real-time via onSnapshot, so it should auto-update.
    const { pickupTasks, loading } = useDriverTasks({ type: "pickup" });

    // Find the task for this order
    const task = useMemo(() =>
        pickupTasks.find(t => t.orderId === orderId),
        [pickupTasks, orderId]
    );

    const formatScheduledDate = (date: Date) => {
        if (isToday(date)) return t("common.today", "Today");
        if (isTomorrow(date)) return t("common.tomorrow", "Tomorrow");
        return format(date, "EEEE, MMM d");
    };

    const handleCall = () => {
        if (task?.customer.phone) {
            window.open(`tel:${task.customer.phone}`);
        }
    };

    const handleWhatsApp = () => {
        if (task?.customer.phone) {
            window.open(`https://wa.me/91${task.customer.phone}`);
        }
    };

    const handleNavigate = () => {
        if (task?.customer.address) {
            window.open(`https://maps.google.com/?q=${encodeURIComponent(task.customer.address)}`);
        }
    };

    const handleComplete = () => {
        setShowCompleteSheet(false);
        navigate("/agent/pickups");
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LSpinner size="lg" />
            </div>
        );
    }

    if (!task) {
        return (
            <PageWrapper maxWidth="lg">
                <LEmptyState
                    icon={<AlertTriangle className="h-12 w-12 text-warning" />}
                    title={t("agent.taskNotFound", "Task not found")}
                    description={t("agent.taskNotFoundDesc", "This pickup task may have been completed or removed")}
                    action={{
                        label: t("agent.backToPickups", "Back to Pickups"),
                        onClick: () => navigate("/agent/pickups")
                    }}
                />
            </PageWrapper>
        );
    }

    const isCompleted = task.status === "completed";

    return (
        <PageWrapper maxWidth="lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <LBadge variant={isCompleted ? "muted" : "success"} size="md">
                            {isCompleted ? (
                                <><CheckCircle2 className="h-3 w-3 mr-1" />{t("agent.completed", "Completed")}</>
                            ) : (
                                <><MapPin className="h-3 w-3 mr-1" />{t("agent.pickup", "PICKUP")}</>
                            )}
                        </LBadge>
                        {task.orderSource === "online" && (
                            <LBadge variant="outline" size="md">
                                {t("orders.onlineOrder", "Online order")}
                            </LBadge>
                        )}
                    </div>
                    <h1 className="text-xl font-bold text-foreground">
                        #{task.orderPublicId}
                    </h1>
                </div>
            </div>

            {/* Schedule Card */}
            <LCard variant="outlined" padding="md" className="mb-4 bg-primary-muted/30">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">{t("agent.scheduledFor", "Scheduled for")}</p>
                        <p className="font-semibold text-foreground">
                            {formatScheduledDate(task.scheduledDate)}
                            {task.timeSlot?.start && ` • ${task.timeSlot.start}`}
                        </p>
                    </div>
                </div>
            </LCard>

            {/* Customer Card */}
            <LCard variant="outlined" padding="md" className="mb-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {t("agent.customer", "Customer")}
                </h3>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-foreground">{task.customer.name}</p>
                        <p className="text-sm text-muted-foreground">{task.customer.phone}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <LButton
                        variant="outline"
                        size="sm"
                        leftIcon={<Phone className="h-4 w-4" />}
                        onClick={handleCall}
                        className="flex-1"
                    >
                        {t("common.call", "Call")}
                    </LButton>
                    <LButton
                        variant="outline"
                        size="sm"
                        leftIcon={<MessageCircle className="h-4 w-4" />}
                        onClick={handleWhatsApp}
                        className="flex-1"
                    >
                        WhatsApp
                    </LButton>
                </div>
            </LCard>

            {/* Address Card */}
            <LCard variant="outlined" padding="md" className="mb-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {t("agent.pickupAddress", "Pickup Address")}
                </h3>
                <p className="text-foreground mb-4">{task.customer.address}</p>
                <LButton
                    variant="secondary"
                    size="md"
                    leftIcon={<Navigation className="h-4 w-4" />}
                    onClick={handleNavigate}
                    fullWidth
                >
                    {t("agent.openInMaps", "Open in Maps")}
                </LButton>
            </LCard>

            {/* Order Info Card – always show financials (subtotal, delivery, tax, total) including when 0 items */}
            <LCard variant="outlined" padding="none" className="mb-4 overflow-hidden">
                <div className="p-4 bg-muted/30 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground">
                                {t("agent.orderInfo", "Order Info")}
                            </h3>
                            <p className="font-medium text-foreground">
                                {task.itemCount} {t("agent.itemsToCollect", "items to collect")}
                            </p>
                        </div>
                    </div>
                    {!isCompleted && (
                        <LButton
                            variant="ghost"
                            size="sm"
                            leftIcon={<Edit2 className="h-4 w-4" />}
                            onClick={() => setShowEditSheet(true)}
                        >
                            {t("common.edit", "Edit")}
                        </LButton>
                    )}
                </div>
                <div className="bg-card">
                    {task.orderSource === "online" && (!task.items || task.items.length === 0) && (
                        <p className="text-xs text-muted-foreground px-4 pt-3 pb-1">
                            {t("tracking.itemsAddedAtPickup", "Order items will be added by the agent when they collect the clothes at pickup.")}
                        </p>
                    )}
                    <LOrderSummary
                        items={(task.items || []).map(item => ({
                            id: item.id,
                            name: item.serviceName + (item.express ? " ⚡" : ""),
                            categoryName: item.categoryName,
                            quantity: item.quantity,
                            price: item.unitPrice,
                            unit: item.unit,
                            express: item.express,
                            processingDays: item.turnaroundDays,
                        }))}
                        subtotal={task.financials?.subtotal ?? 0}
                        discount={task.financials?.discountAmount}
                        delivery={task.financials?.deliveryCharge ?? 0}
                        taxAmount={task.financials?.taxAmount}
                        taxRate={task.financials?.taxRate}
                        taxName={task.financials?.taxName}
                        total={task.financials?.total ?? (task.items?.reduce((sum, item) => sum + item.total, 0) ?? 0)}
                        className="p-4 border-none"
                    />
                </div>
            </LCard>

            {/* Instructions Card (if any) */}
            {task.instructions && (
                <LCard variant="outlined" padding="md" className="mb-4 border-warning bg-warning-muted/30">
                    <h3 className="text-sm font-medium text-warning mb-2">
                        {t("agent.specialInstructions", "Special Instructions")}
                    </h3>
                    <p className="text-foreground">{task.instructions}</p>
                </LCard>
            )}

            {/* Complete Button */}
            {!isCompleted && (
                <LButton
                    variant="primary"
                    size="lg"
                    leftIcon={<CheckCircle2 className="h-5 w-5" />}
                    onClick={() => setShowCompleteSheet(true)}
                    fullWidth
                    className="mt-4"
                >
                    {t("agent.completePickup", "Complete Pickup")}
                </LButton>
            )}

            {/* Complete Pickup Sheet */}
            <CompletePickupSheet
                open={showCompleteSheet}
                onClose={() => setShowCompleteSheet(false)}
                task={task}
                onComplete={handleComplete}
            />

            <AgentEditOrderSheet
                open={showEditSheet}
                onClose={() => setShowEditSheet(false)}
                orderId={task.orderId}
                onOrderUpdated={() => {
                    // Handled by real-time snapshot
                }}
            />
        </PageWrapper>
    );
}
