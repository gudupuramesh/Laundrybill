import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useDriverAuth } from "@/features/driver-app/DriverAuthContext";
import type { Order } from "@/types/order";
import { format } from "date-fns";
import {
    ArrowLeft,
    Package,
    User,
    Calendar,
    Phone,
    MapPin,
    Clock,
    CheckCircle
} from "lucide-react";
import { LButton, LCard, LSpinner, LStatusBadge, LOrderSummary } from "@/components/laundry";
import { useEffect } from "react";

export function PlantOrderDetailPage() {
    const { t } = useTranslation();
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const { shopId } = useDriverAuth();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!shopId || !orderId) {
            setLoading(false);
            return;
        }

        const orderRef = doc(db, "shops", shopId, "orders", orderId);
        const unsubscribe = onSnapshot(orderRef, (doc) => {
            if (doc.exists()) {
                setOrder({ id: doc.id, ...doc.data() } as Order);
            } else {
                setOrder(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [shopId, orderId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LSpinner size="lg" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">{t('plant.orderNotFound', 'Order not found')}</p>
                <LButton variant="outline" className="mt-4" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {t('common.back', 'Go Back')}
                </LButton>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <LButton variant="ghost" size="sm" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                </LButton>
                <div>
                    <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <LStatusBadge status={order.status} />
                    </div>
                </div>
            </div>

            {/* Customer Info */}
            <LCard className="p-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    {t('plant.customer', 'Customer')}
                </h3>
                <div className="space-y-2 text-sm">
                    <p className="font-medium">{order.customerName}</p>
                    {order.customerPhone && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            {order.customerPhone}
                        </p>
                    )}
                    {order.deliveryAddress && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            {order.deliveryAddress}
                        </p>
                    )}
                </div>
            </LCard>

            {/* Order Items – category-wise with full pricing (same layout as shop owner) */}
            <LCard className="p-0">
                <div className="p-4 pb-2 flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-lg">
                        {t('plant.items', 'Items')} ({order.items?.length || 0})
                    </h3>
                </div>
                <LOrderSummary
                    items={(order.items || []).map((item) => ({
                        id: item.id,
                        name: item.serviceName + (item.express ? " ⚡ Express" : ""),
                        categoryName: item.categoryName,
                        quantity: item.quantity,
                        price: item.unitPrice,
                        unit: item.unit,
                        express: item.express,
                        processingDays: item.turnaroundDays,
                    }))}
                    subtotal={order.financials?.subtotal || 0}
                    discount={order.financials?.discountAmount || 0}
                    delivery={order.financials?.deliveryCharge || 0}
                    taxAmount={order.financials?.taxAmount || 0}
                    taxRate={order.financials?.taxRate}
                    taxName={order.financials?.taxName}
                    total={order.financials?.total || 0}
                    className="border-t"
                />
            </LCard>

            {/* Timeline */}
            <LCard className="p-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    {t('plant.timeline', 'Timeline')}
                </h3>
                <div className="space-y-3">
                    {order.timeline?.map((event, idx) => (
                        <div key={event.id || idx} className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <CheckCircle className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="font-medium capitalize">{event.status.replace(/_/g, ' ')}</p>
                                <p className="text-sm text-muted-foreground">
                                    {event.staffName} • {format(event.timestamp?.toDate?.() || new Date(), "dd MMM, hh:mm a")}
                                </p>
                                {event.notes && (
                                    <p className="text-xs text-muted-foreground mt-1">{event.notes}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </LCard>

            {/* Dates */}
            <LCard className="p-4">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    {t('plant.dates', 'Dates')}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">{t('plant.created', 'Created')}</p>
                        <p className="font-medium">
                            {order.createdAt?.toDate
                                ? format(order.createdAt.toDate(), "dd MMM yyyy, hh:mm a")
                                : "N/A"}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">{t('plant.expectedReady', 'Expected Ready')}</p>
                        <p className="font-medium">
                            {order.expectedDelivery?.toDate
                                ? format(order.expectedDelivery.toDate(), "dd MMM yyyy")
                                : "N/A"}
                        </p>
                    </div>
                </div>
            </LCard>
        </div>
    );
}
