/**
 * Delivery Settings Page
 * 
 * Dedicated page for managing:
 * - Service areas (where shop offers pickup/delivery)
 * - Pickup time slots
 * - Delivery time slots
 * 
 * All settings have enable/disable toggles
 */

import { useTranslation } from "react-i18next";
import { PageWrapper } from "@/components/PageWrapper";
import { ServiceAreasSettings } from "./ServiceAreasSettings";
import { Truck } from "lucide-react";

export function DeliverySettingsPage() {
    const { t } = useTranslation();

    return (
        <PageWrapper maxWidth="lg">
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Truck className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            {t("settings.deliverySettings", "Delivery & Pickup")}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t("settings.deliverySettingsDesc", "Configure service areas and time slots")}
                        </p>
                    </div>
                </div>
            </div>

            <ServiceAreasSettings />
        </PageWrapper>
    );
}
