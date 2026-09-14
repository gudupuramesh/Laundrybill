/**
 * Payroll maths shared by the Payroll list, salary slip and detail page.
 * Monthly staff are paid per effective day over 26 working days; daily staff
 * per effective day. Half days count 0.5. Overtime uses the staff's rate or
 * 1.5× the hourly rate.
 */

import type { Attendance, PayrollEntry, Staff } from "@/types/staff";

export const WORKING_DAYS = 26;

export function calculatePayroll(staff: Staff, attendance: Attendance[]): Partial<PayrollEntry> {
    const a = attendance.filter((x) => x.staffId === staff.id);
    const daysPresent = a.filter((x) => x.status === "present").length;
    const daysAbsent = a.filter((x) => x.status === "absent").length;
    const daysHalf = a.filter((x) => x.status === "half").length;
    const daysLeave = a.filter((x) => x.status === "leave").length;
    const effectiveDays = daysPresent + daysHalf * 0.5;
    const baseSalary = staff.payType === "monthly" ? (staff.baseSalary / WORKING_DAYS) * effectiveDays : staff.baseSalary * effectiveDays;
    const overtimeHours = a.reduce((sum, x) => sum + (x.overtime || 0), 0);
    let overtimeAmount = 0;
    if (overtimeHours > 0) {
        const hourly = staff.payType === "monthly" ? staff.baseSalary / WORKING_DAYS / 8 : staff.baseSalary / 8;
        overtimeAmount = staff.overtimeRate && staff.overtimeRate > 0 ? overtimeHours * staff.overtimeRate : overtimeHours * hourly * 1.5;
    }
    const totalEarnings = Math.round(baseSalary + overtimeAmount);
    return {
        daysPresent, daysAbsent, daysHalf, daysLeave,
        daysWorked: Math.round(effectiveDays * 10) / 10,
        baseSalary: Math.round(baseSalary),
        overtimeHours,
        overtimeAmount: Math.round(overtimeAmount),
        bonus: 0, deductions: 0, advances: 0,
        totalEarnings, totalDeductions: 0, netSalary: totalEarnings,
    };
}

/** Advance payments recorded against a month (tagged by "Add advance"). */
export function advancePaid(entry?: PayrollEntry | null): number {
    return (entry?.payments || [])
        .filter((p) => p.type === "advance" || (p.note || "").toLowerCase() === ADVANCE_NOTE.toLowerCase())
        .reduce((s, p) => s + (p.amount || 0), 0);
}

export const ADVANCE_NOTE = "Advance";
