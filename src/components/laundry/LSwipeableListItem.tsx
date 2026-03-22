/**
 * Swipeable List Item Component
 * 
 * List item with swipe actions for mobile
 */

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SwipeAction {
    icon: LucideIcon;
    label: string;
    color: "primary" | "success" | "warning" | "destructive";
    onClick: () => void;
}

interface LSwipeableListItemProps {
    children: React.ReactNode;
    leftActions?: SwipeAction[];
    rightActions?: SwipeAction[];
    className?: string;
}

const colorClasses = {
    primary: "bg-primary text-primary-foreground",
    success: "bg-success text-white",
    warning: "bg-warning text-white",
    destructive: "bg-destructive text-destructive-foreground",
};

export function LSwipeableListItem({
    children,
    leftActions = [],
    rightActions = [],
    className,
}: LSwipeableListItemProps) {
    const [translateX, setTranslateX] = useState(0);
    const [isSliding, setIsSliding] = useState(false);
    const startX = useRef(0);
    const currentX = useRef(0);

    const ACTION_WIDTH = 70; // Width per action button
    const maxLeftSwipe = leftActions.length * ACTION_WIDTH;
    const maxRightSwipe = rightActions.length * ACTION_WIDTH;

    const handleTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        currentX.current = translateX;
        setIsSliding(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isSliding) return;

        const diff = e.touches[0].clientX - startX.current;
        let newTranslate = currentX.current + diff;

        // Limit the swipe range
        newTranslate = Math.max(-maxRightSwipe, Math.min(maxLeftSwipe, newTranslate));

        setTranslateX(newTranslate);
    };

    const handleTouchEnd = () => {
        setIsSliding(false);

        // Snap to position
        if (translateX > maxLeftSwipe / 2) {
            setTranslateX(maxLeftSwipe);
        } else if (translateX < -maxRightSwipe / 2) {
            setTranslateX(-maxRightSwipe);
        } else {
            setTranslateX(0);
        }
    };

    const handleActionClick = (action: SwipeAction) => {
        setTranslateX(0);
        action.onClick();
    };

    return (
        <div className={cn("relative overflow-hidden", className)}>
            {/* Left Actions (revealed on swipe right) */}
            {leftActions.length > 0 && (
                <div className="absolute left-0 top-0 bottom-0 flex">
                    {leftActions.map((action, index) => {
                        const Icon = action.icon;
                        return (
                            <button
                                key={index}
                                onClick={() => handleActionClick(action)}
                                className={cn(
                                    "flex flex-col items-center justify-center px-4",
                                    colorClasses[action.color]
                                )}
                                style={{ width: ACTION_WIDTH }}
                            >
                                <Icon className="h-5 w-5 mb-1" />
                                <span className="text-xs">{action.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Right Actions (revealed on swipe left) */}
            {rightActions.length > 0 && (
                <div className="absolute right-0 top-0 bottom-0 flex">
                    {rightActions.map((action, index) => {
                        const Icon = action.icon;
                        return (
                            <button
                                key={index}
                                onClick={() => handleActionClick(action)}
                                className={cn(
                                    "flex flex-col items-center justify-center px-4",
                                    colorClasses[action.color]
                                )}
                                style={{ width: ACTION_WIDTH }}
                            >
                                <Icon className="h-5 w-5 mb-1" />
                                <span className="text-xs">{action.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Main Content */}
            <div
                className={cn(
                    "relative bg-card",
                    isSliding ? "" : "transition-transform duration-200"
                )}
                style={{ transform: `translateX(${translateX}px)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    );
}
