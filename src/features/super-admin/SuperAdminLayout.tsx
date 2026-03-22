/**
 * Super Admin Layout
 *
 * Sidebar on desktop; bottom tab bar on mobile (like user app).
 */

import { useState, useMemo } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useSuperAdmin } from "./SuperAdminAuthContext";
import { LButton, LBottomTabBar, LBottomSheet } from "@/components/laundry";
import { useIsMobile } from "@/hooks/use-mobile";
import {
    LayoutDashboard,
    Store,
    Package,
    CreditCard,
    Users,
    Activity,
    Settings,
    LogOut,
    Menu,
    X,
    ChevronRight,
    Shield,
    FileText,
    HelpCircle,
    MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", path: "/super-admin", icon: LayoutDashboard, end: true },
    { id: "plans", label: "Plans", path: "/super-admin/plans", icon: FileText },
    { id: "shops", label: "Shops", path: "/super-admin/shops", icon: Store },
    { id: "map", label: "Shops map", path: "/super-admin/map", icon: MapPin },
    { id: "items-list", label: "Items List", path: "/super-admin/items-list", icon: Package },
    { id: "subscriptions", label: "Subscriptions", path: "/super-admin/subscriptions", icon: CreditCard },
    { id: "payments", label: "Payments", path: "/super-admin/payments", icon: Users },
    { id: "activity", label: "Activity", path: "/super-admin/activity", icon: Activity },
    { id: "support", label: "Support & Help", path: "/super-admin/support", icon: HelpCircle },
    { id: "settings", label: "Settings", path: "/super-admin/settings", icon: Settings },
];

export function SuperAdminLayout() {
    const { superAdmin, signOut } = useSuperAdmin();
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useIsMobile();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [moreSheetOpen, setMoreSheetOpen] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        navigate("/super-admin/login");
    };

    const mobileTabItems = useMemo(
        () => [
            { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
            { id: "shops", label: "Shops", icon: <Store className="h-5 w-5" /> },
            { id: "subscriptions", label: "Subs", icon: <CreditCard className="h-5 w-5" /> },
            { id: "more", label: "More", icon: <Menu className="h-5 w-5" /> },
        ],
        []
    );

    const activeTab = useMemo(() => {
        const path = location.pathname;
        if (path === "/super-admin" || path === "/super-admin/") return "dashboard";
        if (path.startsWith("/super-admin/shops")) return "shops";
        if (path.startsWith("/super-admin/subscriptions")) return "subscriptions";
        if (path.startsWith("/super-admin/map")) return "more";
        if (
            path.startsWith("/super-admin/plans") ||
            path.startsWith("/super-admin/items-list") ||
            path.startsWith("/super-admin/payments") ||
            path.startsWith("/super-admin/activity") ||
            path.startsWith("/super-admin/support") ||
            path.startsWith("/super-admin/settings")
        )
            return "more";
        return "dashboard";
    }, [location.pathname]);

    const handleTabChange = (id: string) => {
        if (id === "more") {
            setMoreSheetOpen(true);
            return;
        }
        const item = NAV_ITEMS.find((i) => i.id === id);
        if (item) navigate(item.path);
    };

    return (
        <div className="min-h-screen bg-background flex">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <Shield className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="font-bold text-foreground">Super Admin</h1>
                            <p className="text-xs text-muted-foreground">LaundryBill</p>
                        </div>
                    </div>
                    <button
                        className="lg:hidden p-2 hover:bg-muted rounded-lg"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.id === "dashboard"}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )
                            }
                        >
                            <item.icon className="h-5 w-5" />
                            {item.label}
                            <ChevronRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100" />
                        </NavLink>
                    ))}
                </nav>

                {/* User section */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-lg font-semibold text-primary">
                                {superAdmin?.name?.charAt(0) || "A"}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {superAdmin?.name || "Admin"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {superAdmin?.email}
                            </p>
                        </div>
                    </div>
                    <LButton
                        variant="outline"
                        size="sm"
                        fullWidth
                        leftIcon={<LogOut className="h-4 w-4" />}
                        onClick={handleSignOut}
                    >
                        Sign Out
                    </LButton>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Mobile header */}
                <header className="h-14 border-b border-border bg-card flex items-center px-4 lg:hidden shrink-0">
                    <button
                        className="p-2 hover:bg-muted rounded-lg"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Menu"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <h1 className="ml-3 font-semibold text-foreground">Super Admin</h1>
                </header>

                {/* Page content - pb for bottom nav on mobile */}
                <main className={cn("flex-1 overflow-auto", isMobile && "pb-20")}>
                    <Outlet />
                </main>

                {/* Mobile bottom tab bar (all screens) */}
                {isMobile && (
                    <LBottomTabBar
                        items={mobileTabItems}
                        activeId={activeTab}
                        onTabChange={handleTabChange}
                    />
                )}

                {/* More menu sheet (mobile) */}
                {isMobile && (
                    <LBottomSheet
                        open={moreSheetOpen}
                        onClose={() => setMoreSheetOpen(false)}
                        title="Menu"
                        snapPoints={[0.6]}
                    >
                        <div className="p-4 space-y-1">
                            {NAV_ITEMS.filter(
                                (i) =>
                                    i.id !== "dashboard" &&
                                    i.id !== "shops" &&
                                    i.id !== "subscriptions"
                            ).map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        navigate(item.path);
                                        setMoreSheetOpen(false);
                                    }}
                                    className={cn(
                                        "flex items-center gap-3 w-full px-3 py-3 rounded-lg text-left text-sm font-medium transition-colors",
                                        location.pathname.startsWith(item.path)
                                            ? "bg-primary/10 text-primary"
                                            : "text-foreground hover:bg-muted"
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </LBottomSheet>
                )}
            </div>
        </div>
    );
}
