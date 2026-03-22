/**
 * Driver Profile Page
 * 
 * Agent's profile with:
 * - Profile info (name, phone, vehicle)
 * - Today's stats (pickups, deliveries, collected)
 * - Online/offline toggle
 * - Logout button
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDriverAuth } from "../DriverAuthContext";
import { useDriverTasks } from "../hooks/use-driver-tasks";
import {
    LCard,
    LButton,
    LAvatar,
    LToggle,
    LStatCard,
    LDivider,
} from "@/components/laundry";
import { PageWrapper } from "@/components/PageWrapper";
import {
    Phone,
    Truck,
    MapPin,
    Package,
    LogOut,
    Settings,
    HelpCircle,
    ChevronRight,
} from "lucide-react";

export function DriverProfilePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { agent, signOut, isOnline, goOnline, goOffline, loading: authLoading } = useDriverAuth();
    const { lifetimeStats } = useDriverTasks();
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            signOut();
            navigate("/agent/login");
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            setLoggingOut(false);
        }
    };

    const handleOnlineToggle = async (checked: boolean) => {
        try {
            if (checked) {
                await goOnline();
            } else {
                await goOffline();
            }
        } catch (error) {
            console.error("Failed to update online status:", error);
        }
    };

    return (
        <PageWrapper maxWidth="lg">
            {/* Profile Header */}
            <LCard variant="outlined" padding="lg" className="mb-4">
                <div className="flex items-center gap-4 mb-4">
                    <LAvatar
                        name={agent?.name || "Agent"}
                        size="lg"
                    />
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-foreground">
                            {agent?.name || t("agent.unknownAgent", "Agent")}
                        </h1>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {agent?.phone || "---"}
                        </p>
                    </div>
                </div>

                {/* Vehicle Info */}
                {agent?.vehicle && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                        <Truck className="h-4 w-4" />
                        <span className="capitalize">{agent.vehicle.type}</span>
                        {agent.vehicle.number && (
                            <>
                                <span>•</span>
                                <span className="font-mono">{agent.vehicle.number}</span>
                            </>
                        )}
                    </div>
                )}

                {/* Service Areas */}
                {agent?.serviceAreas && agent.serviceAreas.length > 0 && (
                    <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {t("agent.serviceAreas", "Service Areas")}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {agent.serviceAreas.map((area, idx) => (
                                <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs"
                                >
                                    {area}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </LCard>

            {/* Online Status */}
            <LCard variant="outlined" padding="md" className="mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOnline ? 'bg-success/10' : 'bg-muted'}`}>
                            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                        </div>
                        <div>
                            <p className="font-medium text-foreground">
                                {isOnline ? t("agent.online", "Online") : t("agent.offline", "Offline")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {isOnline
                                    ? t("agent.readyForTasks", "Ready to receive tasks")
                                    : t("agent.notReceivingTasks", "Not receiving new tasks")}
                            </p>
                        </div>
                    </div>
                    <LToggle
                        checked={isOnline}
                        onChange={handleOnlineToggle}
                        disabled={authLoading}
                    />
                </div>
            </LCard>

            {/* Lifetime Stats */}
            <div className="mb-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {t("agent.lifetimeStats", "Total Stats")}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <LStatCard
                        title={t("agent.pickups", "Pickups")}
                        value={`${lifetimeStats.pickupsCompleted}`}
                        icon={<Package className="h-5 w-5" />}
                        variant="default"
                    />
                    <LStatCard
                        title={t("agent.deliveries", "Deliveries")}
                        value={`${lifetimeStats.deliveriesCompleted}`}
                        icon={<Truck className="h-5 w-5" />}
                        variant="default"
                    />
                </div>
            </div>

            <LDivider className="my-4" />

            {/* Menu Items */}
            <div className="space-y-2">
                <button
                    onClick={() => {/* TODO: Open settings */ }}
                    className="w-full flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Settings className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium text-foreground">{t("agent.settings", "Settings")}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>

                <button
                    onClick={() => {/* TODO: Open help */ }}
                    className="w-full flex items-center justify-between p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <HelpCircle className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium text-foreground">{t("agent.help", "Help & Support")}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
            </div>

            <LDivider className="my-4" />

            {/* Logout Button */}
            <LButton
                variant="outline"
                size="lg"
                leftIcon={<LogOut className="h-5 w-5" />}
                onClick={handleLogout}
                loading={loggingOut}
                fullWidth
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
            >
                {t("agent.logout", "Logout")}
            </LButton>
        </PageWrapper>
    );
}
