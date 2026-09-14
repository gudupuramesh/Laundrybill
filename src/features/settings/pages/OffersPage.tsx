/**
 * Offers (Pro+ / Business) — offer list + Create/Edit form, and cashback points.
 *
 *  - Offers are coupon codes stored in settings.publicCoupons — the SAME list the
 *    public booking page and the POS read. Each saves immediately as a single
 *    field write ("settings.publicCoupons"), never by rewriting the whole
 *    settings map (a stale copy would roll back e.g. nextOrderNumber).
 *  - Loyalty: cashback points config (settings.loyalty), saved the same way.
 */

import { useState, useEffect, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useShop } from "@/hooks/use-shop";
import { useCurrency } from "@/hooks/use-currency";
import { useLToast, LConfirmDialog } from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PublicCoupon, LoyaltySettings } from "@/types/shop";
import { format } from "date-fns";
import { ChevronLeft, Plus, Pencil, Percent, Tag, CalendarDays, Info, Trash2, ArrowRight, Coins, X } from "lucide-react";

const today = () => format(new Date(), "yyyy-MM-dd");
const fmtDay = (d?: string) => (d ? format(new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))), "MMM d") : "");

function statusOf(c: PublicCoupon): { label: string; bg: string; fg: string } {
    const now = today();
    if (c.active === false) return { label: "Paused", bg: "#F3F4F6", fg: "#4B5563" };
    if (c.expiresAt && c.expiresAt < now) return { label: "Expired", bg: "#FEE2E2", fg: "#B91C1C" };
    if (c.startsAt && c.startsAt > now) return { label: "Scheduled", bg: "#FEF3C7", fg: "#B45309" };
    return { label: "Active", bg: "#DCFCE7", fg: "#15803D" };
}

type Draft = { code: string; name: string; type: "percent" | "flat"; value: string; minOrder: string; startsAt: string; expiresAt: string; showOnBookingPage: boolean; active: boolean };
const EMPTY: Draft = { code: "", name: "", type: "percent", value: "", minOrder: "", startsAt: "", expiresAt: "", showOnBookingPage: true, active: true };

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
            style={{ position: "relative", cursor: "pointer", width: 44, height: 24, border: 0, borderRadius: 20, flex: "none", background: on ? "var(--ds-blue)" : "#D1D5DB" }}>
            <span style={{ position: "absolute", top: 3, left: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)", transition: "transform .15s", transform: on ? "translateX(20px)" : "translateX(0)" }} />
        </button>
    );
}

