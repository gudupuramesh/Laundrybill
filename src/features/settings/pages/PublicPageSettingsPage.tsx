/**
 * Public Order Page Settings – standalone page (linked from left menu).
 * Renders the DS full-page setup; gates behind the publicOrderingPage feature.
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { PublicPageSettings } from "../PublicPageSettings";
import { useShopLimits } from "@/hooks/use-shop-limits";

export function PublicPageSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasFeature } = useShopLimits();
  const canAccessPublicPage = hasFeature("publicOrderingPage");

  if (!canAccessPublicPage) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-bg)", padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: "center", background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, boxShadow: "var(--sh-sm)", padding: 32 }}>
          <span style={{ width: 64, height: 64, borderRadius: 16, background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Globe size={30} />
          </span>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{t("publicPage.businessOnly", "Business plan feature")}</div>
          <p style={{ fontSize: 13.5, color: "var(--c-text-2)", lineHeight: 1.5, marginBottom: 20 }}>
            {t("publicPage.upgradeDesc", "Public ordering page allows your customers to place orders online without logging in. Upgrade to Business plan to enable this feature.")}
          </p>
          <button
            onClick={() => navigate("/settings/subscription")}
            style={{ cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 10, padding: "11px 22px", boxShadow: "var(--sh-sm)" }}
          >
            {t("common.upgradePlan", "Upgrade plan")}
          </button>
        </div>
      </div>
    );
  }

  return <PublicPageSettings />;
}
