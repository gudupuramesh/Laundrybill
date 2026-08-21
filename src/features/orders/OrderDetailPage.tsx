/**
 * Order Detail Page
 * 
 * Standalone page for order details (Mobile usually)
 * Wrapper around OrderDetailView
 */

import { useParams, useNavigate, useLocation } from "react-router-dom";
import { OrderDetailView } from "./OrderDetailView";
import { MobileOrderDetail } from "./MobileOrderDetail";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOrder } from "@/hooks/use-orders";
import { LSpinner } from "@/components/laundry";
import { PageWrapper } from "@/components/PageWrapper";
import { useTranslation } from "react-i18next";
import { LButton } from "@/components/laundry";

export function OrderDetailPage() {
    const { t } = useTranslation();
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useIsMobile();
    // Keep back-navigation in-context: staff app lives under /staff/*.
    const ordersBase = location.pathname.startsWith("/staff") ? "/staff/orders" : "/orders";

    if (!orderId) {
        return (
            <PageWrapper>
                <div className="text-center py-12">
                    <p className="text-muted-foreground">{t('orders.notFound')}</p>
                    <LButton variant="ghost" onClick={() => navigate(ordersBase)} className="mt-4">
                        {t('orders.backToOrders')}
                    </LButton>
                </div>
            </PageWrapper>
        );
    }

    // MOBILE: render the owner app's OrderDetailsScreen clone.
    if (isMobile) return <MobileOrderDetailRoute orderId={orderId} ordersBase={ordersBase} />;

    return (
        <OrderDetailView
            orderId={orderId}
            onBack={() => navigate(ordersBase)}
            isEmbedded={false}
        />
    );
}

/** Loads the order for the mobile clone (OrderDetailView does its own fetch). */
function MobileOrderDetailRoute({ orderId, ordersBase }: { orderId: string; ordersBase: string }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { order, loading } = useOrder(orderId);
    const root = ordersBase.replace(/\/orders$/, "");

    if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}><LSpinner size="lg" /></div>;
    if (!order) return (
        <div style={{ textAlign: "center", padding: 48 }}>
            <p style={{ color: "var(--c-text-3)" }}>{t("orders.notFound", "Order not found")}</p>
            <LButton variant="ghost" onClick={() => navigate(ordersBase)} className="mt-4">{t("orders.backToOrders", "Back to orders")}</LButton>
        </div>
    );
    return <MobileOrderDetail order={order} basePath={root} onBack={() => navigate(ordersBase)} />;
}
