/**
 * Subscription Page (web) — Enterprise Laundry CRM design system.
 *
 * Read-only: shows the current plan, billing period, plan comparison.
 * Paid subscriptions are purchased only via the Android / iOS app
 * (Google Play / App Store) — the web surface never charges a card.
 */

import { useMemo, useState, useEffect, type CSSProperties } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { usePlans, filterActivePlans } from "@/features/super-admin/hooks/use-plans";
import { useShopSubscription } from "@/hooks/use-shop-subscription";
import { useCurrency } from "@/hooks/use-currency";
import { useIsMobile } from "@/hooks/use-mobile";
import { normalizePlanId, type Plan, type PlanType } from "@/types/plans";
import { LSpinner } from "@/components/laundry";
import { format } from "date-fns";
import {
    CreditCard,
    Check,
    Minus,
    Sparkles,
    Zap,
    Building2,
    Smartphone,
    CalendarClock,
} from "lucide-react";

const MONO = "'IBM Plex Mono'";

const GOOGLE_PLAY_URL =
    import.meta.env.VITE_GOOGLE_PLAY_URL || "https://play.google.com/store/apps";
const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL || "https://apps.apple.com";

const PLAN_ICON: Record<PlanType, typeof Sparkles> = {
    free: Sparkles,
    pro: Zap,
    pro_plus: Zap,
    business: Building2,
};

type Cycle = "monthly" | "yearly";

const priceOf = (plan: Plan, cycle: Cycle): number =>
    cycle === "yearly"
        ? plan.prices.yearly || Math.round(plan.prices.monthly * 12 * 0.8)
        : plan.prices.monthly;

const numLimit = (v: number): string => (v === -1 ? "Unlimited" : String(v));

