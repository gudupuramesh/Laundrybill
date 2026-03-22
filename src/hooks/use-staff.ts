import { useState, useEffect, useCallback } from "react";
import {
    collection,
    query,
    orderBy,
    where,
    getDocs,
    getDoc,
    doc,
    addDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import type { Staff, PayrollEntry, Attendance, AttendanceStatus } from "@/types/staff";
import { format } from "date-fns";

// Staff hook - fetches staff list from Firestore
export function useStaff() {
    const { shopId } = useAuth();
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "shops", shopId, "staff"),
            orderBy("name", "asc")
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const staffList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Staff[];
                setStaff(staffList);
                setLoading(false);
            },
            (err) => {
                console.error("Staff fetch error:", err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [shopId]);

    const activeStaff = staff.filter((s) => s.isActive);

    return {
        staff,
        activeStaff,
        loading,
        error,
    };
}

// Staff mutations hook - create, update, deactivate staff
export function useStaffMutations() {
    const { shopId } = useAuth();

    /** Create roster staff (attendance/payroll). No app login/invite. */
    const createStaff = async (
        data: Omit<Staff, "id" | "createdAt" | "updatedAt" | "inviteCode" | "inviteStatus" | "memberType">
    ): Promise<{ id: string }> => {
        if (!shopId) throw new Error("No shop ID");

        const staffRef = collection(db, "shops", shopId, "staff");
        const docRef = await addDoc(staffRef, {
            ...data,
            joiningDate: data.joiningDate || Timestamp.now(),
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        return { id: docRef.id };
    };

    const updateStaff = async (staffId: string, data: Partial<Staff>) => {
        if (!shopId) throw new Error("No shop ID");

        await updateDoc(doc(db, "shops", shopId, "staff", staffId), {
            ...data,
            updatedAt: serverTimestamp(),
        });
    };

    const deactivateStaff = async (staffId: string) => {
        if (!shopId) throw new Error("No shop ID");

        await updateDoc(doc(db, "shops", shopId, "staff", staffId), {
            isActive: false,
            updatedAt: serverTimestamp(),
        });
    };

    return {
        createStaff,
        updateStaff,
        deactivateStaff,
    };
}

// Payroll hook - fetches payroll entries for a month
export function usePayroll(month: string) {
    const { shopId } = useAuth();
    const [payroll, setPayroll] = useState<PayrollEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        const payrollRef = collection(db, `shops/${shopId}/payroll`);
        const q = query(payrollRef, where("month", "==", month));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as PayrollEntry[];
            setPayroll(docs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching payroll:", error);
            setLoading(false);
        });

        return unsubscribe;
    }, [shopId, month]);

    return { payroll, loading };
}

