/**
 * Attendance Mark Sheet
 * 
 * Shows status buttons (Present, Absent, Half, Leave) + Overtime hours input
 */

import { useState, useEffect } from "react";
import {
    LButton,
    LNumberInput,
    LTextInput,
} from "@/components/laundry";
import { LResponsiveDialog } from "@/components/laundry";
import { useAttendanceMutations } from "@/hooks/use-staff";
import type { AttendanceStatus } from "@/types/staff";
import { format } from "date-fns";
import { Check, X, Clock, Calendar, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceMarkSheetProps {
    open: boolean;
    onClose: () => void;
    staffId: string;
    staffName: string;
    date: Date;
    currentStatus?: AttendanceStatus;
    currentOvertime?: number;
    currentNotes?: string;
    onSuccess?: () => void;
}

const statusOptions: {
    value: AttendanceStatus;
    label: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
}[] = [
        {
            value: "present",
            label: "Present",
            icon: <Check className="h-5 w-5" />,
            color: "text-success",
            bgColor: "bg-success hover:bg-success/90",
        },
        {
            value: "absent",
            label: "Absent",
            icon: <X className="h-5 w-5" />,
            color: "text-destructive",
            bgColor: "bg-destructive hover:bg-destructive/90",
        },
        {
            value: "half",
            label: "Half Day",
            icon: <Clock className="h-5 w-5" />,
            color: "text-warning",
            bgColor: "bg-warning hover:bg-warning/90",
        },
        {
            value: "leave",
            label: "Leave",
            icon: <Calendar className="h-5 w-5" />,
            color: "text-primary",
            bgColor: "bg-primary hover:bg-primary/90",
        },
    ];

export function AttendanceMarkSheet({
    open,
    onClose,
    staffId,
    staffName,
    date,
    currentStatus,
    currentOvertime,
    currentNotes,
    onSuccess,
}: AttendanceMarkSheetProps) {
    const [saving, setSaving] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | null>(null);
    const [overtimeHours, setOvertimeHours] = useState(0);
    const [notes, setNotes] = useState("");
    const { markAttendance } = useAttendanceMutations();

    // Reset form when opened with new data
    useEffect(() => {
        if (open) {
            setSelectedStatus(currentStatus || null);
            setOvertimeHours(currentOvertime || 0);
            setNotes(currentNotes || "");
        }
    }, [open, currentStatus, currentOvertime, currentNotes]);

    const handleSave = async () => {
        if (!selectedStatus) return;

        setSaving(true);
        try {
            await markAttendance(
                staffId,
                format(date, "yyyy-MM-dd"),
                selectedStatus,
                overtimeHours > 0 ? overtimeHours : undefined,
                notes || undefined
            );
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error("Failed to mark attendance:", error);
            alert("Failed to save attendance. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const dateStr = format(date, "EEEE, d MMMM yyyy");
    const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title="Mark Attendance"
            size="sm"
            snapPoints={[0.6]}
        >
            <div className="p-4 space-y-4">
                {/* Date & Staff Info */}
                <div className="text-center">
                    <p className="text-lg font-semibold text-foreground">{dateStr}</p>
                    {isToday && (
                        <span className="text-xs text-primary font-medium">Today</span>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">{staffName}</p>
                </div>

                {/* Status Selection Buttons */}
                <div className="grid grid-cols-2 gap-3">
                    {statusOptions.map((option) => {
                        const isSelected = selectedStatus === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setSelectedStatus(option.value)}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all",
                                    isSelected
                                        ? `${option.bgColor} text-white border-transparent`
                                        : `bg-card ${option.color} border-border hover:border-current`
                                )}
                            >
                                {option.icon}
                                <span className="text-sm font-medium">{option.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Overtime Hours Input */}
                {(selectedStatus === "present" || selectedStatus === "half") && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-foreground">
                            <Timer className="h-5 w-5 text-warning" />
                            <span className="font-medium">Extra Work / Overtime</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <LNumberInput
                                    value={overtimeHours}
                                    onChange={setOvertimeHours}
                                    min={0}
                                    max={12}
                                    step={0.5}
                                    placeholder="0"
                                />
                            </div>
                            <span className="text-sm text-muted-foreground whitespace-nowrap">hours</span>
                        </div>
                        <div className="flex gap-2">
                            {[1, 2, 4, 8].map((h) => (
                                <button
                                    key={h}
                                    type="button"
                                    onClick={() => setOvertimeHours(h)}
                                    className={cn(
                                        "flex-1 py-1 text-xs rounded border transition-colors",
                                        overtimeHours === h
                                            ? "bg-warning text-white border-warning"
                                            : "bg-card border-border text-muted-foreground hover:border-warning"
                                    )}
                                >
                                    {h}h
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Overtime will be calculated at 1.5× hourly rate in payroll
                        </p>
                    </div>
                )}

                {/* Notes */}
                <LTextInput
                    label="Notes (Optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Worked night shift, Holiday work"
                />

                {/* Current Status Indicator */}
                {currentStatus && (
                    <p className="text-xs text-center text-muted-foreground">
                        Current: <span className="font-medium capitalize">{currentStatus}</span>
                        {currentOvertime ? ` + ${currentOvertime}h overtime` : ""}
                    </p>
                )}

                {/* Save Button */}
                <LButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleSave}
                    loading={saving}
                    disabled={!selectedStatus || saving}
                >
                    {saving ? "Saving..." : "Save Attendance"}
                </LButton>
            </div>
        </LResponsiveDialog>
    );
}
