/**
 * Finance Hooks for LaundryBoss
 * 
 * Expense tracking and financial reports
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    getDocs,
    Timestamp,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import type { Expense, ExpenseCategory } from "@/types/finance";

// ============================================
// EXPENSES HOOKS
// ============================================

export function useExpenses(month: Date) {
    const { shopId } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const startDate = startOfMonth(month);
    const endDate = endOfMonth(month);

    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, `shops/${shopId}/expenses`),
            where("date", ">=", Timestamp.fromDate(startDate)),
            where("date", "<=", Timestamp.fromDate(endDate)),
            orderBy("date", "desc")
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const expenseList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Expense[];

                setExpenses(expenseList);
                setLoading(false);
            },
            (err) => {
                console.error("Expenses fetch error:", err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [shopId, startDate.getTime(), endDate.getTime()]);

    // Group by category
    const byCategory = useMemo(() => {
        return expenses.reduce((acc, expense) => {
            if (!acc[expense.category]) {
                acc[expense.category] = [];
            }
            acc[expense.category].push(expense);
            return acc;
        }, {} as Record<ExpenseCategory, Expense[]>);
    }, [expenses]);

    // Calculate totals
    const totals = useMemo(() => {
        const total = expenses.reduce((sum, e) => sum + e.amount, 0);
        const byCat = Object.entries(byCategory).reduce((acc, [cat, items]) => {
            acc[cat as ExpenseCategory] = items.reduce((sum, e) => sum + e.amount, 0);
            return acc;
        }, {} as Record<ExpenseCategory, number>);

        return { total, byCategory: byCat };
    }, [expenses, byCategory]);

    const getExpense = useCallback((id: string) => {
        return expenses.find(e => e.id === id);
    }, [expenses]);

    return { expenses, loading, error, byCategory, totals, getExpense };
}

export function useExpenseMutations() {
    const { shopId, user } = useAuth();

    const createExpense = async (data: Partial<Expense>) => {
        if (!shopId || !user) throw new Error("Not authenticated");

        const ref = collection(db, `shops/${shopId}/expenses`);
        const expenseDate = data.date || Timestamp.now();
        const monthStr = format(expenseDate.toDate(), "yyyy-MM");

        const docRef = await addDoc(ref, {
            ...data,
            date: expenseDate,
            month: monthStr,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
        });

        return { id: docRef.id, ...data, date: expenseDate, month: monthStr } as Expense;
    };

    const updateExpense = async (expenseId: string, data: Partial<Expense>) => {
        if (!shopId) throw new Error("No shop ID");

        const expenseRef = doc(db, `shops/${shopId}/expenses/${expenseId}`);
        const updateData: any = { ...data };

        // Update month if date changed
        if (data.date) {
            updateData.month = format(data.date.toDate(), "yyyy-MM");
        }

        await updateDoc(expenseRef, updateData);
    };

    const deleteExpense = async (expenseId: string) => {
        if (!shopId) throw new Error("No shop ID");

        const expenseRef = doc(db, `shops/${shopId}/expenses/${expenseId}`);
        await deleteDoc(expenseRef);
    };

    return { createExpense, updateExpense, deleteExpense };
}

// ============================================
// FINANCIAL REPORTS HOOK
// ============================================

interface DailyRevenue {
    date: string;
    amount: number;
    count: number;
}

interface OrderStats {
    total: number;
    // By status
    orderPlaced: number;
    pickupScheduled: number;
    pickedUp: number;
    inProgress: number;
    readyForDelivery: number;
    outForDelivery: number;
    delivered: number;
    cancelled: number;
    // By delivery type
    pickupStore: number;
    pickupHome: number;
    deliveryHome: number;
    // Payment status
    paidOrders: number;
    unpaidOrders: number;
    partiallyPaid: number;
}

// Helper to get all months in range
function getMonthsInRange(start: Date, end: Date): string[] {
    const months: string[] = [];
    const current = new Date(start);
    // Set to 1st of month to avoid skipping feb if start is jan 30
    current.setDate(1);

    while (current <= end) {
        months.push(format(current, "yyyy-MM"));
        current.setMonth(current.getMonth() + 1);
    }
    // Check if end date's month is included (edge case where loop might stop before)
    const endMonth = format(end, "yyyy-MM");
    if (!months.includes(endMonth)) {
        months.push(endMonth);
    }
    return [...new Set(months)]; // Dedupe
}

interface StaffMetric {
    staffId: string;
    staffName: string;
    presentDays: number; // calculated from valid attendance
    salaryPaid: number; // actual amount paid in this period (from payroll)
    netSalary: number; // total liability in this period
}

interface FinancialReportsData {
    // Revenue
    revenue: number;
    orderCount: number;
    avgOrderValue: number;

    // Collections
    collections: number;
    outstanding: number;
    collectionRate: number;

    // Order breakdown
    orderStats: OrderStats;

    // Expenses (including salaries)
    totalExpenses: number;
    expensesByCategory: Record<string, number>;
    salariesPaid: number;

    // Profit
    profit: number;
    profitMargin: number;

    // Daily breakdown
    revenueByDay: DailyRevenue[];

    // New Metrics
    staffMetrics: StaffMetric[];
    customerStats: {
        newCustomers: number;
        totalCustomers: number;
    };

    // Loading state
    loading: boolean;
    error: string | null;
}

export function useFinancialReports(startDate: Date, endDate: Date): FinancialReportsData {
    const { shopId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [data, setData] = useState<Omit<FinancialReportsData, "loading" | "error">>({
        revenue: 0,
        orderCount: 0,
        avgOrderValue: 0,
        collections: 0,
        outstanding: 0,
        collectionRate: 0,
        orderStats: {
            total: 0,
            orderPlaced: 0,
            pickupScheduled: 0,
            pickedUp: 0,
            inProgress: 0,
            readyForDelivery: 0,
            outForDelivery: 0,
            delivered: 0,
            cancelled: 0,
            pickupStore: 0,
            pickupHome: 0,
            deliveryHome: 0,
            paidOrders: 0,
            unpaidOrders: 0,
            partiallyPaid: 0,
        },
        totalExpenses: 0,
        expensesByCategory: {},
        salariesPaid: 0,
        profit: 0,
        profitMargin: 0,
        revenueByDay: [],
        staffMetrics: [],
        customerStats: {
            newCustomers: 0,
            totalCustomers: 0,
        },
    });

    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                // 1. Fetch Orders
                const ordersQuery = query(
                    collection(db, `shops/${shopId}/orders`),
                    where("createdAt", ">=", Timestamp.fromDate(startDate)),
                    where("createdAt", "<=", Timestamp.fromDate(endDate)),
                    orderBy("createdAt", "desc")
                );

                const ordersSnapshot = await getDocs(ordersQuery);

                // Process Orders (Same logic as before)
                let revenue = 0;
                let collections = 0;
                let outstanding = 0;
                const dailyMap = new Map<string, { amount: number; count: number }>();
                const stats = {
                    total: ordersSnapshot.size,
                    orderPlaced: 0, pickupScheduled: 0, pickedUp: 0, inProgress: 0,
                    readyForDelivery: 0, outForDelivery: 0, delivered: 0, cancelled: 0,
                    pickupStore: 0, pickupHome: 0, deliveryHome: 0,
                    paidOrders: 0, unpaidOrders: 0, partiallyPaid: 0,
                };

                ordersSnapshot.docs.forEach((docSnap) => {
                    const order = docSnap.data();
                    const total = order.financials?.total || 0;
                    const paid = order.financials?.amountPaid || 0;
                    const balance = order.financials?.balance ?? (total - paid);
                    const status = order.status || "order_placed";
                    const deliveryType = order.deliveryType || "pickup_store";
                    const paymentStatus = order.paymentStatus || "unpaid";

                    const isCancelled = status === "cancelled";
                    if (!isCancelled) {
                        revenue += total;
                        collections += paid;
                        outstanding += balance > 0 ? balance : 0;
                    }

                    // Simple stats counting
                    if (status.includes("pending")) stats.orderPlaced++;
                    else if (status === "cancelled") stats.cancelled++;
                    else if (status === "delivered" || (status === "picked_up" && deliveryType === "pickup_store")) stats.delivered++;
                    else stats.inProgress++; // Simplified for brevity in grouping, but detailed mapping can remain if needed

                    // Detailed status map for correct count
                    switch (status) {
                        case "order_placed":
                        case "pending": stats.orderPlaced++; break;
                        case "pickup_scheduled": stats.pickupScheduled++; break;
                        case "picked_up":
                            stats.pickedUp++;
                            if (deliveryType === "pickup_store") stats.delivered++;
                            break;
                        case "in_progress": stats.inProgress++; break;
                        case "ready_for_delivery":
                        case "ready_for_pickup": stats.readyForDelivery++; break;
                        case "out_for_delivery": stats.outForDelivery++; break;
                        case "delivered": stats.delivered++; break;
                        case "cancelled": stats.cancelled--; break; // Offset simplified count
                    }
                    if (status === "cancelled") stats.cancelled++; // Re-add correct count

                    switch (deliveryType) {
                        case "pickup_store": stats.pickupStore++; break;
                        case "pickup_home": stats.pickupHome++; break;
                        case "delivery_home": stats.deliveryHome++; break;
                    }
                    switch (paymentStatus) {
                        case "paid": stats.paidOrders++; break;
                        case "partial": stats.partiallyPaid++; break;
                        default: stats.unpaidOrders++; break;
                    }

                    const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
                    const dateKey = format(orderDate, "yyyy-MM-dd");
                    if (!isCancelled) {
                        if (dailyMap.has(dateKey)) {
                            const existing = dailyMap.get(dateKey)!;
                            dailyMap.set(dateKey, { amount: existing.amount + total, count: existing.count + 1 });
                        } else {
                            dailyMap.set(dateKey, { amount: total, count: 1 });
                        }
                    }
                });

                const revenueByDay = Array.from(dailyMap.entries())
                    .map(([date, d]) => ({ date, ...d }))
                    .sort((a, b) => a.date.localeCompare(b.date));

                // 2. Fetch Expenses
                const expensesQuery = query(
                    collection(db, `shops/${shopId}/expenses`),
                    where("date", ">=", Timestamp.fromDate(startDate)),
                    where("date", "<=", Timestamp.fromDate(endDate))
                );
                const expensesSnapshot = await getDocs(expensesQuery);
                let totalExpenses = 0;
                const categoryMap: Record<string, number> = {};

                expensesSnapshot.docs.forEach((doc) => {
                    const e = doc.data();
                    const amt = e.amount || 0;
                    const cat = e.category || "miscellaneous";
                    totalExpenses += amt;
                    categoryMap[cat] = (categoryMap[cat] || 0) + amt;
                });

                // 3. Fetch Payroll (All months in range)
                const targetMonths = getMonthsInRange(startDate, endDate);
                const payrollRef = collection(db, `shops/${shopId}/payroll`);
                // Firestore "in" query limited to 10. If more, need to loop. Assuming <10 months usually.
                // If query fails (range too big), we catch and fallback to partial? safer to split.

                let payrollDocs: any[] = [];
                // Chunk months into groups of 10
                for (let i = 0; i < targetMonths.length; i += 10) {
                    const chunk = targetMonths.slice(i, i + 10);
                    if (chunk.length > 0) {
                        const q = query(payrollRef, where("month", "in", chunk)); // removed orderBy month to avoid index issues if not exists
                        const snap = await getDocs(q);
                        snap.forEach(d => payrollDocs.push(d.data()));
                    }
                }

                let totalSalaries = 0;
                const staffMap = new Map<string, StaffMetric>();

                payrollDocs.forEach(p => {
                    // Aggregate salaries
                    if (p.status === "paid" || p.status === "partial") {
                        totalSalaries += p.totalPaid || 0;
                    } // We consider actual paid amount for expense calc

                    // For staff metrics, we aggregate metrics per staff
                    const existing = staffMap.get(p.staffId) || {
                        staffId: p.staffId,
                        staffName: p.staffName,
                        presentDays: 0,
                        salaryPaid: 0,
                        netSalary: 0
                    };

                    existing.salaryPaid += p.totalPaid || 0;
                    existing.netSalary += p.netSalary || 0;
                    staffMap.set(p.staffId, existing);
                });

                // 4. Fetch Attendance (to calculate present days)
                // We query by date range
                const startStr = format(startDate, "yyyy-MM-dd");
                const endStr = format(endDate, "yyyy-MM-dd");

                const attQuery = query(
                    collection(db, `shops/${shopId}/attendance`),
                    where("date", ">=", startStr),
                    where("date", "<=", endStr)
                );
                const attSnapshot = await getDocs(attQuery);

                attSnapshot.forEach(doc => {
                    const att = doc.data();
                    const sid = att.staffId;
                    if (att.status === "present" || att.status === "half") {
                        // Assuming Half day counts as 0.5 or 1? Let's count days present (regardless of half)
                        // Or simplistic: Present = 1, Half = 0.5? Let's do simplistic count of "Attendance Days"
                        // User asked "how many days they came".
                        const value = att.status === "half" ? 0.5 : 1;

                        // We might not have staff in map if no payroll yet. Add if missing.
                        // Can't easily get name if not in payroll or attendance doc. 
                        // Attendance doc usually doesn't have name (uses ID). 
                        // We might rely on Payroll having the name, OR fetch staff names map efficiently.
                        // For now, if missing in Payroll map, we might miss the name if we don't fetch staff list.
                        // However, usually detailed reports show data for ACTIVE staff or those with payroll.
                        // Let's assume payroll exists or we skip name (or use ID as name fallback).

                        let metric = staffMap.get(sid);
                        if (!metric) {
                            metric = {
                                staffId: sid,
                                staffName: "Unknown Staff", // potentially fetch staff list to map names if crucial
                                presentDays: 0,
                                salaryPaid: 0,
                                netSalary: 0
                            };
                            // Try to look up staff name if easier? 
                            // Skipping separate staff fetch for perf unless needed.
                        }
                        metric.presentDays += value;
                        staffMap.set(sid, metric);
                    }
                });

                // If names are "Unknown Staff", we should probably fetch staff names quickly
                // 4b. Fetch Staff Names if needed
                const unknownStaffIds = Array.from(staffMap.values()).filter(s => s.staffName === "Unknown Staff").map(s => s.staffId);
                if (unknownStaffIds.length > 0) {
                    // Since we can't query "where id in ids" on collection easily (document IDs), we can fetch all staff once or fetch individually
                    // Given staff count is low (usually < 20), fetching all staff is cheap.
                    const staffRef = collection(db, `shops/${shopId}/staff`);
                    const staffSnap = await getDocs(staffRef); // cached mostly
                    const nameMap = new Map();
                    staffSnap.forEach(d => nameMap.set(d.id, d.data().name));

                    unknownStaffIds.forEach(id => {
                        const metric = staffMap.get(id);
                        if (metric) metric.staffName = nameMap.get(id) || "Unknown";
                    });
                }


                // 5. Fetch Customers (New vs Total)
                // Total Count:
                const customersColl = collection(db, `shops/${shopId}/customers`);
                const allCustSnap = await getDocs(customersColl); // Potentially expensive if 1000s users.
                // Optimization: getCountFromServer (lighter) if supported, but here using getDocs for simplicity with existing imports
                // For "New This Period":
                let newCustomers = 0;
                allCustSnap.forEach(d => {
                    const created = d.data().createdAt?.toDate?.();
                    if (created && created >= startDate && created <= endDate) {
                        newCustomers++;
                    }
                });

                const totalWithSalaries = totalExpenses + totalSalaries;
                const profit = revenue - totalWithSalaries;
                const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

                setData({
                    revenue,
                    orderCount: ordersSnapshot.size,
                    avgOrderValue: ordersSnapshot.size > 0 ? revenue / ordersSnapshot.size : 0,
                    collections,
                    outstanding,
                    collectionRate: revenue > 0 ? (collections / revenue) * 100 : 0,
                    orderStats: stats as OrderStats,
                    totalExpenses: totalWithSalaries,
                    expensesByCategory: { ...categoryMap, salary: totalSalaries },
                    salariesPaid: totalSalaries,
                    profit,
                    profitMargin,
                    revenueByDay,
                    staffMetrics: Array.from(staffMap.values()),
                    customerStats: {
                        newCustomers,
                        totalCustomers: allCustSnap.size
                    }
                });

                setLoading(false);

            } catch (err: any) {
                console.error("Reports Data Error:", err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchData();
    }, [shopId, startDate.getTime(), endDate.getTime()]); // deps as milestones

    return { ...data, loading, error };
}
