/**
 * Orders Page (Master-Detail Layout)
 * 
 * Desktop: Side-by-side list + detail
 * Mobile: Navigates to separate detail page
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { LMasterDetailLayout } from "@/components/layout/LMasterDetailLayout";
import { LPageLoader } from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOrdersPaginated } from "@/hooks/use-orders-paginated";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useTranslation } from "react-i18next";
import { OrdersList } from "./OrdersList";
import { OrderDetailPanel } from "./OrderDetailPanel";

export function OrdersPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { orderId } = useParams<{ orderId?: string }>();
    const isMobile = useIsMobile();
    const { loading } = useOrdersPaginated();
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    // Determine base path for navigation
    const isStaff = location.pathname.startsWith('/staff');
    const basePath = isStaff ? '/staff/orders' : '/orders';

    // Use minimum loading duration to show animation properly
    const showLoading = useMinLoading(loading, { minDuration: 700 });

    // On desktop, handle URL params for selected order
    useEffect(() => {
        if (orderId && !isMobile) {
            setSelectedOrderId(orderId);
        }
    }, [orderId, isMobile]);

    const handleOrderSelect = (id: string) => {
        if (isMobile) {
            // Mobile: Navigate to detail page
            navigate(`${basePath}/${id}`);
        } else {
            // Desktop: Update state, show in detail panel
            setSelectedOrderId(id);
        }
    };

    // Show page loader while initial data loads
    if (showLoading) {
        return (
            <div className="h-full">
                <LPageLoader variant="hanger" message={t('orders.loading')} />
            </div>
        );
    }

    return (
        <LMasterDetailLayout
            listPanel={
                <OrdersList
                    selectedId={selectedOrderId}
                    onSelect={handleOrderSelect}
                />
            }
            detailPanel={
                selectedOrderId && (
                    <OrderDetailPanel
                        orderId={selectedOrderId}
                        onClose={() => setSelectedOrderId(null)}
                    />
                )
            }
            selectedId={selectedOrderId}
            adPosition="orders-sidebar"
        />
    );
}