export function SubscriptionPage() {
    const { plans, loading: plansLoading } = usePlans();
    const visiblePlans = useMemo(() => filterActivePlans(plans), [plans]);
    const { subscription, loading: subLoading } = useShopSubscription();
    const { formatAmount } = useCurrency();
    const isMobile = useIsMobile();

    const [cycle, setCycle] = useState<Cycle>("monthly");

    // Pro+ and Business are sales-assisted (contact-only) — no in-app price/purchase.
    const [waNumber, setWaNumber] = useState("919876543210");
    useEffect(() => {
        getDoc(doc(db, "platformSettings", "emailBranding"))
            .then((s) => { const n = s.data()?.whatsappNumber; if (n) setWaNumber(String(n)); })
            .catch(() => { /* keep default */ });
    }, []);
    const contactHref = (planName: string) =>
        `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
            `Hi, I'd like to upgrade to ${planName} (includes POS setup, staff training & guided onboarding).`
        )}`;

    const isLoading = plansLoading || subLoading;

    const status = subscription?.status;
    const isActiveSub =
        status === "active" ||
        status === "grace_period" ||
        (status === "cancelled" &&
            subscription?.activeUntil &&
            (typeof (subscription.activeUntil as { toDate?: () => Date })?.toDate === "function"
                ? (subscription.activeUntil as { toDate: () => Date }).toDate()
                : (subscription.activeUntil as Date)) > new Date());

    const currentPlanId: PlanType = isActiveSub ? normalizePlanId(subscription?.planId) : "free";
    const currentPlan =
        visiblePlans.find((p) => normalizePlanId(p.id) === currentPlanId) || visiblePlans[0];

    if (isLoading) {
        return (
            <div
                style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 14,
                    background: "var(--c-bg)",
                }}
            >
                <LSpinner size="lg" />
                <p style={{ color: "var(--c-text-3)", fontSize: 13 }}>Loading plans…</p>
            </div>
        );
    }

    const daysLeft = Math.max(0, subscription?.daysRemaining ?? 0);
    const periodDays = (subscription?.billingCycle || cycle) === "yearly" ? 365 : 30;
    const daysUsed = Math.min(periodDays, Math.max(0, periodDays - daysLeft));
    const usedPct = Math.round((daysUsed / periodDays) * 100);
    const showProgress = isActiveSub && currentPlanId !== "free" && subscription?.daysRemaining != null;

    const statusLabel =
        status === "active"
            ? "Active"
            : status === "grace_period"
              ? "Grace period"
              : status === "cancelled"
                ? "Cancelled"
                : status === "expired"
                  ? "Expired"
                  : "Free";
    const statusDot =
        status === "active"
            ? "var(--c-success)"
            : status === "expired"
              ? "var(--c-error)"
              : status === "cancelled" || status === "grace_period"
                ? "var(--c-warning)"
                : "var(--c-text-3)";

    const th: CSSProperties = {
        textAlign: "left",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: ".04em",
        color: "var(--c-text-3)",
        padding: "11px 14px",
        borderBottom: "1px solid var(--c-border)",
        whiteSpace: "nowrap",
    };
    const td: CSSProperties = {
        fontSize: 13,
        color: "var(--c-text)",
        padding: "11px 14px",
        borderBottom: "1px solid var(--c-border)",
        verticalAlign: "middle",
    };

    const featureRows: { label: string; kind: "num" | "bool"; get: (p: Plan) => number | boolean }[] = [
        { label: "Orders / month", kind: "num", get: (p) => p.limits.maxOrders },
        { label: "Customers", kind: "num", get: (p) => p.limits.maxCustomers },
        { label: "Staff accounts", kind: "num", get: (p) => p.limits.maxStaff },
        { label: "Services", kind: "num", get: (p) => p.limits.maxServices },
        { label: "Order tracking", kind: "bool", get: (p) => p.features.orderTracking },
        { label: "WhatsApp receipts", kind: "bool", get: (p) => p.features.whatsappReceipts },
        { label: "Staff management", kind: "bool", get: (p) => p.features.staffManagement },
        { label: "Attendance", kind: "bool", get: (p) => p.features.attendance },
        { label: "Payroll", kind: "bool", get: (p) => p.features.payroll },
        { label: "Expenses", kind: "bool", get: (p) => p.features.expenses },
        { label: "Reports & analytics", kind: "bool", get: (p) => p.features.reports },
        { label: "QR scans", kind: "bool", get: (p) => p.features.qrScans },
        { label: "Damage photos", kind: "bool", get: (p) => p.features.damagePhotos },
        { label: "Driver / Agent app", kind: "bool", get: (p) => p.features.driverApp },
        { label: "Plant dashboard", kind: "bool", get: (p) => p.features.plantApp },
        { label: "Public ordering page", kind: "bool", get: (p) => p.features.publicOrderingPage },
        { label: "Web dashboard", kind: "bool", get: (p) => p.features.webDashboard ?? false },
    ];

    const boolCell = (on: boolean) =>
        on ? (
            <Check size={16} style={{ color: "var(--c-success)" }} />
        ) : (
            <Minus size={15} style={{ color: "var(--c-text-3)" }} />
        );

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header */}
            <header
                style={{
                    flex: "none",
                    minHeight: 58,
                    background: "var(--c-surface)",
                    borderBottom: "1px solid var(--c-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: isMobile ? "wrap" : "nowrap",
                    gap: isMobile ? 10 : 14,
                    padding: isMobile ? "12px 16px" : "0 22px",
                }}
            >
                <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <span
                        style={{
                            width: 30,
                            height: 30,
                            flex: "none",
                            borderRadius: 8,
                            background: "var(--c-primary-soft)",
                            color: "var(--c-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <CreditCard size={17} />
                    </span>
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1.1 }}>
                            Subscription
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>Plans, billing &amp; usage</div>
                    </div>
                </div>

                {/* billing-cycle toggle */}
                <div
                    role="group"
                    aria-label="Billing cycle"
                    style={{
                        display: "inline-flex",
                        background: "var(--c-surface-2)",
                        border: "1px solid var(--c-border)",
                        borderRadius: 9,
                        padding: 3,
                    }}
                >
                    {(["monthly", "yearly"] as Cycle[]).map((c) => {
                        const on = cycle === c;
                        return (
                            <button
                                key={c}
                                onClick={() => setCycle(c)}
                                aria-pressed={on}
                                style={{
                                    cursor: "pointer",
                                    font: "inherit",
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    padding: "6px 14px",
                                    borderRadius: 7,
                                    border: 0,
                                    background: on ? "var(--c-surface)" : "transparent",
                                    color: on ? "var(--c-text)" : "var(--c-text-3)",
                                    boxShadow: on ? "var(--sh-sm)" : undefined,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                {c === "monthly" ? "Monthly" : "Yearly"}
                                {c === "yearly" && (
                                    <span
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: "var(--c-success)",
                                            background: "var(--c-success-soft)",
                                            borderRadius: 5,
                                            padding: "1px 5px",
                                        }}
                                    >
                                        −20%
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </header>

            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: isMobile ? "16px" : "22px", minHeight: 0 }}>
                <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* current plan banner */}
                    <div
                        style={{
                            position: "relative",
                            borderRadius: 16,
                            overflow: "hidden",
                            background: "linear-gradient(120deg,#14213D,#1A4FD6)",
                            color: "#fff",
                            padding: "22px 24px",
                            boxShadow: "var(--sh-md)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: 20,
                            }}
                        >
                            <div style={{ minWidth: 220 }}>
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                        letterSpacing: ".06em",
                                        color: "rgba(255,255,255,.7)",
                                    }}
                                >
                                    Current plan
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                                    <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.02em" }}>
                                        {currentPlan?.name || subscription?.planName || "Free Plan"}
                                    </span>
                                    <span
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 6,
                                            fontSize: 11.5,
                                            fontWeight: 600,
                                            background: "rgba(255,255,255,.16)",
                                            borderRadius: 999,
                                            padding: "3px 10px",
                                        }}
                                    >
                                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusDot }} />
                                        {statusLabel}
                                    </span>
                                </div>
                                <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 4 }}>
                                    <span style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO }}>
                                        {formatAmount(currentPlan ? priceOf(currentPlan, cycle) : 0)}
                                    </span>
                                    <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.7)" }}>
                                        / {cycle === "yearly" ? "yr" : "mo"}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
                                {subscription?.expiresAt && (
                                    <BannerStat
                                        label={status === "cancelled" ? "Access until" : "Renews on"}
                                        value={format(subscription.expiresAt, "MMM d, yyyy")}
                                    />
                                )}
                                {showProgress && <BannerStat label="Days left" value={`${daysLeft}`} mono />}
                                <BannerStat label="Orders used" value={`${subscription?.usage?.ordersThisMonth ?? 0}`} mono />
                                <BannerStat label="Customers" value={`${subscription?.usage?.totalCustomers ?? 0}`} mono />
                            </div>
                        </div>

                        {showProgress && (
                            <div style={{ marginTop: 18 }}>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: 11.5,
                                        color: "rgba(255,255,255,.75)",
                                        marginBottom: 6,
                                    }}
                                >
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                        <CalendarClock size={13} /> Billing period
                                    </span>
                                    <span style={{ fontFamily: MONO }}>
                                        {daysUsed} / {periodDays} days
                                    </span>
                                </div>
                                <div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,.2)", overflow: "hidden" }}>
                                    <div style={{ width: `${usedPct}%`, height: "100%", borderRadius: 999, background: "#fff" }} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* purchase-on-mobile notice */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: isMobile ? "wrap" : "nowrap",
                            gap: 12,
                            background: "var(--c-info-soft)",
                            border: "1px solid var(--c-info-soft)",
                            borderRadius: 12,
                            padding: "12px 16px",
                        }}
                    >
                        <span
                            style={{
                                width: 34,
                                height: 34,
                                flex: "none",
                                borderRadius: 9,
                                background: "var(--c-surface)",
                                color: "var(--c-info)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Smartphone size={17} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>Upgrades happen in the app</div>
                            <div style={{ fontSize: 12, color: "var(--c-text-2)", marginTop: 1 }}>
                                Billing runs through Google Play or the App Store. Open Subscription in the LaundryBill mobile app to
                                purchase or change a plan.
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flex: "none", width: isMobile ? "100%" : undefined }}>
                            <StoreBtn label="Google Play" onClick={() => window.open(GOOGLE_PLAY_URL, "_blank", "noopener,noreferrer")} />
                            <StoreBtn label="App Store" onClick={() => window.open(APP_STORE_URL, "_blank", "noopener,noreferrer")} />
                        </div>
                    </div>

                    {/* available plans */}
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text)", marginBottom: 12 }}>Available plans</div>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                                gap: 16,
                            }}
                        >
                            {visiblePlans.map((plan) => {
                                const id = normalizePlanId(plan.id);
                                const isCurrent = id === currentPlanId;
                                const popular = id === "pro";
                                const contactOnly = id === "pro_plus" || id === "business";
                                const Icon = PLAN_ICON[id] || Sparkles;
                                return (
                                    <div
                                        key={plan.id}
                                        style={{
                                            position: "relative",
                                            display: "flex",
                                            flexDirection: "column",
                                            background: "var(--c-surface)",
                                            border: `1.5px solid ${
                                                isCurrent ? "var(--c-primary)" : popular ? "var(--c-violet)" : "var(--c-border)"
                                            }`,
                                            borderRadius: 14,
                                            boxShadow: popular || isCurrent ? "var(--sh-md)" : "var(--sh-sm)",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {popular && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    top: 0,
                                                    right: 0,
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    letterSpacing: ".04em",
                                                    color: "#fff",
                                                    background: "var(--c-violet)",
                                                    padding: "4px 10px",
                                                    borderBottomLeftRadius: 10,
                                                }}
                                            >
                                                MOST POPULAR
                                            </div>
                                        )}

                                        <div style={{ padding: "20px 18px 0", flex: 1 }}>
                                            <span
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: 10,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    background: isCurrent ? "var(--c-primary-soft)" : "var(--c-surface-2)",
                                                    color: isCurrent ? "var(--c-primary)" : "var(--c-text-2)",
                                                }}
                                            >
                                                <Icon size={19} />
                                            </span>
                                            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 12 }}>{plan.name}</div>
                                            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 6 }}>
                                                {contactOnly ? (
                                                    <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.01em" }}>Contact us</span>
                                                ) : (
                                                    <>
                                                        <span style={{ fontSize: 26, fontWeight: 700, fontFamily: MONO, letterSpacing: "-.02em" }}>
                                                            {formatAmount(priceOf(plan, cycle))}
                                                        </span>
                                                        <span style={{ fontSize: 12.5, color: "var(--c-text-3)" }}>
                                                            / {cycle === "yearly" ? "yr" : "mo"}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 12.5,
                                                    color: "var(--c-text-2)",
                                                    marginTop: 8,
                                                    minHeight: 34,
                                                    lineHeight: 1.4,
                                                }}
                                            >
                                                {plan.description || "Full feature access on this tier."}
                                            </div>

                                            <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                                                <PlanFeat label={`${numLimit(plan.limits.maxOrders)} orders / mo`} on />
                                                <PlanFeat label={`${numLimit(plan.limits.maxCustomers)} customers`} on />
                                                <PlanFeat label={`${numLimit(plan.limits.maxStaff)} staff accounts`} on />
                                                <PlanFeat label="Reports & analytics" on={plan.features.reports} />
                                                <PlanFeat label="Driver / Agent app" on={plan.features.driverApp} />
                                                <PlanFeat label="Plant dashboard" on={plan.features.plantApp} />
                                                <PlanFeat label="Public ordering page" on={plan.features.publicOrderingPage} />
                                            </ul>
                                        </div>

                                        <div style={{ padding: 18, marginTop: 14 }}>
                                            {isCurrent ? (
                                                <button
                                                    disabled
                                                    style={{
                                                        width: "100%",
                                                        font: "inherit",
                                                        fontSize: 13.5,
                                                        fontWeight: 600,
                                                        color: "var(--c-primary)",
                                                        background: "var(--c-primary-soft)",
                                                        border: 0,
                                                        borderRadius: 10,
                                                        padding: "11px 0",
                                                        cursor: "default",
                                                    }}
                                                >
                                                    Current plan
                                                </button>
                                            ) : id === "free" ? (
                                                <div
                                                    style={{
                                                        width: "100%",
                                                        textAlign: "center",
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        color: "var(--c-success)",
                                                        background: "var(--c-success-soft)",
                                                        borderRadius: 10,
                                                        padding: "11px 0",
                                                    }}
                                                >
                                                    Free forever
                                                </div>
                                            ) : contactOnly ? (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                    <a
                                                        href={contactHref(plan.name)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            width: "100%",
                                                            textAlign: "center",
                                                            cursor: "pointer",
                                                            font: "inherit",
                                                            fontSize: 13.5,
                                                            fontWeight: 700,
                                                            color: "#fff",
                                                            background: "var(--c-success)",
                                                            borderRadius: 10,
                                                            padding: "11px 0",
                                                            textDecoration: "none",
                                                            boxShadow: "var(--sh-sm)",
                                                        }}
                                                    >
                                                        Contact on WhatsApp
                                                    </a>
                                                    <div style={{ fontSize: 11, color: "var(--c-text-3)", textAlign: "center", lineHeight: 1.4 }}>
                                                        Includes POS setup, staff training &amp; guided onboarding
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => window.open(GOOGLE_PLAY_URL, "_blank", "noopener,noreferrer")}
                                                    style={{
                                                        width: "100%",
                                                        cursor: "pointer",
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        gap: 8,
                                                        font: "inherit",
                                                        fontSize: 13.5,
                                                        fontWeight: 700,
                                                        color: "#fff",
                                                        background: "var(--c-primary)",
                                                        border: 0,
                                                        borderRadius: 10,
                                                        padding: "11px 0",
                                                        boxShadow: "var(--sh-sm)",
                                                    }}
                                                >
                                                    <Smartphone size={15} /> Get on the app
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* compare features */}
                    <div
                        style={{
                            background: "var(--c-surface)",
                            border: "1px solid var(--c-border)",
                            borderRadius: 14,
                            boxShadow: "var(--sh-sm)",
                            overflow: "hidden",
                        }}
                    >
                        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--c-border)", fontSize: 14, fontWeight: 700 }}>
                            Compare features
                        </div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...th, minWidth: 200 }}>Feature</th>
                                        {visiblePlans.map((p) => {
                                            const pid = normalizePlanId(p.id);
                                            const isCurrent = pid === currentPlanId;
                                            const pContactOnly = pid === "pro_plus" || pid === "business";
                                            return (
                                                <th key={p.id} style={{ ...th, textAlign: "center", color: isCurrent ? "var(--c-primary)" : "var(--c-text-2)" }}>
                                                    {p.name}
                                                    <div style={{ fontWeight: 600, fontSize: 11, color: "var(--c-text-3)", marginTop: 2, fontFamily: MONO, textTransform: "none", letterSpacing: 0 }}>
                                                        {pContactOnly ? "Contact us" : `${formatAmount(priceOf(p, cycle))}/${cycle === "yearly" ? "yr" : "mo"}`}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {featureRows.map((row) => (
                                        <tr key={row.label}>
                                            <td style={{ ...td, fontWeight: 500, color: "var(--c-text-2)" }}>{row.label}</td>
                                            {visiblePlans.map((p) => {
                                                const v = row.get(p);
                                                return (
                                                    <td key={p.id} style={{ ...td, textAlign: "center" }}>
                                                        {row.kind === "bool" ? (
                                                            <span style={{ display: "inline-flex", justifyContent: "center", width: "100%" }}>
                                                                {boolCell(Boolean(v))}
                                                            </span>
                                                        ) : (
                                                            <span style={{ fontFamily: MONO, fontSize: 12.5 }}>{numLimit(v as number)}</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BannerStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: "rgba(255,255,255,.65)" }}>
                {label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3, fontFamily: mono ? MONO : undefined }}>{value}</div>
        </div>
    );
}

function StoreBtn({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                cursor: "pointer",
                font: "inherit",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--c-text)",
                background: "var(--c-surface)",
                border: "1px solid var(--c-border-strong)",
                borderRadius: 8,
                padding: "7px 12px",
                whiteSpace: "nowrap",
            }}
        >
            {label}
        </button>
    );
}

function PlanFeat({ label, on }: { label: string; on: boolean }) {
    return (
        <li style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}>
            <span
                style={{
                    width: 18,
                    height: 18,
                    flex: "none",
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: on ? "var(--c-success-soft)" : "var(--c-surface-2)",
                    color: on ? "var(--c-success)" : "var(--c-text-3)",
                }}
            >
                {on ? <Check size={11} /> : <Minus size={11} />}
            </span>
            <span style={{ color: on ? "var(--c-text)" : "var(--c-text-3)", textDecoration: on ? "none" : "line-through" }}>
                {label}
            </span>
        </li>
    );
}
