/**
 * Payroll Page — full-page list (design-system tokens).
 * List (KPIs + month stepper + table) → full-page payroll detail on select.
 */

import { useState } from "react";
import { LPageLoader } from "@/components/laundry";
import { useStaff } from "@/hooks/use-staff";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useTranslation } from "react-i18next";
import { PayrollStaffList } from "./PayrollStaffList";
import { PayrollDetailPanel } from "./PayrollDetailPanel";

export function PayrollPageMasterDetail() {
    const { t } = useTranslation();
    const { loading: staffLoading } = useStaff();
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const showLoading = useMinLoading(staffLoading, { minDuration: 700 });
    const handleClose = () => setSelectedStaffId(null);

    if (showLoading) {
        return <div className="h-full"><LPageLoader variant="cash" message={t("payroll.loading")} /></div>;
    }

    return (
        <div style={{ height: "100%", minHeight: 0 }}>
            {selectedStaffId ? (
                <div style={{ height: "100%", overflow: "auto", background: "var(--c-bg)" }}>
                    <PayrollDetailPanel staffId={selectedStaffId} month={currentMonth} onClose={handleClose} />
                </div>
            ) : (
                <PayrollStaffList selectedId={selectedStaffId} onSelect={setSelectedStaffId} currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
            )}
        </div>
    );
}
