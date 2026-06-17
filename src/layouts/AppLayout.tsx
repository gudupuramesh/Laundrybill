/**
 * App Layout
 * 
 * Responsive layout with sidebar on desktop and bottom tabs on mobile
 */

import { useState, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    LBottomTabBar,
    LSidebar,
    LTopNavbar,
    LAvatar,
    LBottomSheet,
    LList,
    LListItem,
    LDivider,
    LLanguageSelector,
} from "@/components/laundry";
import { useAuth } from "@/features/auth/AuthContext";
import { useFcmTokenRegistration, useFcmForegroundHandler } from "@/hooks/use-fcm-token";
import app from "@/lib/firebase";
import { useIsMobile } from "@/hooks/use-mobile";
import {
    LayoutDashboard,
    PlusCircle,
    ClipboardList,
    Users,
    Menu,
    Package,
    Settings,
    IndianRupee,
    UserCog,
    LogOut,
    Calendar,
    ShoppingCart,
    FileText,
    Smartphone,
    QrCode,
    Crown,
    Globe,
    HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useOrderSummary } from "@/hooks/use-order-summary";
import { useSeenOnlineOrders, SeenOnlineOrdersContext } from "@/hooks/use-seen-online-orders";
import type { PlanFeatures } from "@/types/plans";
import { HelpQuickSheet } from "@/features/help";
import { DashboardHeaderActions } from "@/features/dashboard/DashboardHeaderActions";

// Sidebar item config (without translated labels)
interface SidebarNavItem {
    id: string;
    labelKey: string;
    icon: LucideIcon;
    href: string;
    adminOnly?: boolean;
    feature?: keyof PlanFeatures;
}

