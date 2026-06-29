/**
 * Staff App Layout
 * 
 * Responsive layout with sidebar on desktop and bottom tabs on mobile
 * Matching Admin AppLayout structure for consistency
 */

import { useState, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useStaffAuth } from "./StaffAuthContext";
import {
    LayoutDashboard,
    ClipboardList,
    Users,
    Receipt,
    User,
    QrCode,
    Store,
    PlusCircle,
    Menu,
    LogOut,
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
} from "@/components/laundry";

// Sidebar items for desktop
const sidebarItemsConfig = [
    { id: "home", labelKey: "common.home", icon: LayoutDashboard, href: "/staff" },
    { id: "new-order", labelKey: "dashboard.newOrder", icon: PlusCircle, href: "/staff/orders/new" },
    { id: "orders", labelKey: "common.orders", icon: ClipboardList, href: "/staff/orders" },
    { id: "scan", labelKey: "common.scan", icon: QrCode, href: "/staff/scan" },
    { id: "customers", labelKey: "common.customers", icon: Users, href: "/staff/customers" },
    { id: "expenses", labelKey: "common.expenses", icon: Receipt, href: "/staff/expenses" },
    { id: "profile", labelKey: "common.profile", icon: User, href: "/staff/profile" },
];

// More menu items (shown in bottom sheet on mobile) - includes ALL nav items
const moreMenuItemsConfig = [
    { id: "home", labelKey: "common.home", icon: LayoutDashboard, href: "/staff" },
    { id: "orders", labelKey: "common.orders", icon: ClipboardList, href: "/staff/orders" },
    { id: "customers", labelKey: "common.customers", icon: Users, href: "/staff/customers" },
    { id: "expenses", labelKey: "common.expenses", icon: Receipt, href: "/staff/expenses" },
    { id: "profile", labelKey: "common.profile", icon: User, href: "/staff/profile" },
];

export function StaffAppLayout() {
    const { t } = useTranslation();
    const { shopName, staff, signOut } = useStaffAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const [showMoreSheet, setShowMoreSheet] = useState(false);

    // Handle sign out
    const handleSignOut = () => {
        signOut();
        navigate("/team/login");
    };

    // Create translated tab items for mobile bottom bar (matching Admin pattern)
    const mobileTabItems = useMemo(() => [
        { id: "home", label: t("common.home"), icon: <LayoutDashboard className="h-5 w-5" /> },
        { id: "new-order", label: t("dashboard.newOrder").split(" ")[0], icon: <PlusCircle className="h-6 w-6" />, primary: true },
        { id: "scan", label: t("common.scan", "Scan"), icon: <QrCode className="h-5 w-5" /> },
        { id: "orders", label: t("common.orders"), icon: <ClipboardList className="h-5 w-5" /> },
        { id: "customers", label: t("common.customers"), icon: <Users className="h-5 w-5" /> },
        { id: "more", label: t("common.more"), icon: <Menu className="h-5 w-5" /> },
    ], [t]);

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

        for (const item of sidebarItemsConfig) {
            if (item.href === "/staff" && path === "/staff") {
                return item.id;
            }
            if (item.href !== "/staff" && path.startsWith(item.href)) {
                return item.id;
            }
        }

        return "home";
    };

    const activeTab = getActiveTab();

    // Get page title based on current path
    const getPageTitle = (): string => {
        const path = location.pathname;
        const item = sidebarItems.find((i) =>
            i.href === "/staff" ? path === "/staff" : path.startsWith(i.href)
        );
        return item?.label || shopName || "Staff App";
    };

    // Handle tab change
    const handleTabChange = (tabId: string) => {
        if (tabId === "more") {
            setShowMoreSheet(true);
            return;
        }

        const routes: Record<string, string> = {
            home: "/staff",
            "new-order": "/staff/orders/new",
            orders: "/staff/orders",
            customers: "/staff/customers",
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
                            <Store className="h-6 w-6" />
                            <span>{shopName || "Fresh Laundry"}</span>
                        </div>
                    }
                    collapsedLogo={
                        <div className="flex items-center justify-center font-bold text-xl text-primary">
                            <Store className="h-6 w-6" />
                        </div>
                    }
                    footer={
                        <div className="flex items-center gap-3 px-2 pb-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                {staff?.name?.charAt(0).toUpperCase() || "S"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {staff?.name || "Staff Member"}
                                </p>
                                <p className="text-xs text-muted-foreground capitalize">
                                    {staff?.role || "Staff"}
                                </p>
                            </div>
                            <button
                                onClick={handleSignOut}
                                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                title="Sign out"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </div>
                    }
                />
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen w-full min-w-0 overflow-hidden">
                {/* Top Navbar - mobile only, hidden on order detail pages */}
                {isMobile && !location.pathname.match(/\/staff\/orders\/[^/]+$/) && (
                    <LTopNavbar
                        title={getPageTitle()}
                        showBack={location.pathname !== "/staff"}
                        onBack={() => navigate(-1)}
                        showMenu={true}
                        onMenu={() => setShowMoreSheet(true)}
                        showNotifications={false}
                        user={{ name: staff?.name || "Staff" }}
                        onUserClick={() => navigate("/staff/profile")}
                    />
                )}

                {/* Page Content - Scrollable */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-4 w-full min-w-0">
                    <Outlet />
                </main>
            </div>

            {/* Mobile Bottom Navigation - Match Admin pattern */}
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
                title={t("common.more")}
            >
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
                    <p className="text-sm font-medium mb-2">{t("settings.language")}</p>
                    <LLanguageSelector variant="dropdown" />
                </div>
            </LBottomSheet>
        </div>
    );
}
