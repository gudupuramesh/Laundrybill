/**
 * List Components
 * 
 * LList - Container for list items
 * LListItem - Individual list item with left/right content
 * LDivider - Visual separator
 */

import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

// LList
interface LListProps {
    children: React.ReactNode;
    dividers?: boolean;
    className?: string;
}

export function LList({ children, dividers = true, className }: LListProps) {
    return (
        <div
            className={cn(
                "bg-card rounded-xl overflow-hidden",
                dividers && "[&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-border",
                className
            )}
        >
            {children}
        </div>
    );
}

// LListItem
interface LListItemProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    leftContent?: React.ReactNode;
    rightContent?: React.ReactNode;
    showChevron?: boolean;
    destructive?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
}

export function LListItem({
    title,
    subtitle,
    leftContent,
    rightContent,
    showChevron = false,
    destructive = false,
    disabled = false,
    onClick,
    className,
}: LListItemProps) {
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Don't trigger if clicking on a nested interactive element (not the list item itself)
        const target = e.target as HTMLElement;
        const currentTarget = e.currentTarget;

        // Check if there's a button/link between target and currentTarget
        const interactiveParent = target.closest('button, a, input');
        if (interactiveParent && interactiveParent !== currentTarget && currentTarget.contains(interactiveParent)) {
            return;
        }

        if (!disabled && onClick) {
            onClick();
        }
    };

    return (
        <div
            onClick={onClick ? handleClick : undefined}
            role={onClick ? "button" : undefined}
            tabIndex={onClick && !disabled ? 0 : undefined}
            onKeyDown={onClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!disabled) onClick();
                }
            } : undefined}
            className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left",
                "transition-colors",
                onClick && !disabled && "hover:bg-muted active:bg-muted/80 cursor-pointer",
                disabled && "opacity-50 cursor-not-allowed",
                className
            )}
        >
            {/* Left Content */}
            {leftContent && (
                <div className="flex-shrink-0">{leftContent}</div>
            )}

            {/* Main Content */}
            <div className="flex-1 min-w-0">
                <div
                    className={cn(
                        "text-sm font-medium truncate",
                        destructive ? "text-destructive" : "text-foreground"
                    )}
                >
                    {title}
                </div>
                {subtitle && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {subtitle}
                    </div>
                )}
            </div>

            {/* Right Content */}
            {rightContent && (
                <div className="flex-shrink-0">{rightContent}</div>
            )}

            {/* Chevron */}
            {showChevron && (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
        </div>
    );
}

// LDivider
interface LDividerProps {
    label?: string;
    className?: string;
}

export function LDivider({ label, className }: LDividerProps) {
    if (!label) {
        return <div className={cn("h-px bg-border", className)} />;
    }
    return (
        <div className={cn("relative flex items-center py-2", className)}>
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink-0 mx-4 text-xs font-medium text-muted-foreground uppercase">{label}</span>
            <div className="flex-grow border-t border-border"></div>
        </div>
    );
}
