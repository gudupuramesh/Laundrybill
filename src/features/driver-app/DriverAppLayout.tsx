/**
 * Driver App Layout
 * 
 * Responsive layout with sidebar on desktop and bottom tabs on mobile
 * Matching Staff App structure for design consistency
 * Uses primary color (not custom green) for theming consistency
 */

import { useState, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDriverAuth } from "./DriverAuthContext";
import { useAgentFcmToken } from "./hooks/use-agent-fcm-token";
import {
    LayoutDashboard,
    MapPin,
    Truck,
    QrCode,
    User,
    Menu,
    LogOut,
    Power,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import {
    LSidebar,
    LLanguageSelector,
    LBottomTabBar,
    LBottomSheet,
    LList,
    LListItem,
    LDivider,
    LTopNavbar,
    LToggle,
} from "@/components/laundry";

// Sidebar items for desktop
const sidebarItemsConfig = [
    { id: "today", labelKey: "agent.today", icon: LayoutDashboard, href: "/agent" },
    { id: "pickups", labelKey: "agent.pickups", icon: MapPin, href: "/agent/pickups" },
    { id: "scan", labelKey: "agent.scan", icon: QrCode, href: "/agent/scan" },
    { id: "deliveries", labelKey: "agent.deliveries", icon: Truck, href: "/agent/deliveries" },
    { id: "profile", labelKey: "agent.profile", icon: User, href: "/agent/profile" },
];

// More menu items (shown in bottom sheet on mobile)
const moreMenuItemsConfig = [
    { id: "today", labelKey: "agent.today", icon: LayoutDashboard, href: "/agent" },
    { id: "pickups", labelKey: "agent.pickups", icon: MapPin, href: "/agent/pickups" },
    { id: "deliveries", labelKey: "agent.deliveries", icon: Truck, href: "/agent/deliveries" },
    { id: "scan", labelKey: "agent.scan", icon: QrCode, href: "/agent/scan" },
    { id: "profile", labelKey: "agent.profile", icon: User, href: "/agent/profile" },
];

export function DriverAppLayout() {
    const { t } = useTranslation();
    const { agent, shopId, shopName, isOnline, goOnline, goOffline, signOut } = useDriverAuth();
    useAgentFcmToken(shopId ?? null, agent?.id ?? null, agent?.memberType);
    const location = useLocation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const [showMoreSheet, setShowMoreSheet] = useState(false);

    // Handle sign out
    const handleSignOut = () => {
        signOut();
        navigate("/agent/login");
    };

    // Handle online toggle
    const handleOnlineToggle = async () => {
        if (isOnline) {
            await goOffline();
        } else {
            await goOnline();
        }
    };

    // Create translated tab items for mobile bottom bar (matching Staff pattern)
    const mobileTabItems = useMemo(() => [
        { id: "today", label: t("agent.today", "Today"), icon: <LayoutDashboard className="h-5 w-5" /> },
        { id: "pickups", label: t("agent.pickups", "Pickups"), icon: <MapPin className="h-5 w-5" /> },
        { id: "scan", label: t("agent.scan", "Scan"), icon: <QrCode className="h-5 w-5" />, primary: true }, // Highlight Scan
        { id: "deliveries", label: t("agent.deliveries", "Deliveries"), icon: <Truck className="h-5 w-5" /> },
        { id: "more", label: t("common.more", "More"), icon: <Menu className="h-5 w-5" /> },
    ], [t]);

    // Translate sidebar items
    const sidebarItems = useMemo(() =>
        sidebarItemsConfig.map(item => ({
            ...item,
            label: t(item.labelKey, item.labelKey.split('.')[1]),
        })),
        [t]);

    // Translate more menu items
    const moreMenuItems = useMemo(() =>
        moreMenuItemsConfig.map(item => ({
            ...item,
            label: t(item.labelKey, item.labelKey.split('.')[1]),
        })),
        [t]);

    // Determine active tab/sidebar item
    const getActiveTab = (): string => {
        const path = location.pathname;

        for (const item of sidebarItemsConfig) {
            if (item.href === "/agent" && path === "/agent") {
                return item.id;
            }
            if (item.href !== "/agent" && path.startsWith(item.href)) {
                return item.id;
            }
        }

        return "today";
    };

    const activeTab = getActiveTab();

    // Get page title based on current path
    const getPageTitle = (): string => {
        const path = location.pathname;
        const item = sidebarItems.find((i) =>
            i.href === "/agent" ? path === "/agent" : path.startsWith(i.href)
        );
        return item?.label || t("agent.appName", "Agent App");
    };

    // Handle tab change
    const handleTabChange = (tabId: string) => {
        if (tabId === "more") {
            setShowMoreSheet(true);
            return;
        }

        const routes: Record<string, string> = {
            today: "/agent",
            pickups: "/agent/pickups",
            deliveries: "/agent/deliveries",
            scan: "/agent/scan",
        };

        if (routes[tabId]) {
            navigate(routes[tabId]);
        }
    };

    // Handle sidebar navigation
    const handleSidebarNav = (item: typeof sidebarItems[0]) => {
        navigate(item.href);
    };

    return (
        <div className="h-screen bg-background flex w-full max-w-full overflow-hidden">
            {/* Desktop Sidebar */}
            {!isMobile && (
                <LSidebar
                    items={sidebarItems.map((item) => ({
                        id: item.id,
                        label: item.label,
                        icon: item.icon,
                        onClick: () => handleSidebarNav(item),
                    }))}
                    activeId={activeTab}
                    logo={
                        <div className="flex items-center gap-2 font-bold text-xl text-primary">
                            <Truck className="h-6 w-6" />
                            <span>{t("agent.appName", "Agent App")}</span>
                        </div>
                    }
                    collapsedLogo={
                        <div className="flex items-center justify-center font-bold text-xl text-primary">
                            <Truck className="h-6 w-6" />
                        </div>
                    }
                    footer={
                        <div className="space-y-3 px-2 pb-2">
                            {/* Online/Offline Toggle */}
                            <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                                <div className="flex items-center gap-2">
                                    <Power className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">
                                        {isOnline ? t("agent.online", "Online") : t("agent.offline", "Offline")}
                                    </span>
                                </div>
                                <LToggle
                                    checked={isOnline}
                                    onChange={handleOnlineToggle}
                                    size="sm"
                                />
                            </div>
                            {/* User Info */}
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                    {agent?.name?.charAt(0).toUpperCase() || "A"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {agent?.name || "Agent"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {shopName || "Shop"}
                                    </p>
                                </div>
                                <button
                                    onClick={handleSignOut}
                                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                    title={t("auth.signOut", "Sign out")}
                                >
                                    <LogOut className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    }
                />
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen w-full min-w-0 overflow-hidden">
                {/* Top Navbar - mobile only */}
                {isMobile && (
                    <LTopNavbar
                        title={getPageTitle()}
                        showBack={location.pathname !== "/agent"}
                        onBack={() => navigate(-1)}
                        showMenu={true}
                        onMenu={() => setShowMoreSheet(true)}
                        showNotifications={false}
                        user={{ name: agent?.name || "Agent" }}
                        onUserClick={() => navigate("/agent/profile")}
                    />
                )}

                {/* Page Content - Scrollable */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-4 w-full min-w-0">
                    <Outlet />
                </main>
            </div>

            {/* Mobile Bottom Navigation - Match Staff pattern */}
            {isMobile && (
                <LBottomTabBar
                    items={mobileTabItems}
                    activeId={activeTab}
                    onTabChange={handleTabChange}
                />
            )}

            {/* More Menu Bottom Sheet */}
            <LBottomSheet
                open={showMoreSheet}
                onClose={() => setShowMoreSheet(false)}
                title={t("common.more", "More")}
            >
                <div className="p-4">
                    {/* Online/Offline Toggle in More Menu */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOnline ? 'bg-success/20' : 'bg-muted'}`}>
                                <Power className={`h-5 w-5 ${isOnline ? 'text-success' : 'text-muted-foreground'}`} />
                            </div>
                            <div>
                                <p className="font-medium">{isOnline ? t("agent.online", "Online") : t("agent.offline", "Offline")}</p>
                                <p className="text-sm text-muted-foreground">
                                    {isOnline
                                        ? t("agent.statusOnline", "Receiving tasks")
                                        : t("agent.statusOffline", "Not receiving tasks")}
                                </p>
                            </div>
                        </div>
                        <LToggle
                            checked={isOnline}
                            onChange={handleOnlineToggle}
                        />
                    </div>
                </div>
                <LList>
                    {moreMenuItems.map((item) => (
                        <LListItem
                            key={item.id}
                            title={item.label}
                            leftContent={
                                <div className="p-2 rounded-lg bg-muted">
                                    <item.icon className="h-5 w-5 text-muted-foreground" />
                                </div>
                            }
                            showChevron
                            onClick={() => {
                                navigate(item.href);
                                setShowMoreSheet(false);
                            }}
                        />
                    ))}
                </LList>
                <LDivider />
                <div className="px-4 py-3">
                    <p className="text-sm font-medium mb-2">{t("settings.language", "Language")}</p>
                    <LLanguageSelector variant="dropdown" />
                </div>
            </LBottomSheet>
        </div>
    );
}
