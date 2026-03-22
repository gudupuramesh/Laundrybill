/**
 * Attendance Page (Master-Detail Layout)
 * 
 * Desktop: Staff list + selected staff's attendance calendar
 * Mobile: List + bottom sheet for attendance detail
 */

import { useState } from "react";
import { LMasterDetailLayout } from "@/components/layout/LMasterDetailLayout";
import { LBottomSheet, LPageLoader } from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStaff } from "@/hooks/use-staff";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useTranslation } from "react-i18next";
import { AttendanceStaffList } from "./AttendanceStaffList";
import { AttendanceDetailPanel } from "./AttendanceDetailPanel";

export function AttendancePageMasterDetail() {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const { loading } = useStaff();
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

    // Use minimum loading duration to show animation properly
    const showLoading = useMinLoading(loading, { minDuration: 700 });

    const handleStaffSelect = (id: string) => {
        setSelectedStaffId(id);
    };

    const handleClose = () => {
        setSelectedStaffId(null);
    };

    // Show page loader while initial data loads
    if (showLoading) {
        return (
            <div className="h-full">
                <LPageLoader variant="machine" message={t('attendance.loading')} />
            </div>
        );
    }

    return (
        <>
            <LMasterDetailLayout
                listPanel={
                    <AttendanceStaffList
                        selectedId={selectedStaffId}
                        onSelect={handleStaffSelect}
                    />
                }
                detailPanel={
                    selectedStaffId && (
                        <AttendanceDetailPanel
                            staffId={selectedStaffId}
                            onClose={handleClose}
                        />
                    )
                }
                selectedId={selectedStaffId}
                adPosition="attendance-sidebar"
            />
            
            {/* Mobile: Show detail in bottom sheet */}
            {isMobile && (
                <LBottomSheet
                    open={!!selectedStaffId}
                    onClose={handleClose}
                    title="Attendance"
                    snapPoints={[0.95]}
                >
                    {selectedStaffId && (
                        <AttendanceDetailPanel
                            staffId={selectedStaffId}
                            onClose={handleClose}
                        />
                    )}
                </LBottomSheet>
            )}
        </>
    );
}
