/**
 * Public Page Settings
 *
 * Enable/disable, slug, template for Business plan shop owners.
 */

import { useState, useEffect } from "react";
import {
  LCard,
  LToggle,
  LTextInput,
  LButton,
  LSelect,
  useLToast,
  LHelpButton,
} from "@/components/laundry";
import { Globe, ExternalLink, Tag, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import { useCurrency } from "@/hooks/use-currency";
import { useShop, useShopMutations } from "@/hooks/use-shop";
import { PUBLIC_TEMPLATES, type PublicTemplateId } from "@/features/public-order";
import type { PublicCoupon, PublicTestimonial, PublicSocialLinks } from "@/types/shop";
import { MessageCircle, Share2 } from "lucide-react";

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
  const { updateShop } = useShopMutations();

  const [enabled, setEnabled] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [templateId, setTemplateId] = useState<PublicTemplateId>("minimal");
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
  const [testimonials, setTestimonials] = useState<PublicTestimonial[]>([]);
  const [socialLinks, setSocialLinks] = useState<PublicSocialLinks>({});
  const [featuredCouponCode, setFeaturedCouponCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ slug?: string; openTime?: string; closeTime?: string }>({});

  useEffect(() => {
    if (shop?.publicOrdering) {
      setEnabled(!!shop.publicOrdering.enabled);
      setSlugInput(shop.publicOrdering.slug || "");
      setTemplateId(
        (shop.publicOrdering.template as PublicTemplateId) || "minimal"
      );
      if (Array.isArray(shop.publicOrdering.testimonials)) {
        setTestimonials(shop.publicOrdering.testimonials);
      }
      if (shop.publicOrdering.socialLinks && typeof shop.publicOrdering.socialLinks === "object") {
        setSocialLinks(shop.publicOrdering.socialLinks);
      }
      setFeaturedCouponCode(shop.publicOrdering.featuredCouponCode || "");
    }
    if (shop?.businessHours) {
      setOpenTime(shop.businessHours.openTime || "");
      setCloseTime(shop.businessHours.closeTime || "");
    }
    if (Array.isArray(shop?.settings?.publicCoupons)) {
      setCoupons(shop.settings.publicCoupons);
    }
  }, [shop?.publicOrdering, shop?.businessHours, shop?.settings?.publicCoupons]);

  const slug = slugFromInput(slugInput || "my-shop");
  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/order/${slug}`
      : "";

  const handleSave = async () => {
    const newErrors: { slug?: string; openTime?: string; closeTime?: string } = {};

    if (enabled) {
      const finalSlug = slugFromInput(slugInput);
      if (!slugInput?.trim()) {
        newErrors.slug = t("publicPage.slugRequired", "Page URL (shop name) is required.");
      } else if (!finalSlug) {
        newErrors.slug = t("publicPage.invalidSlug", "Enter a valid page URL (letters, numbers, hyphens only).");
      }
      if (!openTime?.trim()) {
        newErrors.openTime = t("publicPage.openTimeRequired", "Open time is required.");
      }
      if (!closeTime?.trim()) {
        newErrors.closeTime = t("publicPage.closeTimeRequired", "Close time is required.");
      }

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
      const slugQuery = query(
        collection(db, "shops"),
        where("publicOrdering.slug", "==", finalSlug)
      );
      const slugSnap = await getDocs(slugQuery);
      const takenByOther = slugSnap.docs.some((d) => d.id !== shopId);
      if (takenByOther) {
        setErrors({
          slug: t("publicPage.slugAlreadyTaken", "This name is already taken by another shop. Please try a different name."),
        });
        addToast({
          type: "error",
          title: t("publicPage.slugAlreadyTakenTitle", "Page URL already in use"),
          description: t("publicPage.slugAlreadyTaken", "This name is already taken by another shop. Please try a different name."),
        });
        return;
      }
    }

    setSaving(true);
    try {
      await updateShop({
        publicOrdering: {
          enabled,
          slug: finalSlug,
          template: templateId,
          testimonials: testimonials.length > 0 ? testimonials : undefined,
          socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
          featuredCouponCode: featuredCouponCode.trim().toUpperCase() || undefined,
        },
        businessHours:
          openTime?.trim() && closeTime?.trim()
            ? { openTime: openTime.trim(), closeTime: closeTime.trim() }
            : null,
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
      addToast({
        type: "success",
        title: t("publicPage.saved", "Public page settings saved"),
      });
    } catch (err) {
      console.error("Public page settings save failed:", err);
      const message = err instanceof Error ? err.message : undefined;
      addToast({
        type: "error",
        title: t("shop.saveError", "Failed to save settings"),
        description: message || t("shop.saveErrorDesc", "Please check your connection and try again."),
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    if (enabled && slug) {
      window.open(`/order/${slug}`, "_blank", "noopener");
    } else {
      addToast({
        type: "info",
        title: t("publicPage.enableFirst", "Enable and save to preview"),
      });
    }
  };

  const templateOptions = Object.values(PUBLIC_TEMPLATES).map((tpl) => ({
    value: tpl.id,
    label: tpl.name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {t("publicPage.title", "Public Ordering Page")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t(
              "publicPage.desc",
              "Let customers place orders online without logging in. Business plan only."
            )}
          </p>
        </div>
        <LHelpButton size="icon" className="shrink-0" />
      </div>

      <LCard variant="outlined" padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">
              {t("publicPage.enable", "Enable public ordering")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("publicPage.enableDesc", "Customers can order via your public link")}
            </p>
          </div>
          <LToggle
            checked={enabled}
            onChange={(v) => { setEnabled(v); if (!v) setErrors({}); }}
          />
        </div>

        <LTextInput
          label={t("publicPage.pageUrl", "Page URL") + (enabled ? " *" : "")}
          value={slugInput}
          onChange={(e) => { setSlugInput(e.target.value); if (errors.slug) setErrors((prev) => ({ ...prev, slug: undefined })); }}
          placeholder="my-laundry-shop"
          hint={enabled ? t("publicPage.slugHintRequired", "Required. Letters, numbers, hyphens only. Your link:") : t("publicPage.slugHint", "Letters, numbers, hyphens only. Your link:")}
          disabled={!enabled}
          error={errors.slug}
        />
        {enabled && slug && (
          <p className="text-xs text-muted-foreground font-mono break-all">
            {publicUrl}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {t("publicPage.template", "Page template")}
          </label>
          <LSelect
            value={templateId}
            onChange={(v) => setTemplateId(v as PublicTemplateId)}
            options={templateOptions}
            placeholder={t("publicPage.selectTemplate", "Select template")}
            disabled={!enabled}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("publicPage.openTime", "Open time")}{enabled ? " *" : ""}
            </label>
            <input
              type="time"
              value={openTime}
              onChange={(e) => { setOpenTime(e.target.value); if (errors.openTime) setErrors((prev) => ({ ...prev, openTime: undefined })); }}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-foreground ${errors.openTime ? "border-destructive" : "border-border"}`}
              disabled={!enabled}
            />
            {errors.openTime ? (
              <p className="text-xs text-destructive mt-1">{errors.openTime}</p>
            ) : enabled ? (
              <p className="text-xs text-muted-foreground mt-1">
                {t("publicPage.openTimeRequiredHint", "Required. Shown on your public page.")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {t("publicPage.openTimeHint", "Shown on public page; required when enabled")}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("publicPage.closeTime", "Close time")}{enabled ? " *" : ""}
            </label>
            <input
              type="time"
              value={closeTime}
              onChange={(e) => { setCloseTime(e.target.value); if (errors.closeTime) setErrors((prev) => ({ ...prev, closeTime: undefined })); }}
              className={`w-full px-3 py-2 rounded-lg border bg-background text-foreground ${errors.closeTime ? "border-destructive" : "border-border"}`}
              disabled={!enabled}
            />
            {errors.closeTime ? (
              <p className="text-xs text-destructive mt-1">{errors.closeTime}</p>
            ) : enabled ? (
              <p className="text-xs text-muted-foreground mt-1">
                {t("publicPage.closeTimeRequiredHint", "Required. Shown on your public page.")}
              </p>
            ) : null}
          </div>
        </div>

        {/* Coupon code – shown on public page; customers click to copy */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">
              {t("publicPage.featuredCouponCodeTitle", "Featured coupon code")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("publicPage.featuredCouponCodeHintSettings", "Show a copyable coupon code on your public page. Customers click to copy and use it at checkout. Use one of your coupon codes below, or enter a code to display.")}
          </p>
          <LTextInput
            label={t("publicPage.featuredCouponCode", "Coupon code to display")}
            value={featuredCouponCode}
            onChange={(e) => setFeaturedCouponCode(e.target.value.toUpperCase())}
            placeholder="SAVE10"
            hint={t("publicPage.featuredCouponCodeHint", "Leave empty to show your first coupon from the list below.")}
          />
        </div>

        {/* Testimonials – shown on public page before area selector */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">
              {t("publicPage.testimonials", "Testimonials & Reviews")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("publicPage.testimonialsHint", "Show customer reviews and trust signals (e.g. orders completed) on your public page.")}
          </p>
          {testimonials.map((testimonial, i) => (
            <div
              key={testimonial.id || i}
              className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/20"
            >
              <textarea
                value={testimonial.quote}
                onChange={(e) => {
                  const next = [...testimonials];
                  next[i] = { ...next[i], quote: e.target.value };
                  setTestimonials(next);
                }}
                placeholder="Customer quote / review"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={testimonial.author}
                  onChange={(e) => {
                    const next = [...testimonials];
                    next[i] = { ...next[i], author: e.target.value };
                    setTestimonials(next);
                  }}
                  placeholder="Author name"
                  className="flex-1 min-w-[120px] px-2 py-1.5 text-sm border border-border rounded bg-background"
                />
                <input
                  type="text"
                  value={testimonial.location || ""}
                  onChange={(e) => {
                    const next = [...testimonials];
                    next[i] = { ...next[i], location: e.target.value || undefined };
                    setTestimonials(next);
                  }}
                  placeholder="Area (optional)"
                  className="w-28 px-2 py-1.5 text-sm border border-border rounded bg-background"
                />
                <input
                  type="number"
                  min={0}
                  value={testimonial.ordersCount ?? ""}
                  onChange={(e) => {
                    const next = [...testimonials];
                    next[i] = { ...next[i], ordersCount: e.target.value ? Number(e.target.value) : undefined };
                    setTestimonials(next);
                  }}
                  placeholder="Orders (e.g. 50)"
                  className="w-20 px-2 py-1.5 text-sm border border-border rounded bg-background"
                />
              </div>
              <button
                type="button"
                onClick={() => setTestimonials(testimonials.filter((_, j) => j !== i))}
                className="self-start p-1.5 text-destructive hover:bg-destructive/10 rounded text-sm"
              >
                <Trash2 className="h-4 w-4 inline mr-1" /> Remove
              </button>
            </div>
          ))}
          <LButton
            variant="outline"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setTestimonials([...testimonials, { id: `t-${Date.now()}`, quote: "", author: "" }])}
          >
            {t("publicPage.addTestimonial", "Add testimonial")}
          </LButton>
        </div>

        {/* Social links – shown in public page header */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">
              {t("publicPage.socialLinks", "Social media links")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("publicPage.socialLinksHint", "Optional. Shown in the header of your public page.")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(["facebook", "instagram", "twitter", "youtube", "linkedin", "whatsapp"] as const).map((key) => (
              <div key={key}>
                <label className="block text-xs font-medium text-muted-foreground mb-1 capitalize">{key}</label>
                <input
                  type="url"
                  value={socialLinks[key] ?? ""}
                  onChange={(e) => setSocialLinks({ ...socialLinks, [key]: e.target.value.trim() || undefined })}
                  placeholder={key === "whatsapp" ? "https://wa.me/919876543210" : `https://${key}.com/...`}
                  className="w-full px-3 py-2 text-sm border border-border rounded bg-background"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Coupons – customer enters code at checkout; no manual discount */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">
              {t("publicPage.coupons", "Coupons")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("publicPage.couponsHint", "Customers enter a code at checkout. Add codes below (e.g. SAVE10 for 10% off).")}
          </p>
          {coupons.map((c, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-border bg-muted/20"
            >
              <input
                type="text"
                value={c.code}
                onChange={(e) => {
                  const next = [...coupons];
                  next[i] = { ...next[i], code: e.target.value.toUpperCase() };
                  setCoupons(next);
                }}
                placeholder="CODE"
                className="w-24 px-2 py-1.5 text-sm font-mono uppercase border border-border rounded bg-background"
              />
              <select
                value={c.type}
                onChange={(e) => {
                  const next = [...coupons];
                  next[i] = { ...next[i], type: e.target.value as "percent" | "flat" };
                  setCoupons(next);
                }}
                className="text-sm border border-border rounded px-2 py-1.5 bg-background"
              >
                <option value="percent">% off</option>
                <option value="flat">{currencySymbol} off</option>
              </select>
              <input
                type="number"
                min={0}
                value={c.value}
                onChange={(e) => {
                  const next = [...coupons];
                  next[i] = { ...next[i], value: Number(e.target.value) || 0 };
                  setCoupons(next);
                }}
                className="w-16 px-2 py-1.5 text-sm border border-border rounded bg-background"
              />
              <span className="text-xs text-muted-foreground">
                {t("publicPage.minOrder", "Min order")} {currencySymbol}
              </span>
              <input
                type="number"
                min={0}
                value={c.minOrder ?? ""}
                onChange={(e) => {
                  const next = [...coupons];
                  next[i] = { ...next[i], minOrder: e.target.value ? Number(e.target.value) : undefined };
                  setCoupons(next);
                }}
                placeholder="0"
                className="w-20 px-2 py-1.5 text-sm border border-border rounded bg-background"
              />
              <button
                type="button"
                onClick={() => setCoupons(coupons.filter((_, j) => j !== i))}
                className="p-1.5 text-destructive hover:bg-destructive/10 rounded"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <LButton
            variant="outline"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setCoupons([...coupons, { code: "", type: "percent", value: 10 }])}
          >
            {t("publicPage.addCoupon", "Add coupon")}
          </LButton>
        </div>

        <div className="flex gap-2 pt-2">
          <LButton onClick={handleSave} loading={saving}>
            {t("common.save")}
          </LButton>
          <LButton variant="outline" onClick={handlePreview}>
            <ExternalLink className="h-4 w-4 mr-2" />
            {t("publicPage.preview", "Preview")}
          </LButton>
        </div>
      </LCard>
    </div>
  );
}
