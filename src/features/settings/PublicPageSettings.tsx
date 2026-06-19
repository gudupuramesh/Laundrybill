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
import { useSmartUpload } from "@/hooks/use-smart-upload";
import {
    Eye,
    Copy,
    Check,
    Tag,
    MessageCircle,
    Share2,
    Plus,
    Trash2,
    QrCode,
    Star,
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

const MONO = "'IBM Plex Mono'";

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

export function PublicPageSettings() {
    const { t } = useTranslation();
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
    const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
    const [testimonials, setTestimonials] = useState<PublicTestimonial[]>([]);
    const [socialLinks, setSocialLinks] = useState<PublicSocialLinks>({});
    const [featuredCouponCode, setFeaturedCouponCode] = useState("");
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [errors, setErrors] = useState<{ slug?: string; openTime?: string; closeTime?: string }>({});

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
            setOfferText(shop.publicOrdering.offerText || "");
            setOfferEnabled(shop.publicOrdering.offerEnabled ?? !!shop.publicOrdering.featuredCouponCode);
            if (Array.isArray(shop.publicOrdering.testimonials)) setTestimonials(shop.publicOrdering.testimonials);
            if (shop.publicOrdering.socialLinks && typeof shop.publicOrdering.socialLinks === "object") setSocialLinks(shop.publicOrdering.socialLinks);
        }
        if (shop?.businessHours) {
            setOpenTime(shop.businessHours.openTime || "");
            setCloseTime(shop.businessHours.closeTime || "");
        }
        if (Array.isArray(shop?.settings?.publicCoupons)) setCoupons(shop.settings.publicCoupons);
    }, [shop?.publicOrdering, shop?.businessHours, shop?.settings?.publicCoupons]);

    const slug = slugFromInput(slugInput || "my-shop");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const host = typeof window !== "undefined" ? window.location.host : "";
    const publicUrl = `${origin}/order/${slug}`;

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
                },
                businessHours: openTime?.trim() && closeTime?.trim() ? { openTime: openTime.trim(), closeTime: closeTime.trim() } : null,
                settings: {
                    currency: shop?.settings?.currency ?? "INR",
                    timezone: shop?.settings?.timezone ?? "Asia/Kolkata",
                    orderPrefix: shop?.settings?.orderPrefix ?? "A",
                    nextOrderNumber: shop?.settings?.nextOrderNumber ?? 1,
                    adsEnabled: shop?.settings?.adsEnabled ?? false,
                    showSelfPromo: shop?.settings?.showSelfPromo ?? false,
                    whatsappNotifications: shop?.settings?.whatsappNotifications ?? false,
                    smsNotifications: shop?.settings?.smsNotifications ?? false,
                    ...shop?.settings,
                    publicCoupons: coupons,
                },
            });
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
        if (enabled && slug) window.open(`/order/${slug}`, "_blank", "noopener");
        else addToast({ type: "info", title: t("publicPage.enableFirst", "Enable and save to preview") });
    };

    // ---- styles ----
    const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, padding: 20, boxShadow: "var(--sh-sm)" };
    const cardTitle: CSSProperties = { fontSize: 13, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 };
    const lbl: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--c-text-2)" };
    const fld: CSSProperties = { width: "100%", font: "inherit", fontSize: 14, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 9, padding: "10px 12px", outline: "none" };
    const small: CSSProperties = { ...fld, fontSize: 13.5 };

    const accent = TEMPLATE_ACCENT[templateId] || "var(--c-primary)";

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header */}
            <header style={{ flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 12, padding: "0 22px" }}>
                <div>
                    <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1.1 }}>{t("publicPage.setupTitle", "Public booking page")}</div>
                    <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{t("publicPage.setupSubtitle", "Set up your customer-facing page")}</div>
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: enabled ? "var(--c-success)" : "var(--c-text-3)", background: enabled ? "var(--c-success-soft)" : "var(--c-surface-3)", padding: "6px 12px", borderRadius: 20 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: enabled ? "var(--c-success)" : "var(--c-text-3)" }} />
                    {enabled ? t("publicPage.published", "Published") : t("publicPage.draft", "Draft")}
                </span>
                <button onClick={handlePreview} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "8px 13px" }}>
                    <Eye size={15} />{t("publicPage.preview", "Preview")}
                </button>
                <button onClick={handleSave} disabled={saving} style={{ cursor: saving ? "wait" : "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 8, padding: "8px 16px", boxShadow: "var(--sh-sm)", opacity: saving ? 0.6 : 1 }}>
                    {saving ? t("common.saving", "Saving…") : t("common.saveChanges", "Save changes")}
                </button>
            </header>

            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: 22 }}>
                <div style={{ display: "flex", gap: 20, alignItems: "flex-start", maxWidth: 1180, margin: "0 auto", flexWrap: "wrap" }}>
                    {/* FORM */}
                    <div style={{ flex: "1.5 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* page link */}
                        <div style={card}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{t("publicPage.pageLink", "Page link")}</div>
                            <div style={{ fontSize: 12, color: "var(--c-text-3)", marginBottom: 14 }}>{t("publicPage.pageLinkDesc", "Share this URL with customers to take bookings.")}</div>

                            {/* enable */}
                            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, cursor: "pointer", marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("publicPage.enable", "Enable public ordering")}</div>
                                    <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{t("publicPage.enableDesc", "Customers can order via your public link")}</div>
                                </div>
                                <Switch on={enabled} onChange={(v) => { setEnabled(v); if (!v) setErrors({}); }} />
                            </label>

                            <label style={lbl}>{t("publicPage.pageUrl", "Your booking URL")}{enabled ? " *" : ""}</label>
                            <div style={{ display: "flex", alignItems: "stretch", border: `1px solid ${errors.slug ? "var(--c-error)" : "var(--c-border-strong)"}`, borderRadius: 10, overflow: "hidden", opacity: enabled ? 1 : 0.6 }}>
                                <span style={{ display: "flex", alignItems: "center", padding: "0 12px", background: "var(--c-surface-2)", color: "var(--c-text-3)", fontSize: 12.5, fontFamily: MONO, borderRight: "1px solid var(--c-border)", whiteSpace: "nowrap" }}>{host}/order/</span>
                                <input
                                    value={slugInput}
                                    disabled={!enabled}
                                    onChange={(e) => { setSlugInput(e.target.value); if (errors.slug) setErrors((p) => ({ ...p, slug: undefined })); }}
                                    placeholder="my-laundry-shop"
                                    style={{ flex: 1, minWidth: 0, border: 0, outline: "none", fontFamily: MONO, fontSize: 13, fontWeight: 600, color: "var(--c-primary)", padding: "11px 12px", background: "var(--c-surface)" }}
                                />
                                <button onClick={handleCopy} style={{ cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, color: copied ? "var(--c-success)" : "var(--c-text-2)", background: "var(--c-surface)", border: 0, borderLeft: "1px solid var(--c-border)", padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                                    {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t("common.copied", "Copied!") : t("common.copy", "Copy")}
                                </button>
                            </div>
                            {errors.slug && <div style={{ fontSize: 11.5, color: "var(--c-error)", marginTop: 6 }}>{errors.slug}</div>}

                            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12 }}>
                                <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)" }}><QrCode size={16} /></span>
                                <span style={{ fontSize: 12, color: "var(--c-text-2)" }}>{t("publicPage.qrNote", "QR code generated automatically — print it for your shop counter.")}</span>
                            </div>

                            {/* hours */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                                <div>
                                    <label style={lbl}>{t("publicPage.openTime", "Open time")}{enabled ? " *" : ""}</label>
                                    <input type="time" value={openTime} disabled={!enabled} onChange={(e) => { setOpenTime(e.target.value); if (errors.openTime) setErrors((p) => ({ ...p, openTime: undefined })); }} style={{ ...fld, fontFamily: MONO, borderColor: errors.openTime ? "var(--c-error)" : "var(--c-border-strong)" }} />
                                    {errors.openTime && <div style={{ fontSize: 11.5, color: "var(--c-error)", marginTop: 4 }}>{errors.openTime}</div>}
                                </div>
                                <div>
                                    <label style={lbl}>{t("publicPage.closeTime", "Close time")}{enabled ? " *" : ""}</label>
                                    <input type="time" value={closeTime} disabled={!enabled} onChange={(e) => { setCloseTime(e.target.value); if (errors.closeTime) setErrors((p) => ({ ...p, closeTime: undefined })); }} style={{ ...fld, fontFamily: MONO, borderColor: errors.closeTime ? "var(--c-error)" : "var(--c-border-strong)" }} />
                                    {errors.closeTime && <div style={{ fontSize: 11.5, color: "var(--c-error)", marginTop: 4 }}>{errors.closeTime}</div>}
                                </div>
                            </div>
                        </div>

                        {/* brand */}
                        <div style={card}>
                            <div style={cardTitle}>{t("publicPage.brand", "Brand")}</div>
                            <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
                                <div style={{ flex: "none" }}>
                                    <label style={lbl}>{t("publicPage.logo", "Logo")}</label>
                                    <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoCleared(false); logoUpload.upload(f); } e.target.value = ""; }} />
                                    {logoPreview ? (
                                        <div style={{ position: "relative", width: 96, height: 96 }}>
                                            <img src={logoPreview} alt="Logo" style={{ width: 96, height: 96, borderRadius: 16, objectFit: "cover", border: "1px solid var(--c-border)" }} />
                                            <button type="button" onClick={() => { const id = logoUpload.images[0]?.id; if (id) logoUpload.remove(id); setLogoCleared(true); }} aria-label="Remove logo" style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: "50%", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", boxShadow: "var(--sh-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-error)", padding: 0 }}><X size={14} /></button>
                                            <button type="button" onClick={() => logoInputRef.current?.click()} style={{ position: "absolute", bottom: -8, right: -8, width: 28, height: 28, borderRadius: "50%", background: "var(--c-primary)", border: 0, boxShadow: "var(--sh-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", padding: 0 }} aria-label="Change logo"><ImagePlus size={14} /></button>
                                        </div>
                                    ) : (
                                        <button type="button" onClick={() => logoInputRef.current?.click()} style={{ width: 96, height: 96, borderRadius: 16, border: "1.5px dashed var(--c-border-strong)", background: "var(--c-surface-2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, color: "var(--c-text-3)", cursor: "pointer", font: "inherit" }}>
                                            <ImagePlus size={22} />
                                            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{t("publicPage.uploadLogo", "Upload")}</span>
                                        </button>
                                    )}
                                    <div style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 6, maxWidth: 110 }}>{t("publicPage.logoHint", "Square works best · optional")}</div>
                                </div>
                                <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div>
                                        <label style={lbl}>{t("publicPage.businessName", "Business name")}</label>
                                        <input value={brandName} onChange={(e) => setBrandName(e.target.value)} style={fld} />
                                    </div>
                                    <div>
                                        <label style={lbl}>{t("publicPage.tagline", "Tagline")}</label>
                                        <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Fresh clothes, delivered." style={fld} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* template / theme */}
                        <div style={card}>
                            <div style={cardTitle}>{t("publicPage.template", "Page theme")}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
                                {Object.values(PUBLIC_TEMPLATES).map((tpl) => {
                                    const on = tpl.id === templateId;
                                    return (
                                        <button
                                            key={tpl.id}
                                            onClick={() => setTemplateId(tpl.id)}
                                            style={{
                                                cursor: "pointer",
                                                textAlign: "left",
                                                font: "inherit",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 10,
                                                padding: "11px 12px",
                                                borderRadius: 11,
                                                border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`,
                                                background: on ? "var(--c-primary-soft)" : "var(--c-surface)",
                                            }}
                                        >
                                            <span style={{ width: 26, height: 26, flex: "none", borderRadius: 7, background: TEMPLATE_ACCENT[tpl.id], boxShadow: "0 0 0 1px var(--c-border)" }} />
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 12.5, fontWeight: 600, color: on ? "var(--c-primary)" : "var(--c-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tpl.name}</div>
                                            </div>
                                            {on && <Check size={15} style={{ color: "var(--c-primary)", marginLeft: "auto", flex: "none" }} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* offer banner */}
                        <div style={card}>
                            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}><Tag size={15} style={{ color: "var(--c-primary)" }} />{t("publicPage.offerBanner", "Offer banner")}</div>
                                <div style={{ marginLeft: "auto" }}><Switch on={offerEnabled} onChange={setOfferEnabled} /></div>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: -6, marginBottom: 12 }}>{t("publicPage.offerBannerHint", "Show a promo banner at the top of your public page. Customers tap the code to copy it for checkout.")}</p>
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                <div style={{ flex: "2 1 240px" }}>
                                    <label style={lbl}>{t("publicPage.bannerText", "Banner text")}</label>
                                    <input value={offerText} onChange={(e) => setOfferText(e.target.value)} placeholder="20% OFF your first order" style={fld} />
                                </div>
                                <div style={{ flex: "1 1 140px" }}>
                                    <label style={lbl}>{t("publicPage.promoCode", "Promo code")}</label>
                                    <input value={featuredCouponCode} onChange={(e) => setFeaturedCouponCode(e.target.value.toUpperCase())} placeholder="FRESH20" style={{ ...fld, fontFamily: MONO, fontWeight: 600, color: "var(--c-primary)" }} />
                                </div>
                            </div>
                        </div>

                        {/* social links */}
                        <div style={card}>
                            <div style={cardTitle}><Share2 size={15} style={{ color: "var(--c-primary)" }} />{t("publicPage.socialLinks", "Contact & social links")}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {SOCIAL_FIELDS.map(({ key, icon: Icon, placeholder }) => (
                                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ width: 36, height: 36, flex: "none", borderRadius: 9, background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={17} /></span>
                                        <input value={socialLinks[key] ?? ""} onChange={(e) => setSocialLinks({ ...socialLinks, [key]: e.target.value.trim() || undefined })} placeholder={placeholder} style={small} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* testimonials */}
                        <div style={card}>
                            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{t("publicPage.testimonials", "Testimonials")}</div>
                                <button onClick={() => setTestimonials([...testimonials, { id: `t-${testimonials.length}-${slug}`, quote: "", author: "" }])} style={{ marginLeft: "auto", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 8, padding: "6px 11px", display: "inline-flex", alignItems: "center", gap: 5 }}><Plus size={13} />{t("common.add", "Add")}</button>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {testimonials.length === 0 && <div style={{ fontSize: 12.5, color: "var(--c-text-3)" }}>{t("publicPage.testimonialsHint", "Show customer reviews and trust signals on your public page.")}</div>}
                                {testimonials.map((tm, i) => (
                                    <div key={tm.id || i} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, border: "1px solid var(--c-border)", borderRadius: 11 }}>
                                        <textarea value={tm.quote} onChange={(e) => { const next = [...testimonials]; next[i] = { ...next[i], quote: e.target.value }; setTestimonials(next); }} placeholder={t("publicPage.testimonialQuote", "Customer quote / review")} rows={2} style={{ ...small, resize: "vertical" }} />
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                            <input value={tm.author} onChange={(e) => { const next = [...testimonials]; next[i] = { ...next[i], author: e.target.value }; setTestimonials(next); }} placeholder={t("publicPage.author", "Author name")} style={{ ...small, flex: "1 1 130px" }} />
                                            <input value={tm.location || ""} onChange={(e) => { const next = [...testimonials]; next[i] = { ...next[i], location: e.target.value || undefined }; setTestimonials(next); }} placeholder={t("publicPage.area", "Area (optional)")} style={{ ...small, flex: "0 1 120px" }} />
                                            <input type="number" min={0} value={tm.ordersCount ?? ""} onChange={(e) => { const next = [...testimonials]; next[i] = { ...next[i], ordersCount: e.target.value ? Number(e.target.value) : undefined }; setTestimonials(next); }} placeholder={t("publicPage.orders", "Orders")} style={{ ...small, fontFamily: MONO, flex: "0 1 90px" }} />
                                            <button onClick={() => setTestimonials(testimonials.filter((_, j) => j !== i))} style={{ cursor: "pointer", width: 36, flex: "none", color: "var(--c-text-3)", background: "transparent", border: "1px solid var(--c-border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={15} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* coupons */}
                        <div style={card}>
                            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{t("publicPage.coupons", "Coupons")}</div>
                                <button onClick={() => setCoupons([...coupons, { code: "", type: "percent", value: 10 }])} style={{ marginLeft: "auto", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 8, padding: "6px 11px", display: "inline-flex", alignItems: "center", gap: 5 }}><Plus size={13} />{t("common.add", "Add")}</button>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: -8, marginBottom: 12 }}>{t("publicPage.couponsHint", "Customers enter a code at checkout. Add codes below (e.g. SAVE10 for 10% off).")}</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {coupons.map((c, i) => (
                                    <div key={i} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: 12, border: "1px solid var(--c-border)", borderRadius: 11 }}>
                                        <input value={c.code} onChange={(e) => { const next = [...coupons]; next[i] = { ...next[i], code: e.target.value.toUpperCase() }; setCoupons(next); }} placeholder="CODE" style={{ ...small, fontFamily: MONO, fontWeight: 600, width: 110, flex: "none" }} />
                                        <select value={c.type} onChange={(e) => { const next = [...coupons]; next[i] = { ...next[i], type: e.target.value as "percent" | "flat" }; setCoupons(next); }} style={{ ...small, width: "auto", flex: "none" }}>
                                            <option value="percent">% off</option>
                                            <option value="flat">{currencySymbol} off</option>
                                        </select>
                                        <input type="number" min={0} value={c.value} onChange={(e) => { const next = [...coupons]; next[i] = { ...next[i], value: Number(e.target.value) || 0 }; setCoupons(next); }} style={{ ...small, fontFamily: MONO, width: 70, flex: "none" }} />
                                        <span style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{t("publicPage.minOrder", "Min order")} {currencySymbol}</span>
                                        <input type="number" min={0} value={c.minOrder ?? ""} onChange={(e) => { const next = [...coupons]; next[i] = { ...next[i], minOrder: e.target.value ? Number(e.target.value) : undefined }; setCoupons(next); }} placeholder="0" style={{ ...small, fontFamily: MONO, width: 80, flex: "none" }} />
                                        <button onClick={() => setCoupons(coupons.filter((_, j) => j !== i))} style={{ cursor: "pointer", width: 36, marginLeft: "auto", flex: "none", color: "var(--c-text-3)", background: "transparent", border: "1px solid var(--c-border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", height: 36 }}><Trash2 size={15} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* LIVE PREVIEW */}
                    <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                        <div style={{ position: "sticky", top: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 12 }}>{t("publicPage.livePreview", "Live preview")}</div>
                            {/* phone frame */}
                            <div style={{ margin: "0 auto", width: 300, maxWidth: "100%", borderRadius: 34, background: "#0B1330", padding: 10, boxShadow: "var(--sh-md)" }}>
                                <div style={{ borderRadius: 26, overflow: "hidden", background: "#F4F7FD", height: 540, display: "flex", flexDirection: "column" }}>
                                    <div style={{ background: "#fff", borderBottom: "1px solid var(--c-border)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, overflow: "hidden", background: accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                                            {logoPreview ? <img src={logoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Store size={16} />}
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brandName || shop?.name || "Your Laundry"}</div>
                                            <div style={{ fontSize: 10, color: "var(--c-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tagline || "Fresh clothes, delivered."}</div>
                                        </div>
                                    </div>
                                    <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: 16 }}>
                                        {offerEnabled && (offerText.trim() || featuredCouponCode) && (
                                            <div style={{ background: accent, color: "#fff", borderRadius: 10, padding: "9px 11px", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                                <span style={{ fontSize: 14 }}>🎉</span>
                                                <div style={{ flex: 1, minWidth: 0, fontSize: 10.5, fontWeight: 700 }}>{offerText.trim() || t("publicPage.offerLine", "Special offer for you")}</div>
                                                {featuredCouponCode && <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, background: "rgba(255,255,255,.22)", padding: "2px 6px", borderRadius: 5 }}>{featuredCouponCode}</span>}
                                            </div>
                                        )}
                                        <div style={{ textAlign: "center", marginBottom: 14 }}>
                                            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em" }}>{t("publicPage.bookPickup", "Book a pickup")}</div>
                                            <div style={{ fontSize: 11, color: "var(--c-text-3)" }}>{openTime && closeTime ? `${openTime} – ${closeTime}` : t("publicPage.freePickup", "Free pickup & delivery")}</div>
                                        </div>
                                        <div style={{ background: "#fff", border: "1px solid var(--c-border)", borderRadius: 12, padding: 14, boxShadow: "var(--sh-sm)" }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{t("publicPage.chooseService", "Choose a service")}</div>
                                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
                                                <span style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: accent, padding: "5px 9px", borderRadius: 20 }}>Wash &amp; Fold</span>
                                                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface-2)", padding: "5px 9px", borderRadius: 20 }}>Dry Clean</span>
                                                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface-2)", padding: "5px 9px", borderRadius: 20 }}>Iron</span>
                                            </div>
                                            <div style={{ height: 34, border: "1px solid var(--c-border)", borderRadius: 8, marginBottom: 8 }} />
                                            <div style={{ height: 34, border: "1px solid var(--c-border)", borderRadius: 8, marginBottom: 12 }} />
                                            <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#fff", background: accent, borderRadius: 9, padding: 11 }}>{t("publicPage.bookPickupBtn", "Book pickup")}</div>
                                        </div>
                                        {testimonials[0]?.quote && (
                                            <div style={{ marginTop: 14, background: "#fff", border: "1px solid var(--c-border)", borderRadius: 12, padding: 13 }}>
                                                <div style={{ color: "var(--c-star,#E8A317)", fontSize: 11, display: "inline-flex", gap: 1 }}>{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={11} fill="currentColor" />)}</div>
                                                <div style={{ fontSize: 11, color: "var(--c-text-2)", marginTop: 5 }}>"{testimonials[0].quote}"</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: "center", marginTop: 12, fontSize: 11.5, color: "var(--c-text-3)", fontFamily: MONO, wordBreak: "break-all" }}>{host}/order/{slug}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={(e) => { e.preventDefault(); onChange(!on); }}
            style={{ position: "relative", flex: "none", cursor: "pointer", width: 44, height: 25, border: 0, borderRadius: 20, background: on ? "var(--c-primary)" : "var(--c-border-strong)", transition: "background .15s" }}
        >
            <span style={{ position: "absolute", top: 3, left: 3, width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)", transition: "transform .15s", transform: on ? "translateX(19px)" : "translateX(0)" }} />
        </button>
    );
}
