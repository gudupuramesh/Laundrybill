/**
 * Attendance Staff List
 * 
 * Staff list panel for attendance master-detail layout
 */

import { useState } from "react";
import {
    LSearchInput,
    LList,
    LListItem,
    LAvatar,
    LEmptyState,
    LSkeletonList,
    LButton,
    LAdSlot,
    LHelpButton,
} from "@/components/laundry";
import { useStaff, useAttendance } from "@/hooks/use-staff";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, addMonths, subMonths } from "date-fns";
import { Users, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const AD_FREQUENCY = 6;

interface AttendanceStaffListProps {
    selectedId?: string | null;
    onSelect?: (staffId: string) => void;
}

export function AttendanceStaffList({ selectedId, onSelect }: AttendanceStaffListProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const [searchQuery, setSearchQuery] = useState("");
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const { activeStaff, loading } = useStaff();
    const { getStaffSummary } = useAttendance(currentMonth);

    const filteredStaff = activeStaff.filter((staff) =>
        staff.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-card p-4 space-y-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-foreground">{t('staff.attendance')}</h1>
                    <LHelpButton size="icon" />
                </div>

                {/* Month Selector */}
                <div className="flex items-center justify-center gap-2">
                    <LButton variant="ghost" size="icon-sm" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </LButton>
                    <span className="text-sm font-medium text-foreground min-w-[120px] text-center">
                        {format(currentMonth, "MMMM yyyy")}
                    </span>
                    <LButton variant="ghost" size="icon-sm" onClick={handleNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </LButton>
                </div>

                {/* Search */}
                <LSearchInput
                    placeholder={t('common.search')}
                    onChange={setSearchQuery}
                />
            </div>

            {/* Staff List */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <LSkeletonList count={6} />
                ) : filteredStaff.length === 0 ? (
                    <LEmptyState
                        icon={<Users className="h-8 w-8" />}
                        title={t('staff.noStaff')}
                        description={t('staff.addStaffFirst')}
                    />
                ) : (
                    <LList>
                        {filteredStaff.map((staff, index) => {
                            const summary = getStaffSummary(staff.id);
                            return (
                                <div key={staff.id}>
                                    <LListItem
                                        title={staff.name}
                                        subtitle={`${summary.present}P • ${summary.absent}A • ${summary.half}H • ${summary.leave}L`}
                                        leftContent={<LAvatar name={staff.name} size="md" />}
                                        rightContent={
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm font-medium text-success">
                                                    {summary.present}
                                                </span>
                                                <Check className="h-3 w-3 text-success" />
                                            </div>
                                        }
                                        onClick={() => onSelect?.(staff.id)}
                                        className={cn(
                                            "cursor-pointer transition-colors",
                                            selectedId === staff.id &&
                                            "bg-primary-muted border-l-4 border-l-primary"
                                        )}
                                    />
                                    {isMobile && (index + 1) % AD_FREQUENCY === 0 && (
                                        <LAdSlot variant="card" position={`attendance-list-${index + 1}`} />
                                    )}
                                </div>
                            );
                        })}
                    </LList>
                )}
            </div>
        </div>
    );
}
