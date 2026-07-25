/**
 * Franchise master report — per-branch financials over a period, matching the
 * single-shop Reports semantics exactly (use-finance.ts):
 *   revenue     = Σ financials.total   of non-cancelled orders (createdAt range)
 *   collected   = Σ financials.amountPaid
 *   outstanding = Σ positive balances
 *   expenses    = Σ shops/{id}/expenses.amount (date range)
 *   profit      = revenue − expenses
 * Growth compares revenue with the equal-length previous period.
 * Explicit shop list (super-admin pattern) — authorized by rules' isShopOwner.
 */
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface BranchReport {
    shopId: string;
    name: string;
    orders: number;
    revenue: number;
    collected: number;
    outstanding: number;
    expenses: number;
    profit: number;
    avgOrder: number;
    /** Revenue in the previous equal-length period (growth base). */
    prevRevenue: number;
    /** Revenue growth vs previous period, % (0 when no base). */
    growthPct: number;
}

async function reportForShop(
    shopId: string,
    name: string,
    start: Date,
    end: Date,
    prevStart: Date,
    prevEnd: Date,
): Promise<BranchReport> {
    const ordersRef = collection(db, `shops/${shopId}/orders`);
    const expensesRef = collection(db, `shops/${shopId}/expenses`);

    const [ordersSnap, prevOrdersSnap, expensesSnap] = await Promise.all([
        getDocs(query(ordersRef, where("createdAt", ">=", Timestamp.fromDate(start)), where("createdAt", "<=", Timestamp.fromDate(end)))),
        getDocs(query(ordersRef, where("createdAt", ">=", Timestamp.fromDate(prevStart)), where("createdAt", "<=", Timestamp.fromDate(prevEnd)))),
        getDocs(query(expensesRef, where("date", ">=", Timestamp.fromDate(start)), where("date", "<=", Timestamp.fromDate(end)))),
    ]);

    let orders = 0;
    let revenue = 0;
    let collected = 0;
    let outstanding = 0;
    ordersSnap.docs.forEach((d) => {
        const o = d.data() as { status?: string; financials?: { total?: number; amountPaid?: number; balance?: number } };
        if (o.status === "cancelled") return;
        const total = o.financials?.total || 0;
        const paid = o.financials?.amountPaid || 0;
        const balance = o.financials?.balance ?? total - paid;
        orders += 1;
        revenue += total;
        collected += paid;
        outstanding += balance > 0 ? balance : 0;
    });

    let prevRevenue = 0;
    prevOrdersSnap.docs.forEach((d) => {
        const o = d.data() as { status?: string; financials?: { total?: number } };
        if (o.status === "cancelled") return;
        prevRevenue += o.financials?.total || 0;
    });

    let expenses = 0;
    expensesSnap.docs.forEach((d) => {
        expenses += (d.data() as { amount?: number }).amount || 0;
    });

    const profit = revenue - expenses;
    return {
        shopId,
        name,
        orders,
        revenue,
        collected,
        outstanding,
        expenses,
        profit,
        avgOrder: orders > 0 ? revenue / orders : 0,
        prevRevenue,
        growthPct: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
    };
}

export function useFranchiseReport(
    shops: { id: string; name: string }[],
    start: Date,
    end: Date,
    prevStart: Date,
    prevEnd: Date,
): { reports: BranchReport[]; loading: boolean } {
    const [reports, setReports] = useState<BranchReport[]>([]);
    const [loading, setLoading] = useState(true);

    const shopsKey = shops.map((s) => s.id).join(",");
    const rangeKey = `${start.getTime()}_${end.getTime()}`;

    useEffect(() => {
        if (!shops.length) {
            setReports([]);
            setLoading(false);
            return;
        }
        let alive = true;
        setLoading(true);
        Promise.all(shops.map((s) => reportForShop(s.id, s.name, start, end, prevStart, prevEnd)))
            .then((r) => {
                if (alive) setReports(r);
            })
            .catch((e) => {
                console.error("Franchise report failed:", e);
                if (alive) setReports([]);
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopsKey, rangeKey]);

    return { reports, loading };
}
