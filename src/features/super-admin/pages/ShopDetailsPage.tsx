/**
 * Super Admin – Shop Details Page (Phase 1 + 2 + 3)
 *
 * Full page when clicking a shop:
 * - Phase 1: Main details + order summary (this month, last month, overall).
 * - Phase 2: Service areas list + category/service analytics (most used, avg bill).
 * - Phase 3: Delivery map (OpenStreetMap) – pins by delivery/pickup location, filter by month & type.
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  LCard,
  LButton,
  LPageLoader,
  LSpinner,
  LSelect,
} from "@/components/laundry";
import {
  Store,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  ArrowLeft,
  ShoppingBag,
  IndianRupee,
  MapPinned,
  BarChart3,
  Map,
} from "lucide-react";
import { format } from "date-fns";
import type { Shop } from "@/types/shop";
import type { PlanType } from "@/types/plans";
import { useShopOrderStats } from "../hooks/use-shop-order-stats";
import { useShopCategoryStats } from "../hooks/use-shop-category-stats";
import {
  useShopOrdersForMap,
  type MapMonthFilter,
  type MapDeliveryFilter,
} from "../hooks/use-shop-orders-for-map";
import { DeliveryMap } from "../components/DeliveryMap";
import { cn } from "@/lib/utils";

const PLAN_LABELS: Record<PlanType, string> = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro Plus",
  business: "Business",
};

const PLAN_COLORS: Record<PlanType, string> = {
  free: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pro: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  pro_plus: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  business: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function ShopDetailsPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [sub, setSub] = useState<{ planId: PlanType; status: string; endDate?: Date } | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    thisMonth,
    lastMonth,
    overall,
    loading: statsLoading,
    error: statsError,
  } = useShopOrderStats(shopId ?? null);

  const {
    byCategory,
    overallAvgOrderValue,
    totalOrders: categoryOrderCount,
    loading: categoryLoading,
    error: categoryError,
  } = useShopCategoryStats(shopId ?? null);

  const [mapMonth, setMapMonth] = useState<MapMonthFilter>("all");
  const [mapDeliveryType, setMapDeliveryType] = useState<MapDeliveryFilter>("all");
  const [mapServiceFilter, setMapServiceFilter] = useState<string>("all");
  const {
    pins: mapPins,
    loading: mapLoading,
    error: mapError,
  } = useShopOrdersForMap(shopId ?? null, {
    month: mapMonth,
    deliveryType: mapDeliveryType,
  });

  // Service filter: unique category names from current pins; filter pins by selected service
  const mapServiceOptions = useMemo(() => {
    const set = new Set<string>();
    mapPins.forEach((p) => p.categoryNames.forEach((c) => set.add(c)));
    return [{ value: "all", label: "All services" }, ...Array.from(set).sort().map((c) => ({ value: c, label: c }))];
  }, [mapPins]);
  const filteredMapPins = useMemo(() => {
    if (mapServiceFilter === "all") return mapPins;
    return mapPins.filter((p) => p.categoryNames.includes(mapServiceFilter));
  }, [mapPins, mapServiceFilter]);

  // Reset service filter when selected option no longer exists (e.g. after changing period)
  useEffect(() => {
    if (mapServiceFilter !== "all" && !mapServiceOptions.some((o) => o.value === mapServiceFilter)) {
      setMapServiceFilter("all");
    }
  }, [mapServiceOptions, mapServiceFilter]);

  useEffect(() => {
    async function fetchShop() {
      if (!shopId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [shopSnap, subSnap] = await Promise.all([
          getDoc(doc(db, "shops", shopId)),
          getDoc(doc(db, "subscriptions", shopId)),
        ]);
        if (shopSnap.exists()) {
          setShop({ id: shopSnap.id, ...shopSnap.data() } as Shop);
        } else {
          setShop(null);
        }
        if (subSnap.exists()) {
          const d = subSnap.data();
          setSub({
            planId: (d.planId as PlanType) || "free",
            status: d.status || "active",
            endDate: d.endDate?.toDate?.() ?? undefined,
          });
        } else {
          setSub(null);
        }
      } catch {
        setShop(null);
        setSub(null);
      } finally {
        setLoading(false);
      }
    }
    fetchShop();
  }, [shopId]);

  if (!shopId) {
    return (
      <div className="p-4 md:p-6">
        <LButton variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/super-admin/shops")}>
          Back to Shops
        </LButton>
        <p className="mt-4 text-muted-foreground">No shop selected.</p>
      </div>
    );
  }

  if (loading && !shop) {
    return <LPageLoader message="Loading shop..." />;
  }

  if (!shop) {
    return (
      <div className="p-4 md:p-6">
        <LButton variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/super-admin/shops")}>
          Back to Shops
        </LButton>
        <p className="mt-4 text-destructive">Shop not found.</p>
      </div>
    );
  }

  const planId = sub?.planId ?? "free";

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <LButton
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft className="h-4 w-4" />}
        onClick={() => navigate("/super-admin/shops")}
      >
        Back to Shops
      </LButton>

      {/* Main details */}
      <LCard variant="outlined" className="p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-foreground">
                {shop.name || "Unnamed Shop"}
              </h1>
              <span
                className={cn(
                  "inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium",
                  PLAN_COLORS[planId]
                )}
              >
                {PLAN_LABELS[planId]}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {shop.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <a href={`mailto:${shop.email}`} className="text-primary hover:underline truncate">
                {shop.email}
              </a>
            </div>
          )}
          {shop.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" />
              <span>{shop.phone}</span>
            </div>
          )}
          {shop.location?.address && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground sm:col-span-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {shop.location.address}
                {shop.location.city && `, ${shop.location.city}`}
                {shop.location.state && ` ${shop.location.state}`}
                {shop.location.pincode && ` - ${shop.location.pincode}`}
              </span>
            </div>
          )}
          {shop.createdAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Joined {format(shop.createdAt?.toDate?.() ?? new Date(), "MMM d, yyyy")}</span>
            </div>
          )}
          {sub?.endDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span>Plan ends {format(sub.endDate, "MMM d, yyyy")}</span>
            </div>
          )}
        </div>
      </LCard>

      {/* Order summary */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Order summary
        </h2>
        {statsError && (
          <p className="text-sm text-destructive mb-3">{statsError}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <LCard variant="outlined" className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              This month
            </p>
            {statsLoading ? (
              <LSpinner className="h-6 w-6 mt-2" />
            ) : (
              <>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {thisMonth.count}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <IndianRupee className="h-3.5 w-3.5" />
                  {formatAmount(thisMonth.totalAmount)} total
                </p>
              </>
            )}
          </LCard>
          <LCard variant="outlined" className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Last month
            </p>
            {statsLoading ? (
              <LSpinner className="h-6 w-6 mt-2" />
            ) : (
              <>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {lastMonth.count}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <IndianRupee className="h-3.5 w-3.5" />
                  {formatAmount(lastMonth.totalAmount)} total
                </p>
              </>
            )}
          </LCard>
          <LCard variant="outlined" className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Overall
            </p>
            {statsLoading ? (
              <LSpinner className="h-6 w-6 mt-2" />
            ) : (
              <>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {overall.count}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <IndianRupee className="h-3.5 w-3.5" />
                  {formatAmount(overall.totalAmount)} total
                </p>
              </>
            )}
          </LCard>
        </div>
      </div>

      {/* Service areas */}
      {shop.settings?.delivery?.serviceAreas && shop.settings.delivery.serviceAreas.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <MapPinned className="h-5 w-5" />
            Service areas
          </h2>
          <LCard variant="outlined" className="p-4">
            <ul className="flex flex-wrap gap-2">
              {shop.settings.delivery.serviceAreas.map((area) => (
                <li
                  key={area.id}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm",
                    area.isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {area.value}
                  {!area.isActive && (
                    <span className="text-xs">(inactive)</span>
                  )}
                </li>
              ))}
            </ul>
          </LCard>
        </div>
      )}

      {/* Service / category analytics */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Services & average pricing
        </h2>
        {categoryError && (
          <p className="text-sm text-destructive mb-3">{categoryError}</p>
        )}
        <LCard variant="outlined" className="overflow-hidden">
          {categoryLoading ? (
            <div className="p-8 flex justify-center">
              <LSpinner className="h-8 w-8" />
            </div>
          ) : byCategory.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No order data yet to show category breakdown.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left font-medium p-3">Category</th>
                      <th className="text-right font-medium p-3">Orders</th>
                      <th className="text-right font-medium p-3">Total amount</th>
                      <th className="text-right font-medium p-3">Avg order value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCategory.map((row) => (
                      <tr key={row.categoryName} className="border-b border-border/50">
                        <td className="p-3 font-medium text-foreground">
                          {row.categoryName}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {row.orderCount}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {formatAmount(row.totalAmount)}
                        </td>
                        <td className="p-3 text-right font-medium text-foreground">
                          {formatAmount(row.avgOrderValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  Based on last {categoryOrderCount} orders
                </span>
                <span className="text-sm font-medium text-foreground">
                  Overall average bill: {formatAmount(overallAvgOrderValue)}
                </span>
              </div>
            </>
          )}
        </LCard>
      </div>

      {/* Delivery map (Phase 3) */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Map className="h-5 w-5" />
          Delivery map
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Orders with saved delivery/pickup location (Home delivery & Pickup & delivery).
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          <LSelect
            label="Period"
            value={mapMonth}
            onChange={(v) => setMapMonth(v as MapMonthFilter)}
            options={[
              { value: "all", label: "All time" },
              { value: "this", label: "This month" },
              { value: "last", label: "Last month" },
            ]}
            className="w-full sm:w-[140px]"
          />
          <LSelect
            label="Type"
            value={mapDeliveryType}
            onChange={(v) => setMapDeliveryType(v as MapDeliveryFilter)}
            options={[
              { value: "all", label: "All" },
              { value: "delivery_home", label: "Home delivery" },
              { value: "pickup_home", label: "Pickup & delivery" },
            ]}
            className="w-full sm:w-[160px]"
          />
          {mapServiceOptions.length > 1 && (
            <LSelect
              label="Service"
              value={mapServiceFilter}
              onChange={setMapServiceFilter}
              options={mapServiceOptions}
              className="w-full sm:w-[160px]"
            />
          )}
        </div>
        {mapError && (
          <p className="text-sm text-destructive mb-3">{mapError}</p>
        )}
        <LCard variant="outlined" className="p-0 overflow-hidden">
          {mapLoading ? (
            <div className="p-12 flex justify-center">
              <LSpinner className="h-8 w-8" />
            </div>
          ) : mapPins.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No orders with location in this period. Only orders that had a location saved at checkout appear here.
            </p>
          ) : filteredMapPins.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No orders for the selected service in this period. Try a different service or period.
            </p>
          ) : (
            <DeliveryMap pins={filteredMapPins} className="min-h-[320px]" />
          )}
        </LCard>
      </div>
    </div>
  );
}