// Payroll mutations hook
export function usePayrollMutations() {
    const { shopId, user } = useAuth();

    // Generate new payroll or update existing draft
    const generatePayroll = async (
        staffId: string,
        staffName: string,
        monthStr: string,
        data: Partial<PayrollEntry>
    ) => {
        if (!shopId) return null;

        // Check if payroll already exists
        const q = query(
            collection(db, `shops/${shopId}/payroll`),
            where("staffId", "==", staffId),
            where("month", "==", monthStr)
        );
        const existing = await getDocs(q);

        const payrollData = {
            staffId,
            staffName,
            month: monthStr,
            ...data,
            totalPaid: 0,
            remainingAmount: data.netSalary || 0,
            payments: [],
            status: "draft",
            updatedAt: serverTimestamp(),
        };

        if (!existing.empty) {
            // Update existing draft
            const existingDoc = existing.docs[0];
            const existingData = existingDoc.data();

            // Only allow recalculation if status is draft
            if (existingData.status !== "draft") {
                throw new Error("Cannot recalculate payroll after payments have been made");
            }

            await updateDoc(existingDoc.ref, payrollData);
            return existingDoc.id;
        }

        // Create new
        const payrollRef = collection(db, `shops/${shopId}/payroll`);
        const docRef = await addDoc(payrollRef, {
            ...payrollData,
            createdAt: serverTimestamp(),
        });
        return docRef.id;
    };

    // Recalculate payroll (preserves payments and totalPaid; updates earned amounts from attendance)
    const recalculatePayroll = async (
        payrollId: string,
        data: Partial<PayrollEntry>
    ) => {
        if (!shopId) return;

        const payrollRef = doc(db, `shops/${shopId}/payroll/${payrollId}`);
        const payrollDoc = await getDoc(payrollRef);

        if (!payrollDoc.exists()) throw new Error("Payroll not found");

        const currentData = payrollDoc.data() as PayrollEntry;
        if (currentData.status === "paid" || currentData.status === "settlement") {
            throw new Error("Cannot recalculate a settled payroll");
        }

        const totalPaid = currentData.totalPaid || 0;
        const newNetSalary = data.netSalary ?? currentData.netSalary;
        const remainingAmount = newNetSalary - totalPaid;

        await updateDoc(payrollRef, {
            ...data,
            remainingAmount,
            updatedAt: serverTimestamp(),
        });
    };

    // Add payment to payroll
    const addPayment = async (
        payrollId: string,
        amount: number,
        mode: "cash" | "bank" | "upi",
        note?: string
    ) => {
        if (!shopId || !user) throw new Error("Not authenticated");

        const payrollRef = doc(db, `shops/${shopId}/payroll/${payrollId}`);
        const payrollDoc = await getDoc(payrollRef);

        if (!payrollDoc.exists()) throw new Error("Payroll not found");

        const currentData = payrollDoc.data() as PayrollEntry;
        const currentPayments = currentData.payments || [];
        const currentTotalPaid = currentData.totalPaid || 0;

        const newTotalPaid = currentTotalPaid + amount;
        const newRemaining = currentData.netSalary - newTotalPaid;
        const isAdvance = newTotalPaid > currentData.netSalary;

        const newPayment: Record<string, unknown> = {
            id: `payment_${Date.now()}`,
            amount,
            date: Timestamp.now(),
            mode,
            paidBy: user.displayName || user.email || "Unknown",
            type: isAdvance ? "advance" : "regular",
        };
        if (note != null && note !== "") {
            newPayment.note = note;
        }

        // Never auto-set status to "paid" - only Full Settlement does that
        await updateDoc(payrollRef, {
            payments: [...currentPayments, newPayment],
            totalPaid: newTotalPaid,
            remainingAmount: newRemaining,
            status: "partial",
            updatedAt: serverTimestamp(),
        });

        return newPayment;
    };

    /**
     * Full Settlement - Explicitly close payroll and enable payslip download.
     * Optionally override final amount (e.g. pay full salary despite absences).
     * Only this action sets status to "paid".
     */
    const performFullSettlement = async (
        payrollId: string,
        options: {
            mode?: "cash" | "bank" | "upi";
            note?: string;
            /** Override net salary (e.g. pay full amount despite deductions) */
            finalAmountOverride?: number;
        } = {}
    ) => {
        if (!shopId || !user) throw new Error("Not authenticated");

        const { mode = "cash", note, finalAmountOverride } = options;

        const payrollRef = doc(db, `shops/${shopId}/payroll/${payrollId}`);
        const payrollDoc = await getDoc(payrollRef);

        if (!payrollDoc.exists()) throw new Error("Payroll not found");

        const currentData = payrollDoc.data() as PayrollEntry;
        if (currentData.status === "paid" || currentData.status === "settlement") {
            throw new Error("Payroll is already settled");
        }

        const netSalary = finalAmountOverride ?? currentData.netSalary;
        const totalPaid = currentData.totalPaid || 0;
        const remainingToPay = netSalary - totalPaid;

        // If there's remaining to pay, add final payment first
        if (remainingToPay > 0) {
            const currentPayments = currentData.payments || [];
            const newPayment: Record<string, unknown> = {
                id: `payment_${Date.now()}`,
                amount: remainingToPay,
                date: Timestamp.now(),
                mode,
                paidBy: user.displayName || user.email || "Unknown",
                type: "regular",
            };
            if (note != null && note !== "") {
                newPayment.note = note;
            }

            await updateDoc(payrollRef, {
                payments: [...currentPayments, newPayment],
                totalPaid: totalPaid + remainingToPay,
                remainingAmount: 0,
                status: "paid",
                paidAt: serverTimestamp(),
                ...(finalAmountOverride != null && { netSalary: finalAmountOverride }),
                updatedAt: serverTimestamp(),
            });
        } else {
            // Already paid enough (incl. advances) - just mark as settled
            await updateDoc(payrollRef, {
                status: "paid",
                paidAt: serverTimestamp(),
                ...(finalAmountOverride != null && { netSalary: finalAmountOverride }),
                updatedAt: serverTimestamp(),
            });
        }
    };

    // Generate settlement for terminated staff
    const generateSettlement = async (
        staffId: string,
        staffName: string,
        data: {
            daysWorked: number;
            baseSalary: number;
            overtimeHours: number;
            overtimeAmount: number;
            bonus: number;
            deductions: number;
            noticePeriodDays?: number;
            noticePeriodAmount?: number;
            leaveEncashmentDays?: number;
            leaveEncashmentAmount?: number;
            gratuity?: number;
            settlementNote?: string;
        }
    ) => {
        if (!shopId) return null;

        const totalEarnings = data.baseSalary + data.overtimeAmount + data.bonus +
            (data.noticePeriodAmount || 0) + (data.leaveEncashmentAmount || 0) + (data.gratuity || 0);
        const totalDeductions = data.deductions;
        const netSalary = totalEarnings - totalDeductions;

        const settlementData = {
            staffId,
            staffName,
            month: format(new Date(), "yyyy-MM"),
            daysWorked: data.daysWorked,
            baseSalary: data.baseSalary,
            overtimeHours: data.overtimeHours,
            overtimeAmount: data.overtimeAmount,
            bonus: data.bonus,
            deductions: data.deductions,
            advances: 0,
            totalEarnings,
            totalDeductions,
            netSalary,
            totalPaid: 0,
            remainingAmount: netSalary,
            payments: [],
            status: "settlement" as const,
            isSettlement: true,
            settlementDate: serverTimestamp(),
            settlementNote: data.settlementNote,
            noticePeriodDays: data.noticePeriodDays,
            noticePeriodAmount: data.noticePeriodAmount,
            leaveEncashmentDays: data.leaveEncashmentDays,
            leaveEncashmentAmount: data.leaveEncashmentAmount,
            gratuity: data.gratuity,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        const payrollRef = collection(db, `shops/${shopId}/payroll`);
        const docRef = await addDoc(payrollRef, settlementData);
        return docRef.id;
    };

    // Update payroll fields (bonus, deductions, etc.)
    const updatePayroll = async (payrollId: string, data: Partial<PayrollEntry>) => {
        if (!shopId) return;

        const payrollRef = doc(db, `shops/${shopId}/payroll/${payrollId}`);
        const payrollDoc = await getDoc(payrollRef);

        if (!payrollDoc.exists()) throw new Error("Payroll not found");

        const current = payrollDoc.data() as PayrollEntry;

        // Recalculate totals if earnings/deductions changed (or use manual override)
        const bonus = data.bonus ?? current.bonus;
        const deductions = data.deductions ?? current.deductions;
        const advances = data.advances ?? current.advances;

        const totalEarnings = (data.totalEarnings ?? current.baseSalary + current.overtimeAmount + bonus);
        const totalDeductions = deductions + advances;
        const netSalary = data.netSalary ?? (totalEarnings - totalDeductions);
        const remainingAmount = netSalary - (current.totalPaid || 0);

        await updateDoc(payrollRef, {
            ...data,
            bonus,
            deductions,
            advances,
            totalEarnings,
            totalDeductions,
            netSalary,
            remainingAmount,
            updatedAt: serverTimestamp(),
        });
    };

    return {
        generatePayroll,
        recalculatePayroll,
        addPayment,
        performFullSettlement,
        markAsPaid: performFullSettlement,
        generateSettlement,
        updatePayroll,
    };
}

// Attendance hook - fetches attendance for a month
export function useAttendance(month: Date) {
    const { shopId } = useAuth();
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Get month range
    const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
    const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "shops", shopId, "attendance"),
            where("date", ">=", startStr),
            where("date", "<=", endStr),
            orderBy("date", "desc")
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const records = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Attendance[];
                setAttendance(records);
                setLoading(false);
            },
            (err) => {
                console.error("Attendance fetch error:", err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [shopId, startStr, endStr]);

    // Get attendance for specific staff
    const getStaffAttendance = useCallback(
        (staffId: string) => {
            return attendance.filter((a) => a.staffId === staffId);
        },
        [attendance]
    );

    // Get summary for staff
    const getStaffSummary = useCallback(
        (staffId: string) => {
            const records = attendance.filter((a) => a.staffId === staffId);
            return {
                present: records.filter((r) => r.status === "present").length,
                absent: records.filter((r) => r.status === "absent").length,
                half: records.filter((r) => r.status === "half").length,
                leave: records.filter((r) => r.status === "leave").length,
                holiday: records.filter((r) => r.status === "holiday").length,
                totalOvertime: records.reduce((sum, r) => sum + (r.overtime || 0), 0),
            };
        },
        [attendance]
    );

    return {
        attendance,
        loading,
        error,
        getStaffAttendance,
        getStaffSummary,
    };
}

