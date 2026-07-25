/**
 * All shops overview — one card per owned shop with today's orders, revenue,
 * and open workload, plus combined totals. Tapping a card switches the active
 * shop and opens its dashboard. Owner-only (multi-shop / franchise).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useShopDailyStats } from "@/hooks/use-shop-daily-stats";
import { useCurrency } from "@/hooks/use-currency";
import { normalizePlanId } from "@/types/plans";
import { Store, Plus, ChevronRight, Package, IndianRupee, Clock } from "lucide-react";
import { LSpinner } from "@/components/laundry";

interface ShopRow {
    id: string;
    name: string;
    plan: string;
    location?: string;
}

const PLAN_LABEL: Record<string, string> = {
    free: "Free",
    pro: "Pro",
    pro_plus: "Pro+",
    business: "Business",
    franchise: "Franchise",
};

export function AllShopsPage() {
    const { user, shopId, primaryShopId, switchShop } = useAuth();
    const { checkLimit } = useShopLimits();
    const navigate = useNavigate();
    const [shops, setShops] = useState<ShopRow[] | null>(null);

    useEffect(() => {
        const uid = user?.uid;
        if (!uid) return;
        getDocs(query(collection(db, "shops"), where("ownerId", "==", uid)))
            .then((snap) => {
                const rows: ShopRow[] = snap.docs
                    .map((d) => {
                        const data = d.data() as { name?: string; plan?: string; location?: { city?: string } | string };
                        const loc = typeof data.location === "string" ? data.location : data.location?.city;
                        return { id: d.id, name: data.name || "My shop", plan: normalizePlanId(data.plan), location: loc };
                    })
                    .sort((a, b) => (a.id === primaryShopId ? -1 : b.id === primaryShopId ? 1 : a.name.localeCompare(b.name)));
                setShops(rows);
            })
            .catch(() => setShops([]));
    }, [user?.uid, primaryShopId]);

    const shopCheck = checkLimit("maxShops", shops?.length ?? 1);
    const canAdd = shopCheck.allowed;

    if (!shops) {
        return (
            <div className="flex items-center justify-center py-24">
                <LSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-foreground">Your shops</h1>
                    <p className="text-sm text-muted-foreground">
                        {shops.length} shop{shops.length === 1 ? "" : "s"} · tap a shop to open its dashboard
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

            <div className="flex flex-col gap-3">
                {shops.map((s) => (
                    <ShopCard
                        key={s.id}
                        shop={s}
                        isActive={s.id === shopId}
                        isPrimary={s.id === primaryShopId}
                        onOpen={() => {
                            switchShop(s.id);
                            navigate("/dashboard");
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

function ShopCard({
    shop,
    isActive,
    isPrimary,
    onOpen,
}: {
    shop: ShopRow;
    isActive: boolean;
    isPrimary: boolean;
    onOpen: () => void;
}) {
    const stats = useShopDailyStats(shop.id);
    const { formatAmount } = useCurrency();

    return (
        <button
            type="button"
            onClick={onOpen}
            className={`w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/60 ${
                isActive ? "border-primary" : "border-border"
            }`}
        >
            <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Store className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-foreground">{shop.name}</p>
                        {isPrimary && (
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Main
                            </span>
                        )}
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            {PLAN_LABEL[shop.plan] || shop.plan}
                        </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                        {shop.location || (isActive ? "Currently open" : " ")}
                    </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
                <Metric icon={Package} label="Today" value={stats.loading ? "…" : String(stats.todayOrders)} />
                <Metric icon={IndianRupee} label="Collected" value={stats.loading ? "…" : formatAmount(stats.todayRevenue)} />
                <Metric icon={Clock} label="In progress" value={stats.loading ? "…" : String(stats.pendingOrders)} />
            </div>
        </button>
    );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string }) {
    return (
        <div className="rounded-xl bg-muted/60 px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3 w-3" />
                {label}
            </div>
            <p className="mt-0.5 truncate text-sm font-bold text-foreground">{value}</p>
        </div>
    );
}

export default AllShopsPage;
