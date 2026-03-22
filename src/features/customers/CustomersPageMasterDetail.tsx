/**
 * Customers Page (Master-Detail Layout)
 * 
 * Desktop: Side-by-side list + detail
 * Mobile: Navigates to separate detail page
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { LMasterDetailLayout } from "@/components/layout/LMasterDetailLayout";
import { LPageLoader } from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCustomers } from "@/hooks/use-customers";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useTranslation } from "react-i18next";
import { CustomersList } from "./CustomersList";
import { CustomerDetailPanel } from "./CustomerDetailPanel";

export function CustomersPageMasterDetail() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { customerId } = useParams<{ customerId?: string }>();
    const isMobile = useIsMobile();
    const { loading } = useCustomers();
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

    // Determine base path for navigation
    const isStaff = location.pathname.startsWith('/staff');
    const basePath = isStaff ? '/staff/customers' : '/customers';

    // Use minimum loading duration to show animation properly
    const showLoading = useMinLoading(loading, { minDuration: 700 });

    // On desktop, handle URL params for selected customer
    useEffect(() => {
        if (customerId && !isMobile) {
            setSelectedCustomerId(customerId);
        }
    }, [customerId, isMobile]);

    const handleCustomerSelect = (id: string) => {
        if (isMobile) {
            // Mobile: Navigate to detail page
            navigate(`${basePath}/${id}`);
        } else {
            // Desktop: Update state, show in detail panel
            setSelectedCustomerId(id);
        }
    };

    // Show page loader while initial data loads
    if (showLoading) {
        return (
            <div className="h-full">
                <LPageLoader variant="bubbles" message={t('customers.loading')} />
            </div>
        );
    }

    return (
        <LMasterDetailLayout
            listPanel={
                <CustomersList
                    selectedId={selectedCustomerId}
                    onSelect={handleCustomerSelect}
                />
            }
            detailPanel={
                selectedCustomerId && (
                    <CustomerDetailPanel
                        customerId={selectedCustomerId}
                        onClose={() => setSelectedCustomerId(null)}
                    />
                )
            }
            selectedId={selectedCustomerId}
            adPosition="customers-sidebar"
        />
    );
}
