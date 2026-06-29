/**
 * Plant App Layout
 *
 * Mirrors the owner AppLayout / StaffAppLayout for a consistent shell:
 * shared LSidebar on desktop, LBottomTabBar on mobile, and a no-padding <main>
 * (pages self-pad). Keeps the plant operator online toggle + sign out.
 */

import { useState, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDriverAuth } from "@/features/driver-app/DriverAuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
    LayoutDashboard,
    Package,
    RefreshCw,
    CheckCircle2,
    Scan,
    Archive,
    Menu,
    LogOut,
    Power,
} from "lucide-react";
import {
    LSidebar,
    LBottomTabBar,
    LBottomSheet,
    LList,
    LListItem,
    LTopNavbar,
} from "@/components/laundry";

const navConfig = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/plant/dashboard" },
    { id: "inbound", label: "Inbound", icon: Package, href: "/plant/inbound" },
    { id: "processing", label: "Processing", icon: RefreshCw, href: "/plant/processing" },
    { id: "ready", label: "Ready", icon: CheckCircle2, href: "/plant/ready" },
    { id: "scan", label: "Scan", icon: Scan, href: "/plant/scan" },
    { id: "history", label: "History", icon: Archive, href: "/plant/completed" },
];

export function PlantLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useIsMobile();
    const { agent, shopName, signOut, isOnline, goOnline, goOffline } = useDriverAuth();

    const [showMoreSheet, setShowMoreSheet] = useState(false);

    const handleLogout = async () => {
        try {
            await signOut();
            navigate("/team/login");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    const activeTab = useMemo(() => {
        const match = navConfig.find((i) => location.pathname.startsWith(i.href));
        // No false highlight on sub-pages (e.g. /plant/orders/:id) that aren't a nav section.
        return match?.id || "";
    }, [location.pathname]);

    // Mobile bottom bar — key destinations + a "more" sheet for the rest.
    const mobileTabItems = useMemo(() => [
        { id: "dashboard", label: "Home", icon: <LayoutDashboard className="h-5 w-5" /> },
        { id: "inbound", label: "Inbound", icon: <Package className="h-5 w-5" /> },
        { id: "scan", label: "Scan", icon: <Scan className="h-6 w-6" />, primary: true },
        { id: "ready", label: "Ready", icon: <CheckCircle2 className="h-5 w-5" /> },
        { id: "more", label: "More", icon: <Menu className="h-5 w-5" /> },
    ], []);
    const bottomActiveId = ["dashboard", "inbound", "scan", "ready"].includes(activeTab)
        ? activeTab
        : (["processing", "history"].includes(activeTab) ? "more" : "");

    const handleTabChange = (tabId: string) => {
        if (tabId === "more") { setShowMoreSheet(true); return; }
        const routes: Record<string, string> = {
            dashboard: "/plant/dashboard",
            inbound: "/plant/inbound",
            scan: "/plant/scan",
            ready: "/plant/ready",
        };
        if (routes[tabId]) navigate(routes[tabId]);
    };

    const getPageTitle = () => navConfig.find((i) => location.pathname.startsWith(i.href))?.label || shopName || "Plant";

    return (
        <div className="h-screen bg-background flex w-full max-w-full overflow-hidden">
            {/* Desktop Sidebar */}
            {!isMobile && (
                <LSidebar
                    items={navConfig.map((item) => ({
                        id: item.id,
                        label: item.label,
                        icon: item.icon,
                        onClick: () => navigate(item.href),
                    }))}
                    activeId={activeTab}
                    logo={
                        <div className="flex items-center gap-2 font-bold text-xl text-primary">
                            <Package className="h-6 w-6" />
                            <span className="truncate">{shopName || "Plant"}</span>
                        </div>
                    }
                    collapsedLogo={
                        <div className="flex items-center justify-center font-bold text-xl text-primary">
                            <Package className="h-6 w-6" />
                        </div>
                    }
                    footer={
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {/* Operator online / station status */}
                            <button
                                onClick={() => (isOnline ? goOffline() : goOnline())}
                                style={{
                                    cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                                    font: "inherit", fontSize: 12.5, fontWeight: 600, borderRadius: 8, padding: "8px 11px", border: 0,
                                    color: isOnline ? "var(--c-success)" : "var(--c-text-3)",
                                    background: isOnline ? "var(--c-success-soft)" : "var(--c-surface-2)",
                                }}
                            >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: isOnline ? "var(--c-success)" : "var(--c-text-3)" }} />
                                    {isOnline ? "Station Active" : "Station Offline"}
                                </span>
                                <Power className="h-4 w-4" />
                            </button>
                            {/* Operator identity + sign out */}
                            <div className="flex items-center gap-3 px-1">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                    {agent?.name?.charAt(0).toUpperCase() || "P"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{agent?.name || "Operator"}</p>
                                    <p className="text-xs text-muted-foreground">Plant</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                    title="Sign out"
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
                {isMobile && (
                    <LTopNavbar
                        title={getPageTitle()}
                        showBack={location.pathname !== "/plant/dashboard"}
                        onBack={() => navigate(-1)}
                        showMenu={true}
                        onMenu={() => setShowMoreSheet(true)}
                        showNotifications={false}
                        user={{ name: agent?.name || "Operator" }}
                    />
                )}

                {/* Page Content — pages self-pad (no extra padding here). */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-4 w-full min-w-0">
                    <Outlet />
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            {isMobile && (
                <LBottomTabBar items={mobileTabItems} activeId={bottomActiveId} onTabChange={handleTabChange} />
            )}

            {/* More Menu Bottom Sheet */}
            <LBottomSheet open={showMoreSheet} onClose={() => setShowMoreSheet(false)} title="More">
                <LList>
                    {[
                        { id: "processing", label: "Processing", icon: RefreshCw, href: "/plant/processing" },
                        { id: "history", label: "History", icon: Archive, href: "/plant/completed" },
                    ].map((item) => (
                        <LListItem
                            key={item.id}
                            title={item.label}
                            leftContent={<div className="p-2 rounded-lg bg-muted"><item.icon className="h-5 w-5 text-muted-foreground" /></div>}
                            showChevron
                            onClick={() => { navigate(item.href); setShowMoreSheet(false); }}
                        />
                    ))}
                </LList>
            </LBottomSheet>
        </div>
    );
}
