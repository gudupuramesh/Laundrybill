/**
 * Subscription Page (web) — Enterprise Laundry CRM design system.
 *
 * Read-only: shows the current plan, billing period, plan comparison.
 * Paid subscriptions are purchased only via the Android / iOS app
 * (Google Play / App Store) — the web surface never charges a card.
 */

import { useMemo, useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { useTeamMembers } from "@/hooks/use-team-members";
import { db } from "@/lib/firebase";
import { usePlans, filterActivePlans } from "@/features/super-admin/hooks/use-plans";
import { useShopSubscription } from "@/hooks/use-shop-subscription";
import { useShop } from "@/hooks/use-shop";
import { useCurrency } from "@/hooks/use-currency";
import { useIsMobile } from "@/hooks/use-mobile";
import { normalizePlanId, type Plan, type PlanType } from "@/types/plans";
import { getTeamLoginCap } from "@/config/plans";
import { LSpinner, useLToast } from "@/components/laundry";
import { useAuth } from "@/features/auth/AuthContext";
import { startRazorpaySubscription } from "@/lib/razorpay-checkout";
import { format } from "date-fns";
import { Check, Store, Crown, Users, ChevronRight, ShieldCheck } from "lucide-react";
import { GOOGLE_PLAY_URL, APP_STORE_URL, detectMobileOS } from "@/config/app-links";

type Cycle = "monthly" | "yearly";

const priceOf = (plan: Plan, cycle: Cycle, intl: boolean): number => {
    const src = intl && plan.pricesIntl ? plan.pricesIntl : plan.prices;
    return cycle === "yearly"
        ? src.yearly || Math.round(src.monthly * 12 * 0.8)
        : src.monthly;
};

const numLimit = (v: number): string => (v === -1 ? "Unlimited" : String(v));

export function SubscriptionPage({ embedded }: { embedded?: boolean } = {}) {
    const { plans, loading: plansLoading } = usePlans();
    const visiblePlans = useMemo(() => filterActivePlans(plans), [plans]);
    const { subscription, loading: subLoading } = useShopSubscription();
    const { formatAmount } = useCurrency();
    const isMobile = useIsMobile();
    const { user, shopId, primaryShopId, ownedShops } = useAuth();
    const { teamMembers } = useTeamMembers();
    // Billing always targets the PRIMARY shop (multi-shop owners may be viewing
    // a child shop; child shops never carry their own paid subscription).
    const billingShopId = primaryShopId || shopId;
    const viewingChildShop = !!primaryShopId && !!shopId && shopId !== primaryShopId;
    const { shop } = useShop();
    const { addToast } = useLToast();

    // International shops (countryCode != IN) are billed in USD; India shops in INR.
    const isIntl = String(shop?.settings?.countryCode || "IN").toUpperCase() !== "IN";

    // Format a plan's price in the right currency: USD ($) for international plans that
    // have a USD tier, otherwise the shop's currency (₹) via formatAmount.
    const fmtPrice = (plan: Plan, c: Cycle): string => {
        const val = priceOf(plan, c, isIntl);
        return isIntl && plan.pricesIntl ? `$${val.toLocaleString("en-US")}` : formatAmount(val);
    };

    const [cycle, setCycle] = useState<Cycle>("monthly");
    const [subscribing, setSubscribing] = useState<PlanType | null>(null);

    // Pro+ / Business / Franchise are charged on the web via Razorpay (recurring monthly).
    const handleSubscribe = async (plan: Plan) => {
        const pid = normalizePlanId(plan.id);
        if (pid !== "pro_plus" && pid !== "business" && pid !== "franchise") return;
        if (!billingShopId) {
            addToast({ type: "error", title: "Not ready", description: "Your shop isn't loaded yet — please retry in a moment." });
            return;
        }
        setSubscribing(pid);
        try {
            const result = await startRazorpaySubscription({
                shopId: billingShopId,
                planId: pid,
                planName: plan.name,
                email: user?.email || undefined,
                contact: user?.phone || undefined,
            });
            if (result.ok) {
                addToast({ type: "success", title: `${plan.name} activated`, description: "Your subscription is active. It renews automatically every month." });
            } else if (!result.dismissed) {
                addToast({ type: "error", title: "Subscription failed", description: result.error });
            }
        } catch (e) {
            addToast({ type: "error", title: "Subscription failed", description: (e as Error)?.message || "Please try again." });
        } finally {
            setSubscribing(null);
        }
    };

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
    // NO fallback to visiblePlans[0]: an expired/free shop must show "Free",
    // not the first paid card with its price and a stale renew date.
    const currentPlan =
        visiblePlans.find((p) => normalizePlanId(p.id) === currentPlanId) || null;

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
                    background: "transparent",
                    padding: 40,
                }}
            >
                <LSpinner size="lg" />
                <p style={{ color: "var(--c-text-3)", fontSize: 13 }}>Loading plans…</p>
            </div>
        );
    }

    const statusLabel =
        status === "active" ? "Active" : status === "grace_period" ? "Grace period" : status === "cancelled" ? "Cancelled" : status === "expired" ? "Expired" : status === "trial" ? "Free trial" : "Free";

    const loginCap = currentPlan ? getTeamLoginCap(currentPlan.limits) : 0;
    const shopCap = currentPlan?.limits.maxShops ?? 1;
    const usedLogins = teamMembers.length;
    const usedShops = Math.max(1, ownedShops.length);
    const renewLabel = subscription?.expiresAt
        ? `${status === "cancelled" ? "Access until" : status === "expired" ? "Expired" : "Renews"} ${format(subscription.expiresAt, "d MMM yyyy")}`
        : "";

    const yes = <Check size={18} strokeWidth={2.4} style={{ color: "#16A34A" }} />;
    const no = <span style={{ color: "var(--ds-text-3)" }}>—</span>;
    const all = (p: Plan, keys: (keyof Plan["features"])[]) => keys.every((k) => !!p.features[k]);
    const featureRows: { label: string; cell: (p: Plan) => ReactNode }[] = [
        { label: "Orders per month", cell: (p) => numLimit(p.limits.maxOrders) },
        { label: "Customers", cell: (p) => numLimit(p.limits.maxCustomers) },
        { label: "Receipts, QR/barcode tags, customer tracking", cell: (p) => (all(p, ["orderTracking", "qrScans"]) ? yes : no) },
        { label: "Expenses, attendance, payroll, reports", cell: (p) => (all(p, ["expenses", "attendance", "payroll", "reports"]) ? yes : no) },
        { label: "WhatsApp receipts & web dashboard", cell: (p) => (p.features.whatsappReceipts && (p.features.webDashboard ?? false) ? yes : no) },
        { label: "Team app logins", cell: (p) => { const c = getTeamLoginCap(p.limits); return c === 0 ? no : (p.limits.maxShops ?? 1) > 1 && c !== -1 ? `${c} per shop` : numLimit(c); } },
        { label: "Online booking page, reminders, offers", cell: (p) => (all(p, ["publicOrderingPage", "orderReminders", "offers"]) ? yes : no) },
        { label: "Item-level tracking", cell: (p) => (p.features.itemTracking ? yes : no) },
        { label: "Plant app & damage photos", cell: (p) => (all(p, ["plantApp", "damagePhotos"]) ? yes : no) },
        { label: "Delivery agent app", cell: (p) => (p.features.driverApp ? yes : no) },
        { label: "Shops on one subscription", cell: (p) => String(p.limits.maxShops ?? 1) },
    ];

    const outBtn: CSSProperties = { width: "100%", cursor: "pointer", font: "inherit", fontSize: 15, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 8, padding: "10px 8px" };
    const solidBtn: CSSProperties = { ...outBtn, color: "#fff", background: "var(--ds-blue)", border: "1px solid var(--ds-blue)" };
    const colW = `minmax(150px, 1fr)`;
    const grid: CSSProperties = { display: "grid", gridTemplateColumns: `minmax(190px, 1.05fr) repeat(${visiblePlans.length}, ${colW})` };
    const cellBase = (pid: PlanType, extra?: CSSProperties): CSSProperties => {
        const cur = pid === currentPlanId;
        return { display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 13.5, padding: "8px 10px", borderTop: "1px solid var(--ds-divider)", borderLeft: cur ? "2px solid var(--ds-blue)" : "1px solid var(--ds-divider)", borderRight: cur ? "2px solid var(--ds-blue)" : undefined, ...extra };
    };
    const storeUrl = detectMobileOS() === "ios" ? APP_STORE_URL : GOOGLE_PLAY_URL;

    return (
        <div className="lb-ds" style={{ minHeight: "100%", background: embedded ? "transparent" : "var(--ds-bg)" }}>
            <div style={{ padding: isMobile ? 16 : embedded ? "22px 24px 28px" : "22px 26px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
                {!embedded && <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-.02em" }}>Subscription</div>}
                {embedded && <div style={{ fontSize: 21, fontWeight: 600 }}>Subscription</div>}

                {/* current plan */}
                <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", border: "1px solid var(--ds-border)", borderRadius: 14, padding: "18px 22px", background: "var(--ds-card)" }}>
                    <span style={{ width: 76, height: 76, flex: "none", borderRadius: 14, background: "var(--ds-blue)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Crown size={36} /></span>
                    <div style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ fontSize: 13.5, color: "var(--ds-text-2)" }}>Current plan</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 3 }}>
                            <span style={{ fontSize: 20, fontWeight: 600 }}>
                                {currentPlan?.name || subscription?.planName || "Free"}
                                <span style={{ color: "var(--ds-text-2)", fontWeight: 400 }}> · </span>
                                {currentPlan ? fmtPrice(currentPlan, "monthly") : formatAmount(0)}<span style={{ fontWeight: 400, fontSize: 16 }}>/month</span>
                                {renewLabel && <><span style={{ color: "var(--ds-text-2)", fontWeight: 400 }}> · </span><span style={{ fontWeight: 400 }}>{renewLabel}</span></>}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: isActiveSub ? "#DCFCE7" : "#F3F4F6", color: isActiveSub ? "#15803D" : "#4B5563" }}>{statusLabel}</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 32, marginTop: 14 }}>
                            {[
                                { icon: <Users size={16} />, label: "Team logins", used: usedLogins, cap: loginCap },
                                { icon: <Store size={16} />, label: "Shops", used: usedShops, cap: shopCap },
                            ].map((u) => (
                                <div key={u.label}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>{u.icon}{u.label}<span style={{ marginLeft: "auto" }}>{u.cap === -1 ? `${u.used} · Unlimited` : u.cap === 0 ? "Not included" : `${u.used} of ${u.cap}`}</span></div>
                                    <div style={{ height: 6, borderRadius: 6, background: "#E5E7EB", marginTop: 8, overflow: "hidden" }}>
                                        <div style={{ height: "100%", width: `${u.cap > 0 ? Math.min(100, (u.used / u.cap) * 100) : u.cap === -1 ? 12 : 0}%`, background: "var(--ds-blue)", borderRadius: 6 }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button onClick={() => document.getElementById("lb-invoices")?.scrollIntoView({ behavior: "smooth" })} style={{ cursor: "pointer", font: "inherit", fontSize: 15, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", borderRadius: 8, padding: "11px 26px" }}>Billing history</button>
                </div>

                {viewingChildShop && (
                    <div style={{ fontSize: 13.5, color: "var(--ds-text-2)", background: "var(--ds-table-head)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "11px 14px" }}>
                        This shop is covered by your main shop&apos;s subscription — any plan you buy here is billed on your primary shop and applies to all your shops.
                    </div>
                )}

                {/* cycle toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div role="group" aria-label="Billing cycle" style={{ display: "inline-flex", gap: 4, padding: 4, border: "1px solid var(--ds-border)", borderRadius: 10, background: "var(--ds-card)" }}>
                        {(["monthly", "yearly"] as Cycle[]).map((c) => {
                            const on = cycle === c;
                            return (
                                <button key={c} onClick={() => setCycle(c)} aria-pressed={on} style={{ cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, padding: "6px 14px", borderRadius: 7, border: 0, background: on ? "var(--ds-blue)" : "transparent", color: on ? "#fff" : "var(--ds-text)" }}>
                                    {c === "monthly" ? "Monthly" : <>Yearly <span style={{ fontWeight: 400, fontSize: 12.5, color: on ? "#fff" : "var(--ds-text-2)" }}>(save 20%)</span></>}
                                </button>
                            );
                        })}
                    </div>
                    {cycle === "yearly" && <span style={{ fontSize: 12.5, color: "var(--ds-text-2)" }}>Yearly prices are shown for comparison — web subscriptions bill monthly.</span>}
                    <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--ds-text-2)" }}>Prices in {isIntl ? "USD" : shop?.settings?.currency || "INR"}</span>
                </div>

                {/* plan comparison */}
                <div className="lb-scroll" style={{ overflowX: "auto", border: "1px solid var(--ds-border)", borderRadius: 14, background: "var(--ds-card)" }}>
                    <div style={{ minWidth: 190 + visiblePlans.length * 150 }}>
                        {/* headers */}
                        <div style={grid}>
                            <div />
                            {visiblePlans.map((plan) => {
                                const pid = normalizePlanId(plan.id);
                                const cur = pid === currentPlanId;
                                return (
                                    <div key={plan.id} style={{ padding: "18px 16px 16px", borderLeft: cur ? "2px solid var(--ds-blue)" : "1px solid var(--ds-divider)", borderRight: cur ? "2px solid var(--ds-blue)" : undefined, borderTop: cur ? "2px solid var(--ds-blue)" : undefined, borderRadius: cur ? "10px 10px 0 0" : undefined }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 18, fontWeight: 600, color: cur ? "var(--ds-blue)" : "var(--ds-text)" }}>{plan.name}</span>
                                            {cur && <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-blue-soft)", borderRadius: 6, padding: "2px 8px" }}>Current plan</span>}
                                        </div>
                                        <div style={{ fontSize: 17, fontWeight: 500, marginTop: 4 }}>{fmtPrice(plan, cycle)}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--ds-text-2)" }}>/{cycle === "yearly" ? "yr" : "mo"}</span></div>
                                        <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginTop: 8, lineHeight: 1.45 }}>{plan.description || ""}</div>
                                        {pid === "pro" && <span style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 500, color: "#6D28D9", background: "#EDE9FE", borderRadius: 6, padding: "3px 8px" }}>Bought inside the app</span>}
                                    </div>
                                );
                            })}
                        </div>
                        {/* feature rows */}
                        {featureRows.map((row) => (
                            <div key={row.label} style={grid}>
                                <div style={{ fontSize: 13, padding: "8px 16px", borderTop: "1px solid var(--ds-divider)", display: "flex", alignItems: "center" }}>{row.label}</div>
                                {visiblePlans.map((plan) => <div key={plan.id} style={cellBase(normalizePlanId(plan.id))}>{row.cell(plan)}</div>)}
                            </div>
                        ))}
                        {/* actions */}
                        <div style={grid}>
                            <div style={{ borderTop: "1px solid var(--ds-divider)" }} />
                            {visiblePlans.map((plan) => {
                                const pid = normalizePlanId(plan.id);
                                const cur = pid === currentPlanId;
                                const webPlan = pid === "pro_plus" || pid === "business" || pid === "franchise";
                                return (
                                    <div key={plan.id} style={{ ...cellBase(pid, { padding: "14px 16px 16px", flexDirection: "column", gap: 6 }), borderBottom: cur ? "2px solid var(--ds-blue)" : undefined, borderRadius: cur ? "0 0 10px 10px" : undefined }}>
                                        {cur ? (
                                            <button disabled style={{ ...outBtn, color: "var(--ds-text-2)", background: "#E5E7EB", border: "1px solid #E5E7EB", cursor: "default" }}>Current plan</button>
                                        ) : pid === "free" ? (
                                            <div style={{ fontSize: 13.5, color: "var(--ds-text-2)", padding: "10px 0" }}>Free forever</div>
                                        ) : webPlan ? (
                                            <>
                                                <button onClick={() => void handleSubscribe(plan)} disabled={subscribing !== null} style={{ ...solidBtn, opacity: subscribing !== null && subscribing !== pid ? 0.6 : 1, cursor: subscribing !== null ? "default" : "pointer" }}>
                                                    {subscribing === pid ? "Opening checkout…" : "Upgrade"}
                                                </button>
                                                <a href={contactHref(plan.name)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: "var(--ds-text-2)", textDecoration: "none" }}>Need help? WhatsApp us</a>
                                            </>
                                        ) : (
                                            <button onClick={() => window.open(storeUrl, "_blank", "noopener,noreferrer")} style={outBtn}>Get the app</button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <InvoicesCard shopId={billingShopId || ""} planName={currentPlan?.name || subscription?.planName || ""} />
            </div>
        </div>
    );
}

/** Subscription payments (subscriptions/{shopId}/payments) — latest first. */
function InvoicesCard({ shopId, planName }: { shopId: string; planName: string }) {
    const navigate = useNavigate();
    const { formatAmount } = useCurrency();
    const [rows, setRows] = useState<{ id: string; ref: string; type: string; amount?: number; currency?: string; status?: string; date: Date | null }[] | null>(null);
    useEffect(() => {
        if (!shopId) { setRows([]); return; }
        getDocs(query(collection(db, "subscriptions", shopId, "payments"), orderBy("date", "desc"), limit(5)))
            .then((snap) => setRows(snap.docs.map((d) => {
                const x = d.data();
                return { id: d.id, ref: x.paymentId || x.refundId || d.id, type: x.type || "subscription", amount: x.amount, currency: x.currency, status: x.status, date: x.date?.toDate?.() ?? null };
            })))
            .catch(() => setRows([]));
    }, [shopId]);
    const typeLabel = (t: string) => ({ subscription: "Subscription", renewal: "Renewal", renewal_failed: "Failed renewal", refund: "Refund" } as Record<string, string>)[t] || t;
    const TH: CSSProperties = { textAlign: "left", fontSize: 13, fontWeight: 500, color: "var(--ds-text-2)", padding: "10px 14px", background: "var(--ds-table-head)", borderBottom: "1px solid var(--ds-border)", whiteSpace: "nowrap" };
    const TD: CSSProperties = { fontSize: 13.5, padding: "11px 14px", borderBottom: "1px solid var(--ds-divider)", whiteSpace: "nowrap" };
    return (
        <div id="lb-invoices" style={{ border: "1px solid var(--ds-border)", borderRadius: 14, padding: "16px 16px 12px", background: "var(--ds-card)" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>Invoices</span>
                <button onClick={() => navigate("/settings/payment-history")} style={{ marginLeft: "auto", cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: "var(--ds-blue)", background: "transparent", border: 0 }}>View all<ChevronRight size={16} /></button>
            </div>
            {rows === null ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--ds-text-2)", fontSize: 13.5 }}>Loading…</div>
            ) : rows.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--ds-text-2)", fontSize: 13.5 }}>No subscription payments yet.</div>
            ) : (
                <div className="lb-scroll" style={{ overflowX: "auto", border: "1px solid var(--ds-border)", borderRadius: 10 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                        <thead><tr><th style={TH}>Payment</th><th style={TH}>Date</th><th style={TH}>Plan</th><th style={TH}>Type</th><th style={{ ...TH, textAlign: "right" }}>Amount</th><th style={{ ...TH, textAlign: "center" }}>Status</th></tr></thead>
                        <tbody>
                            {rows.map((r) => {
                                const ok = r.status === "success" || r.status === "captured" || r.status === "paid";
                                const bad = r.status === "failed";
                                return (
                                    <tr key={r.id}>
                                        <td style={{ ...TD, fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 12.5 }}>{r.ref}</td>
                                        <td style={TD}>{r.date ? format(r.date, "d MMM yyyy") : "—"}</td>
                                        <td style={TD}>{planName || "—"}</td>
                                        <td style={TD}>{typeLabel(r.type)}</td>
                                        <td style={{ ...TD, textAlign: "right" }}>{r.amount != null ? (r.currency && r.currency !== "INR" ? `${r.currency} ${r.amount}` : formatAmount(r.amount)) : "—"}</td>
                                        <td style={{ ...TD, textAlign: "center" }}><span style={{ fontSize: 12, fontWeight: 500, padding: "3px 9px", borderRadius: 6, background: ok ? "#DCFCE7" : bad ? "#FEE2E2" : "#F3F4F6", color: ok ? "#15803D" : bad ? "#B91C1C" : "#4B5563" }}>{ok ? "Paid" : bad ? "Failed" : r.status || "—"}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ds-text-2)", marginTop: 12 }}><ShieldCheck size={16} />Pro+, Business and Franchise renew monthly via Razorpay — cancel anytime. Pro is billed by Google Play / App Store.</div>
        </div>
    );
}
