/**
 * Apps Page
 * 
 * Shows all available LaundryBoss apps that the owner can share with their team.
 * Each app card has a share button for WhatsApp sharing.
 * 
 * Design: Follows dashboard-like layout with proper spacing and LCard usage
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageWrapper } from "@/components/PageWrapper";
import {
    LCard,
    LButton,
    LBadge,
    LHelpButton,
} from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/features/auth/AuthContext";
import {
    Users,
    Truck,
    Factory,
    Share2,
    ExternalLink,
    Check,
    Smartphone,
    Copy,
    Info,
    CheckCircle2,
    Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppInfo {
    id: string;
    name: string;
    shortName: string;
    description: string;
    icon: React.ReactNode;
    iconBg: string;
    path: string;
    status: "available" | "coming_soon";
}

// Apps are defined inside the component to access translations

export function AppsPage() {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const { shopName } = useAuth();
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Get the base URL for sharing
    const getAppUrl = (path: string) => {
        const baseUrl = window.location.origin;
        return `${baseUrl}${path}`;
    };

    const apps: AppInfo[] = [
        {
            id: "staff",
            name: t('apps.staffApp', 'Staff App'),
            shortName: "Staff",
            description: t('apps.staffAppDesc', 'Take orders, manage customers, process payments'),
            icon: <Users className="h-6 w-6 text-white" />,
            iconBg: "bg-blue-500",
            path: "/staff",
            status: "available",
        },
        {
            id: "agent",
            name: t('apps.deliveryAgent', 'Delivery Agent'),
            shortName: "Agent",
            description: t('apps.deliveryAgentDesc', 'Pickup and deliver orders to customers'),
            icon: <Truck className="h-6 w-6 text-white" />,
            iconBg: "bg-green-500",
            path: "/agent",
            status: "available",
        },
        {
            id: "plant",
            name: t('apps.plantDashboard', 'Plant Dashboard'),
            shortName: "Plant",
            description: t('apps.plantDashboardDesc', 'Track washing, ironing, and packing'),
            icon: <Factory className="h-6 w-6 text-white" />,
            iconBg: "bg-purple-500",
            path: "/plant",
            status: "available",
        },
    ];

    // Share via WhatsApp
    const shareViaWhatsApp = (app: AppInfo) => {
        const url = getAppUrl(app.path);
        const headline = t('apps.shareMessage', { appName: app.name });
        const message = `${shopName || "Our shop"} is using LaundryBill!

${headline}
${url}

1. ${t('apps.step1')}
2. ${t('apps.step2')}
3. ${t('apps.step3')}
4. ${t('apps.step4')}`;

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, "_blank");
    };

    // Copy link to clipboard
    const copyLink = async (app: AppInfo) => {
        const url = getAppUrl(app.path);
        await navigator.clipboard.writeText(url);
        setCopiedId(app.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Open app in new tab
    const openApp = (app: AppInfo) => {
        window.open(getAppUrl(app.path), "_blank");
    };

    return (
        <PageWrapper maxWidth="lg">
            {/* Page Header */}
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        {t("apps.title", "Apps")}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t("apps.subtitle", "Share these apps with your team")}
                    </p>
                </div>
                <LHelpButton size="icon" className="shrink-0 mt-1" />
            </div>

            {/* How it works - Compact Info Card */}
            <LCard className="mb-6 border-primary/20 bg-primary/5">
                <div className="flex gap-4">
                    <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Info className="h-5 w-5 text-primary" />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm mb-2">
                            {t("apps.howItWorks", "How it works")}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">1</span>
                                <span>{t('apps.step1')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">2</span>
                                <span>{t('apps.step2')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">3</span>
                                <span>{t('apps.step3')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">4</span>
                                <span>{t('apps.step4')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </LCard>

            {/* Apps List */}
            <div className="space-y-4">
                {apps.map((app) => (
                    <LCard
                        key={app.id}
                        className={cn(
                            "transition-all",
                            app.status === "coming_soon" && "opacity-70"
                        )}
                    >
                        <div className="flex items-start gap-4">
                            {/* App Icon */}
                            <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                                app.iconBg
                            )}>
                                {app.icon}
                            </div>

                            {/* App Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-foreground">
                                        {app.name}
                                    </h3>
                                    {app.status === "available" ? (
                                        <LBadge color="success" size="sm">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            {t("apps.available", "Available")}
                                        </LBadge>
                                    ) : (
                                        <LBadge variant="warning" size="sm">
                                            <Clock className="h-3 w-3 mr-1" />
                                            {t("apps.comingSoon", "Coming Soon")}
                                        </LBadge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {app.description}
                                </p>

                                {/* Actions - Only for available apps */}
                                {app.status === "available" && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <LButton
                                            variant="primary"
                                            size="sm"
                                            leftIcon={<Share2 className="h-4 w-4" />}
                                            onClick={() => shareViaWhatsApp(app)}
                                        >
                                            {isMobile ? t('apps.share') : t('apps.shareWhatsApp')}
                                        </LButton>
                                        <LButton
                                            variant="outline"
                                            size="sm"
                                            leftIcon={copiedId === app.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                            onClick={() => copyLink(app)}
                                        >
                                            {copiedId === app.id ? t('apps.copied') : t('apps.copyLink')}
                                        </LButton>
                                        <LButton
                                            variant="ghost"
                                            size="sm"
                                            leftIcon={<ExternalLink className="h-4 w-4" />}
                                            onClick={() => openApp(app)}
                                        >
                                            {t('apps.open')}
                                        </LButton>
                                    </div>
                                )}
                            </div>
                        </div>
                    </LCard>
                ))}
            </div>

            {/* Footer tip */}
            <div className="mt-6 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    {t("apps.qrHint", "Tip: Print QR codes for easy app installation in your shop")}
                </p>
            </div>
        </PageWrapper>
    );
}
