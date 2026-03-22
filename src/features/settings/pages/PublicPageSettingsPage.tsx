/**
 * Public Order Page Settings – standalone page (linked from left menu).
 * Wraps PublicPageSettings with feature check and upgrade prompt.
 */

import { useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { LCard, LButton } from "@/components/laundry";
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
      <PageWrapper>
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">
              {t("publicPage.title", "Public Ordering Page")}
            </h1>
          </div>
          <LCard variant="outlined" padding="lg" className="text-center space-y-4">
            <div className="p-4 rounded-full bg-primary/10 inline-block">
              <Globe className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {t("publicPage.businessOnly", "Business Plan Feature")}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t(
                "publicPage.upgradeDesc",
                "Public ordering page allows your customers to place orders online without logging in. Upgrade to Business plan to enable this feature."
              )}
            </p>
            <LButton variant="primary" onClick={() => navigate("/settings/subscription")}>
              {t("common.upgradePlan", "Upgrade Plan")}
            </LButton>
          </LCard>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <PublicPageSettings />
    </PageWrapper>
  );
}
