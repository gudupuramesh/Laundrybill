/**
 * Responsive Grid Component
 * 
 * Auto-sizing grid with minimum item width
 * Mobile: 2 columns fixed
 * Desktop: auto-fill based on minItemWidth
 */

import { cn } from "@/lib/utils";

interface LResponsiveGridProps {
    children: React.ReactNode;
    minItemWidth?: number;
    gap?: "sm" | "md" | "lg";
    className?: string;
}

const gapClasses = {
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
};

export function LResponsiveGrid({
    children,
    gap = "md",
    className,
}: LResponsiveGridProps) {
    return (
        <div
            className={cn(
                "grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
                "[&>*]:min-w-0", // Prevent grid children from overflowing
                gapClasses[gap],
                className
            )}
        >
            {children}
        </div>
    );
}
