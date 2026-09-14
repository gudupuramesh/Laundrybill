/**
 * Staff Page — full-page list (design system "Staff").
 * Selecting a row shows the full-page detail panel (staff member or app login),
 * matching the DS isList → isDetail flow. No master-detail side panel.
 */

import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { LPageLoader } from "@/components/laundry";
import { useStaff } from "@/hooks/use-staff";
import { useTeamMembers } from "@/hooks/use-team-members";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useTranslation } from "react-i18next";
import { StaffList } from "./StaffList";
import { StaffDetailPanel } from "./StaffDetailPanel";
import { TeamMemberDetailPanel } from "./TeamMemberDetailPanel";

export function StaffPageMasterDetail() {
    const { t } = useTranslation();
    const { loading } = useStaff();
    const { teamMembers } = useTeamMembers();
    // ?id=<staffId> opens that person directly (e.g. from Attendance's row menu).
    const [searchParams] = useSearchParams();
    const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("id"));

    const isTeamMember = useMemo(
        () => selectedId != null && teamMembers.some((tm) => tm.id === selectedId),
        [selectedId, teamMembers]
    );

    const showLoading = useMinLoading(loading, { minDuration: 700 });
    const handleClose = () => setSelectedId(null);

    if (showLoading) {
        return <div className="h-full"><LPageLoader variant="machine" message={t("staff.loading")} /></div>;
    }

    return (
        <div style={{ height: "100%", minHeight: 0 }}>
            {selectedId ? (
                <div style={{ height: "100%", overflow: "auto", background: "var(--c-bg)" }}>
                    {isTeamMember
                        ? <TeamMemberDetailPanel teamMemberId={selectedId} onClose={handleClose} />
                        : <StaffDetailPanel staffId={selectedId} onClose={handleClose} />}
                </div>
            ) : (
                <StaffList onSelect={setSelectedId} onTabChange={handleClose} />
            )}
        </div>
    );
}
