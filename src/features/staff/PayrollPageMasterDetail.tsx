/**
 * Payroll Page (Master-Detail Layout)
 * 
 * Desktop: Staff list + selected staff's payroll breakdown
 * Mobile: List + bottom sheet for payroll detail
 */

import { useState } from "react";
import { LMasterDetailLayout } from "@/components/layout/LMasterDetailLayout";
import { LBottomSheet, LPageLoader } from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStaff } from "@/hooks/use-staff";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useTranslation } from "react-i18next";
import { PayrollStaffList } from "./PayrollStaffList";
import { PayrollDetailPanel } from "./PayrollDetailPanel";

export function PayrollPageMasterDetail() {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const { loading: staffLoading } = useStaff();
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

    // Use minimum loading duration to show animation properly
    const showLoading = useMinLoading(staffLoading, { minDuration: 700 });

    const handleStaffSelect = (id: string) => {
        setSelectedStaffId(id);
    };

    const handleClose = () => {
        setSelectedStaffId(null);
    };

    // Show page loader while initial staff data loads
    if (showLoading) {
        return (
            <div className="h-full">
                <LPageLoader variant="cash" message={t('payroll.loading')} />
            </div>
        );
    }

    return (
        <>
            <LMasterDetailLayout
                listPanel={
                    <PayrollStaffList
                        selectedId={selectedStaffId}
                        onSelect={handleStaffSelect}
                    />
                }
                detailPanel={
                    selectedStaffId && (
                        <PayrollDetailPanel
                            staffId={selectedStaffId}
                            onClose={handleClose}
                        />
                    )
                }
                selectedId={selectedStaffId}
                adPosition="payroll-sidebar"
            />
            
            {/* Mobile: Show detail in bottom sheet */}
            {isMobile && (
                <LBottomSheet
                    open={!!selectedStaffId}
                    onClose={handleClose}
                    title="Payroll Details"
                    snapPoints={[0.95]}
                >
                    {selectedStaffId && (
                        <PayrollDetailPanel
                            staffId={selectedStaffId}
                            onClose={handleClose}
                        />
                    )}
                </LBottomSheet>
            )}
        </>
    );
}
