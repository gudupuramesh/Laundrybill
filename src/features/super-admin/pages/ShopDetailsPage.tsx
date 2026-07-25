/**
 * Super Admin – Shop Details Page (Phase 1 + 2 + 3)
 *
 * Full page when clicking a shop:
 * - Phase 1: Main details + order summary (this month, last month, overall).
 * - Phase 2: Service areas list + category/service analytics (most used, avg bill).
 * - Phase 3: Delivery map (OpenStreetMap) – pins by delivery/pickup location, filter by month & type.
 */

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, type DocumentData } from "firebase/firestore";
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
  Shield,
  ArrowDownToLine,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Receipt,
  History,
  Repeat,
} from "lucide-react";
import { format } from "date-fns";
import type { Shop } from "@/types/shop";
import type { PlanType } from "@/types/plans";
import { normalizePlanId } from "@/types/plans";
import { getCachedShop } from "../hooks/use-all-shops";
import { useShopOrderStats } from "../hooks/use-shop-order-stats";
import { useShopCategoryStats } from "../hooks/use-shop-category-stats";
import {
  useShopOrdersForMap,
  type MapMonthFilter,
  type MapDeliveryFilter,
} from "../hooks/use-shop-orders-for-map";
import { useMoveSubscriptionToFree, useOverridePlan } from "../hooks/use-subscriptions";
import { usePayments } from "../hooks/use-payments";
import { useShopSubscriptionEvents } from "../hooks/use-shop-subscription-events";
import { ACTIVITY_TYPE_CONFIG } from "../hooks/use-activity-logs";
import { monthlyPrice } from "../lib/subscription-events";
import { DeliveryMap } from "../components/DeliveryMap";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";

const PLAN_LABELS: Record<PlanType, string> = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro+",
  business: "Business",
  franchise: "Franchise",
};

const PLAN_COLORS: Record<PlanType, string> = {
  free: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pro: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  pro_plus: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  business: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  franchise: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

type ShopSub = { planId: PlanType; status: string; endDate?: Date };

/** Read a shop + its subscription from the shops-list session cache (for instant seed). */
function readSeed(id: string | undefined): { shop: Shop | null; sub: ShopSub | null } {
  const s = id ? getCachedShop(id) : undefined;
  return {
    shop: s ? (s as Shop) : null,
    sub: s?.subscription
      ? { planId: s.subscription.planId, status: s.subscription.status, endDate: s.subscription.endDate }
      : null,
  };
}

function tsToDate(v: unknown): Date | null {
  const d = (v as { toDate?: () => Date })?.toDate?.();
  if (d instanceof Date) return d;
  if (v instanceof Date) return v;
  return null;
}
const fmtDate = (v: unknown): string => {
  const d = tsToDate(v);
  return d ? format(d, "MMM d, yyyy") : "—";
};
const fmtDateTime = (v: unknown): string => {
  const d = tsToDate(v);
  return d ? format(d, "MMM d, yyyy · h:mm a") : "—";
};

function subProviderLabel(p?: string): string {
  switch (p) {
    case "apple_iap": return "Apple IAP";
    case "google_play": return "Google Play";
    case "razorpay": return "Razorpay";
    case "manual": return "Manual";
    case "free": return "—";
    default: return p || "—";
  }
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  refunded: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const TIMELINE_DOT_COLORS: Record<string, string> = {
  green: "bg-green-100 text-green-600",
  blue: "bg-blue-100 text-blue-600",
  purple: "bg-purple-100 text-purple-600",
  orange: "bg-orange-100 text-orange-600",
  red: "bg-red-100 text-red-600",
  gray: "bg-gray-100 text-gray-600",
};

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground mt-0.5 break-words">{value}</p>
    </div>
  );
}

