/**
 * Skeleton Loading Component
 * 
 * Placeholder for loading states
 */

import { cn } from "@/lib/utils";

interface LSkeletonProps {
    width?: number | string;
    height?: number | string;
    className?: string;
}

export function LSkeleton({ width, height, className }: LSkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse bg-muted rounded-lg",
                className
            )}
            style={{
                width: typeof width === "number" ? `${width}px` : width,
                height: typeof height === "number" ? `${height}px` : height,
            }}
        />
    );
}
