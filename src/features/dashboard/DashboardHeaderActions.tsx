/**
 * Dashboard top-bar actions
 *
 * Rendered inside the shared top navbar (desktop, dashboard route only):
 * the active plan pill + the primary "New Order" CTA. Keeps the dashboard
 * body free of a redundant header row.
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Calendar, PlusCircle } from "lucide-react";
import { LButton } from "@/components/laundry";
import { useShopSubscription } from "@/hooks/use-shop-subscription";

export function DashboardHeaderActions() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { subscription } = useShopSubscription();

    const showPlan = subscription && subscription.planId !== "free" && subscription.status !== "expired";
    const expiringSoon =
        subscription?.daysRemaining != null && subscription.daysRemaining <= 15 && !!subscription.expiresAt;

    return (
        <div className="flex items-center gap-3">
            {showPlan && (
                <button
                    onClick={() => navigate("/settings/subscription")}
                    className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40"
                >
                    <span className="font-semibold text-foreground">{subscription.planName}</span>
                    {expiringSoon ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                            <Calendar className="h-3.5 w-3.5" />
                            {t('dashboard.planExpires', 'Expires')} {format(subscription.expiresAt!, "MMM d, yyyy")}
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground">{t('dashboard.planActive', 'Active')}</span>
                    )}
                </button>
            )}
            <LButton
                variant="primary"
                size="sm"
                leftIcon={<PlusCircle className="h-4 w-4" />}
                onClick={() => navigate("/new-order")}
            >
                {t('dashboard.newOrder', 'New Order')}
            </LButton>
        </div>
    );
}
