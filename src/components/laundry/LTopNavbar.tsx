/**
 * Top Navbar Component
 * 
 * Header navigation bar with back button, title, and actions
 */

import { cn } from "@/lib/utils";
import { ChevronLeft, Bell, Menu, HelpCircle } from "lucide-react";
import { LAvatar } from "./LAvatar";

interface LTopNavbarProps {
    title?: string;
    showBack?: boolean;
    onBack?: () => void;
    showMenu?: boolean;
    onMenu?: () => void;
    /** When true, show Help icon instead of notifications (e.g. on dashboard) */
    showHelp?: boolean;
    onHelp?: () => void;
    showNotifications?: boolean;
    notificationCount?: number;
    onNotifications?: () => void;
    user?: {
        name: string;
        avatar?: string;
    };
    onUserClick?: () => void;
    className?: string;
    children?: React.ReactNode;
}

export function LTopNavbar({
    title,
    showBack = false,
    onBack,
    showMenu = false,
    onMenu,
    showHelp = false,
    onHelp,
    showNotifications = false,
    notificationCount = 0,
    onNotifications,
    user,
    onUserClick,
    className,
    children,
}: LTopNavbarProps) {
    return (
        <header
            className={cn(
                "sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border",
                "h-14 flex items-center px-4 gap-3",
                className
            )}
        >
            {/* Left Section */}
            <div className="flex items-center gap-2">
                {showBack && (
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                )}

                {showMenu && !showBack && (
                    <button
                        onClick={onMenu}
                        className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors md:hidden"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Title */}
            {title && (
                <h1 className="text-lg font-semibold text-foreground flex-1 truncate">
                    {title}
                </h1>
            )}

            {/* Custom children */}
            {children && <div className="flex-1">{children}</div>}

            {/* Right Section */}
            <div className="flex items-center gap-2">
                {showHelp && onHelp && (
                    <button
                        onClick={onHelp}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        title="Help"
                    >
                        <HelpCircle className="h-5 w-5" />
                    </button>
                )}
                {!showHelp && showNotifications && (
                    <button
                        onClick={onNotifications}
                        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                        <Bell className="h-5 w-5" />
                        {notificationCount > 0 && (
                            <span className="absolute top-1 right-1 w-4 h-4 bg-destructive text-white text-xs rounded-full flex items-center justify-center">
                                {notificationCount > 9 ? "9+" : notificationCount}
                            </span>
                        )}
                    </button>
                )}

                {user && (
                    <button onClick={onUserClick} className="flex items-center gap-2">
                        <LAvatar name={user.name} src={user.avatar} size="sm" />
                    </button>
                )}
            </div>
        </header>
    );
}
