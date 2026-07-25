/**
 * Franchise master dashboard — all shops in one view.
 *
 * Period-filtered financials per branch using the SAME semantics as the
 * single-shop Reports page (revenue = billed non-cancelled, profit = revenue −
 * expenses), combined totals, growth vs the previous period, and a ranked
 * "which branch is doing well" list. Tap a branch to switch into its dashboard.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useShopDailyStats } from "@/hooks/use-shop-daily-stats";
import { useFranchiseReport, type BranchReport } from "@/hooks/use-franchise-report";
import { useCurrency } from "@/hooks/use-currency";
import { normalizePlanId } from "@/types/plans";
import {
    startOfDay, startOfMonth, endOfMonth, subDays, subMonths, endOfDay,
} from "date-fns";
import {
    Plus, ChevronRight, TrendingUp, TrendingDown, Banknote, Receipt, PiggyBank,
    Trophy, AlertTriangle, Package, Clock,
} from "lucide-react";
import { LSpinner } from "@/components/laundry";

interface ShopRow {
    id: string;
    name: string;
    plan: string;
}

type PeriodKey = "today" | "7d" | "month" | "lastMonth";

const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7 days" },
    { key: "month", label: "This month" },
    { key: "lastMonth", label: "Last month" },
];

function periodRange(key: PeriodKey): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
    const now = new Date();
    switch (key) {
        case "today": {
            const start = startOfDay(now);
            return { start, end: now, prevStart: startOfDay(subDays(now, 1)), prevEnd: endOfDay(subDays(now, 1)) };
        }
        case "7d": {
            const start = startOfDay(subDays(now, 6));
            return { start, end: now, prevStart: startOfDay(subDays(now, 13)), prevEnd: endOfDay(subDays(now, 7)) };
        }
        case "month": {
            const start = startOfMonth(now);
            const prev = subMonths(now, 1);
            return { start, end: now, prevStart: startOfMonth(prev), prevEnd: endOfMonth(prev) };
        }
        case "lastMonth": {
            const prev = subMonths(now, 1);
            const prev2 = subMonths(now, 2);
            return { start: startOfMonth(prev), end: endOfMonth(prev), prevStart: startOfMonth(prev2), prevEnd: endOfMonth(prev2) };
        }
    }
}

export function AllShopsPage() {
    const { user, shopId, primaryShopId, switchShop } = useAuth();
    const { checkLimit } = useShopLimits();
    const { formatAmount } = useCurrency();
    const navigate = useNavigate();

    const [shops, setShops] = useState<ShopRow[] | null>(null);
    const [period, setPeriod] = useState<PeriodKey>("month");

    // Owned shops (rules: isShopOwner authorizes all of them).
    useEffect(() => {
        const uid = user?.uid;
        if (!uid) return;
        getDocs(query(collection(db, "shops"), where("ownerId", "==", uid)))
            .then((snap) => {
                const rows: ShopRow[] = snap.docs
                    .map((d) => {
                        const data = d.data() as { name?: string; plan?: string };
                        return { id: d.id, name: data.name || "My shop", plan: normalizePlanId(data.plan) };
                    })
                    .sort((a, b) => (a.id === primaryShopId ? -1 : b.id === primaryShopId ? 1 : a.name.localeCompare(b.name)));
                setShops(rows);
            })
            .catch(() => setShops([]));
    }, [user?.uid, primaryShopId]);

    const range = useMemo(() => periodRange(period), [period]);
    const { reports, loading: reportLoading } = useFranchiseReport(
        shops || [], range.start, range.end, range.prevStart, range.prevEnd,
    );

    // Combined totals + ranking by profit.
    const totals = useMemo(() => {
        const t = { orders: 0, revenue: 0, collected: 0, expenses: 0, profit: 0 };
        reports.forEach((r) => {
            t.orders += r.orders;
            t.revenue += r.revenue;
            t.collected += r.collected;
            t.expenses += r.expenses;
            t.profit += r.profit;
        });
        return t;
    }, [reports]);

    const ranked = useMemo(() => [...reports].sort((a, b) => b.profit - a.profit), [reports]);
    const maxRevenue = Math.max(1, ...reports.map((r) => r.revenue));

    const shopCheck = checkLimit("maxShops", shops?.length ?? 1);
    const canAdd = shopCheck.allowed;

    if (!shops) {
        return (
            <div className="flex items-center justify-center py-24">
                <LSpinner size="lg" />
            </div>
        );
    }

    const margin = totals.revenue > 0 ? Math.round((totals.profit / totals.revenue) * 100) : 0;

    return (
        <div className="mx-auto w-full max-w-4xl px-4 py-6">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-foreground">Franchise overview</h1>
                    <p className="text-sm text-muted-foreground">
                        {shops.length} shop{shops.length === 1 ? "" : "s"} · combined performance
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => (canAdd ? navigate("/shops/new") : navigate("/settings/subscription"))}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
                >
                    <Plus className="h-4 w-4" />
                    Add shop
                </button>
            </div>

            {!canAdd && (
                <div className="mb-4 rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                    Your plan covers {shopCheck.limit} shop{shopCheck.limit === 1 ? "" : "s"}. Upgrade to{" "}
                    <button className="font-semibold text-primary" onClick={() => navigate("/settings/subscription")}>
                        Franchise
                    </button>{" "}
                    to run more shops under one subscription.
                </div>
            )}

            {/* Period selector */}
            <div className="mb-4 flex flex-wrap gap-2">
                {PERIODS.map((p) => (
                    <button
                        key={p.key}
                        type="button"
                        onClick={() => setPeriod(p.key)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                            period === p.key
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "border border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Master KPIs */}
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi icon={TrendingUp} tint="text-primary" label="Revenue" value={formatAmount(totals.revenue)} sub={`${totals.orders} order${totals.orders === 1 ? "" : "s"}`} loading={reportLoading} />
                <Kpi icon={Banknote} tint="text-emerald-600" label="Collected" value={formatAmount(totals.collected)} sub={totals.revenue > 0 ? `${Math.round((totals.collected / totals.revenue) * 100)}% of billed` : "—"} loading={reportLoading} />
                <Kpi icon={Receipt} tint="text-amber-600" label="Expenses" value={formatAmount(totals.expenses)} sub="all shops" loading={reportLoading} />
                <Kpi icon={PiggyBank} tint={totals.profit >= 0 ? "text-emerald-600" : "text-red-600"} label="Net profit" value={formatAmount(totals.profit)} sub={`${margin}% margin`} loading={reportLoading} />
            </div>

            {/* Branch performance, ranked by profit */}
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Branch performance
            </p>
            <div className="flex flex-col gap-3 pb-8">
                {reportLoading && reports.length === 0 ? (
                    <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-10">
                        <LSpinner size="md" />
                    </div>
                ) : (
                    ranked.map((r, i) => (
                        <BranchRow
                            key={r.shopId}
                            report={r}
                            rank={i + 1}
                            isTop={i === 0 && ranked.length > 1 && r.profit > 0}
                            needsAttention={ranked.length > 1 && i === ranked.length - 1 && r.profit < ranked[0].profit && (r.profit < 0 || r.revenue < maxRevenue * 0.4)}
                            isActive={r.shopId === shopId}
                            isPrimary={r.shopId === primaryShopId}
                            revenueShare={r.revenue / maxRevenue}
                            formatAmount={formatAmount}
                            onOpen={() => {
                                switchShop(r.shopId);
                                navigate("/dashboard");
                            }}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function Kpi({ icon: Icon, tint, label, value, sub, loading }: {
    icon: typeof TrendingUp; tint: string; label: string; value: string; sub: string; loading: boolean;
}) {
    return (
        <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className={`h-3.5 w-3.5 ${tint}`} />
                {label}
            </div>
            <p className="mt-1.5 truncate text-lg font-bold text-foreground">{loading ? "…" : value}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{loading ? " " : sub}</p>
        </div>
    );
}

function BranchRow({
    report: r, rank, isTop, needsAttention, isActive, isPrimary, revenueShare, formatAmount, onOpen,
}: {
    report: BranchReport;
    rank: number;
    isTop: boolean;
    needsAttention: boolean;
    isActive: boolean;
    isPrimary: boolean;
    revenueShare: number;
    formatAmount: (n: number) => string;
    onOpen: () => void;
}) {
    // Live open-workload count (independent of the selected period).
    const live = useShopDailyStats(r.shopId);
    const growth = Math.round(r.growthPct);

    return (
        <button
            type="button"
            onClick={onOpen}
            className={`w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/60 ${
                isActive ? "border-primary" : "border-border"
            }`}
        >
            <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                    #{rank}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate font-semibold text-foreground">{r.name}</p>
                        {isPrimary && (
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Main</span>
                        )}
                        {isTop && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                <Trophy className="h-3 w-3" /> Top performer
                            </span>
                        )}
                        {needsAttention && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                <AlertTriangle className="h-3 w-3" /> Needs attention
                            </span>
                        )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{r.orders} orders</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{live.pendingOrders} in progress</span>
                        {r.prevRevenue > 0 && (
                            <span className={`inline-flex items-center gap-0.5 font-semibold ${growth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {growth >= 0 ? "+" : ""}{growth}%
                            </span>
                        )}
                    </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>

            {/* Financial strip */}
            <div className="mt-3 grid grid-cols-3 gap-2">
                <Metric label="Revenue" value={formatAmount(r.revenue)} />
                <Metric label="Expenses" value={formatAmount(r.expenses)} />
                <Metric label="Profit" value={formatAmount(r.profit)} valueClass={r.profit >= 0 ? "text-emerald-600" : "text-red-600"} />
            </div>

            {/* Revenue share bar */}
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.max(3, Math.round(revenueShare * 100))}%` }}
                />
            </div>
        </button>
    );
}

function Metric({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
    return (
        <div className="rounded-xl bg-muted/60 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={`mt-0.5 truncate text-sm font-bold ${valueClass || "text-foreground"}`}>{value}</p>
        </div>
    );
}

export default AllShopsPage;
