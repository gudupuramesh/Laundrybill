/**
 * Offers & Loyalty (Pro+ / Business)
 *
 * One page for both revenue features:
 *  - Coupons: code + fixed/% value + min order + expiry + pause. Stored in
 *    settings.publicCoupons — the SAME list the public booking page uses, and
 *    (new) applied by code at the POS checkout.
 *  - Loyalty: cashback points config (settings.loyalty). Points are credited when
 *    an order becomes fully paid and redeemed at the POS checkout (1 pt = 1 unit).
 */

import { useState, useEffect, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useShop, useShopMutations } from "@/hooks/use-shop";
import { useCurrency } from "@/hooks/use-currency";
import { useLToast } from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PublicCoupon, LoyaltySettings } from "@/types/shop";
import { ChevronLeft, Plus, Trash2, TicketPercent, Coins } from "lucide-react";

const MONO = "'IBM Plex Mono'";
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, boxShadow: "var(--sh-sm)", padding: "18px 20px" };
const cardTitle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, marginBottom: 6 };
const helpTxt: CSSProperties = { fontSize: 12.5, color: "var(--c-text-2)", margin: "0 0 14px", lineHeight: 1.5 };
const fld: CSSProperties = { font: "inherit", fontSize: 13, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "8px 10px", outline: "none" };
const lbl: CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--c-text-2)", marginBottom: 4 };

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={label || "toggle"} onClick={onClick}
            style={{ position: "relative", cursor: "pointer", width: 42, height: 24, border: 0, borderRadius: 20, flex: "none", background: on ? "var(--c-primary)" : "var(--c-border-strong)" }}>
            <span style={{ position: "absolute", top: 3, left: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)", transition: "transform .15s", transform: on ? "translateX(18px)" : "translateX(0)" }} />
        </button>
    );
}

