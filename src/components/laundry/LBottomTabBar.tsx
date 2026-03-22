/**
 * Bottom Tab Bar Component
 * 
 * Mobile navigation with tabs at the bottom
 */

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface TabItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    primary?: boolean;
    /** Optional badge count (e.g. unseen online orders) */
    badge?: number;
}

interface LBottomTabBarProps {
    items: TabItem[];
    activeId: string;
    onTabChange: (id: string) => void;
    className?: string;
}

export function LBottomTabBar({
    items,
    activeId,
    onTabChange,
    className,
}: LBottomTabBarProps) {
    return (
        <nav
            className={cn(
                "fixed bottom-0 left-0 right-0 z-40 w-full max-w-full",
                "bg-card/95 backdrop-blur-xl border-t border-border",
                "pb-safe",
                className
            )}
        >
            <div className="flex items-center justify-around h-16">
                {items.map((item) => {
                    const isActive = activeId === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={cn(
                                "flex flex-col items-center justify-center flex-1 h-full",
                                "transition-colors relative",
                                item.primary && "!flex-none px-4"
                            )}
                        >
                            {item.primary ? (
                                // Primary action button (New Order)
                                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center shadow-lg -mt-4">
                                    <span className="text-white">{item.icon}</span>
                                </div>
                            ) : (
                                <>
                                    <div
                                        className={cn(
                                            "transition-colors relative inline-flex",
                                            isActive ? "text-primary" : "text-muted-foreground"
                                        )}
                                    >
                                        {item.icon}
                                        {item.badge != null && item.badge > 0 && (
                                            <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1">
                                                {item.badge > 99 ? "99+" : item.badge}
                                            </span>
                                        )}
                                    </div>
                                    <span
                                        className={cn(
                                            "text-xs mt-1 transition-colors",
                                            isActive
                                                ? "text-primary font-medium"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        {item.label}
                                    </span>

                                    {/* Active indicator */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute -top-px left-1/4 right-1/4 h-0.5 bg-primary rounded-full"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                </>
                            )}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