export function ShopDetailsPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Seed from the shops-list session cache so opening a shop from the list is
  // instant — no full-screen loader. A cold load (direct URL) still fetches.
  const [shop, setShop] = useState<Shop | null>(() => readSeed(shopId).shop);
  const [sub, setSub] = useState<ShopSub | null>(() => readSeed(shopId).sub);
  const [subDoc, setSubDoc] = useState<DocumentData | null>(null); // full subscription doc for billing/history
  const [loading, setLoading] = useState(() => !readSeed(shopId).shop);

  // Plan management state
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overridePlanId, setOverridePlanId] = useState<PlanType>("pro");
  const [overrideEndDate, setOverrideEndDate] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [moveToFreeReason, setMoveToFreeReason] = useState("");
  const [showMoveToFreeConfirm, setShowMoveToFreeConfirm] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { moveToFree, loading: moveToFreeLoading, error: moveToFreeError } = useMoveSubscriptionToFree();
  const { overridePlan, loading: overrideLoading, error: overrideError } = useOverridePlan();

  // Billing history + audit timeline
  const { payments, loading: paymentsLoading } = usePayments({ shopId: shopId || undefined });
  const { events, loading: eventsLoading, refetch: refetchEvents } = useShopSubscriptionEvents(shopId ?? null);

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
    let cancelled = false;

    // Re-seed synchronously on shopId change so we never render the previous shop's
    // data under the new URL (the route reuses this component instance, no remount).
    const seed = readSeed(shopId);
    setShop(seed.shop);
    setSub(seed.sub);

    async function fetchShop() {
      if (!shopId) {
        setLoading(false);
        return;
      }
      // Only block on a true cold load; a cache-seeded page refreshes silently.
      setLoading(!seed.shop);
      try {
        const [shopSnap, subSnap] = await Promise.all([
          getDoc(doc(db, "shops", shopId)),
          getDoc(doc(db, "subscriptions", shopId)),
        ]);
        if (cancelled) return; // a newer shopId (or unmount) supersedes this fetch
        if (shopSnap.exists()) {
          setShop({ id: shopSnap.id, ...shopSnap.data() } as Shop);
        } else {
          setShop(null); // authoritative: the shop really doesn't exist
        }
        if (subSnap.exists()) {
          const d = subSnap.data();
          setSub({
            planId: normalizePlanId(d.planId),
            status: d.status || "active",
            endDate: d.endDate?.toDate?.() ?? undefined,
          });
          setSubDoc(d);
        } else {
          setSub(null);
          setSubDoc(null);
        }
      } catch {
        // Transient background-refresh failure: keep the already-seeded shop on
        // screen rather than wiping it to "Shop not found". A cold load stays empty.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchShop();

    return () => {
      cancelled = true;
    };
  }, [shopId]);

  if (!shopId) {
    return (
      <div className="p-4 md:p-6">
        <LButton variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(-1)}>
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
        <LButton variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(-1)}>
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
        onClick={() => navigate(-1)}
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
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={cn(
                    "inline-block px-2 py-0.5 rounded-full text-xs font-medium",
                    PLAN_COLORS[planId]
                  )}
                >
                  {PLAN_LABELS[planId]}
                </span>
                {sub?.status && (
                  <span
                    className={cn(
                      "inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                      sub.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : sub.status === "expired" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    )}
                  >
                    {sub.status}
                  </span>
                )}
              </div>
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

      {/* Plan management */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Plan management
        </h2>

        {actionSuccess && (
          <div className="mb-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {actionSuccess}
          </div>
        )}
        {(moveToFreeError || overrideError) && (
          <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {moveToFreeError || overrideError}
          </div>
        )}

        <LCard variant="outlined" className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="text-lg font-semibold">
                {PLAN_LABELS[planId]}{" "}
                <span className="text-sm font-normal text-muted-foreground capitalize">
                  ({sub?.status || "no subscription"})
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Move to Free button */}
            {planId !== "free" && (
              <LButton
                variant="outline"
                size="sm"
                leftIcon={<ArrowDownToLine className="h-4 w-4" />}
                onClick={() => {
                  setShowMoveToFreeConfirm(!showMoveToFreeConfirm);
                  setShowOverrideForm(false);
                  setActionSuccess(null);
                }}
                disabled={moveToFreeLoading}
              >
                Move to Free plan
              </LButton>
            )}

            {/* Override Plan button */}
            <LButton
              variant="outline"
              size="sm"
              leftIcon={<Shield className="h-4 w-4" />}
              onClick={() => {
                setShowOverrideForm(!showOverrideForm);
                setShowMoveToFreeConfirm(false);
                setActionSuccess(null);
              }}
              disabled={overrideLoading}
            >
              Override plan
            </LButton>
          </div>

          {/* Move to Free confirmation */}
          {showMoveToFreeConfirm && (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium text-foreground">
                Move <strong>{shop.name}</strong> to Free plan?
              </p>
              <p className="text-sm text-muted-foreground">
                This will clear trial status, set the plan to Free, and remove the end date.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={moveToFreeReason}
                  onChange={(e) => setMoveToFreeReason(e.target.value)}
                  placeholder="e.g. Trial ended, moving to free"
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                />
              </div>
              <div className="flex gap-2">
                <LButton
                  variant="primary"
                  size="sm"
                  loading={moveToFreeLoading}
                  onClick={async () => {
                    const result = await moveToFree(
                      shopId!,
                      shopId,
                      moveToFreeReason || "Admin: moved to free plan",
                      user?.uid || "super-admin"
                    );
                    if (result.success) {
                      setSub({ planId: "free", status: "free", endDate: undefined });
                      setShowMoveToFreeConfirm(false);
                      setMoveToFreeReason("");
                      setActionSuccess("Successfully moved to Free plan");
                      refetchEvents();
                    }
                  }}
                >
                  Confirm move to Free
                </LButton>
                <LButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMoveToFreeConfirm(false)}
                >
                  Cancel
                </LButton>
              </div>
            </div>
          )}

          {/* Override Plan form */}
          {showOverrideForm && (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium text-foreground">
                Override plan for <strong>{shop.name}</strong>
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">New plan</label>
                  <select
                    value={overridePlanId}
                    onChange={(e) => setOverridePlanId(e.target.value as PlanType)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="pro_plus">Pro+</option>
                    <option value="business">Business</option>
                    <option value="franchise">Franchise (multi-shop)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End date</label>
                  <input
                    type="date"
                    value={overrideEndDate}
                    onChange={(e) => setOverrideEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Gifted pro access, manual renewal"
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                />
              </div>
              <div className="flex gap-2">
                <LButton
                  variant="primary"
                  size="sm"
                  loading={overrideLoading}
                  disabled={!overrideEndDate || !overrideReason}
                  onClick={async () => {
                    const result = await overridePlan(
                      shopId!,
                      overridePlanId,
                      new Date(overrideEndDate),
                      overrideReason,
                      user?.uid || "super-admin",
                      shopId
                    );
                    if (result.success) {
                      setSub({
                        planId: overridePlanId,
                        status: "active",
                        endDate: new Date(overrideEndDate),
                      });
                      setShowOverrideForm(false);
                      setOverrideReason("");
                      setOverrideEndDate("");
                      setActionSuccess(`Plan overridden to ${PLAN_LABELS[overridePlanId]}`);
                      refetchEvents();
                    }
                  }}
                >
                  Apply override
                </LButton>
                <LButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOverrideForm(false)}
                >
                  Cancel
                </LButton>
              </div>
            </div>
          )}
        </LCard>
      </div>

      {/* Subscription & billing */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Subscription &amp; billing
          </h2>
          {subDoc?.provider && (
            <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground inline-flex items-center gap-1">
              <Repeat className="h-3 w-3" /> {subProviderLabel(subDoc.provider)}
            </span>
          )}
        </div>
        <LCard variant="outlined" className="p-4">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
            <Field label="Plan" value={PLAN_LABELS[planId]} />
            <Field label="Status" value={<span className="capitalize">{(sub?.status ?? "free").replace("_", " ")}</span>} />
            <Field
              label="Price"
              value={
                monthlyPrice(sub?.planId, subDoc?.billingCycle) > 0
                  ? `₹${monthlyPrice(sub?.planId, subDoc?.billingCycle).toLocaleString("en-IN")}/mo`
                  : "Free"
              }
            />
            <Field label="Billing cycle" value={<span className="capitalize">{subDoc?.billingCycle ?? "—"}</span>} />
            <Field label="Auto-renew" value={subDoc?.isAutoRenew ?? subDoc?.autoRenew ? "On" : "Off"} />
            <Field label="Started" value={fmtDate(subDoc?.startDate)} />
            <Field label="Current period ends" value={fmtDate(subDoc?.currentPeriodEnd ?? sub?.endDate)} />
            <Field
              label={sub?.status === "cancelled" || sub?.status === "expired" ? "Access until" : "Renews / expires"}
              value={fmtDate(subDoc?.nextPaymentDate ?? subDoc?.activeUntil ?? sub?.endDate)}
            />
            <Field label="Last payment" value={fmtDate(subDoc?.lastPaymentDate)} />
            {subDoc?.providerRef && (
              <Field label="Gateway ref" value={<span className="font-mono text-xs">{subDoc.providerRef}</span>} />
            )}
          </div>

          {sub?.status === "trial" && (
            <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300">
              Trial — {subDoc?.trialOrdersUsed ?? 0}/{subDoc?.trialOrderLimit ?? "?"} orders used · ends {fmtDate(subDoc?.trialEndDate)}
            </div>
          )}
          {subDoc?.lastPurchaseError && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {String(subDoc.lastPurchaseError)}
            </div>
          )}
          {subDoc?.manualOverride && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              Last manual override by {subDoc.manualOverride.overriddenBy || "admin"} on {fmtDate(subDoc.manualOverride.overriddenAt)}
              {subDoc.manualOverride.reason ? ` — ${subDoc.manualOverride.reason}` : ""}
            </div>
          )}
        </LCard>
      </div>

      {/* Payment history */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Payment history
        </h2>
        <LCard variant="outlined" className="overflow-hidden">
          {paymentsLoading ? (
            <div className="p-8 flex justify-center">
              <LSpinner className="h-6 w-6" />
            </div>
          ) : payments.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No payments recorded for this shop yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="font-medium p-3">Date</th>
                    <th className="font-medium p-3">Plan</th>
                    <th className="font-medium p-3 text-right">Amount</th>
                    <th className="font-medium p-3">Method</th>
                    <th className="font-medium p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{fmtDate(p.createdAt)}</td>
                      <td className="p-3">{PLAN_LABELS[normalizePlanId(p.planId)]}</td>
                      <td className="p-3 text-right font-medium text-foreground whitespace-nowrap">
                        ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3 capitalize text-muted-foreground whitespace-nowrap">{subProviderLabel(p.method)}</td>
                      <td className="p-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium capitalize", PAYMENT_STATUS_COLORS[p.status] || PAYMENT_STATUS_COLORS.pending)}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </LCard>
      </div>

      {/* Subscription history timeline */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <History className="h-5 w-5" />
          Subscription history
        </h2>
        <LCard variant="outlined" className="p-4">
          {eventsLoading ? (
            <div className="p-4 flex justify-center">
              <LSpinner className="h-6 w-6" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No plan changes recorded yet. New subscription events (overrides, renewals, cancellations) will appear here.
            </p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-1 bottom-1 w-0.5 bg-border" />
              <div className="space-y-4">
                {events.map((e) => {
                  const cfg = ACTIVITY_TYPE_CONFIG[e.type] || { label: e.type, color: "gray" };
                  return (
                    <div key={e.id} className="relative flex gap-3 pl-1">
                      <div className={cn("relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0", TIMELINE_DOT_COLORS[cfg.color] || TIMELINE_DOT_COLORS.gray)}>
                        <Repeat className="h-3 w-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">{e.description || cfg.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmtDateTime(e.createdAt)}
                          {e.superAdminId ? " · admin" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </LCard>
      </div>

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
