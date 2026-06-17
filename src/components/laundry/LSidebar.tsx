/**
 * Sidebar Component
 * 
 * Desktop navigation sidebar with collapsible state
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SidebarItem {
    id: string;
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    /** Optional badge count (e.g. online orders count) */
    badge?: number;
}

interface LSidebarProps {
    items: SidebarItem[];
    activeId: string;
    logo?: React.ReactNode;
    collapsedLogo?: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
}

export function LSidebar({
    items,
    activeId,
    logo,
    collapsedLogo,
    footer,
    className,
}: LSidebarProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "h-screen sticky top-0 bg-sidebar border-r border-sidebar-border",
                "flex flex-col transition-all duration-300",
                collapsed ? "w-16" : "w-64",
                className
            )}
        >
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border">
                {collapsed ? collapsedLogo : logo}

                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn(
                        "p-1.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                        collapsed && "mx-auto"
                    )}
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeId === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={item.onClick}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors relative",
                                isActive
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                collapsed && "justify-center px-0",
                                (item.badge != null && item.badge > 0) && "relative"
                            )}
                            title={collapsed ? item.label : undefined}
                        >
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            {!collapsed && (
                                <>
                                    <span className="text-sm font-medium truncate flex-1 text-left">
                                        {item.label}
                                    </span>
                                    {item.badge != null && item.badge > 0 && (
                                        <span className="flex-shrink-0 min-w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                                            {item.badge > 99 ? "99+" : item.badge}
                                        </span>
                                    )}
                                </>
                            )}
                            {collapsed && item.badge != null && item.badge > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-medium flex items-center justify-center">
                                    {item.badge > 9 ? "9+" : item.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Footer */}
            {footer && !collapsed && (
                <div className="p-4 border-t border-sidebar-border">{footer}</div>
            )}
        </aside>
    );
}
