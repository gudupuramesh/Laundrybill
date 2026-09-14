/**
 * Public booking page — admin setup (Enterprise Laundry CRM design system).
 *
 * DS two-column layout: a form rail on the left and a sticky live phone
 * preview on the right. Wired to the real shop document — every card maps to a
 * persisted field (publicOrdering.{enabled,slug,template,testimonials,socialLinks,
 * featuredCouponCode}, businessHours, settings.publicCoupons). The DS mockup's
 * brand-colour picker is realised as the real template presets; the tagline /
 * logo-upload / free-text offer banner have no backing field and are omitted.
 */

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { useLToast } from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSmartUpload } from "@/hooks/use-smart-upload";
import { QRCodeSVG } from "qrcode.react";
import { useInventory } from "@/hooks/use-inventory";
import {
    Eye,
    Copy,
    Check,
    MessageCircle,
    Plus,
    Trash2,
    Star,
    Link2,
    ExternalLink,
    Quote,
    Pencil,
    Menu,
    Gift,
    Shirt,
    Facebook,
    Instagram,
    Twitter,
    Youtube,
    Linkedin,
    Store,
    ImagePlus,
    X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { useCurrency } from "@/hooks/use-currency";
import { useShop, useShopMutations } from "@/hooks/use-shop";
import { PUBLIC_TEMPLATES, type PublicTemplateId } from "@/features/public-order";
import type { PublicCoupon, PublicTestimonial, PublicSocialLinks } from "@/types/shop";


// Representative accent per template (the presets are Tailwind class bundles;
// this is just for the swatch + live preview tint).
const TEMPLATE_ACCENT: Record<PublicTemplateId, string> = {
    minimal: "#111827",
    warm: "#D97706",
    bold: "#0B1330",
    pastel: "#38BDF8",
    corporate: "#1A4FD6",
};

const SOCIAL_FIELDS: { key: keyof PublicSocialLinks; icon: typeof Facebook; placeholder: string }[] = [
    { key: "facebook", icon: Facebook, placeholder: "https://facebook.com/…" },
    { key: "instagram", icon: Instagram, placeholder: "https://instagram.com/…" },
    { key: "whatsapp", icon: MessageCircle, placeholder: "https://wa.me/91…" },
    { key: "twitter", icon: Twitter, placeholder: "https://x.com/…" },
    { key: "youtube", icon: Youtube, placeholder: "https://youtube.com/@…" },
    { key: "linkedin", icon: Linkedin, placeholder: "https://linkedin.com/company/…" },
];

function slugFromInput(val: string): string {
    return val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

// Slugs that would collide with an app route at the clean URL /:shopSlug.
// Keep in sync with the reserved set in AuthContext / the static routes in App.tsx.
const RESERVED_SLUGS = new Set([
    "login", "track", "receipt", "order", "team", "staff", "agent", "plant", "super-admin",
    "dashboard", "scan", "new-order", "orders", "customers", "inventory", "manage-staff",
    "attendance", "payroll", "expenses", "reports", "apps", "settings", "shop-settings",
    "delivery-settings", "help", "subscription", "shops",
]);

export function PublicPageSettings({ embedded, onOpenOffers }: { embedded?: boolean; onOpenOffers?: () => void } = {}) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const { addToast } = useLToast();
    const { shopId } = useAuth();
    const { shop } = useShop();
    const { currencySymbol } = useCurrency();
    const { updateShop, updateLogo } = useShopMutations();

    const [enabled, setEnabled] = useState(false);
    const [slugInput, setSlugInput] = useState("");
    const [templateId, setTemplateId] = useState<PublicTemplateId>("minimal");
    const [brandName, setBrandName] = useState("");
    const [tagline, setTagline] = useState("");
    const [offerEnabled, setOfferEnabled] = useState(false);
    const [offerText, setOfferText] = useState("");
    const [logoCleared, setLogoCleared] = useState(false);
    const logoUpload = useSmartUpload({ folder: "shop-assets", shopId: shopId || "", maxFiles: 1, deferUpload: true });
    const logoInputRef = useRef<HTMLInputElement>(null);
    const logoPreview = logoCleared ? "" : (logoUpload.images[0]?.url || shop?.logo || "");
    const [openTime, setOpenTime] = useState("");
    const [closeTime, setCloseTime] = useState("");
    const coupons: PublicCoupon[] = Array.isArray(shop?.settings?.publicCoupons) ? shop!.settings.publicCoupons! : [];
    const [testimonials, setTestimonials] = useState<PublicTestimonial[]>([]);
    const [socialLinks, setSocialLinks] = useState<PublicSocialLinks>({});
    const [featuredCouponCode, setFeaturedCouponCode] = useState("");
    const [minOrderValue, setMinOrderValue] = useState("");
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [errors, setErrors] = useState<{ slug?: string; openTime?: string; closeTime?: string }>({});
    const [editingTestimonial, setEditingTestimonial] = useState<string | null>(null);
    const { items: inventoryItems } = useInventory();

    useEffect(() => {
        if (shop) {
            setBrandName(shop.name || "");
        }
        if (shop?.publicOrdering) {
            setEnabled(!!shop.publicOrdering.enabled);
            setSlugInput(shop.publicOrdering.slug || "");
            setTemplateId((shop.publicOrdering.template as PublicTemplateId) || "minimal");
            setTagline(shop.publicOrdering.tagline || "");
            setFeaturedCouponCode(shop.publicOrdering.featuredCouponCode || "");
            setMinOrderValue(shop.publicOrdering.minOrderValue != null ? String(shop.publicOrdering.minOrderValue) : "");
            setOfferText(shop.publicOrdering.offerText || "");
            setOfferEnabled(shop.publicOrdering.offerEnabled ?? !!shop.publicOrdering.featuredCouponCode);
            if (Array.isArray(shop.publicOrdering.testimonials)) setTestimonials(shop.publicOrdering.testimonials);
            if (shop.publicOrdering.socialLinks && typeof shop.publicOrdering.socialLinks === "object") setSocialLinks(shop.publicOrdering.socialLinks);
        }
        if (shop?.businessHours) {
            setOpenTime(shop.businessHours.openTime || "");
            setCloseTime(shop.businessHours.closeTime || "");
        }
    }, [shop?.publicOrdering, shop?.businessHours]);

    const slug = slugFromInput(slugInput || "my-shop");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const host = typeof window !== "undefined" ? window.location.host : "";
    const publicUrl = `${origin}/${slug}`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(publicUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard unavailable */
        }
    };

    const handleSave = async () => {
        const newErrors: { slug?: string; openTime?: string; closeTime?: string } = {};
        if (enabled) {
            const finalSlug = slugFromInput(slugInput);
            if (!slugInput?.trim()) newErrors.slug = t("publicPage.slugRequired", "Page URL (shop name) is required.");
            else if (!finalSlug) newErrors.slug = t("publicPage.invalidSlug", "Enter a valid page URL (letters, numbers, hyphens only).");
            else if (RESERVED_SLUGS.has(finalSlug)) newErrors.slug = t("publicPage.reservedSlug", "This name is reserved. Please choose a different page URL.");
            if (!openTime?.trim()) newErrors.openTime = t("publicPage.openTimeRequired", "Open time is required.");
            if (!closeTime?.trim()) newErrors.closeTime = t("publicPage.closeTimeRequired", "Close time is required.");
            if (Object.keys(newErrors).length > 0) {
                setErrors(newErrors);
                addToast({
                    type: "error",
                    title: t("publicPage.mandatoryFieldsMissing", "Please fill in all required fields"),
                    description: t("publicPage.mandatoryFieldsHint", "Page URL and Open/Close times are mandatory when public ordering is enabled."),
                });
                return;
            }
        }

        setErrors({});
        const finalSlug = slugFromInput(slugInput) || "my-shop";

        if (enabled && shopId) {
            const slugQuery = query(collection(db, "shops"), where("publicOrdering.slug", "==", finalSlug));
            const slugSnap = await getDocs(slugQuery);
            const takenByOther = slugSnap.docs.some((d) => d.id !== shopId);
            if (takenByOther) {
                setErrors({ slug: t("publicPage.slugAlreadyTaken", "This name is already taken by another shop. Please try a different name.") });
                addToast({ type: "error", title: t("publicPage.slugAlreadyTakenTitle", "Page URL already in use"), description: t("publicPage.slugAlreadyTaken", "This name is already taken by another shop. Please try a different name.") });
                return;
            }
        }

        setSaving(true);
        try {
            // Upload a newly-picked logo first (deferred upload), or clear it
            try {
                const meta = await logoUpload.uploadPendingImages();
                const newLogo = meta?.[0] || logoUpload.images[0];
                if (newLogo?.url && newLogo.url !== shop?.logo) {
                    await updateLogo(newLogo.url, newLogo.key || undefined);
                } else if (logoCleared && shop?.logo) {
                    await updateLogo("", undefined);
                }
            } catch (e) {
                console.warn("Logo upload failed:", e);
            }

            await updateShop({
                name: brandName.trim() || shop?.name,
                publicOrdering: {
                    enabled,
                    slug: finalSlug,
                    template: templateId,
                    tagline: tagline.trim() || undefined,
                    offerEnabled,
                    offerText: offerText.trim() || undefined,
                    testimonials: testimonials.length > 0 ? testimonials : undefined,
                    socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
                    featuredCouponCode: featuredCouponCode.trim().toUpperCase() || undefined,
                    minOrderValue: minOrderValue.trim() && Number(minOrderValue) > 0 ? Number(minOrderValue) : undefined,
                },
                businessHours: openTime?.trim() && closeTime?.trim() ? { openTime: openTime.trim(), closeTime: closeTime.trim() } : null,
            });
            // Coupons are managed on the Offers screen (settings.publicCoupons) — this
            // page never writes them, so the two editors can't overwrite each other.
            addToast({ type: "success", title: t("publicPage.saved", "Public page settings saved") });
        } catch (err) {
            console.error("Public page settings save failed:", err);
            const message = err instanceof Error ? err.message : undefined;
            addToast({ type: "error", title: t("shop.saveError", "Failed to save settings"), description: message || t("shop.saveErrorDesc", "Please check your connection and try again.") });
        } finally {
            setSaving(false);
        }
    };

    const handlePreview = () => {
        if (enabled && slug) window.open(`/${slug}`, "_blank", "noopener");
        else addToast({ type: "info", title: t("publicPage.enableFirst", "Enable and save to preview") });
    };

    // ---- styles (reference layout) ----
    const accent = TEMPLATE_ACCENT[templateId] || "#2563EB";
    const L: CSSProperties = { display: "block", fontSize: 13.5, fontWeight: 500, marginBottom: 8 };
    const F: CSSProperties = { width: "100%", font: "inherit", fontSize: 14, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "10px 12px", outline: "none" };
    const box: CSSProperties = { border: "1px solid var(--ds-border)", borderRadius: 12, padding: "16px 16px", background: "var(--ds-card)" };
    const counter = (n: number, max: number) => <div style={{ textAlign: "right", fontSize: 12, color: n > max ? "var(--ds-negative)" : "var(--ds-text-2)", marginTop: 5 }}>{n} / {max}</div>;
    const liveCoupon = coupons.find((c) => c.code?.toUpperCase() === featuredCouponCode.trim().toUpperCase());
    const previewServices = (inventoryItems || []).filter((it) => it.isActive !== false).slice(0, 4);
    const [editingTm, setEditingTm] = [editingTestimonial, setEditingTestimonial];

    const TemplateThumb = ({ id }: { id: PublicTemplateId }) => {
        const dark = id === "bold";
        const bg = id === "warm" ? "#FBF3E4" : id === "pastel" ? "#F3E8FF" : id === "corporate" ? "#EEF4FF" : dark ? "#0B1330" : "#fff";
        const ink = dark ? "#fff" : "#111827";
        const acc = TEMPLATE_ACCENT[id];
        return (
            <div style={{ height: 92, borderRadius: 7, background: bg, padding: 8, display: "flex", flexDirection: "column", gap: 4, overflow: "hidden", border: "1px solid rgba(0,0,0,.06)" }}>
                <div style={{ display: "flex", gap: 3 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: ink, opacity: 0.5 }} /><span style={{ marginLeft: "auto", width: 10, height: 3, borderRadius: 2, background: ink, opacity: 0.3 }} /></div>
                <div style={{ fontSize: id === "bold" ? 9.5 : 8.5, fontWeight: 800, color: ink, lineHeight: 1.1, marginTop: 4, textTransform: id === "bold" ? "uppercase" : undefined }}>{id === "pastel" ? "Fresh clothes, happy you." : id === "corporate" ? "Professional care for your clothes." : "Wash · Iron · Dry clean"}</div>
                <div style={{ height: 3, width: "60%", borderRadius: 2, background: ink, opacity: 0.15 }} />
                <div style={{ marginTop: "auto", display: "flex", gap: 4 }}><span style={{ width: 30, height: 9, borderRadius: 3, background: id === "bold" ? "#F59E0B" : acc }} /><span style={{ width: 18, height: 9, borderRadius: 3, background: ink, opacity: 0.12 }} /></div>
            </div>
        );
    };

    return (
        <div className="lb-ds" style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: embedded ? "transparent" : "var(--ds-bg)" }}>
            <div className="lb-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: isMobile ? 16 : "22px 24px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                    <span style={{ fontSize: embedded ? 21 : 26, fontWeight: 600 }}>{t("publicPage.setupTitle", "Public booking page")}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: enabled ? "#DCFCE7" : "#F3F4F6", color: enabled ? "#15803D" : "#4B5563" }}>{enabled ? t("publicPage.published", "Published") : t("publicPage.draft", "Draft")}</span>
                </div>

                <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
                    {/* FORM */}
                    <div style={{ flex: "1.6 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                        {/* enable */}
                        <div style={{ ...box, display: "flex", alignItems: "center", gap: 16 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 15, fontWeight: 500 }}>{t("publicPage.onlineBooking", "Online booking page")}</div>
                                <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginTop: 3 }}>{t("publicPage.onlineBookingDesc", "Allow customers to book pickup and delivery online.")}</div>
                            </div>
                            <Switch on={enabled} onChange={(v) => { setEnabled(v); if (!v) setErrors({}); }} />
                        </div>

                        {/* link + QR + hours */}
                        <div style={{ ...box, padding: 0 }}>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 180px" }}>
                                <div style={{ padding: "16px 16px", borderRight: isMobile ? 0 : "1px solid var(--ds-divider)" }}>
                                    <label style={L}>{t("publicPage.yourLink", "Your booking page link")}{enabled ? " *" : ""}</label>
                                    <div style={{ display: "flex", alignItems: "stretch", gap: 8, flexWrap: "wrap" }}>
                                        <div style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${errors.slug ? "var(--ds-negative)" : "var(--ds-border)"}`, borderRadius: 10, padding: "0 12px", opacity: enabled ? 1 : 0.65 }}>
                                            <Link2 size={16} style={{ color: "var(--ds-blue)", flex: "none" }} />
                                            <span style={{ fontSize: 14, color: "var(--ds-text-2)", whiteSpace: "nowrap" }}>{host}/</span>
                                            <input value={slugInput} disabled={!enabled} onChange={(e) => { setSlugInput(e.target.value); if (errors.slug) setErrors((p) => ({ ...p, slug: undefined })); }} placeholder="my-laundry"
                                                style={{ flex: 1, minWidth: 60, border: 0, outline: "none", font: "inherit", fontSize: 14.5, fontWeight: 500, color: "var(--ds-blue)", padding: "11px 0", background: "transparent" }} />
                                        </div>
                                        <button onClick={handleCopy} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, color: copied ? "#15803D" : "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9, padding: "0 14px", minHeight: 42 }}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? t("common.copied", "Copied") : t("common.copy", "Copy")}</button>
                                        <button onClick={handlePreview} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9, padding: "0 14px", minHeight: 42 }}><ExternalLink size={16} />{t("publicPage.open", "Open")}</button>
                                    </div>
                                    {errors.slug && <div style={{ fontSize: 12.5, color: "var(--ds-negative)", marginTop: 6 }}>{errors.slug}</div>}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                                        <div>
                                            <label style={L}>{t("publicPage.openTime", "Open time")}{enabled ? " *" : ""}</label>
                                            <input type="time" value={openTime} disabled={!enabled} onChange={(e) => { setOpenTime(e.target.value); if (errors.openTime) setErrors((p) => ({ ...p, openTime: undefined })); }} style={{ ...F, borderColor: errors.openTime ? "var(--ds-negative)" : "var(--ds-border)" }} />
                                            {errors.openTime && <div style={{ fontSize: 12, color: "var(--ds-negative)", marginTop: 4 }}>{errors.openTime}</div>}
                                        </div>
                                        <div>
                                            <label style={L}>{t("publicPage.closeTime", "Close time")}{enabled ? " *" : ""}</label>
                                            <input type="time" value={closeTime} disabled={!enabled} onChange={(e) => { setCloseTime(e.target.value); if (errors.closeTime) setErrors((p) => ({ ...p, closeTime: undefined })); }} style={{ ...F, borderColor: errors.closeTime ? "var(--ds-negative)" : "var(--ds-border)" }} />
                                            {errors.closeTime && <div style={{ fontSize: 12, color: "var(--ds-negative)", marginTop: 4 }}>{errors.closeTime}</div>}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: "16px 12px", textAlign: "center" }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("publicPage.qrDoor", "QR to print at the door")}</div>
                                    <QRCodeSVG value={publicUrl} size={96} style={{ display: "block", margin: "0 auto" }} />
                                    <div style={{ fontSize: 12.5, color: "var(--ds-text-2)", marginTop: 8 }}>{t("publicPage.scanToBook", "Scan to book")}</div>
                                </div>
                            </div>
                        </div>

                        {/* template + tagline + offer */}
                        <div style={box}>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>{t("publicPage.template2", "Template")}</div>
                            <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginTop: 3, marginBottom: 12 }}>{t("publicPage.templateDesc", "Choose how your booking page looks")}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(104px, 1fr))", gap: 10 }}>
                                {Object.values(PUBLIC_TEMPLATES).map((tpl) => {
                                    const on = tpl.id === templateId;
                                    return (
                                        <button key={tpl.id} type="button" onClick={() => setTemplateId(tpl.id)} style={{ position: "relative", cursor: "pointer", font: "inherit", padding: 4, borderRadius: 9, border: `${on ? 2 : 1}px solid ${on ? "var(--ds-blue)" : "var(--ds-border)"}`, background: "var(--ds-card)", textAlign: "center" }}>
                                            <TemplateThumb id={tpl.id} />
                                            <div style={{ fontSize: 13.5, fontWeight: on ? 600 : 500, color: on ? "var(--ds-blue)" : "var(--ds-text)", padding: "7px 0 3px" }}>{tpl.name}</div>
                                            {on && <span style={{ position: "absolute", right: 8, top: 72, width: 18, height: 18, borderRadius: "50%", background: "var(--ds-blue)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={11} strokeWidth={3} /></span>}
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginTop: 18 }}>
                                <div>
                                    <label style={L}>{t("publicPage.tagline", "Tagline")}</label>
                                    <input value={tagline} maxLength={80} onChange={(e) => setTagline(e.target.value)} placeholder={t("publicPage.taglinePh", "Wash · Iron · Dry clean — picked up from your door")} style={F} />
                                    {counter(tagline.length, 80)}
                                </div>
                                <div>
                                    <label style={{ ...L, display: "flex", alignItems: "center" }}>{t("publicPage.offerBannerText", "Offer banner text")}<span style={{ marginLeft: "auto" }}><Switch on={offerEnabled} onChange={setOfferEnabled} small /></span></label>
                                    <input value={offerText} maxLength={60} onChange={(e) => setOfferText(e.target.value)} placeholder={t("publicPage.offerTextPh", "20% off your first pickup")} style={{ ...F, opacity: offerEnabled ? 1 : 0.6 }} />
                                    {counter(offerText.length, 60)}
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginTop: 6 }}>
                                <div>
                                    <label style={L}>{t("publicPage.promoCode", "Promo code on the banner")}</label>
                                    <select value={featuredCouponCode} onChange={(e) => setFeaturedCouponCode(e.target.value)} style={F}>
                                        <option value="">{t("publicPage.noPromo", "None")}</option>
                                        {coupons.map((c) => <option key={c.code} value={c.code}>{c.code}{c.name ? ` — ${c.name}` : ""}</option>)}
                                        {featuredCouponCode && !liveCoupon && <option value={featuredCouponCode}>{featuredCouponCode}</option>}
                                    </select>
                                    <div style={{ fontSize: 12.5, color: "var(--ds-text-2)", marginTop: 5 }}>
                                        {featuredCouponCode && !liveCoupon ? t("publicPage.promoMissing", "This code isn't in your offers — customers can't use it.") : t("publicPage.promoHint", "Codes come from your offers.")}{" "}
                                        {onOpenOffers && <button type="button" onClick={onOpenOffers} style={{ cursor: "pointer", font: "inherit", fontSize: 12.5, color: "var(--ds-blue)", background: "transparent", border: 0, padding: 0 }}>{t("publicPage.manageOffers", "Manage offers →")}</button>}
                                    </div>
                                </div>
                                <div>
                                    <label style={L}>{t("publicPage.minOrderValue", "Minimum order value")} ({currencySymbol})</label>
                                    <input inputMode="numeric" value={minOrderValue} onChange={(e) => setMinOrderValue(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" style={F} />
                                    <div style={{ fontSize: 12.5, color: "var(--ds-text-2)", marginTop: 5 }}>{t("publicPage.minOrderValueHint", "Shown to customers on your booking page. Leave blank for no minimum.")}</div>
                                </div>
                            </div>
                        </div>

                        {/* brand */}
                        <div style={{ ...box, display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
                            <div style={{ flex: "none" }}>
                                <label style={L}>{t("publicPage.logo", "Logo")}</label>
                                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoCleared(false); logoUpload.upload(f); } e.target.value = ""; }} />
                                {logoPreview ? (
                                    <div style={{ position: "relative", width: 84, height: 84 }}>
                                        <img src={logoPreview} alt="Logo" style={{ width: 84, height: 84, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--ds-border)" }} />
                                        <button type="button" onClick={() => { const id = logoUpload.images[0]?.id; if (id) logoUpload.remove(id); setLogoCleared(true); }} aria-label="Remove logo" style={{ position: "absolute", top: -4, right: -4, width: 24, height: 24, borderRadius: "50%", background: "var(--ds-card)", border: "1px solid var(--ds-border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ds-negative)", padding: 0 }}><X size={13} /></button>
                                        <button type="button" onClick={() => logoInputRef.current?.click()} aria-label="Change logo" style={{ position: "absolute", bottom: -4, right: -4, width: 26, height: 26, borderRadius: "50%", background: "var(--ds-blue)", border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", padding: 0 }}><ImagePlus size={13} /></button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => logoInputRef.current?.click()} style={{ width: 84, height: 84, borderRadius: "50%", border: "1.5px dashed var(--ds-border)", background: "var(--ds-table-head)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "var(--ds-text-2)", cursor: "pointer", font: "inherit" }}><ImagePlus size={20} /><span style={{ fontSize: 11 }}>{t("publicPage.uploadLogo", "Upload")}</span></button>
                                )}
                            </div>
                            <div style={{ flex: "1 1 220px" }}>
                                <label style={L}>{t("publicPage.businessName", "Business name")}</label>
                                <input value={brandName} onChange={(e) => setBrandName(e.target.value)} style={F} />
                            </div>
                        </div>

                        {/* testimonials */}
                        <div style={box}>
                            <div style={{ display: "flex", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 500 }}>{t("publicPage.testimonials", "Testimonials")}</div>
                                    <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginTop: 3 }}>{t("publicPage.testimonialsDesc", "These appear on your booking page")}</div>
                                </div>
                                <button onClick={() => { const id = `t-${Date.now()}`; setTestimonials([...testimonials, { id, quote: "", author: "" }]); setEditingTm(id); }} style={{ marginLeft: "auto", cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "var(--ds-blue)", background: "transparent", border: 0 }}><Plus size={16} />{t("common.add", "Add")}</button>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                                {testimonials.length === 0 && <div style={{ fontSize: 13.5, color: "var(--ds-text-2)" }}>{t("publicPage.testimonialsHint", "Add real reviews from your customers.")}</div>}
                                {testimonials.map((tm, i) => editingTm === tm.id ? (
                                    <div key={tm.id} style={{ border: "1px solid var(--ds-blue)", borderRadius: 11, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                                        <textarea autoFocus value={tm.quote} rows={2} onChange={(e) => { const n = [...testimonials]; n[i] = { ...n[i], quote: e.target.value }; setTestimonials(n); }} placeholder={t("publicPage.testimonialQuote", "Customer quote / review")} style={{ ...F, resize: "vertical" }} />
                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                            <input value={tm.author} onChange={(e) => { const n = [...testimonials]; n[i] = { ...n[i], author: e.target.value }; setTestimonials(n); }} placeholder={t("publicPage.author", "Author name")} style={{ ...F, flex: "1 1 140px" }} />
                                            <input value={tm.location || ""} onChange={(e) => { const n = [...testimonials]; n[i] = { ...n[i], location: e.target.value || undefined }; setTestimonials(n); }} placeholder={t("publicPage.area", "Area (optional)")} style={{ ...F, flex: "1 1 120px" }} />
                                            <button onClick={() => setEditingTm(null)} style={{ cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 9, padding: "0 16px" }}>{t("common.done", "Done")}</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div key={tm.id || i} style={{ display: "flex", alignItems: "center", gap: 14, border: "1px solid var(--ds-border)", borderRadius: 11, padding: "12px 14px" }}>
                                        <span style={{ width: 36, height: 36, flex: "none", borderRadius: "50%", background: i % 2 ? "#DCFCE7" : "var(--ds-blue-soft)", color: i % 2 ? "#16A34A" : "var(--ds-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}><Quote size={16} /></span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13.5 }}>{tm.quote ? `“${tm.quote}”` : <span style={{ color: "var(--ds-text-2)" }}>{t("publicPage.emptyQuote", "Empty review")}</span>}</div>
                                            <div style={{ fontSize: 12.5, color: "var(--ds-text-2)", marginTop: 3 }}>— {tm.author || "—"}{tm.location ? `, ${tm.location}` : ""}</div>
                                        </div>
                                        <button onClick={() => setEditingTm(tm.id)} aria-label={t("common.edit", "Edit")} style={{ cursor: "pointer", border: 0, background: "transparent", color: "var(--ds-text-2)", display: "inline-flex" }}><Pencil size={17} /></button>
                                        <button onClick={() => setTestimonials(testimonials.filter((_, j) => j !== i))} aria-label={t("common.delete", "Delete")} style={{ cursor: "pointer", border: 0, background: "transparent", color: "var(--ds-text-2)", display: "inline-flex" }}><Trash2 size={17} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* social */}
                        <div style={box}>
                            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{t("publicPage.socialLinks", "Contact & social links")}</div>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                                {SOCIAL_FIELDS.map(({ key, icon: Icon, placeholder }) => (
                                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ width: 38, height: 38, flex: "none", borderRadius: 9, background: "var(--ds-table-head)", color: "var(--ds-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={17} /></span>
                                        <input value={socialLinks[key] ?? ""} onChange={(e) => setSocialLinks({ ...socialLinks, [key]: e.target.value.trim() || undefined })} placeholder={placeholder} style={F} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* PHONE PREVIEW */}
                    <div style={{ flex: "1 1 300px", minWidth: 0, maxWidth: 340, position: isMobile ? "static" : "sticky", top: 0 }}>
                        <div style={{ borderRadius: 34, border: "2px solid #E5E7EB", background: "#F9FAFB", padding: 8, boxShadow: "0 12px 30px rgba(16,24,40,.10)" }}>
                            <div style={{ borderRadius: 27, background: "#fff", height: 640, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                <div style={{ display: "flex", alignItems: "center", padding: "14px 16px 4px" }}>
                                    <Menu size={20} />
                                    {socialLinks.whatsapp && <MessageCircle size={21} style={{ marginLeft: "auto", color: "#16A34A" }} />}
                                </div>
                                <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: "0 14px 16px" }}>
                                    <div style={{ textAlign: "center" }}>
                                        {logoPreview ? <img src={logoPreview} alt="" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: "50%", display: "block", margin: "0 auto" }} /> : <span style={{ width: 56, height: 56, margin: "0 auto", borderRadius: "50%", background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Store size={26} /></span>}
                                        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 8 }}>{brandName || shop?.name || "Your laundry"}</div>
                                        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{tagline || t("publicPage.taglinePh", "Wash · Iron · Dry clean — picked up from your door")}</div>
                                        {offerEnabled && (offerText.trim() || featuredCouponCode) && (
                                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11.5, fontWeight: 600, color: accent === "#111827" ? "#2563EB" : accent, background: "#EEF2FF", borderRadius: 7, padding: "5px 12px" }}><Gift size={13} />{offerText.trim() || featuredCouponCode}</div>
                                        )}
                                    </div>
                                    <div style={{ border: "1px solid #E5E7EB", borderRadius: 11, padding: 11, marginTop: 14 }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t("publicPage.pvDeliver", "Do we deliver to you?")}</div>
                                        <div style={{ fontSize: 10.5, color: "#9CA3AF", border: "1px solid #E5E7EB", borderRadius: 6, padding: "7px 8px", marginTop: 7 }}>{t("publicPage.pvArea", "Enter your area or pincode")}</div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: accent === "#111827" ? "#2563EB" : accent, borderRadius: 6, padding: 7, marginTop: 7, textAlign: "center" }}>{t("publicPage.pvCheck", "Check availability")}</div>
                                    </div>
                                    {openTime && closeTime && <div style={{ fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 8 }}>{t("publicPage.pvOpen", "Open")} {openTime} – {closeTime}</div>}
                                    <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 14 }}>{t("publicPage.pvServices", "Our services")}</div>
                                    <div style={{ marginTop: 6 }}>
                                        {previewServices.length === 0 && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{t("publicPage.pvNoServices", "Your services appear here")}</div>}
                                        {previewServices.map((it) => (
                                            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #F3F4F6", fontSize: 11.5 }}>
                                                <Shirt size={15} style={{ color: "#2563EB" }} />
                                                <span style={{ fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                                                <span style={{ fontSize: 10, color: "#6B7280" }}>{currencySymbol}{it.basePrice} {it.pricingType === "piece" ? "per pc" : `per ${it.pricingType}`}</span>
                                                <span style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={10} /></span>
                                            </div>
                                        ))}
                                    </div>
                                    {testimonials.some((x) => x.quote) && (
                                        <div style={{ border: "1px solid #E5E7EB", borderRadius: 11, padding: 11, marginTop: 14 }}>
                                            <div style={{ fontSize: 12, fontWeight: 600 }}>{t("publicPage.pvSay", "What our customers say")}</div>
                                            <div style={{ display: "flex", gap: 1, color: "#F59E0B", marginTop: 5 }}>{Array.from({ length: 5 }).map((_, k) => <Star key={k} size={11} fill="currentColor" />)}</div>
                                            <div style={{ fontSize: 11, color: "#4B5563", marginTop: 5 }}>“{testimonials.find((x) => x.quote)?.quote}”</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: "center", marginTop: 10, fontSize: 12.5, color: "var(--ds-text-2)", wordBreak: "break-all" }}>{host}/{slug}</div>
                    </div>
                </div>
            </div>

            {/* save bar */}
            <div style={{ flex: "none", position: "sticky", bottom: 0, zIndex: 3, display: "flex", alignItems: "center", gap: 12, padding: "14px 24px", background: "var(--ds-card)", borderTop: "1px solid var(--ds-border)", borderRadius: embedded ? "0 0 14px 14px" : 0 }}>
                <span style={{ fontSize: 13.5, color: "var(--ds-text-2)" }}>{t("publicPage.saveHint", "Changes go live on your booking page when you save.")}</span>
                <div style={{ flex: 1 }} />
                <button onClick={handlePreview} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 500, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 10, padding: "10px 18px" }}><Eye size={16} />{t("publicPage.preview", "Preview")}</button>
                <button onClick={handleSave} disabled={saving} style={{ cursor: saving ? "wait" : "pointer", font: "inherit", fontSize: 15, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 10, padding: "11px 30px", opacity: saving ? 0.6 : 1 }}>{saving ? t("common.saving", "Saving…") : t("common.saveChanges", "Save changes")}</button>
            </div>
        </div>
    );
}

function Switch({ on, onChange, small }: { on: boolean; onChange: (v: boolean) => void; small?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={(e) => { e.preventDefault(); onChange(!on); }}
            style={{ position: "relative", flex: "none", cursor: "pointer", width: small ? 36 : 44, height: small ? 20 : 24, border: 0, borderRadius: 20, background: on ? "var(--ds-blue, #2563EB)" : "#D1D5DB", transition: "background .15s" }}
        >
            <span style={{ position: "absolute", top: small ? 3 : 3, left: 3, width: small ? 14 : 18, height: small ? 14 : 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.25)", transition: "transform .15s", transform: on ? `translateX(${small ? 16 : 20}px)` : "translateX(0)" }} />
        </button>
    );
}
