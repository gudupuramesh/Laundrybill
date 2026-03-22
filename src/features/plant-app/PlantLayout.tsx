import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useDriverAuth } from "@/features/driver-app/DriverAuthContext";
import {
    LayoutDashboard,
    Package,
    CheckCircle2,
    Menu,
    LogOut,
    Power,
    Scan
} from "lucide-react";
import {
    LButton,
    LAvatar,
    LBadge,
    LBottomTabBar
} from "@/components/laundry";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function PlantLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { agent, signOut, isOnline, goOnline, goOffline } = useDriverAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const isActive = (path: string) => location.pathname === path;

    const menuItems = [
        {
            icon: LayoutDashboard,
            label: "Dashboard",
            path: "/plant/dashboard"
        },
        {
            icon: Package,
            label: "Inbound",
            path: "/plant/inbound",
            badge: "New" // TODO: Add real count
        },
        {
            icon: Power,
            label: "Processing",
            path: "/plant/processing"
        },
        {
            icon: CheckCircle2,
            label: "Ready",
            path: "/plant/ready"
        },
        {
            icon: Scan,
            label: "Scan",
            path: "/plant/scan"
        },
        {
            icon: CheckCircle2,
            label: "History",
            path: "/plant/completed"
        }
    ];

    const handleLogout = async () => {
        try {
            await signOut();
            navigate("/plant/login");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    return (
        <div className="min-h-screen bg-muted/20 flex flex-col md:flex-row">
            {/* Mobile Header */}
            <header className="md:hidden h-16 bg-background border-b px-4 flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center gap-3">
                    <LButton
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        <Menu className="h-6 w-6" />
                    </LButton>
                    <span className="font-bold text-lg text-primary">Plant Portal</span>
                </div>
                <LAvatar name={agent?.name || "P"} size="sm" />
            </header>

            {/* Sidebar (Desktop) / Drawer (Mobile) */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-64 bg-background border-r transform transition-transform duration-200 md:relative md:translate-x-0 flex flex-col",
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Logo Area */}
                <div className="h-16 flex items-center px-6 border-b">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mr-3">
                        <span className="text-primary-foreground font-bold">L</span>
                    </div>
                    <div>
                        <h1 className="font-bold text-foreground">LaundryBill</h1>
                        <p className="text-xs text-muted-foreground">Plant Unit</p>
                    </div>
                </div>

                {/* Operator Profile */}
                <div className="p-4 border-b bg-muted/10">
                    <div className="flex items-center gap-3 mb-3">
                        <LAvatar name={agent?.name || "Operator"} size="md" />
                        <div className="overflow-hidden">
                            <p className="font-medium truncate">{agent?.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{agent?.phone}</p>
                        </div>
                    </div>
                    {/* Online Toggle */}
                    <button
                        onClick={() => isOnline ? goOffline() : goOnline()}
                        className={cn(
                            "w-full py-2 px-3 rounded-md flex items-center justify-between text-sm transition-colors",
                            isOnline ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                        )}
                    >
                        <span className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-success animate-pulse" : "bg-muted-foreground")} />
                            {isOnline ? "Station Active" : "Station Offline"}
                        </span>
                        <Power className="h-4 w-4" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {menuItems.map((item) => (
                        <button
                            key={item.path}
                            onClick={() => {
                                navigate(item.path);
                                setIsMobileMenuOpen(false);
                            }}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                isActive(item.path)
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className="h-5 w-5" />
                                {item.label}
                            </div>
                            {item.badge && (
                                <LBadge variant={isActive(item.path) ? "default" : "outline"} size="sm">
                                    {item.badge}
                                </LBadge>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t">
                    <LButton
                        variant="ghost"
                        className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-5 w-5 mr-3" />
                        Sign Out
                    </LButton>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto h-[calc(100vh-64px)] md:h-screen p-4 md:p-8 pb-24 md:pb-8">
                <Outlet />
            </main>

            {/* Mobile Bottom Tab Bar */}
            <LBottomTabBar
                className="md:hidden"
                activeId={location.pathname}
                onTabChange={(path) => navigate(path)}
                items={menuItems.map(item => ({
                    id: item.path,
                    label: item.label,
                    icon: <item.icon className="h-5 w-5" />,
                    primary: item.label === 'Scan' // Highlight Scan as primary action
                }))}
            />
        </div>
    );
}