// Sidebar items for desktop (keys for translation)
const sidebarItemsConfig: SidebarNavItem[] = [
    { id: "dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { id: "new-order", labelKey: "nav.newOrder", icon: PlusCircle, href: "/new-order" },
    { id: "orders", labelKey: "nav.orders", icon: ClipboardList, href: "/orders" },
    { id: "customers", labelKey: "nav.customers", icon: Users, href: "/customers" },
    { id: "inventory", labelKey: "nav.services", icon: Package, href: "/inventory", adminOnly: true, feature: "services" },
    { id: "staff", labelKey: "nav.staff", icon: UserCog, href: "/manage-staff", adminOnly: true, feature: "staffManagement" },
    { id: "attendance", labelKey: "nav.attendance", icon: Calendar, href: "/attendance", adminOnly: true, feature: "attendance" },
    { id: "payroll", labelKey: "nav.payroll", icon: IndianRupee, href: "/payroll", adminOnly: true, feature: "payroll" },
    { id: "expenses", labelKey: "nav.expenses", icon: ShoppingCart, href: "/expenses", adminOnly: true, feature: "expenses" },
    { id: "reports", labelKey: "nav.reports", icon: FileText, href: "/reports", adminOnly: true, feature: "reports" },
    { id: "apps", labelKey: "nav.apps", icon: Smartphone, href: "/apps", adminOnly: true }, // Keep generic or feature flag specific apps?
    { id: "scan", labelKey: "common.scan", icon: QrCode, href: "/scan", feature: "qrScans" },
    { id: "publicPage", labelKey: "publicPage.title", icon: Globe, href: "/settings/public-page", feature: "publicOrderingPage" },
    { id: "subscription", labelKey: "nav.subscription", icon: Crown, href: "/settings/subscription", adminOnly: true },
    { id: "settings", labelKey: "nav.settings", icon: Settings, href: "/settings" },
];

// More menu items for mobile (subset of sidebar items)
const moreMenuItemsConfig: SidebarNavItem[] = [
    { id: "inventory", labelKey: "nav.services", icon: Package, href: "/inventory", adminOnly: true, feature: "services" },
    { id: "staff", labelKey: "nav.staff", icon: UserCog, href: "/manage-staff", adminOnly: true, feature: "staffManagement" },
    { id: "attendance", labelKey: "nav.attendance", icon: Calendar, href: "/attendance", adminOnly: true, feature: "attendance" },
    { id: "payroll", labelKey: "nav.payroll", icon: IndianRupee, href: "/payroll", adminOnly: true, feature: "payroll" },
    { id: "expenses", labelKey: "nav.expenses", icon: ShoppingCart, href: "/expenses", adminOnly: true, feature: "expenses" },
    { id: "reports", labelKey: "nav.reports", icon: FileText, href: "/reports", adminOnly: true, feature: "reports" },
    { id: "apps", labelKey: "nav.apps", icon: Smartphone, href: "/apps", adminOnly: true },
    { id: "scan", labelKey: "common.scan", icon: QrCode, href: "/scan", feature: "qrScans" },
    { id: "publicPage", labelKey: "publicPage.title", icon: Globe, href: "/settings/public-page", feature: "publicOrderingPage" },
    { id: "subscription", labelKey: "nav.subscription", icon: Crown, href: "/settings/subscription", adminOnly: true },
    { id: "help", labelKey: "nav.help", icon: HelpCircle, href: "/help" },
    { id: "settings", labelKey: "nav.settings", icon: Settings, href: "/settings" },
];

export function AppLayout() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useIsMobile();
    const { user, shopId, role, shopName, signOut } = useAuth();

    // Register FCM token for push notifications (new online order alerts)
    useFcmTokenRegistration(app, shopId ?? null, user?.uid ?? null);
    // Play sound when new online order arrives (app in foreground)
    useFcmForegroundHandler(app);

    const [showMoreSheet, setShowMoreSheet] = useState(false);
    const [helpSheetOpen, setHelpSheetOpen] = useState(false);

    // Unseen online orders count for Orders badge (sidebar + mobile tab)
    const { onlineOrderIds = [] } = useOrderSummary();
    const { unseenCount, markSeen } = useSeenOnlineOrders(onlineOrderIds);
    const mobileTabItems = useMemo(() => [
        { id: "dashboard", label: t("common.home"), icon: <LayoutDashboard className="h-5 w-5" /> },
        { id: "new-order", label: t("pos.newOrder").split(" ")[0], icon: <PlusCircle className="h-6 w-6" />, primary: true },
        { id: "orders", label: t("common.orders"), icon: <ClipboardList className="h-5 w-5" />, badge: unseenCount > 0 ? unseenCount : undefined },
        { id: "customers", label: t("common.customers"), icon: <Users className="h-5 w-5" /> },
        { id: "more", label: t("common.more"), icon: <Menu className="h-5 w-5" /> },
    ], [t, unseenCount]);

    // Translate sidebar items
    const sidebarItems = useMemo(() =>
        sidebarItemsConfig.map(item => ({
            ...item,
            label: t(item.labelKey),
        })),
        [t]);

    // Translate more menu items
    const moreMenuItems = useMemo(() =>
        moreMenuItemsConfig.map(item => ({
            ...item,
            label: t(item.labelKey),
        })),
        [t]);

    // Determine active tab/sidebar item
    const getActiveTab = (): string => {
        const path = location.pathname;

        // Check against all sidebar items
        for (const item of sidebarItemsConfig) {
            if (path === item.href || path.startsWith(item.href + "/")) {
                return item.id;
            }
        }

        // Fallback checks for specific routes
        if (path.startsWith("/orders")) return "orders";
        if (path.startsWith("/customers")) return "customers";
        if (path.startsWith("/new-order")) return "new-order";
        if (path === "/dashboard") return "dashboard";
        if (path.startsWith("/inventory")) return "inventory";
        if (path.startsWith("/staff")) return "staff";
        if (path.startsWith("/attendance")) return "attendance";
        if (path.startsWith("/payroll")) return "payroll";
        if (path.startsWith("/expenses")) return "expenses";
        if (path.startsWith("/reports")) return "reports";
        if (path.startsWith("/settings")) return "settings";
        if (path.startsWith("/shop-settings")) return "settings";

        return "dashboard";
    };

    const activeTab = getActiveTab();

    // Handle tab change
    const handleTabChange = (tabId: string) => {
        if (tabId === "more") {
            setShowMoreSheet(true);
            return;
        }

        const routes: Record<string, string> = {
            dashboard: "/dashboard",
            "new-order": "/new-order",
            orders: "/orders",
            customers: "/customers",
        };

        if (routes[tabId]) {
            navigate(routes[tabId]);
        }
    };

    // Handle sidebar navigation
    const handleSidebarNav = (item: (typeof sidebarItems)[0]) => {
        navigate(item.href);
    };

    const { hasFeature } = useShopLimits();

    // Filter items based on role AND feature access
    const filteredSidebarItems = sidebarItems.filter(
        (item) => (!item.adminOnly || role === "admin") &&
            (!item.feature || hasFeature(item.feature))
    );

    const filteredMoreItems = moreMenuItems.filter(
        (item) => (!item.adminOnly || role === "admin") &&
            (!item.feature || hasFeature(item.feature))
    );

    // Get page title
    const getPageTitle = (): string => {
        const path = location.pathname;
        const item = sidebarItems.find((i) => path.startsWith(i.href));
        return item?.label || "LaundryBill";
    };

    // List of top-level routes that should navigate to dashboard on back
    const topLevelRoutes = [
        "/new-order",
        "/orders",
        "/customers",
        "/inventory",
        "/manage-staff",
        "/attendance",
        "/payroll",
        "/expenses",
        "/reports",
        "/apps",
        "/scan",
        "/help",
        "/settings"
    ];

    const handleBack = () => {
        // If on a top-level page, go to dashboard
        // We check if the current pathname exactly matches one of the top-level routes
        // This ensures detail pages (e.g. /orders/123) still use history back behavior
        if (topLevelRoutes.includes(location.pathname)) {
            navigate("/dashboard");
        } else {
            navigate(-1);
        }
    };

    return (
        <div className="h-screen bg-background flex w-full max-w-full overflow-hidden">
            {/* Desktop Sidebar - Fixed */}
            {!isMobile && (
                <LSidebar
                    items={filteredSidebarItems.map((item) => ({
                        id: item.id,
                        label: item.label,
                        icon: item.icon,
                        onClick: () => handleSidebarNav(item),
                        badge: item.id === "orders" && unseenCount > 0 ? unseenCount : undefined,
                    }))}
                    activeId={activeTab}
                    logo={
                        <span className="font-bold text-xl text-white">
                            Laundry<span style={{ color: "hsl(var(--primary-light))" }}>Bill</span>
                        </span>
                    }
                    collapsedLogo={
                        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white font-bold text-sm">
                            LB
                        </div>
                    }
                    footer={
                        <div className="flex items-center gap-3">
                            <LAvatar name={user?.displayName || "User"} size="sm" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                    {shopName || user?.displayName}
                                </p>
                                <p className="text-xs text-sidebar-foreground capitalize">
                                    {role}
                                </p>
                            </div>
                            <button
                                onClick={signOut}
                                className="p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors"
                                title="Sign out"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </div>
                    }
                />
            )}

            {/* Main Content Area - Scrollable */}
            <div className="flex-1 flex flex-col h-screen w-full min-w-0 overflow-hidden">
                {/* Top Navbar - Hidden on order detail pages (they have their own header) */}
                {!location.pathname.match(/^\/orders\/[^/]+$/) && (
                    <LTopNavbar
                        title={getPageTitle()}
                        showBack={location.pathname !== "/dashboard"}
                        onBack={handleBack}
                        showMenu={isMobile}
                        onMenu={() => setShowMoreSheet(true)}
                        showHelp
                        onHelp={() => setHelpSheetOpen(true)}
                        showNotifications={false}
                        notificationCount={0}
                        onNotifications={() => { }}
                        user={{
                            name: user?.displayName || "User",
                        }}
                        onUserClick={() => navigate("/settings")}
                    >
                        {!isMobile && location.pathname === "/dashboard" && <DashboardHeaderActions />}
                    </LTopNavbar>
                )}

                {/* Page Content - Scrollable */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-4 w-full min-w-0">
                    <SeenOnlineOrdersContext.Provider value={{ unseenCount, markSeen }}>
                        <Outlet />
                    </SeenOnlineOrdersContext.Provider>
                </main>

                {/* Mobile Bottom Tab Bar */}
                {isMobile && (
                    <LBottomTabBar
                        items={mobileTabItems}
                        activeId={activeTab}
                        onTabChange={handleTabChange}
                    />
                )}
            </div>

            {/* Help Quick Sheet – video + doc + Go to Help / Got it (opened from top Help icon on any page) */}
            <HelpQuickSheet open={helpSheetOpen} onClose={() => setHelpSheetOpen(false)} />

            {/* More Menu Bottom Sheet (Mobile) */}
            {isMobile && (
                <LBottomSheet
                    open={showMoreSheet}
                    onClose={() => setShowMoreSheet(false)}
                    title={t("common.menu")}
                    snapPoints={[0.7]}
                >
                    <div className="p-4">
                        {/* User Info */}
                        <div className="flex items-center gap-3 p-3 bg-muted rounded-xl mb-4">
                            <LAvatar name={user?.displayName || "User"} size="md" />
                            <div className="flex-1">
                                <p className="font-semibold text-foreground">{shopName || user?.displayName}</p>
                                <p className="text-sm text-muted-foreground capitalize">{role}</p>
                            </div>
                        </div>

                        {/* Language Selection */}
                        <div className="mb-4">
                            <LLanguageSelector variant="dropdown" showLabel={true} />
                        </div>

                        {/* Menu Items */}
                        <LList dividers>
                            {filteredMoreItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <LListItem
                                        key={item.id}
                                        title={item.label}
                                        leftContent={<Icon className="h-5 w-5 text-muted-foreground" />}
                                        showChevron
                                        onClick={() => {
                                            setShowMoreSheet(false);
                                            handleSidebarNav(item);
                                        }}
                                    />
                                );
                            })}
                        </LList>

                        <LDivider className="my-4" />

                        {/* Sign Out */}
                        <LListItem
                            title={t("auth.signOut")}
                            leftContent={<LogOut className="h-5 w-5 text-destructive" />}
                            destructive
                            onClick={() => {
                                setShowMoreSheet(false);
                                signOut();
                            }}
                        />
                    </div>
                </LBottomSheet>
            )}
        </div>
    );
}
