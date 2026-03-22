/**
 * Staff Profile Page
 * 
 * View profile details and preferences
 * Matches Admin Settings aesthetic while being staff-specific (read-only)
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStaffAuth } from "../StaffAuthContext";
import {
    LCard,
    LBadge,
    LLanguageSelector,
    LDivider,
    useLToast,
} from "@/components/laundry";
import {
    Phone,
    Mail,
    Building2,
    LogOut,
    User,
    Settings,
    Globe,
    HelpCircle,
    ArrowLeft,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PageWrapper } from "@/components/PageWrapper";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type ProfileSection = "account" | "preferences";

interface ProfileNavItem {
    id: ProfileSection;
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
}

export function StaffProfilePage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { staff, shopName, signOut, firebaseUser } = useStaffAuth();
    const isMobile = useIsMobile();
    const { addToast } = useLToast();

    const [selectedSection, setSelectedSection] = useState<ProfileSection>("account");
    const [mobileShowDetail, setMobileShowDetail] = useState(false);

    const navItems: ProfileNavItem[] = [
        { id: "account", icon: <User className="h-5 w-5" />, title: t("staff.profile.accountDetails"), subtitle: t("common.phone") },
        { id: "preferences", icon: <Settings className="h-5 w-5" />, title: t("settings.preferences"), subtitle: t("settings.language") },
    ];

    const handleSignOut = () => {
        signOut();
        navigate("/staff/login");
    };

    const handleLanguageChange = async (lang: string) => {
        if (firebaseUser) {
            try {
                await updateDoc(doc(db, "users", firebaseUser.uid), {
                    language: lang
                });
                addToast({ type: "success", title: "Language updated" });
            } catch (err) {
                console.error("Failed to sync language", err);
            }
        }
    };

    const handleSectionClick = (section: ProfileSection) => {
        setSelectedSection(section);
        if (isMobile) {
            setMobileShowDetail(true);
        }
    };

    // Render left panel (navigation list) - matches Admin Settings structure
    const renderNavPanel = () => (
        <div className="h-full overflow-y-auto">
            {/* Profile Header - OUTSIDE cards */}
            <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary-muted flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{shopName || staff?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{staff?.phone || staff?.email}</p>
                        <p className="text-xs text-primary capitalize">{staff?.role || "Staff"}</p>
                    </div>
                </div>
            </div>

            {/* Navigation Items Card */}
            <div className="p-2 space-y-2">
                <LCard variant="outlined" className="p-0 overflow-hidden">
                    {navItems.map((item, index) => (
                        <div key={item.id}>
                            <button
                                onClick={() => handleSectionClick(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-4 transition-colors text-left",
                                    selectedSection === item.id && !isMobile
                                        ? "bg-primary/10"
                                        : "hover:bg-muted"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-lg",
                                    selectedSection === item.id && !isMobile ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                    {item.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn("font-medium text-sm", selectedSection === item.id && !isMobile && "text-primary")}>{item.title}</p>
                                    {item.subtitle && (
                                        <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                                    )}
                                </div>
                                {!isMobile && (
                                    <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                )}
                            </button>
                            {index < navItems.length - 1 && <LDivider />}
                        </div>
                    ))}
                </LCard>

                <div className="h-1" />

                {/* Help & Support Card */}
                <LCard variant="outlined" className="p-0 overflow-hidden">
                    <button className="w-full flex items-center gap-3 p-4 transition-colors text-left hover:bg-muted">
                        <HelpCircle className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium text-foreground text-sm">{t("settings.helpSupport")}</span>
                    </button>
                </LCard>

                <div className="h-1" />

                {/* Sign Out Card */}
                <LCard variant="outlined" className="p-0 overflow-hidden">
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 p-4 transition-colors text-left hover:bg-destructive/10"
                    >
                        <LogOut className="h-5 w-5 text-destructive" />
                        <span className="font-medium text-destructive text-sm">{t("auth.signOut")}</span>
                    </button>
                </LCard>
            </div>
        </div>
    );

    // Render detail panel content
    const renderDetailPanel = () => {
        if (selectedSection === "account") {
            return (
                <LCard title={t("staff.profile.accountDetails")}>
                    <div className="divide-y divide-border">
                        <ProfileItem icon={Phone} label={t("common.phone")} value={staff?.phone} />
                        {firebaseUser?.email && (
                            <ProfileItem icon={Mail} label={t("common.email")} value={firebaseUser.email} />
                        )}
                        <ProfileItem icon={Building2} label={t("common.shop")} value={shopName || undefined} />
                    </div>

                    {/* Account Status */}
                    <div className="p-4 border-t border-border">
                        <p className="text-xs text-muted-foreground uppercase mb-2">{t("staff.profile.accountStatus")}</p>
                        <div className="flex items-center gap-2">
                            <LBadge variant="success" size="sm">{t("staff.profile.active")}</LBadge>
                            {firebaseUser?.emailVerified && (
                                <LBadge variant="default" size="sm">{t("staff.profile.verified")}</LBadge>
                            )}
                        </div>
                    </div>
                </LCard>
            );
        }

        if (selectedSection === "preferences") {
            return (
                <LCard title={t("settings.preferences")}>
                    <div className="p-4">
                        <div className="mb-4">
                            <label className="text-sm font-medium mb-2 flex items-center gap-2">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                {t("settings.language")}
                            </label>
                        </div>
                        <LLanguageSelector
                            variant="list"
                            onLanguageChange={handleLanguageChange}
                        />
                    </div>
                </LCard>
            );
        }

        return null;
    };

    // Mobile: Show detail view with back button
    if (isMobile && mobileShowDetail) {
        return (
            <PageWrapper maxWidth="md">
                {/* Page Header with Back */}
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => setMobileShowDetail(false)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h1 className="text-xl font-bold">
                        {navItems.find(i => i.id === selectedSection)?.title || t("common.profile")}
                    </h1>
                </div>
                <div className="space-y-6">
                    {renderDetailPanel()}
                </div>
            </PageWrapper>
        );
    }

    // Mobile: Show nav panel
    if (isMobile) {
        return (
            <PageWrapper maxWidth="md">
                {/* Page Header */}
                <h1 className="text-xl font-bold mb-4">{t("common.profile")}</h1>
                <div className="space-y-4">
                    {renderNavPanel()}
                    <p className="text-center text-xs text-muted-foreground">
                        LaundryBill v1.0.0
                    </p>
                </div>
            </PageWrapper>
        );
    }

    // Desktop: Master-Detail Layout - matches Admin Settings structure
    return (
        <div className="flex h-[calc(100vh-64px)]">
            {/* Left Panel - Nav (fixed width like Admin) */}
            <div className="w-[320px] flex-shrink-0 border-r border-border bg-card overflow-hidden">
                {renderNavPanel()}
            </div>

            {/* Right Panel - Detail (flex-1 to fill remaining space) */}
            <div className="flex-1 bg-background overflow-hidden">
                <div className="p-6 overflow-y-auto h-full">
                    <h1 className="text-2xl font-bold mb-6">{t("settings.title")}</h1>
                    {renderDetailPanel()}
                    <p className="text-center text-xs text-muted-foreground pt-8">
                        LaundryBill v1.0.0
                    </p>
                </div>
            </div>
        </div>
    );
}

// Helper component
function ProfileItem({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
    if (!value) return null;
    return (
        <div className="flex items-center gap-4 p-4">
            <div className="p-2 bg-muted rounded-lg">
                <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
                <p className="text-xs text-muted-foreground uppercase">{label}</p>
                <p className="text-sm font-medium">{value}</p>
            </div>
        </div>
    );
}
