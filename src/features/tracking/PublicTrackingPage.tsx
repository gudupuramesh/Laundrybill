/**
 * Public Order Tracking Page
 * 
 * Customer-facing page to track order status using tracking ID or QR code
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    LCard,
    LButton,
    LTextInput,
    LAmount,
    LDateDisplay,
    LBadge,
    LDivider,
    LSpacer,
    LPageLoader,
} from "@/components/laundry";
import { useOrderTracking } from "@/hooks/use-tracking";
import { groupOrderItemsByCategory } from "@/lib/order-item-groups";
import {
    Search,
    Phone,
    MessageCircle,
    Clock,
    Package,
    CheckCircle2,
    Truck,
    XCircle,
    ArrowLeft,
    Loader2,
    User,
    Image as ImageIcon,
    FileText,
    MapPin,
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

const statusConfig: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
    pending: { label: "Order Received", icon: Clock, color: "text-warning", bgColor: "bg-warning" },
    order_placed: { label: "Order Received", icon: Clock, color: "text-warning", bgColor: "bg-warning" },
    processing: { label: "Processing", icon: Loader2, color: "text-primary", bgColor: "bg-primary" },
    in_progress: { label: "Processing", icon: Loader2, color: "text-primary", bgColor: "bg-primary" },
    picked_up: { label: "Collected", icon: Package, color: "text-success", bgColor: "bg-success" },
    ready: { label: "Ready", icon: CheckCircle2, color: "text-success", bgColor: "bg-success" },
    ready_for_pickup: { label: "Ready for Pickup", icon: CheckCircle2, color: "text-success", bgColor: "bg-success" },
    ready_for_delivery: { label: "Ready for Delivery", icon: CheckCircle2, color: "text-success", bgColor: "bg-success" },
    out_for_delivery: { label: "Out for Delivery", icon: Truck, color: "text-primary", bgColor: "bg-primary" },
    delivered: { label: "Delivered", icon: CheckCircle2, color: "text-success", bgColor: "bg-success" },
    cancelled: { label: "Cancelled", icon: XCircle, color: "text-destructive", bgColor: "bg-destructive" },
    pickup_scheduled: { label: "Pickup Scheduled", icon: Clock, color: "text-warning", bgColor: "bg-warning" },
    pickup_completed: { label: "Clothes Collected", icon: Package, color: "text-primary", bgColor: "bg-primary" },
};

const progressSteps = [
    { id: "pending", label: "Received" },
    { id: "processing", label: "Processing" },
    { id: "ready", label: "Ready" },
    { id: "delivered", label: "Delivered" },
];

export function PublicTrackingPage() {
    const { t, i18n } = useTranslation();
    const { trackingId, publicId } = useParams<{ trackingId?: string; shopId?: string; publicId?: string }>();
    const navigate = useNavigate();
    // Support both /track/:trackingId and /track/:shopId/:publicId
    const effectiveTrackingId = publicId || trackingId || "";
    const [searchQuery, setSearchQuery] = useState(effectiveTrackingId);
    const [phoneInput, setPhoneInput] = useState("");
    // Phone is the verifier — tracking only runs once the customer confirms the
    // mobile number on the order (prevents enumerating orders by number alone).
    const [phoneVerified, setPhoneVerified] = useState("");

    // Force public tracking page to always render in English, regardless
    // of the app/user language preference.
    useEffect(() => {
        const previousLang = i18n.language;

        if (previousLang !== "en") {
            void i18n.changeLanguage("en");
        }

        return () => {
            if (previousLang && previousLang !== i18n.language) {
                void i18n.changeLanguage(previousLang);
            }
        };
    }, [i18n]);

    // Order IDs are now globally unique (format: XXXX-00001)
    // Legacy IDs (A-001) may still exist but will match the first shop
    const { data, loading, error } = useOrderTracking(effectiveTrackingId, phoneVerified);

    const handleSearch = () => {
        const code = searchQuery.trim();
        const ph = phoneInput.replace(/\D/g, "");
        if (code && ph.length >= 10) {
            setPhoneVerified(ph);
            if (code !== effectiveTrackingId) navigate(`/track/${code}`);
        }
    };

    const getStepIndex = (status: string): number => {
        if (status === "cancelled") return -1;
        if (status === "delivered" || status === "picked_up") return 3; // picked_up = customer collected = done
        if (status === "ready" || status === "ready_for_pickup" || status === "ready_for_delivery" || status === "out_for_delivery") return 2;
        if (status === "processing" || status === "in_progress") return 1;
        return 0; // pending, order_placed
    };

    // Get status info with fallback
    const getStatusInfo = (status: string) => {
        return statusConfig[status] || statusConfig.pending;
    };

    // Search / verify form — shown when there's no order number yet OR the
    // customer hasn't confirmed the phone on the order (the tracking verifier).
    if (!effectiveTrackingId || !phoneVerified) {
        return (
            <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, var(--c-primary), #11338E)" }}>
                {/* Header */}
                <header className="p-6 pt-12 text-center text-white">
                    <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Package className="h-8 w-8" />
                        </div>
                        <h1 className="text-2xl font-bold">{t('tracking.title')}</h1>
                        <p className="text-white/80 mt-1">
                            {t('tracking.subtitle')}
                        </p>
                    </div>
                </header>

                {/* Search Form */}
                <main className="flex-1 p-4">
                    <LCard variant="elevated" padding="lg" className="max-w-md mx-auto">
                        <LTextInput
                            label={t('tracking.orderId')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('tracking.orderIdPlaceholder')}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        />
                        <LSpacer size="sm" />
                        <LTextInput
                            label={t('tracking.phoneVerify', 'Mobile number on the order')}
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                            placeholder={t('tracking.phoneVerifyPlaceholder', 'e.g. 9876543210')}
                            inputMode="tel"
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        />
                        <LSpacer size="xs" />
                        <p className="text-xs text-muted-foreground">
                            {t('tracking.phoneVerifyHint', 'For your privacy, we confirm the mobile number used on the order.')}
                        </p>
                        <LSpacer size="md" />
                        <LButton
                            variant="primary"
                            size="lg"
                            fullWidth
                            leftIcon={<Search className="h-5 w-5" />}
                            onClick={handleSearch}
                            disabled={!searchQuery.trim() || phoneInput.replace(/\D/g, "").length < 10}
                        >
                            {t('tracking.trackOrder')}
                        </LButton>
                    </LCard>

                    {/* Help Text */}
                    <div className="max-w-md mx-auto mt-6 text-center">
                        <p className="text-sm text-white/70">
                            {t('tracking.helpText')}
                        </p>
                    </div>
                </main>

                {/* Footer */}
                <footer className="p-4 text-center">
                    <p className="text-xs text-white/50">
                        {t('tracking.poweredBy')}
                    </p>
                </footer>
            </div>
        );
    }

    // Loading State
    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <LPageLoader variant="machine" message="Finding your order..." />
            </div>
        );
    }

    // Error State
    if (error || !data) {
        return (
            <div className="min-h-screen bg-background p-4">
                <LCard variant="elevated" padding="lg" className="max-w-md mx-auto mt-20">
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-destructive-muted flex items-center justify-center mx-auto mb-4">
                            <XCircle className="h-8 w-8 text-destructive" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground mb-2">{t('tracking.notFound')}</h2>
                        <p className="text-muted-foreground mb-6">
                            {error || t('tracking.notFoundDesc')}
                        </p>
                        <LButton
                            variant="primary"
                            onClick={() => navigate("/track")}
                            leftIcon={<ArrowLeft className="h-4 w-4" />}
                        >
                            {t('tracking.tryAgain')}
                        </LButton>
                    </div>
                </LCard>
            </div>
        );
    }

    const statusInfo = getStatusInfo(data.status);
    const StatusIcon = statusInfo.icon;
    const currentStep = getStepIndex(data.status);

    return (
        <div className="min-h-screen" style={{ background: "var(--c-bg)" }}>
            {/* Header with Status */}
            <header className="text-white p-6 pb-16" style={{ background: "linear-gradient(180deg, var(--c-primary), #11338E)" }}>
                <div className="max-w-md mx-auto">
                    <button
                        onClick={() => navigate("/track")}
                        className="flex items-center gap-1 text-white/80 hover:text-white mb-4"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="text-sm">{t('tracking.trackAnother')}</span>
                    </button>

                    {/* Shop name and address above order number */}
                    {(data.shopName || data.shopAddress) && (
                        <div className="mb-4 text-white/90">
                            {data.shopName && (
                                <p className="font-semibold text-white">{data.shopName}</p>
                            )}
                            {data.shopAddress && (
                                <p className="text-sm text-white/80 flex items-center gap-1 mt-0.5">
                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                    {data.shopAddress}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <StatusIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">{t('tracking.orderNumber', { id: data.publicId })}</h1>
                            <p className="text-white/80">{statusInfo.label}</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="p-4 -mt-10">
                <div className="max-w-md mx-auto space-y-4">
                    {/* Progress Steps */}
                    <LCard variant="elevated" padding="md">
                        {data.status !== "cancelled" ? (
                            <div className="flex justify-between items-center relative">
                                {/* Progress line */}
                                <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted">
                                    <div
                                        className="h-full bg-primary transition-all"
                                        style={{ width: `${(currentStep / 3) * 100}%` }}
                                    />
                                </div>

                                {progressSteps.map((step, index) => (
                                    <div key={step.id} className="relative z-10 flex flex-col items-center">
                                        <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${index <= currentStep
                                                ? "bg-primary text-white"
                                                : "bg-muted text-muted-foreground"
                                                }`}
                                        >
                                            {index < currentStep ? (
                                                <CheckCircle2 className="h-5 w-5" />
                                            ) : (
                                                index + 1
                                            )}
                                        </div>
                                        <span className="text-xs mt-2 text-muted-foreground">{step.label}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <LBadge variant="destructive" size="lg">
                                    {t('tracking.cancelled')}
                                </LBadge>
                            </div>
                        )}
                    </LCard>

                    {/* Delivered At - for completed orders */}
                    {data.status === "delivered" && data.deliveredAt && (
                        <LCard variant="filled" padding="md" className="bg-success/5 border-success">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-success">
                                        {t('tracking.deliveredAt', 'Delivered')}
                                    </p>
                                    <p className="font-semibold text-foreground">
                                        <LDateDisplay date={data.deliveredAt} format="datetime" />
                                    </p>
                                </div>
                                <CheckCircle2 className="h-6 w-6 text-success" />
                            </div>
                        </LCard>
                    )}

                    {/* Expected Delivery - for active orders */}
                    {data.status !== "cancelled" && data.status !== "delivered" && (
                        <LCard variant="filled" padding="md">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">{t('tracking.expectedReady')}</p>
                                    <p className="font-semibold text-foreground">
                                        <LDateDisplay date={data.expectedDelivery} format="datetime" />
                                    </p>
                                </div>
                                <Clock className="h-6 w-6 text-muted-foreground" />
                            </div>
                        </LCard>
                    )}

                    {/* Your order – customer name and address so they can confirm it's their order */}
                    {(data.customerName || data.deliveryAddress) && (
                        <LCard variant="outlined" padding="md">
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">
                                {t('tracking.yourOrder', 'Your order')}
                            </h3>
                            {data.customerName && (
                                <div className="flex items-center gap-2 mb-2">
                                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <p className="font-medium text-foreground">{data.customerName}</p>
                                </div>
                            )}
                            {data.deliveryAddress && (
                                <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                    <p className="text-sm text-foreground">{data.deliveryAddress}</p>
                                </div>
                            )}
                        </LCard>
                    )}

                    {/* Assigned Agent - show for any active order with an assigned agent */}
                    {(data.assignedAgentId || data.assignedAgentName) &&
                        data.status !== "delivered" &&
                        data.status !== "cancelled" && (
                            <LCard variant="outlined" padding="md">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <User className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground">
                                            {t('tracking.yourAgent', 'Your Agent')}
                                        </p>
                                        <p className="font-medium text-foreground">
                                            {data.assignedAgentName || t('orders.agent', 'Agent')}
                                        </p>
                                        {data.assignedAgentPhone ? (
                                            <>
                                                <p className="text-sm text-foreground mt-1">
                                                    <a href={`tel:${data.assignedAgentPhone}`} className="hover:underline">
                                                        {data.assignedAgentPhone}
                                                    </a>
                                                </p>
                                                <div className="flex gap-2 mt-2">
                                                    <LButton
                                                        variant="outline"
                                                        size="sm"
                                                        leftIcon={<Phone className="h-4 w-4" />}
                                                        onClick={() => window.open(`tel:${data.assignedAgentPhone}`)}
                                                    >
                                                        {t('tracking.callAgent', 'Call')}
                                                    </LButton>
                                                    <LButton
                                                        variant="outline"
                                                        size="sm"
                                                        leftIcon={<MessageCircle className="h-4 w-4" />}
                                                        onClick={() => {
                                                            const digits = (data.assignedAgentPhone || '').replace(/\D/g, '');
                                                            const num = digits.startsWith('91') ? digits : `91${digits}`;
                                                            window.open(`https://wa.me/${num}`);
                                                        }}
                                                    >
                                                        {t('tracking.whatsappAgent', 'WhatsApp')}
                                                    </LButton>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {t('tracking.agentContactNotAvailable')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </LCard>
                        )}

                    {/* Order Items – grouped by service type */}
                    <LCard variant="outlined" padding="md">
                        <h3 className="font-semibold text-foreground mb-3">{t('tracking.orderItems')}</h3>
                        {/* Note for online quick orders where items will be added at pickup */}
                        {data.orderSource === "online" && (!data.items || data.items.length === 0) && (
                            <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3 mb-4">
                                {t('tracking.itemsAddedAtPickup', 'Order items will be added by the agent when they collect the clothes at pickup.')}
                            </p>
                        )}
                        <div className="space-y-4">
                            {groupOrderItemsByCategory(data.items, (i) => i.categoryName || "").map(({ categoryName, items: groupItems }) => (
                                <div key={categoryName}>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                        {categoryName === "Others" ? t('common.other', 'Other') : categoryName}
                                    </p>
                                    <div className="space-y-2">
                                        {groupItems.map((item, index) => (
                                            <div key={index} className="flex justify-between text-sm gap-2">
                                                <div className="min-w-0">
                                                    <span className="text-foreground font-medium">{item.name}</span>
                                                    {item.express && (
                                                        <span className="ml-1 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                                                            ⚡ Express
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-muted-foreground shrink-0">×{item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <LDivider className="my-3" />
                        <div className="space-y-1">
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>{t('pos.subtotal')}</span>
                                <LAmount value={data.total - (data.taxAmount || 0) - (data.deliveryCharge || 0) + (data.discountAmount || 0)} size="sm" />
                            </div>

                            {(data.discountAmount || 0) > 0 && (
                                <div className="flex justify-between text-sm text-success">
                                    <span>{t('checkout.discount')}</span>
                                    <span>-<LAmount value={data.discountAmount || 0} size="sm" /></span>
                                </div>
                            )}

                            {(data.deliveryCharge || 0) > 0 && (
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>{t('checkout.delivery')}</span>
                                    <LAmount value={data.deliveryCharge || 0} size="sm" />
                                </div>
                            )}

                            {(data.taxAmount || 0) > 0 && (
                                <div className="flex justify-between text-sm text-foreground">
                                    <span>{t('pos.tax', { name: data.taxName, rate: data.taxRate })}</span>
                                    <LAmount value={data.taxAmount || 0} size="sm" />
                                </div>
                            )}

                            <LDivider className="my-1" />

                            <div className="flex justify-between font-semibold">
                                <span>{t('common.total')}</span>
                                <LAmount value={data.total} />
                            </div>
                            {data.balance > 0 && (
                                <div className="flex justify-between text-sm text-destructive">
                                    <span>{t('tracking.balanceDue')}</span>
                                    <LAmount value={data.balance} />
                                </div>
                            )}
                        </div>
                    </LCard>

                    {/* View / Download Receipt */}
                    <LButton
                        variant="outline"
                        size="lg"
                        fullWidth
                        leftIcon={<FileText className="h-5 w-5" />}
                        onClick={() => navigate(`/receipt/${data.publicId}`, { state: { phone: phoneVerified } })}
                    >
                        {t('tracking.viewReceipt', 'View receipt')}
                    </LButton>

                    {/* Order Photos – damage/stain, pickup proof, delivery proof (visible to customer) */}
                    {(data.damagePhotoUrls?.length || data.pickupPhoto || data.deliveryPhoto || data.plantPhoto) && (
                        <LCard variant="outlined" padding="md">
                            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                {t('tracking.orderPhotos')}
                            </h3>
                            <div className="space-y-3">
                                {data.damagePhotoUrls && data.damagePhotoUrls.length > 0 && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-2">{t('tracking.damageStainPhotos')}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {data.damagePhotoUrls.map((url, i) => (
                                                <a
                                                    key={i}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-block rounded-lg overflow-hidden border border-border hover:opacity-90"
                                                >
                                                    <img src={url} alt={`Damage ${i + 1}`} className="h-24 w-24 object-cover" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {data.pickupPhoto && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-2">{t('tracking.pickupProof')}</p>
                                        <a
                                            href={data.pickupPhoto}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-block rounded-lg overflow-hidden border border-border hover:opacity-90"
                                        >
                                            <img src={data.pickupPhoto} alt="Pickup proof" className="h-24 w-24 object-cover" />
                                        </a>
                                    </div>
                                )}
                                {data.deliveryPhoto && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-2">{t('tracking.deliveryProof')}</p>
                                        <a
                                            href={data.deliveryPhoto}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-block rounded-lg overflow-hidden border border-border hover:opacity-90"
                                        >
                                            <img src={data.deliveryPhoto} alt="Delivery proof" className="h-24 w-24 object-cover" />
                                        </a>
                                    </div>
                                )}
                                {data.plantPhoto && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-2">{t('tracking.plantProof', 'Plant / processing proof')}</p>
                                        <a
                                            href={data.plantPhoto}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-block rounded-lg overflow-hidden border border-border hover:opacity-90"
                                        >
                                            <img src={data.plantPhoto} alt="Plant proof" className="h-24 w-24 object-cover" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </LCard>
                    )}

                    {/* Timeline */}
                    <LCard variant="outlined" padding="md">
                        <h3 className="font-semibold text-foreground mb-3">{t('tracking.timeline')}</h3>
                        <div className="space-y-3">
                            {data.timeline
                                .slice()
                                .reverse()
                                .map((event, index) => {
                                    const config = getStatusInfo(event.status);
                                    const Icon = config.icon;
                                    return (
                                        <div key={index} className="flex items-start gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${index === 0 ? "bg-primary text-white" : "bg-muted"
                                                }`}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-medium ${index === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                                                    {config.label}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(event.timestamp, "MMM d, h:mm a")}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </LCard>

                    {/* Need help? – Phone (click to dial) and WhatsApp at bottom */}
                    {data.shopPhone && (
                        <LCard variant="outlined" padding="md">
                            <h3 className="font-semibold text-foreground mb-2">{t('tracking.needHelp')}</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                {t('tracking.needHelpCall', 'Need help? Call this number or message on WhatsApp.')}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <a
                                    href={`tel:${data.shopPhone}`}
                                    className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                                >
                                    <Phone className="h-4 w-4" />
                                    {data.shopPhone}
                                </a>
                                <span className="text-muted-foreground">·</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const digits = (data.shopPhone || '').replace(/\D/g, '');
                                        const wa = digits.length === 10 ? `91${digits}` : digits.startsWith('91') ? digits : `91${digits}`;
                                        window.open(`https://wa.me/${wa}`);
                                    }}
                                    className="inline-flex items-center gap-2 font-medium text-[#25D366] hover:underline"
                                >
                                    <MessageCircle className="h-4 w-4" />
                                    WhatsApp
                                </button>
                            </div>
                        </LCard>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="p-4 mt-8 text-center">
                <p className="text-xs text-muted-foreground">
                    {t('tracking.poweredBy')}
                </p>
            </footer>
        </div>
    );
}