// Attendance mutations hook
export function useAttendanceMutations() {
    const { shopId, user } = useAuth();

    const markAttendance = async (
        staffId: string,
        date: string,
        status: AttendanceStatus,
        overtime?: number,
        notes?: string
    ) => {
        if (!shopId || !user) throw new Error("Not authenticated");

        // Check if already marked
        const q = query(
            collection(db, "shops", shopId, "attendance"),
            where("staffId", "==", staffId),
            where("date", "==", date)
        );
        const existing = await getDocs(q);

        // Build data object, excluding undefined values (Firestore doesn't accept undefined)
        const baseData = {
            status,
            markedBy: user.uid,
            updatedAt: serverTimestamp(),
        };

        // Only add optional fields if they have values
        const optionalFields: Record<string, unknown> = {};
        if (overtime !== undefined) optionalFields.overtime = overtime;
        if (notes !== undefined) optionalFields.notes = notes;

        if (!existing.empty) {
            // Update existing
            await updateDoc(existing.docs[0].ref, {
                ...baseData,
                ...optionalFields,
            });
            return existing.docs[0].id;
        }

        // Create new
        const ref = collection(db, "shops", shopId, "attendance");
        const docRef = await addDoc(ref, {
            staffId,
            date,
            ...baseData,
            ...optionalFields,
            createdAt: serverTimestamp(),
        });

        return docRef.id;
    };

    const markBulkAttendance = async (
        records: {
            staffId: string;
            date: string;
            status: AttendanceStatus;
        }[]
    ) => {
        if (!shopId || !user) throw new Error("Not authenticated");

        const batch = writeBatch(db);

        for (const record of records) {
            // Check existing
            const q = query(
                collection(db, "shops", shopId, "attendance"),
                where("staffId", "==", record.staffId),
                where("date", "==", record.date)
            );
            const existing = await getDocs(q);

            if (!existing.empty) {
                batch.update(existing.docs[0].ref, {
                    status: record.status,
                    markedBy: user.uid,
                    updatedAt: serverTimestamp(),
                });
            } else {
                const ref = doc(collection(db, "shops", shopId, "attendance"));
                batch.set(ref, {
                    staffId: record.staffId,
                    date: record.date,
                    status: record.status,
                    markedBy: user.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }
        }

        await batch.commit();
    };

    return {
        markAttendance,
        markBulkAttendance,
    };
}
