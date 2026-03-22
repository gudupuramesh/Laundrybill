/**
 * Delivery Detail Page - Driver App
 * 
 * Shows full details of a delivery task with:
 * - Customer info with call button
 * - Address with navigate button
 * - Order info (item count, amount to collect)
 * - Payment status
 * - Complete delivery button
 */

import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDriverTasks } from "../hooks/use-driver-tasks";
import { CompleteDeliverySheet } from "../components/CompleteDeliverySheet";
import {
    LCard,
    LButton,
    LBadge,
    LSpinner,
    LEmptyState,
    LAmount,
    LOrderSummary,
} from "@/components/laundry";
import { PageWrapper } from "@/components/PageWrapper";
import {
    Phone,
    Navigation,
    Clock,
    Package,
    User,
    MessageCircle,
    CheckCircle2,
    AlertTriangle,
    Truck,
    Banknote,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";

export function DeliveryDetailPage() {
    const { t } = useTranslation();
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [showCompleteSheet, setShowCompleteSheet] = useState(false);

    const { deliveryTasks, loading } = useDriverTasks({ type: "delivery" });

    // Find the task for this order
    const task = useMemo(() =>
        deliveryTasks.find(t => t.orderId === orderId),
        [deliveryTasks, orderId]
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
        navigate("/agent/deliveries");
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
                    description={t("agent.taskNotFoundDesc", "This delivery task may have been completed or removed")}
                    action={{
                        label: t("agent.backToDeliveries", "Back to Deliveries"),
                        onClick: () => navigate("/agent/deliveries")
                    }}
                />
            </PageWrapper>
        );
    }

    const isCompleted = task.status === "completed";
    const hasAmount = (task.amountToCollect || 0) > 0;

    return (
        <PageWrapper maxWidth="lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <LBadge variant={isCompleted ? "muted" : "default"} size="md">
                            {isCompleted ? (
                                <><CheckCircle2 className="h-3 w-3 mr-1" />{t("agent.delivered", "Delivered")}</>
                            ) : (
                                <><Truck className="h-3 w-3 mr-1" />{t("agent.delivery", "DELIVERY")}</>
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

            {/* Amount to Collect Card */}
            {hasAmount && !isCompleted && (
                <LCard variant="outlined" padding="md" className="mb-4 bg-success/5 border-success">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                                <Banknote className="h-5 w-5 text-success" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t("agent.collectFromCustomer", "Collect from customer")}</p>
                                <p className="text-xl font-bold text-success">
                                    <LAmount value={task.amountToCollect || 0} />
                                </p>
                            </div>
                        </div>
                        <LBadge
                            variant={task.paymentStatus === "paid" ? "success" : task.paymentStatus === "partial" ? "warning" : "destructive"}
                            size="md"
                        >
                            {task.paymentStatus === "paid" ? t("agent.paid", "Paid") :
                                task.paymentStatus === "partial" ? t("agent.partial", "Partial") :
                                    t("agent.unpaid", "Unpaid")}
                        </LBadge>
                    </div>
                </LCard>
            )}

            {/* Schedule Card */}
            <LCard variant="outlined" padding="md" className="mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">{t("agent.expectedDelivery", "Expected Delivery")}</p>
                        <p className="font-semibold text-foreground">
                            {formatScheduledDate(task.scheduledDate)}
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
                    {t("agent.deliveryAddress", "Delivery Address")}
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

            {/* Order Info Card - Redesigned to be cleaner and use Package icon */}
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
                                {task.itemCount} {t("agent.itemsToDeliver", "items to deliver")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Full Item List – category-wise with full pricing (same as owner view) */}
                <div className="bg-card">
                    <LOrderSummary
                        items={task.items.map(item => ({
                            id: item.id,
                            name: item.serviceName + (item.express ? " ⚡" : ""),
                            categoryName: item.categoryName,
                            quantity: item.quantity,
                            price: item.unitPrice,
                            unit: item.unit,
                            express: item.express,
                            processingDays: item.turnaroundDays,
                        }))}
                        subtotal={task.financials?.subtotal || 0}
                        discount={task.financials?.discountAmount}
                        delivery={task.financials?.deliveryCharge}
                        taxAmount={task.financials?.taxAmount}
                        taxRate={task.financials?.taxRate}
                        taxName={task.financials?.taxName}
                        total={task.financials?.total || task.items.reduce((sum, item) => sum + item.total, 0)}
                        className="p-4 border-none"
                    />
                </div>
            </LCard>

            {/* Instructions Card (if any) */}
            {task.instructions && (
                <LCard variant="outlined" padding="md" className="mb-4 border-warning bg-warning/5">
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
                    {t("agent.completeDelivery", "Complete Delivery")}
                </LButton>
            )}

            {/* Complete Delivery Sheet */}
            <CompleteDeliverySheet
                open={showCompleteSheet}
                onClose={() => setShowCompleteSheet(false)}
                task={task}
                onComplete={handleComplete}
            />
        </PageWrapper>
    );
}