export function OffersPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { shop } = useShop();
    const { updateShop } = useShopMutations();
    const { formatAmount, currencySymbol } = useCurrency();
    const { addToast } = useLToast();

    const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
    const [loyalty, setLoyalty] = useState<LoyaltySettings>({ enabled: false, mode: "percent", earnPercent: 5, earnFixed: 10, maxRedeemPercent: 100 });
    const [saving, setSaving] = useState(false);
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (!shop || initialized) return;
        if (Array.isArray(shop.settings?.publicCoupons)) setCoupons(shop.settings.publicCoupons);
        if (shop.settings?.loyalty) setLoyalty({ maxRedeemPercent: 100, earnPercent: 5, earnFixed: 10, ...shop.settings.loyalty });
        setInitialized(true);
    }, [shop, initialized]);

    const setCoupon = (i: number, patch: Partial<PublicCoupon>) =>
        setCoupons((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

    const handleSave = async () => {
        // Basic validation: code + positive value; % capped at 100; drop empty rows.
        const cleaned: PublicCoupon[] = [];
        for (const c of coupons) {
            const code = (c.code || "").trim().toUpperCase().replace(/\s+/g, "");
            if (!code) continue;
            const value = Number(c.value) || 0;
            if (value <= 0) { addToast({ type: "error", title: t("offers.valueRequired", "Coupon {{code}} needs a value", { code }) }); return; }
            if (c.type === "percent" && value > 100) { addToast({ type: "error", title: t("offers.percentTooHigh", "Coupon {{code}}: percent can't exceed 100", { code }) }); return; }
            if (cleaned.some((x) => x.code === code)) { addToast({ type: "error", title: t("offers.duplicateCode", "Duplicate coupon code {{code}}", { code }) }); return; }
            cleaned.push({
                code,
                type: c.type === "flat" ? "flat" : "percent",
                value,
                minOrder: Number(c.minOrder) > 0 ? Number(c.minOrder) : 0,
                active: c.active !== false,
                ...(c.expiresAt ? { expiresAt: c.expiresAt } : {}),
            });
        }
        const earnPercent = Math.min(100, Math.max(0, Number(loyalty.earnPercent) || 0));
        const earnFixed = Math.max(0, Math.round(Number(loyalty.earnFixed) || 0));
        if (loyalty.enabled && loyalty.mode === "percent" && earnPercent <= 0) {
            addToast({ type: "error", title: t("offers.earnPercentRequired", "Set a cashback % greater than 0") }); return;
        }
        if (loyalty.enabled && loyalty.mode === "fixed" && earnFixed <= 0) {
            addToast({ type: "error", title: t("offers.earnFixedRequired", "Set points-per-order greater than 0") }); return;
        }
        setSaving(true);
        try {
            await updateShop({
                settings: {
                    ...shop?.settings,
                    publicCoupons: cleaned,
                    loyalty: {
                        enabled: !!loyalty.enabled,
                        mode: loyalty.mode === "fixed" ? "fixed" : "percent",
                        earnPercent,
                        earnFixed,
                        maxRedeemPercent: Math.min(100, Math.max(1, Number(loyalty.maxRedeemPercent) || 100)),
                    },
                },
            } as Parameters<typeof updateShop>[0]);
            setCoupons(cleaned);
            addToast({ type: "success", title: t("shop.settingsSaved", "Saved") });
        } catch (e) {
            console.error("Offers save failed:", e);
            addToast({ type: "error", title: t("shop.saveError", "Failed to save settings") });
        } finally {
            setSaving(false);
        }
    };

    const earnPreview = loyalty.mode === "fixed"
        ? t("offers.earnPreviewFixed", "Every paid order earns {{n}} points ({{amt}})", { n: loyalty.earnFixed || 0, amt: formatAmount(loyalty.earnFixed || 0) })
        : t("offers.earnPreviewPercent", "A {{amt}} paid order earns {{n}} points", { amt: formatAmount(500), n: Math.round((500 * (loyalty.earnPercent || 0)) / 100) });

    return (
        <div style={{ minHeight: "100%", background: "var(--c-bg)" }}>
            {/* header */}
            <header style={{ position: "sticky", top: 0, zIndex: 5, minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "0 14px" : "0 22px" }}>
                <button onClick={() => navigate(-1)} aria-label="Back" style={{ cursor: "pointer", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "transparent", border: 0, borderRadius: 7 }}><ChevronLeft size={18} /></button>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{t("offers.title", "Offers & loyalty")}</span>
                <div style={{ flex: 1 }} />
                <button onClick={handleSave} disabled={saving}
                    style={{ cursor: saving ? "wait" : "pointer", font: "inherit", fontSize: 13, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "9px 16px", opacity: saving ? 0.6 : 1 }}>
                    {saving ? t("common.loading", "Saving…") : t("common.save", "Save changes")}
                </button>
            </header>

            <div style={{ padding: isMobile ? "16px 14px 40px" : "20px 22px 40px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
                {/* ── Coupons ─────────────────────────────────────────── */}
                <div style={card}>
                    <div style={cardTitle}><TicketPercent size={16} style={{ color: "var(--c-primary)" }} />{t("offers.couponsTitle", "Coupon codes")}</div>
                    <p style={helpTxt}>{t("offers.couponsHelp", "Create discount codes your customers can use at the counter and on your public booking page. Fixed amount or percentage, with an optional minimum order and expiry date.")}</p>

                    {coupons.length === 0 && (
                        <div style={{ fontSize: 13, color: "var(--c-text-3)", background: "var(--c-surface-2)", borderRadius: 10, padding: 14, textAlign: "center", marginBottom: 12 }}>
                            {t("offers.noCoupons", "No coupons yet. Add your first offer below.")}
                        </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {coupons.map((c, i) => (
                            <div key={i} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 10, padding: 12, border: "1px solid var(--c-border)", borderRadius: 10, background: c.active === false ? "var(--c-surface-2)" : "var(--c-surface)" }}>
                                <div>
                                    <label style={lbl}>{t("offers.code", "Code")}</label>
                                    <input value={c.code} onChange={(e) => setCoupon(i, { code: e.target.value.toUpperCase().replace(/\s+/g, "") })} placeholder="SAVE10"
                                        style={{ ...fld, width: 110, fontFamily: MONO, fontWeight: 700, textTransform: "uppercase" }} />
                                </div>
                                <div>
                                    <label style={lbl}>{t("offers.type", "Type")}</label>
                                    <select value={c.type} onChange={(e) => setCoupon(i, { type: e.target.value as "percent" | "flat" })} style={{ ...fld, width: 110 }}>
                                        <option value="percent">{t("offers.percentOff", "% off")}</option>
                                        <option value="flat">{t("offers.flatOff", "{{sym}} off", { sym: currencySymbol })}</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={lbl}>{c.type === "percent" ? t("offers.percentValue", "Percent") : t("offers.amountValue", "Amount")}</label>
                                    <input type="number" min={1} max={c.type === "percent" ? 100 : undefined} value={c.value || ""} onChange={(e) => setCoupon(i, { value: Number(e.target.value) || 0 })} placeholder={c.type === "percent" ? "10" : "50"}
                                        style={{ ...fld, width: 90, fontFamily: MONO, textAlign: "right" }} />
                                </div>
                                <div>
                                    <label style={lbl}>{t("offers.minOrder", "Min order")}</label>
                                    <input type="number" min={0} value={c.minOrder || ""} onChange={(e) => setCoupon(i, { minOrder: Number(e.target.value) || 0 })} placeholder="0"
                                        style={{ ...fld, width: 100, fontFamily: MONO, textAlign: "right" }} />
                                </div>
                                <div>
                                    <label style={lbl}>{t("offers.expiry", "Expires (optional)")}</label>
                                    <input type="date" value={c.expiresAt || ""} onChange={(e) => setCoupon(i, { expiresAt: e.target.value || undefined })} style={{ ...fld, width: 150 }} />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 6 }}>
                                    <Toggle on={c.active !== false} onClick={() => setCoupon(i, { active: c.active === false })} label="active" />
                                    <span style={{ fontSize: 11.5, color: c.active === false ? "var(--c-text-3)" : "var(--c-success)", fontWeight: 600 }}>
                                        {c.active === false ? t("offers.paused", "Paused") : t("offers.active", "Active")}
                                    </span>
                                </div>
                                <button type="button" onClick={() => setCoupons((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Delete coupon"
                                    style={{ cursor: "pointer", marginLeft: "auto", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-error)", background: "var(--c-error-soft)", border: 0, borderRadius: 8 }}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <button type="button" onClick={() => setCoupons((prev) => [...prev, { code: "", type: "percent", value: 10, minOrder: 0, active: true }])}
                        style={{ marginTop: 12, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 8, padding: "8px 13px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Plus size={13} />{t("offers.addCoupon", "Add coupon")}
                    </button>
                </div>

                {/* ── Loyalty / cashback ──────────────────────────────── */}
                <div style={card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ ...cardTitle, marginBottom: 0, flex: 1 }}><Coins size={16} style={{ color: "var(--c-warning)" }} />{t("offers.loyaltyTitle", "Cashback / loyalty points")}</div>
                        <Toggle on={!!loyalty.enabled} onClick={() => setLoyalty((l) => ({ ...l, enabled: !l.enabled }))} label="loyalty enabled" />
                    </div>
                    <p style={{ ...helpTxt, marginTop: 6 }}>{t("offers.loyaltyHelp", "Customers earn points when an order is fully paid (1 point = {{sym}}1) and can redeem them on their next order at the counter.", { sym: currencySymbol })}</p>

                    {loyalty.enabled && (
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14 }}>
                            <div>
                                <label style={lbl}>{t("offers.earnMode", "Earn model")}</label>
                                <select value={loyalty.mode} onChange={(e) => setLoyalty((l) => ({ ...l, mode: e.target.value as "percent" | "fixed" }))} style={{ ...fld, width: 190 }}>
                                    <option value="percent">{t("offers.earnModePercent", "% of order total")}</option>
                                    <option value="fixed">{t("offers.earnModeFixed", "Fixed points per order")}</option>
                                </select>
                            </div>
                            {loyalty.mode === "percent" ? (
                                <div>
                                    <label style={lbl}>{t("offers.earnPercent", "Cashback %")}</label>
                                    <input type="number" min={1} max={100} value={loyalty.earnPercent || ""} onChange={(e) => setLoyalty((l) => ({ ...l, earnPercent: Number(e.target.value) || 0 }))}
                                        style={{ ...fld, width: 90, fontFamily: MONO, textAlign: "right" }} />
                                </div>
                            ) : (
                                <div>
                                    <label style={lbl}>{t("offers.earnFixed", "Points per order")}</label>
                                    <input type="number" min={1} value={loyalty.earnFixed || ""} onChange={(e) => setLoyalty((l) => ({ ...l, earnFixed: Number(e.target.value) || 0 }))}
                                        style={{ ...fld, width: 90, fontFamily: MONO, textAlign: "right" }} />
                                </div>
                            )}
                            <div>
                                <label style={lbl}>{t("offers.maxRedeem", "Max redeem per order (%)")}</label>
                                <input type="number" min={1} max={100} value={loyalty.maxRedeemPercent || ""} onChange={(e) => setLoyalty((l) => ({ ...l, maxRedeemPercent: Number(e.target.value) || 100 }))}
                                    style={{ ...fld, width: 90, fontFamily: MONO, textAlign: "right" }} />
                            </div>
                            <div style={{ fontSize: 12.5, color: "var(--c-text-2)", paddingBottom: 8 }}>{earnPreview}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
