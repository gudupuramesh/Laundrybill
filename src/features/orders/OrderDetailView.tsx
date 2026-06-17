/**
 * Order Detail View (Shared Component)
 * 
 * Reusable component showing the full order details with Green Gradient Header.
 * Used by:
 * 1. OrderDetailPage (Mobile/Standalone route)
 * 2. OrderDetailPanel (Desktop right-pane split view)
 */

import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { SeenOnlineOrdersContext } from "@/hooks/use-seen-online-orders";
import {
    LCard,
    LButton,
    LAmount,
    LCustomerInfo,
    LOrderSummary,
    LProgressStepper,
    LTimelineItem,
    LBadge,
    LDivider,
    LSpacer,
    LSpinner,
    LActionSheet,
    LSelect,
} from "@/components/laundry";
import { useOrder, useOrderMutations } from "@/hooks/use-orders";
import { useAvailableAgents } from "@/hooks/use-available-agents";
import { StatusUpdateSheet } from "./StatusUpdateSheet";
import { PaymentCollectionSheet } from "./PaymentCollectionSheet";
import { CancelOrderSheet } from "./CancelOrderSheet";
import { TagGeneratorModal } from "@/features/plant-app/components/TagGeneratorModal";
import {
    MoreVertical,
    Phone,
    MessageCircle,
    Printer,
    Edit,
    Tag,
    Trash2,
    MapPin,
    Clock,
    Globe,
    CheckCircle2,
    Package,
    Truck,
    XCircle,
    CreditCard,
    ChevronLeft,
    Store,
    Home,
    RefreshCw,
    Download,
    User,
    UserCog,
    Image as ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { generateOrderReceipt } from "@/lib/generateReceipt";
import { isAndroidPrintEnv } from "@/lib/receipt-print";
import { useReceiptPrint } from "@/context/ReceiptPrintContext";
import { openWhatsAppTextOnly } from "@/lib/whatsappShare";
import { useShop } from "@/hooks/use-shop";
import { useCurrency } from "@/hooks/use-currency";
import { useShopLimits } from "@/hooks/use-shop-limits";
import type { OrderStatus } from "@/types/order";
import { mapLegacyDeliveryType } from "@/types/order";
import { PageWrapper } from "@/components/PageWrapper";
import { cn } from "@/lib/utils";

const statusIcons: Record<OrderStatus, typeof Clock> = {
    pending: Clock,
    processing: Package,
    ready: CheckCircle2,
    ready_for_pickup: CheckCircle2,
    out_for_delivery: Truck,
    delivered: CheckCircle2,
    cancelled: XCircle,
    picked_up: Package,
    pickup_scheduled: Clock,
    pickup_completed: Package,
};

interface OrderDetailViewProps {
    orderId: string;
    onBack?: () => void;
    isEmbedded?: boolean; // True if used in split view (removes PageWrapper padding logic if needed)
}

export function OrderDetailView({ orderId, onBack, isEmbedded = false }: OrderDetailViewProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { markSeen } = useContext(SeenOnlineOrdersContext);
    const { order, loading } = useOrder(orderId);
    const { shop } = useShop();
    const { currencySymbol } = useCurrency();
    const { reassignAgent } = useOrderMutations();
    const { agents } = useAvailableAgents();
    const { hasFeature } = useShopLimits();
    const { triggerReceiptPrint } = useReceiptPrint();

    // Mark online order as seen when viewed (so Orders badge count goes down)
    useEffect(() => {
        if (order?.orderSource === "online" && order?.id && markSeen) {
            markSeen(order.id);
        }
    }, [order?.id, order?.orderSource, markSeen]);

    // Sheet states
    const [statusSheetOpen, setStatusSheetOpen] = useState(false);
    const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
    const [actionSheetOpen, setActionSheetOpen] = useState(false);
    const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
    const [tagModalOpen, setTagModalOpen] = useState(false);
    const [reassigning, setReassigning] = useState(false);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[50vh]">
                <LSpinner size="lg" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">{t('orders.notFound')}</p>
                {onBack && (
                    <LButton variant="ghost" onClick={onBack} className="mt-4">
                        {t('orders.backToOrders')}
                    </LButton>
                )}
            </div>
        );
    }

    const canUpdateStatus = ["pending", "processing", "ready", "ready_for_pickup", "out_for_delivery", "pickup_scheduled", "pickup_completed"].includes(order.status);
    const canEdit = ["pending", "processing", "ready", "ready_for_pickup", "out_for_delivery", "picked_up", "pickup_scheduled"].includes(order.status);
    const canCancel = order.status !== "cancelled" && order.status !== "delivered" && order.status !== "picked_up";
    const hasBalance = order.financials.balance > 0;

    // WhatsApp chat handler - opens WhatsApp with order details (no PDF)
    const handleWhatsAppChat = () => {
        if (!order) return;
        openWhatsAppTextOnly(order, shop || undefined, currencySymbol);
    };

    // Print receipt handler
    // Download receipt handler
    const handleDownloadReceipt = () => {
        if (order && shop) {
            const location = shop.location;
            generateOrderReceipt(order, {
                name: shop.name || "LaundryBill",
                phone: shop.phone,
                address: location?.address ? `${location.address}, ${location.city || ''} ${location.pincode || ''}` : undefined,
                gstNumber: shop.gstNumber,
            });
        }
    };

    // Print/Preview receipt handler (Android: window.print() for native dialog; else PDF in new tab)
    const handlePrintPreview = async () => {
        if (!order || !shop) return;
        const location = shop.location;
        const shopInfo = {
            name: shop.name || "LaundryBill",
            phone: shop.phone,
            address: location?.address ? `${location.address}, ${location.city || ""} ${location.pincode || ""}` : undefined,
        };
        if (isAndroidPrintEnv()) {
            triggerReceiptPrint(order, shopInfo);
            return;
        }
        try {
            const blob = await import("@/lib/generateReceipt").then(m => m.getReceiptBlob(order, {
                ...shopInfo,
                gstNumber: shop.gstNumber,
            }));
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
        } catch (error) {
            console.error("Failed to generate receipt preview", error);
        }
    };

    // Edit order handler - navigate to New Order page with order ID
    const handleEdit = () => {
        if (canEdit && order) {
            // Navigate to new order page with edit mode and order ID
            navigate(`/new-order?edit=${order.id}`);
        }
    };

    // Get status icon with animation class
    const getStatusIconClass = () => {
        if (order.status === "processing" || order.status === "picked_up") {
            return "animate-spin";
        }
        return "";
    };

    // Calculate progress step index for the 4-step display (0–3 = current step, 4 = all done).
    // Must match getProgressSteps() so we don't show "Delivered" until status is actually delivered.
    const getProgressStep = () => {
        if (order.status === "cancelled") return -1;
        const deliveryType = mapLegacyDeliveryType(order.deliveryType);
        const steps = getProgressSteps();

        // Map order status to display step index (0 = first step, steps.length = all completed).
        if (deliveryType === "pickup_store") {
            const map: Record<OrderStatus, number> = {
                pending: 0,
                processing: 1,
                ready_for_pickup: 2,
                picked_up: steps.length, // all done
                ready: 2,
                out_for_delivery: 3,
                delivered: steps.length,
                pickup_scheduled: 0,
                pickup_completed: 1,
                cancelled: -1,
            };
            return map[order.status] ?? 0;
        }

        // delivery_home and pickup_home: 4 steps = Order Placed, Processing, Ready, Delivered
        const map: Record<OrderStatus, number> = {
            pending: 0,
            pickup_scheduled: 0,
            pickup_completed: 1,
            processing: 1,
            ready: 2,
            ready_for_pickup: 2,
            out_for_delivery: 3,
            delivered: steps.length, // all done – only then show Delivered as completed
            picked_up: steps.length,
            cancelled: -1,
        };
        return map[order.status] ?? 0;
    };

    // Get steps for progress stepper - always show 4 universal steps
    const getProgressSteps = () => {
        const deliveryType = mapLegacyDeliveryType(order.deliveryType);

        // Use universal steps that make sense for all types + Plant workflow
        // This ensures steps align even when Plant changes statuses
        if (deliveryType === "pickup_store") {
            return [
                { id: "pending", label: t('orders.steps.placed') },
                { id: "processing", label: t('orders.steps.processing') },
                { id: "ready_for_pickup", label: t('orders.steps.readyForPickup') },
                { id: "picked_up", label: t('orders.steps.pickedUp') },
            ];
        }

        // For Home Delivery and Pickup from Home
        return [
            { id: "pending", label: t('orders.steps.placed') },
            { id: "processing", label: t('orders.steps.processing') },
            { id: "ready", label: t('orders.steps.ready') },
            { id: "delivered", label: t('orders.steps.delivered') },
        ];
    };

    // Delivery type badge config
    const deliveryTypeBadges = {
        pickup_store: { icon: Store, label: t('orders.deliveryTypes.pickup'), className: "bg-blue-100 text-blue-700" },
        delivery_home: { icon: Truck, label: t('orders.deliveryTypes.delivery'), className: "bg-green-100 text-green-700" },
        pickup_home: { icon: Home, label: t('orders.deliveryTypes.collect'), className: "bg-purple-100 text-purple-700" },
    };
    const currentDeliveryType = mapLegacyDeliveryType(order.deliveryType);
    const deliveryBadge = deliveryTypeBadges[currentDeliveryType];

    // Helper for status labels
    const getStatusLabel = (status: OrderStatus) => {
        switch (status) {
            case 'pending': return t('orders.steps.placed');
            case 'processing': return t('orders.steps.processing');
            case 'ready_for_pickup': return t('orders.steps.readyForPickup');
            case 'picked_up': return t('orders.steps.pickedUp');
            case 'ready': return t('orders.steps.ready');
            case 'delivered': return t('orders.steps.delivered');
            case 'cancelled': return t('orders.cancelled');
            case 'pickup_scheduled': return t('orders.scheduledPickup');
            case 'pickup_completed': return t('orders.steps.pickedUp');
            case 'out_for_delivery': return t('dashboard.outForDelivery');
            default: return (status as string).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        }
    };

    // Helper to wrap content relative to embedding
    const Container = isEmbedded ? 'div' : PageWrapper;
    const containerProps = isEmbedded ? { className: 'h-full overflow-y-auto !p-0 bg-background' } : { className: '!p-0' };

    return (
        <Container {...containerProps}>
            <div className="relative">
                {/* Premium Header with Clean Background */}
                <div className={cn("relative overflow-hidden bg-card border-b border-border/60 px-4 pt-4 pb-16 md:pb-20", isEmbedded ? "rounded-t-none" : "")}>
                    {/* Top Bar with Back and Actions */}
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        {onBack ? (
                            <button
                                onClick={onBack}
                                className="flex items-center gap-2 text-foreground/80 hover:text-primary transition-colors text-sm font-semibold"
                            >
                                <ChevronLeft className="h-5 w-5" />
                                <span className="hidden sm:inline">{t('orders.backToOrders')}</span>
                            </button>
                        ) : (
                            // Spacer if no back button to keep alignment
                            <div />
                        )}

                        <LButton
                            variant="ghost"
                            size="icon"
                            onClick={() => setActionSheetOpen(true)}
                            className="text-foreground hover:bg-muted"
                        >
                            <MoreVertical className="h-5 w-5" />
                        </LButton>
                    </div>

                    {/* Order Info with Animated Icon */}
                    <div className="flex items-center gap-4 relative z-10">
                        {/* Animated Status Icon */}
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-primary/15 border border-primary/20 shadow-sm flex items-center justify-center">
                                {(() => {
                                    const Icon = statusIcons[order.status] || Clock;
                                    return <Icon className={`h-6 w-6 md:h-7 md:w-7 text-primary ${getStatusIconClass()}`} />;
                                })()}
                            </div>
                        </div>

                        {/* Order Details */}
                        <div className="text-foreground flex-1">
                            <h1 className="text-xl md:text-2xl font-black tracking-tight">
                                Order #{order.publicId}
                            </h1>
                            <p className="text-muted-foreground text-sm font-bold uppercase tracking-wider mt-0.5">
                                {order.status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                            </p>
                        </div>

                        {/* Order Source & Delivery Type Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {order.orderSource === "online" && (
                                <span className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-teal-50 text-teal-700 border border-teal-200/50 shadow-sm">
                                    <Globe className="h-3.5 w-3.5" />
                                    {t('orders.onlineOrders')}
                                </span>
                            )}
                            {deliveryBadge && (
                                <span className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow-sm ${deliveryBadge.className.replace('bg-', 'bg-').replace('text-', 'text-').concat(' border-current/20')}`}>
                                    <deliveryBadge.icon className="h-3.5 w-3.5" />
                                    {deliveryBadge.label}
                                </span>
                            )}
                        </div>
                    </div>
                </div>


            </div>

            {/* Content with padding and Grid Layout */}
            <div className="px-4 pt-4 pb-24 md:pb-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* LEFT COLUMN: Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Progress Stepper Card */}
                        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                            <LProgressStepper
                                steps={getProgressSteps()}
                                currentStep={getProgressStep()}
                            />
                        </div>

                        {/* Order Items Summary */}
                        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
                            <LOrderSummary
                                items={order.items.map((item) => ({
                                    id: item.id,
                                    name: item.serviceName + (item.express ? " ⚡ Express" : ""),
                                    categoryName: item.categoryName,
                                    quantity: item.quantity,
                                    price: item.unitPrice,
                                    unit: item.unit,
                                    express: item.express,
                                    processingDays: item.turnaroundDays,
                                }))}
                                subtotal={order.financials.subtotal}
                                discount={order.financials.discountAmount}
                                delivery={order.financials.deliveryCharge}
                                taxAmount={order.financials.taxAmount}
                                taxRate={order.financials.taxRate}
                                taxName={order.financials.taxName}
                                total={order.financials.total}
                            />
                        </div>

                        {/* Order Photos: damage/stain, pickup proof, delivery proof, plant proof */}
                        {((order.damagePhotoUrls && order.damagePhotoUrls.length > 0) || order.pickupPhoto || order.deliveryPhoto || order.plantPhoto || order.items?.some((i) => i.damages?.length)) && (
                            <LCard variant="outlined" padding="md">
                                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4" />
                                    {t('orders.photos', 'Order photos')}
                                </h3>
                                <div className="space-y-3">
                                    {order.damagePhotoUrls && order.damagePhotoUrls.length > 0 && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-2">{t('orders.damageStainPhotos', 'Damage / stain photos')}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {order.damagePhotoUrls.map((url, i) => (
                                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border hover:opacity-90">
                                                        <img src={url} alt={`Damage ${i + 1}`} className="h-24 w-24 object-cover" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {order.pickupPhoto && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-2">{t('orders.pickupProof', 'Pickup proof')}</p>
                                            <a href={order.pickupPhoto} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg overflow-hidden border border-border hover:opacity-90">
                                                <img src={order.pickupPhoto} alt="Pickup proof" className="h-24 w-24 object-cover" />
                                            </a>
                                        </div>
                                    )}
                                    {order.deliveryPhoto && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-2">{t('orders.deliveryProof', 'Delivery proof')}</p>
                                            <a href={order.deliveryPhoto} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg overflow-hidden border border-border hover:opacity-90">
                                                <img src={order.deliveryPhoto} alt="Delivery proof" className="h-24 w-24 object-cover" />
                                            </a>
                                        </div>
                                    )}
                                    {order.plantPhoto && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-2">{t('orders.plantProof', 'Plant / processing proof')}</p>
                                            <a href={order.plantPhoto} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg overflow-hidden border border-border hover:opacity-90">
                                                <img src={order.plantPhoto} alt="Plant proof" className="h-24 w-24 object-cover" />
                                            </a>
                                        </div>
                                    )}
                                    {order.items?.map((item, idx) =>
                                        item.damages?.filter((d) => d.photoUrl).length ? (
                                            <div key={idx}>
                                                <p className="text-xs text-muted-foreground mb-2">{item.serviceName} – {t('orders.damageStainPhotos', 'Damage / stain photos')}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {item.damages.filter((d) => d.photoUrl).map((d, i) => (
                                                        <a key={i} href={d.photoUrl!} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border hover:opacity-90">
                                                            <img src={d.photoUrl!} alt={d.description || `Damage ${i + 1}`} className="h-24 w-24 object-cover" />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null
                                    )}
                                </div>
                            </LCard>
                        )}

                        {/* Timeline */}
                        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-4">{t('orders.timeline')}</h3>
                            <div className="space-y-0">
                                {order.timeline?.map((event, index) => {
                                    const Icon = statusIcons[event.status] || Clock;
                                    return (
                                        <LTimelineItem
                                            key={event.id || index}
                                            icon={Icon}
                                            title={getStatusLabel(event.status)}
                                            description={event.notes}
                                            timestamp={format(event.timestamp.toDate(), "MMM d, h:mm a")}
                                            status={index === 0 ? "current" : "completed"}
                                            isLast={index === (order.timeline?.length || 0) - 1}
                                        />
                                    );
                                })}
                                {/* Created By Staff */}
                                {order.staffId && (
                                    <div className="pt-4 mt-4 border-t border-border/60">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                            <span>Created by:</span>
                                            <span className="text-foreground">
                                                {order.staffName || "Staff Member"}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div> {/* Closes LEFT COLUMN */}

                    {/* RIGHT COLUMN: Sidebar */}
                    <div className="space-y-6 lg:sticky lg:top-4 lg:self-start">
                        
                        {/* Expected Delivery / Scheduled Pickup */}
                        {(order.expectedDelivery || order.scheduledPickupTime || order.deliverySlot) && (
                            <div className="flex flex-col gap-3">
                                {/* Pickup Info (for Home Pickup) */}
                                {order.deliveryType === 'pickup_home' && (
                                    <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm flex items-center gap-4">
                                        <div className="p-3 bg-background rounded-xl shrink-0 border border-border/50 shadow-sm">
                                            <Clock className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t('orders.scheduledPickup', 'Scheduled Pickup')}</p>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                                {order.scheduledPickupDate && (
                                                    <p className="font-bold text-foreground">
                                                        {format(order.scheduledPickupDate.toDate(), "MMM d, yyyy")}
                                                    </p>
                                                )}
                                                {order.scheduledPickupTime && (
                                                    <LBadge variant="outline" className="text-[10px] py-0 font-bold border-primary/20 bg-primary/5 text-primary">
                                                        {order.scheduledPickupTime}
                                                    </LBadge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Delivery Info */}
                                {order.expectedDelivery && (
                                    <div className={cn("rounded-2xl border border-border/60 p-4 shadow-sm flex items-center gap-4", order.deliveryType === 'pickup_home' ? "bg-card" : "bg-primary/5 border-primary/20")}>
                                        <div className="p-3 bg-background rounded-xl shrink-0 border border-border/50 shadow-sm">
                                            <Truck className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary/80">
                                                {order.deliveryType === 'pickup_home' || order.deliveryType === 'pickup_store'
                                                    ? t('orders.expectedReady', 'Expected Ready Date')
                                                    : t('orders.expectedDelivery', 'Expected Delivery')}
                                            </p>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                                <p className="text-base font-black tracking-tight text-foreground">
                                                    {format(order.expectedDelivery.toDate(), "MMM d, yyyy")}
                                                </p>
                                                {/* Show delivery slot if Home Delivery */}
                                                {order.deliveryType === 'delivery_home' && order.deliverySlot && (
                                                    <LBadge variant="outline" className="text-[10px] py-0 font-bold border-primary/20 bg-background text-primary">
                                                        {order.deliverySlot}
                                                    </LBadge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Customer Info */}
                        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-4">{t('customer.title')}</h3>
                            <LCustomerInfo
                                name={order.customerName}
                                phone={order.customerPhone}
                                subtitle={order.isGuest ? t('customer.guest') : undefined}
                                size="md"
                            />

                            {(order.deliveryType === "delivery_home" || order.deliveryType === "pickup_home") && order.deliveryAddress && (
                                <>
                                    <LDivider className="my-4 border-dashed" />
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-muted rounded-xl shrink-0">
                                            <MapPin className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-foreground leading-relaxed">{order.deliveryAddress}</p>
                                            {order.deliveryArea && (
                                                <div className="mt-2">
                                                    <LBadge variant="outline" className="text-xs font-semibold px-2 py-0.5 bg-primary/5 text-primary border-primary/20">
                                                        <MapPin className="h-3 w-3 mr-1 inline-block" /> {order.deliveryArea}
                                                    </LBadge>
                                                </div>
                                            )}
                                            {order.deliveryNotes && (
                                                <p className="text-xs font-semibold text-muted-foreground mt-1.5 bg-muted/50 p-2 rounded-lg">{order.deliveryNotes}</p>
                                            )}
                                            {(order.deliveryLat != null && order.deliveryLng != null) && (
                                                <a
                                                    href={`https://www.google.com/maps?q=${order.deliveryLat},${order.deliveryLng}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded-md transition-colors"
                                                >
                                                    <MapPin className="h-3 w-3" /> Get directions
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Assigned Agent (for pickup/delivery orders) */}
                        {(order.deliveryType === "delivery_home" || order.deliveryType === "pickup_home") && (
                            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                                        {t('orders.assignedAgent')}
                                    </h3>
                                    {order.assignedAgentId && (
                                        <LBadge variant="outline" className="text-[9px] uppercase font-bold tracking-wider py-0.5">
                                            <UserCog className="h-3 w-3 mr-1" />
                                            {t('orders.agent')}
                                        </LBadge>
                                    )}
                                </div>

                                {order.status !== "delivered" && order.status !== "cancelled" ? (
                                    <div className="flex items-center gap-3">
                                        <LSelect
                                            value={order.assignedAgentId || ""}
                                            onChange={async (value: string) => {
                                                if (reassigning) return;
                                                setReassigning(true);
                                                try {
                                                    const selectedAgent = agents.find(a => a.id === value);
                                                    await reassignAgent(
                                                        order.id,
                                                        value || null,
                                                        selectedAgent?.name || null
                                                    );
                                                } catch (error) {
                                                    console.error("Failed to reassign agent:", error);
                                                } finally {
                                                    setReassigning(false);
                                                }
                                            }}
                                            options={[
                                                { value: "", label: t('orders.selectAgent', 'Select Agent') },
                                                ...agents.map((agent) => ({
                                                    value: agent.id,
                                                    label: `${agent.name} ${agent.isOnline ? '🟢' : '⚪'}`,
                                                }))
                                            ]}
                                            disabled={reassigning}
                                            className="flex-1 rounded-xl"
                                        />
                                        {reassigning && <LSpinner size="sm" />}
                                        {(() => {
                                            const agent = agents.find(a => a.id === order.assignedAgentId);
                                            return agent?.phone ? (
                                                <LButton
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-10 w-10 p-0 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 shrink-0"
                                                    onClick={() => window.open(`tel:${agent.phone}`)}
                                                >
                                                    <Phone className="h-4 w-4" />
                                                </LButton>
                                            ) : null;
                                        })()}
                                    </div>
                                ) : (
                                    order.assignedAgentId ? (
                                        <div className="flex items-center justify-between bg-muted/30 p-3 rounded-xl border border-border/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <User className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-foreground">{order.assignedAgentName}</p>
                                                    {(() => {
                                                        const agent = agents.find(a => a.id === order.assignedAgentId);
                                                        return agent?.phone ? (
                                                            <a href={`tel:${agent.phone}`} className="text-xs font-semibold text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5">
                                                                <Phone className="h-3 w-3" />
                                                                {agent.phone}
                                                            </a>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            </div>
                                            {(() => {
                                                const agent = agents.find(a => a.id === order.assignedAgentId);
                                                return agent?.phone ? (
                                                    <LButton
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-9 w-9 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                                                        onClick={() => window.open(`tel:${agent.phone}`)}
                                                    >
                                                        <Phone className="h-4 w-4" />
                                                    </LButton>
                                                ) : null;
                                            })()}
                                        </div>
                                    ) : (
                                        <p className="text-sm font-semibold text-muted-foreground italic bg-muted/50 p-3 rounded-xl text-center">
                                            {t('orders.noAgentAssigned', 'No agent assigned')}
                                        </p>
                                    )
                                )}
                            </div>
                        )}

                        {/* Payment Status */}
                        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{t('checkout.payment')}</h3>
                                <LBadge
                                    variant={
                                        order.paymentStatus === "paid" ? "success" :
                                            order.paymentStatus === "partial" ? "warning" : "destructive"
                                    }
                                    className="font-bold tracking-wider"
                                >
                                    {order.paymentStatus === "paid" ? t('orders.paid') :
                                        order.paymentStatus === "partial" ? t('orders.partial') : t('orders.unpaid')}
                                </LBadge>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-sm font-semibold">
                                    <span className="text-muted-foreground">{t('pos.total')}</span>
                                    <LAmount value={order.financials.total} className="text-foreground" />
                                </div>
                                <div className="flex justify-between text-sm font-semibold">
                                    <span className="text-muted-foreground">{t('orders.amountPaid')}</span>
                                    <LAmount value={order.financials.amountPaid} className="text-foreground" />
                                </div>
                                {hasBalance && (
                                    <div className="flex justify-between text-base font-black pt-2 border-t border-dashed border-border/80">
                                        <span className="text-destructive">{t('orders.balanceDue')}</span>
                                        <LAmount value={order.financials.balance} className="text-destructive" />
                                    </div>
                                )}
                            </div>

                            {hasBalance && (
                                <>
                                    <LSpacer size="md" />
                                    <LButton
                                        variant="primary"
                                        fullWidth
                                        leftIcon={<CreditCard className="h-4 w-4" />}
                                        onClick={() => setPaymentSheetOpen(true)}
                                        className="rounded-xl font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300"
                                    >
                                        {t('orders.collectPayment')}
                                    </LButton>
                                </>
                            )}
                        </div>

                        {/* Quick Actions Card (Embedded/Desktop) */}
                        {isEmbedded && (
                            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-4">{t('orders.orderActions', 'Quick Actions')}</h3>
                                <div className="flex flex-col gap-3">
                                    {canUpdateStatus && (
                                        <LButton
                                            variant="primary"
                                            fullWidth
                                            className="rounded-xl font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300"
                                            onClick={() => setStatusSheetOpen(true)}
                                            leftIcon={<RefreshCw className="h-4 w-4" />}
                                        >
                                            {t('orders.updateStatus')}
                                        </LButton>
                                    )}
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <LButton
                                            variant="outline"
                                            className="rounded-xl font-semibold bg-background"
                                            onClick={handlePrintPreview}
                                            leftIcon={<Printer className="h-4 w-4" />}
                                        >
                                            {t('orders.printReceipt')}
                                        </LButton>
                                        
                                        <LButton
                                            variant="outline"
                                            className="rounded-xl font-semibold bg-background"
                                            onClick={() => window.open(`tel:${order.customerPhone}`)}
                                            leftIcon={<Phone className="h-4 w-4" />}
                                        >
                                            {t('orders.callCustomer', 'Call')}
                                        </LButton>
                                        
                                        <LButton
                                            variant="outline"
                                            className="rounded-xl font-semibold bg-background"
                                            onClick={handleWhatsAppChat}
                                            leftIcon={<MessageCircle className="h-4 w-4 text-green-600" />}
                                        >
                                            WhatsApp
                                        </LButton>

                                        {hasFeature("qrScans") && (
                                            <LButton
                                                variant="outline"
                                                className="rounded-xl font-semibold bg-background"
                                                onClick={() => setTagModalOpen(true)}
                                                leftIcon={<Tag className="h-4 w-4" />}
                                            >
                                                {t('orders.printTags', 'Tags')}
                                            </LButton>
                                        )}
                                    </div>
                                    
                                    {(canEdit || canCancel) && (
                                        <div className="flex gap-2 pt-3 border-t border-primary/10 mt-1">
                                            {canEdit && (
                                                <LButton
                                                    variant="ghost"
                                                    className="flex-1 rounded-xl text-muted-foreground hover:text-foreground bg-background/50 hover:bg-background"
                                                    onClick={handleEdit}
                                                    leftIcon={<Edit className="h-4 w-4" />}
                                                >
                                                    {t('orders.editOrder', 'Edit')}
                                                </LButton>
                                            )}
                                            {canCancel && (
                                                <LButton
                                                    variant="ghost"
                                                    className="flex-1 rounded-xl text-destructive hover:bg-destructive/10 bg-background/50"
                                                    onClick={() => setCancelSheetOpen(true)}
                                                    leftIcon={<Trash2 className="h-4 w-4" />}
                                                >
                                                    {t('orders.cancelOrder', 'Cancel')}
                                                </LButton>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>


            </div>

            {/* Mobile Fixed Action Button (Only if NOT embedded) */}
            {!isEmbedded && canUpdateStatus && (
                <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent md:relative md:bottom-auto md:bg-none md:p-0 md:px-4 md:pb-4 z-20">
                    <LButton
                        variant="primary"
                        size="lg"
                        fullWidth
                        className="rounded-2xl font-black shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                        onClick={() => setStatusSheetOpen(true)}
                    >
                        {t('orders.updateStatus')}
                    </LButton>
                </div>
            )}

            {/* Sheets */}
            <StatusUpdateSheet
                open={statusSheetOpen}
                onClose={() => setStatusSheetOpen(false)}
                order={order}
                onSuccess={order?.orderSource === "online" && markSeen ? () => markSeen(order.id) : undefined}
            />

            <PaymentCollectionSheet
                open={paymentSheetOpen}
                onClose={() => setPaymentSheetOpen(false)}
                order={order}
            />

            <LActionSheet
                open={actionSheetOpen}
                onClose={() => setActionSheetOpen(false)}
                title={t('orders.orderActions')}
                actions={[
                    { id: "call", label: t('orders.callCustomer'), icon: <Phone className="h-5 w-5" />, onClick: () => window.open(`tel:${order.customerPhone}`) },
                    { id: "whatsapp", label: t('orders.whatsapp'), icon: <MessageCircle className="h-5 w-5" />, onClick: handleWhatsAppChat },
                    { id: "download", label: t('orders.downloadReceipt'), icon: <Download className="h-5 w-5" />, onClick: handleDownloadReceipt },
                    { id: "print", label: t('orders.printReceipt'), icon: <Printer className="h-5 w-5" />, onClick: handlePrintPreview },
                    ...(hasFeature("qrScans") ? [{ id: "tags", label: t('orders.printTags'), icon: <Tag className="h-5 w-5" />, onClick: () => { setActionSheetOpen(false); setTagModalOpen(true); } }] : []),
                    ...(canEdit ? [{ id: "edit", label: t('orders.editOrder'), icon: <Edit className="h-5 w-5" />, onClick: handleEdit }] : []),
                    ...(canCancel ? [{ id: "cancel", label: t('orders.cancelOrder'), icon: <Trash2 className="h-5 w-5" />, destructive: true, onClick: () => { setActionSheetOpen(false); setCancelSheetOpen(true); } }] : []),
                ]}
            />

            <CancelOrderSheet
                open={cancelSheetOpen}
                onClose={() => setCancelSheetOpen(false)}
                order={order}
            />

            {/* Tag Generator Modal */}
            <TagGeneratorModal
                open={tagModalOpen}
                onClose={() => setTagModalOpen(false)}
                order={order}
            />
        </Container>
    );
}