export function OffersPage({ embedded }: { embedded?: boolean } = {}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { shop } = useShop();
    const { formatAmount, currencySymbol } = useCurrency();
    const { addToast } = useLToast();

    const coupons: PublicCoupon[] = Array.isArray(shop?.settings?.publicCoupons) ? shop!.settings.publicCoupons! : [];
    const [editing, setEditing] = useState<number | "new" | null>(null);
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

    const [loyalty, setLoyalty] = useState<LoyaltySettings>({ enabled: false, mode: "percent", earnPercent: 5, earnFixed: 10, maxRedeemPercent: 100 });
    const [loyaltyInit, setLoyaltyInit] = useState(false);
    const [loyaltySaving, setLoyaltySaving] = useState(false);
    useEffect(() => {
        if (!shop || loyaltyInit) return;
        if (shop.settings?.loyalty) setLoyalty({ maxRedeemPercent: 100, earnPercent: 5, earnFixed: 10, ...shop.settings.loyalty });
        setLoyaltyInit(true);
    }, [shop, loyaltyInit]);

    const writeCoupons = async (next: PublicCoupon[]) => {
        if (!shop?.id) return;
        await updateDoc(doc(db, "shops", shop.id), { "settings.publicCoupons": next, updatedAt: serverTimestamp() });
    };

    const openNew = () => { setDraft(EMPTY); setEditing("new"); };
    const openEdit = (i: number) => {
        const c = coupons[i];
        setDraft({ code: c.code, name: c.name || "", type: c.type, value: String(c.value || ""), minOrder: c.minOrder ? String(c.minOrder) : "", startsAt: c.startsAt || "", expiresAt: c.expiresAt || "", showOnBookingPage: c.showOnBookingPage !== false, active: c.active !== false });
        setEditing(i);
    };

    const saveDraft = async () => {
        const code = draft.code.trim().toUpperCase().replace(/\s+/g, "");
        const value = Number(draft.value) || 0;
        if (!code) { addToast({ type: "error", title: t("offers.codeRequired", "Enter a code customers will type") }); return; }
        if (value <= 0) { addToast({ type: "error", title: t("offers.valueRequired2", "Enter the discount value") }); return; }
        if (draft.type === "percent" && value > 100) { addToast({ type: "error", title: t("offers.percentTooHigh2", "Percent can't exceed 100") }); return; }
        if (draft.startsAt && draft.expiresAt && draft.expiresAt < draft.startsAt) { addToast({ type: "error", title: t("offers.datesOrder", "End date must be after the start date") }); return; }
        if (coupons.some((c, i) => c.code.toUpperCase() === code && i !== editing)) { addToast({ type: "error", title: t("offers.duplicateCode", "Duplicate coupon code {{code}}", { code }) }); return; }
        const item: PublicCoupon = {
            code, type: draft.type, value,
            minOrder: Number(draft.minOrder) > 0 ? Number(draft.minOrder) : 0,
            active: draft.active,
            ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
            ...(draft.startsAt ? { startsAt: draft.startsAt } : {}),
            ...(draft.expiresAt ? { expiresAt: draft.expiresAt } : {}),
            ...(draft.showOnBookingPage ? {} : { showOnBookingPage: false }),
        };
        const next = editing === "new" || editing === null ? [...coupons, item] : coupons.map((c, i) => (i === editing ? item : c));
        setSaving(true);
        try {
            await writeCoupons(next);
            addToast({ type: "success", title: editing === "new" ? t("offers.created", "Offer created") : t("offers.updated", "Offer updated") });
            setEditing(null);
        } catch (e) {
            console.error("save offer", e);
            addToast({ type: "error", title: t("shop.saveError", "Failed to save settings") });
        } finally { setSaving(false); }
    };

    const toggleActive = async (i: number) => {
        try { await writeCoupons(coupons.map((c, idx) => (idx === i ? { ...c, active: c.active === false } : c))); }
        catch (e) { console.error(e); addToast({ type: "error", title: t("shop.saveError", "Failed to save settings") }); }
    };
    const removeOffer = async () => {
        if (deleteIdx == null) return;
        const idx = deleteIdx;
        setDeleteIdx(null);
        try {
            await writeCoupons(coupons.filter((_, i) => i !== idx));
            if (editing === idx) setEditing(null);
            addToast({ type: "success", title: t("offers.deleted", "Offer deleted") });
        } catch (e) { console.error(e); addToast({ type: "error", title: t("shop.saveError", "Failed to save settings") }); }
    };

    const saveLoyalty = async () => {
        if (!shop?.id) return;
        const earnPercent = Math.min(100, Math.max(0, Number(loyalty.earnPercent) || 0));
        const earnFixed = Math.max(0, Math.round(Number(loyalty.earnFixed) || 0));
        if (loyalty.enabled && loyalty.mode === "percent" && earnPercent <= 0) { addToast({ type: "error", title: t("offers.earnPercentRequired", "Set a cashback % greater than 0") }); return; }
        if (loyalty.enabled && loyalty.mode === "fixed" && earnFixed <= 0) { addToast({ type: "error", title: t("offers.earnFixedRequired", "Set points-per-order greater than 0") }); return; }
        setLoyaltySaving(true);
        try {
            await updateDoc(doc(db, "shops", shop.id), {
                "settings.loyalty": { enabled: !!loyalty.enabled, mode: loyalty.mode === "fixed" ? "fixed" : "percent", earnPercent, earnFixed, maxRedeemPercent: Math.min(100, Math.max(1, Number(loyalty.maxRedeemPercent) || 100)) },
                updatedAt: serverTimestamp(),
            });
            addToast({ type: "success", title: t("offers.loyaltySaved", "Cashback settings saved") });
        } catch (e) {
            console.error("save loyalty", e);
            addToast({ type: "error", title: t("shop.saveError", "Failed to save settings") });
        } finally { setLoyaltySaving(false); }
    };

    const L: CSSProperties = { display: "block", fontSize: 13.5, fontWeight: 500, marginBottom: 8 };
    const F: CSSProperties = { width: "100%", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "11px 13px", outline: "none" };
    const prefixed = (prefix: string, value: string, onChange: (v: string) => void, placeholder: string) => (
        <div style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--ds-border)", borderRadius: 10, overflow: "hidden" }}>
            <span style={{ width: 44, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text-2)", borderRight: "1px solid var(--ds-border)", background: "var(--ds-table-head)" }}>{prefix}</span>
            <input value={value} inputMode="decimal" placeholder={placeholder} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 14.5, border: 0, padding: "11px 13px", outline: "none", background: "transparent", color: "var(--ds-text)" }} />
        </div>
    );
    const dateBox = (value: string, onChange: (v: string) => void, placeholder: string) => (
        <label style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--ds-border)", borderRadius: 10, padding: "11px 12px", cursor: "pointer", fontSize: 14, color: value ? "var(--ds-text)" : "var(--ds-text-2)" }}>
            {value ? fmtDay(value) : placeholder}
            <CalendarDays size={17} style={{ marginLeft: "auto" }} />
            <input type="date" value={value} onChange={(e) => onChange(e.target.value)} onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* unsupported */ } }}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }} />
        </label>
    );

    const form = editing !== null && (
        <div style={{ border: "1px solid var(--ds-border)", borderRadius: 14, padding: "20px 22px", alignSelf: "start" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{editing === "new" ? t("offers.createOffer", "Create offer") : t("offers.editOffer", "Edit offer")}</span>
                <button onClick={() => setEditing(null)} aria-label={t("common.close", "Close")} style={{ marginLeft: "auto", cursor: "pointer", border: 0, background: "transparent", color: "var(--ds-text-2)", display: "inline-flex" }}><X size={19} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div><label style={L}>{t("offers.offerName", "Offer name")}</label><input style={F} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("offers.offerNamePh", "e.g., 20% off first pickup")} /></div>
                <div><label style={L}>{t("offers.code", "Code")}</label><input style={{ ...F, textTransform: "uppercase", letterSpacing: ".04em" }} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/\s+/g, "") })} placeholder="FIRST20" /></div>
                <div>
                    <label style={L}>{t("offers.type", "Type")}</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid var(--ds-border)", borderRadius: 10, overflow: "hidden" }}>
                        {([["percent", t("offers.percentType", "Percent (%)")], ["flat", t("offers.flatType", "Flat ({{sym}})", { sym: currencySymbol })]] as const).map(([v, label], i) => {
                            const on = draft.type === v;
                            return <button key={v} type="button" onClick={() => setDraft({ ...draft, type: v })} style={{ cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: on ? 600 : 500, padding: "10px 8px", border: 0, borderLeft: i ? "1px solid var(--ds-border)" : 0, background: on ? "var(--ds-blue-soft)" : "var(--ds-card)", color: on ? "var(--ds-blue)" : "var(--ds-text)", boxShadow: on ? "inset 0 0 0 1px var(--ds-blue)" : undefined }}>{label}</button>;
                        })}
                    </div>
                </div>
                <div><label style={L}>{t("offers.value", "Value")}</label>{prefixed(draft.type === "percent" ? "%" : currencySymbol, draft.value, (v) => setDraft({ ...draft, value: v }), draft.type === "percent" ? "e.g., 20" : "e.g., 50")}</div>
                <div><label style={L}>{t("offers.minOrderLbl", "Minimum order")} <span style={{ color: "var(--ds-text-2)", fontWeight: 400 }}>({t("common.optional", "optional")})</span></label>{prefixed(currencySymbol, draft.minOrder, (v) => setDraft({ ...draft, minOrder: v }), "e.g., 500")}</div>
                <div>
                    <label style={L}>{t("offers.validFromTo", "Valid from – to")}</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {dateBox(draft.startsAt, (v) => setDraft({ ...draft, startsAt: v }), t("offers.startDate", "Start date"))}
                        <ArrowRight size={17} style={{ color: "var(--ds-text-2)", flex: "none" }} />
                        {dateBox(draft.expiresAt, (v) => setDraft({ ...draft, expiresAt: v }), t("offers.endDate", "End date"))}
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{t("offers.showOnBooking", "Show on booking page")}</div>
                        <div style={{ fontSize: 12.5, color: "var(--ds-text-2)", marginTop: 3 }}>{t("offers.showOnBookingDesc", "Display this offer on your public booking page.")}</div>
                    </div>
                    <Toggle on={draft.showOnBookingPage} onClick={() => setDraft({ ...draft, showOnBookingPage: !draft.showOnBookingPage })} label={t("offers.showOnBooking", "Show on booking page")} />
                </div>
                <div style={{ display: "flex", gap: 12, padding: "12px 14px", background: "var(--ds-blue-soft)", borderRadius: 10, fontSize: 13, lineHeight: 1.5 }}>
                    <Info size={18} style={{ color: "var(--ds-blue)", flex: "none", marginTop: 1 }} />
                    {t("offers.howApplied", "Customers enter the code at the counter or on your booking page; it applies when the order meets the rules.")}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    {editing !== "new" && <button type="button" onClick={() => setDeleteIdx(editing as number)} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 500, color: "var(--ds-negative)", background: "var(--ds-card)", border: "1px solid #FCA5A5", borderRadius: 10, padding: "11px 14px" }}><Trash2 size={16} />{t("common.delete", "Delete")}</button>}
                    <button type="button" onClick={() => void saveDraft()} disabled={saving} style={{ flex: 1, cursor: saving ? "wait" : "pointer", font: "inherit", fontSize: 15, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 10, padding: "12px 14px", opacity: saving ? 0.6 : 1 }}>{saving ? t("common.loading", "Saving…") : t("offers.saveOffer", "Save offer")}</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="lb-ds" style={{ minHeight: "100%", background: embedded ? "transparent" : "var(--ds-bg)" }}>
            {!embedded && (
                <header style={{ position: "sticky", top: 0, zIndex: 5, minHeight: 58, background: "var(--ds-card)", borderBottom: "1px solid var(--ds-border)", display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "0 14px" : "0 22px" }}>
                    <button onClick={() => navigate(-1)} aria-label="Back" style={{ cursor: "pointer", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text-2)", background: "transparent", border: 0 }}><ChevronLeft size={19} /></button>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{t("offers.title2", "Offers")}</span>
                </header>
            )}
            <div style={{ padding: isMobile ? "16px 14px 40px" : "24px 26px 32px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 21, fontWeight: 600 }}>{t("offers.title2", "Offers")}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-blue-soft)", borderRadius: 20, padding: "3px 10px" }}>PRO+</span>
                </div>
                <div style={{ fontSize: 14, color: "var(--ds-text-2)", marginTop: 6, marginBottom: 20 }}>{t("offers.subtitle", "Create and manage offers & discounts for your customers.")}</div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile || editing === null ? "1fr" : "minmax(0,1fr) minmax(320px, 400px)", gap: 24 }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                            <button onClick={openNew} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 9, fontSize: 15, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 10, padding: "11px 20px" }}><Plus size={18} />{t("offers.createOffer", "Create offer")}</button>
                        </div>
                        {coupons.length === 0 ? (
                            <div style={{ border: "1px dashed var(--ds-border)", borderRadius: 14, padding: 36, textAlign: "center", color: "var(--ds-text-2)", fontSize: 14 }}>{t("offers.noOffers", "No offers yet. Create your first offer.")}</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {coupons.map((c, i) => {
                                    const st = statusOf(c);
                                    const pct = c.type === "percent";
                                    const title = c.name || (pct ? t("offers.pctOffTitle", "{{v}}% off", { v: c.value }) : t("offers.flatOffTitle", "{{v}} off", { v: formatAmount(c.value).replace(/\.00$/, "") }));
                                    const on = editing === i;
                                    return (
                                        <div key={`${c.code}-${i}`} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", border: `1px solid ${on ? "var(--ds-blue)" : "var(--ds-border)"}`, borderRadius: 12, background: "var(--ds-card)" }}>
                                            <span style={{ width: 48, height: 48, flex: "none", borderRadius: "50%", background: pct ? "#DCFCE7" : "#FFEDD5", color: pct ? "#16A34A" : "#EA580C", display: "flex", alignItems: "center", justifyContent: "center" }}>{pct ? <Percent size={22} /> : <Tag size={21} />}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                                    <span style={{ fontSize: 16, fontWeight: 500 }}>{title}</span>
                                                    <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 9px", borderRadius: 6, background: st.bg, color: st.fg }}>{t(`offers.status${st.label}`, st.label)}</span>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--ds-text-2)", marginTop: 5, flexWrap: "wrap" }}>
                                                    <span style={{ fontWeight: 600, color: "var(--ds-text)", letterSpacing: ".03em" }}>{c.code}</span>
                                                    {!!c.minOrder && <span>· {t("offers.aboveAmt", "above {{amt}}", { amt: formatAmount(c.minOrder).replace(/\.00$/, "") })}</span>}
                                                    {(c.startsAt || c.expiresAt) && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>· <CalendarDays size={14} />{c.startsAt ? fmtDay(c.startsAt) : t("offers.now", "Now")} – {c.expiresAt ? fmtDay(c.expiresAt) : t("offers.noEnd", "No end")}</span>}
                                                    {c.showOnBookingPage === false && <span>· {t("offers.counterOnly", "Counter only")}</span>}
                                                </div>
                                            </div>
                                            <Toggle on={c.active !== false} onClick={() => void toggleActive(i)} label={t("offers.activeToggle", "Offer active")} />
                                            <button onClick={() => openEdit(i)} aria-label={t("common.edit", "Edit")} style={{ cursor: "pointer", width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text-2)", background: "transparent", border: 0 }}><Pencil size={18} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* cashback points */}
                        <div style={{ marginTop: 24, border: "1px solid var(--ds-border)", borderRadius: 14, padding: "18px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ width: 40, height: 40, borderRadius: "50%", background: "#FEF3C7", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}><Coins size={20} /></span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 16, fontWeight: 600 }}>{t("offers.loyaltyTitle", "Cashback / loyalty points")}</div>
                                    <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginTop: 2 }}>{t("offers.loyaltyHelp", "Customers earn points when an order is fully paid (1 point = {{sym}}1) and can redeem them on their next order at the counter.", { sym: currencySymbol })}</div>
                                </div>
                                <Toggle on={!!loyalty.enabled} onClick={() => setLoyalty((l) => ({ ...l, enabled: !l.enabled }))} label={t("offers.loyaltyTitle", "Cashback / loyalty points")} />
                            </div>
                            {loyalty.enabled && (
                                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 1fr", gap: 16, marginTop: 16 }}>
                                    <div>
                                        <label style={L}>{t("offers.earnMode", "Earn model")}</label>
                                        <select value={loyalty.mode} onChange={(e) => setLoyalty((l) => ({ ...l, mode: e.target.value as "percent" | "fixed" }))} style={F}>
                                            <option value="percent">{t("offers.earnModePercent", "% of order total")}</option>
                                            <option value="fixed">{t("offers.earnModeFixed", "Fixed points per order")}</option>
                                        </select>
                                    </div>
                                    {loyalty.mode === "percent"
                                        ? <div><label style={L}>{t("offers.earnPercent", "Cashback %")}</label>{prefixed("%", loyalty.earnPercent ? String(loyalty.earnPercent) : "", (v) => setLoyalty((l) => ({ ...l, earnPercent: Number(v) || 0 })), "5")}</div>
                                        : <div><label style={L}>{t("offers.earnFixed", "Points per order")}</label>{prefixed("pts", loyalty.earnFixed ? String(loyalty.earnFixed) : "", (v) => setLoyalty((l) => ({ ...l, earnFixed: Number(v) || 0 })), "10")}</div>}
                                    <div><label style={L}>{t("offers.maxRedeem", "Max redeem per order (%)")}</label>{prefixed("%", loyalty.maxRedeemPercent ? String(loyalty.maxRedeemPercent) : "", (v) => setLoyalty((l) => ({ ...l, maxRedeemPercent: Number(v) || 100 })), "100")}</div>
                                </div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
                                {loyalty.enabled && (
                                    <span style={{ fontSize: 13, color: "var(--ds-text-2)" }}>
                                        {loyalty.mode === "fixed"
                                            ? t("offers.earnPreviewFixed", "Every paid order earns {{n}} points ({{amt}})", { n: loyalty.earnFixed || 0, amt: formatAmount(loyalty.earnFixed || 0) })
                                            : t("offers.earnPreviewPercent", "A {{amt}} paid order earns {{n}} points", { amt: formatAmount(500), n: Math.round((500 * (loyalty.earnPercent || 0)) / 100) })}
                                    </span>
                                )}
                                <button onClick={() => void saveLoyalty()} disabled={loyaltySaving} style={{ marginLeft: "auto", cursor: loyaltySaving ? "wait" : "pointer", font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", borderRadius: 10, padding: "9px 18px", opacity: loyaltySaving ? 0.6 : 1 }}>{loyaltySaving ? t("common.loading", "Saving…") : t("offers.saveCashback", "Save cashback")}</button>
                            </div>
                        </div>
                    </div>
                    {form}
                </div>
            </div>

            <LConfirmDialog open={deleteIdx != null} onClose={() => setDeleteIdx(null)} onConfirm={() => void removeOffer()} variant="destructive"
                title={t("offers.deleteTitle", "Delete this offer?")} description={deleteIdx != null ? `${coupons[deleteIdx]?.name || coupons[deleteIdx]?.code || ""}` : ""} confirmText={t("common.delete", "Delete")} />
        </div>
    );
}
