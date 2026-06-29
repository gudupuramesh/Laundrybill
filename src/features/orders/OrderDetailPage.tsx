/**
 * Order Detail Page
 * 
 * Standalone page for order details (Mobile usually)
 * Wrapper around OrderDetailView
 */

import { useParams, useNavigate, useLocation } from "react-router-dom";
import { OrderDetailView } from "./OrderDetailView";
import { PageWrapper } from "@/components/PageWrapper";
import { useTranslation } from "react-i18next";
import { LButton } from "@/components/laundry";

export function OrderDetailPage() {
    const { t } = useTranslation();
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
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

    return (
        <OrderDetailView
            orderId={orderId}
            onBack={() => navigate(ordersBase)}
            isEmbedded={false}
        />
    );
}
