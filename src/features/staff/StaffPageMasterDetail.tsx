/**
 * Staff Page (Master-Detail Layout)
 * 
 * Desktop: Side-by-side list + detail
 * Mobile: List + bottom sheet for staff detail
 */

import { useState, useMemo } from "react";
import { LMasterDetailLayout } from "@/components/layout/LMasterDetailLayout";
import { LBottomSheet, LPageLoader } from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStaff } from "@/hooks/use-staff";
import { useTeamMembers } from "@/hooks/use-team-members";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useTranslation } from "react-i18next";
import { StaffList } from "./StaffList";
import { StaffDetailPanel } from "./StaffDetailPanel";
import { TeamMemberDetailPanel } from "./TeamMemberDetailPanel";

export function StaffPageMasterDetail() {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const { loading } = useStaff();
    const { teamMembers } = useTeamMembers();
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const isTeamMember = useMemo(
        () => selectedId != null && teamMembers.some((tm) => tm.id === selectedId),
        [selectedId, teamMembers]
    );

    const showLoading = useMinLoading(loading, { minDuration: 700 });

    const handleSelect = (id: string) => {
        setSelectedId(id);
    };

    const handleClose = () => {
        setSelectedId(null);
    };

    const detailPanel = selectedId && (
        isTeamMember ? (
            <TeamMemberDetailPanel teamMemberId={selectedId} onClose={handleClose} />
        ) : (
            <StaffDetailPanel staffId={selectedId} onClose={handleClose} />
        )
    );

    if (showLoading) {
        return (
            <div className="h-full">
                <LPageLoader variant="machine" message={t('staff.loading')} />
            </div>
        );
    }

    return (
        <>
            <LMasterDetailLayout
                listPanel={
                    <StaffList
                        selectedId={selectedId}
                        onSelect={handleSelect}
                        onTabChange={() => setSelectedId(null)}
                    />
                }
                detailPanel={detailPanel}
                selectedId={selectedId}
                adPosition="staff-sidebar"
            />

            {isMobile && (
                <LBottomSheet
                    open={!!selectedId}
                    onClose={handleClose}
                    title={isTeamMember ? t("staff.appLoginDetails", "App Login Details") : t("staff.details", "Staff Details")}
                    snapPoints={[0.95]}
                >
                    {detailPanel}
                </LBottomSheet>
            )}
        </>
    );
}
