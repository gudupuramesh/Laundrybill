/**
 * Attendance Detail Panel
 * 
 * Calendar view showing selected staff's attendance
 */

import { useState, useMemo } from "react";
import {
    LCard,
    LButton,
    LAvatar,
    LSpinner,
} from "@/components/laundry";
import { useStaff, useAttendance } from "@/hooks/use-staff";
import { AttendanceMarkSheet } from "./AttendanceMarkSheet";
import type { AttendanceStatus } from "@/types/staff";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getDay, isBefore, startOfDay } from "date-fns";
import { ArrowLeft, ChevronLeft, ChevronRight, Check, X, Clock, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const statusColors: Record<AttendanceStatus, string> = {
    present: "bg-success text-white",
    absent: "bg-destructive text-white",
    half: "bg-warning text-white",
    leave: "bg-primary text-white",
    holiday: "bg-muted text-muted-foreground",
};

const statusIcons: Record<AttendanceStatus, React.ReactNode> = {
    present: <Check className="h-3 w-3" />,
    absent: <X className="h-3 w-3" />,
    half: <Clock className="h-3 w-3" />,
    leave: <Calendar className="h-3 w-3" />,
    holiday: null,
};

interface AttendanceDetailPanelProps {
    staffId: string;
    onClose?: () => void;
}

export function AttendanceDetailPanel({ staffId, onClose }: AttendanceDetailPanelProps) {
    const { t } = useTranslation();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const { staff: staffList, loading: staffLoading } = useStaff();
    const { attendance, getStaffSummary } = useAttendance(currentMonth);

    const staff = useMemo(() =>
        staffList.find((s) => s.id === staffId),
        [staffList, staffId]
    );

    const staffAttendance = useMemo(() =>
        attendance.filter((a) => a.staffId === staffId),
        [attendance, staffId]
    );

    const summary = useMemo(() =>
        getStaffSummary(staffId),
        [getStaffSummary, staffId]
    );

    // Generate calendar days
    const calendarDays = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    const getAttendanceForDate = (date: Date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        return staffAttendance.find((a) => a.date === dateStr);
    };

    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
    };

    if (staffLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <LSpinner size="lg" />
            </div>
        );
    }

    if (!staff) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <p className="text-lg font-medium">{t('staff.notFound')}</p>
                <LButton variant="ghost" className="mt-4" onClick={onClose}>
                    {t('common.goBack')}
                </LButton>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
                <div className="flex items-center gap-4">
                    {onClose && (
                        <LButton variant="ghost" size="icon-sm" onClick={onClose}>
                            <ArrowLeft className="h-5 w-5" />
                        </LButton>
                    )}
                    <LAvatar name={staff.name} size="lg" />
                    <div>
                        <h1 className="text-xl font-bold text-foreground">{staff.name}</h1>
                        <p className="text-sm text-muted-foreground">{staff.phone}</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {/* Month Selector */}
                <div className="flex items-center justify-center gap-4">
                    <LButton variant="ghost" size="icon-sm" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-5 w-5" />
                    </LButton>
                    <span className="text-lg font-semibold text-foreground min-w-[150px] text-center">
                        {format(currentMonth, "MMMM yyyy")}
                    </span>
                    <LButton variant="ghost" size="icon-sm" onClick={handleNextMonth}>
                        <ChevronRight className="h-5 w-5" />
                    </LButton>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-2">
                    <LCard variant="filled" padding="sm" className="text-center">
                        <p className="text-2xl font-bold text-success">{summary.present}</p>
                        <p className="text-xs text-muted-foreground">{t('staff.present')}</p>
                    </LCard>
                    <LCard variant="filled" padding="sm" className="text-center">
                        <p className="text-2xl font-bold text-destructive">{summary.absent}</p>
                        <p className="text-xs text-muted-foreground">{t('staff.absent')}</p>
                    </LCard>
                    <LCard variant="filled" padding="sm" className="text-center">
                        <p className="text-2xl font-bold text-warning">{summary.half}</p>
                        <p className="text-xs text-muted-foreground">{t('staff.halfDay')}</p>
                    </LCard>
                    <LCard variant="filled" padding="sm" className="text-center">
                        <p className="text-2xl font-bold text-primary">{summary.leave}</p>
                        <p className="text-xs text-muted-foreground">{t('staff.leave')}</p>
                    </LCard>
                </div>

                {/* Calendar Grid */}
                <LCard variant="outlined" padding="md">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                            <div key={i} className="text-center text-xs font-medium text-muted-foreground py-1">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Instructions */}
                    <p className="text-xs text-center text-muted-foreground mb-3">
                        {t('payroll.tapToMark')}
                    </p>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Empty cells for offset */}
                        {Array.from({ length: getDay(startOfMonth(currentMonth)) }).map((_, i) => (
                            <div key={`empty-${i}`} className="aspect-square" />
                        ))}

                        {/* Actual days */}
                        {calendarDays.map((day) => {
                            const record = getAttendanceForDate(day);
                            const isSunday = getDay(day) === 0;
                            const today = startOfDay(new Date());
                            const dayStart = startOfDay(day);
                            const isPastOrToday = isBefore(dayStart, today) || dayStart.getTime() === today.getTime();
                            const isClickable = isPastOrToday; // Allow all past dates including Sundays

                            return (
                                <button
                                    key={day.toISOString()}
                                    type="button"
                                    disabled={!isClickable}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (!isClickable) return;
                                        handleDateClick(day);
                                    }}
                                    style={{ touchAction: 'manipulation' }}
                                    className={cn(
                                        "aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all select-none",
                                        "active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                        isToday(day) && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                                        isSunday && !record && "bg-orange-100 dark:bg-orange-900/20 text-orange-600",
                                        !isPastOrToday && "opacity-40 cursor-not-allowed bg-muted/30",
                                        record && statusColors[record.status],
                                        !record && isPastOrToday && !isSunday && "bg-card hover:bg-primary/20 active:bg-primary/30 border-2 border-dashed border-muted-foreground/30 cursor-pointer",
                                        !record && isPastOrToday && isSunday && "hover:bg-orange-200 dark:hover:bg-orange-800/30 cursor-pointer border-2 border-dashed border-orange-300"
                                    )}
                                >
                                    <span className="font-medium">{format(day, "d")}</span>
                                    {record && statusIcons[record.status]}
                                </button>
                            );
                        })}
                    </div>
                </LCard>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 justify-center text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-success" />
                        <span>{t('staff.present')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-destructive" />
                        <span>{t('staff.absent')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-warning" />
                        <span>{t('staff.halfDay')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-primary" />
                        <span>{t('staff.leave')}</span>
                    </div>
                </div>
            </div>

            {/* Attendance Mark Sheet */}
            {selectedDate && staff && (
                <AttendanceMarkSheet
                    open={!!selectedDate}
                    onClose={() => setSelectedDate(null)}
                    staffId={staff.id}
                    staffName={staff.name}
                    date={selectedDate}
                    currentStatus={getAttendanceForDate(selectedDate)?.status}
                    currentOvertime={getAttendanceForDate(selectedDate)?.overtime}
                    currentNotes={getAttendanceForDate(selectedDate)?.notes}
                />
            )}
        </div>
    );
}
