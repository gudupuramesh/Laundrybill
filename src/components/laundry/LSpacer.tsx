/**
 * Spacer Component
 * 
 * Vertical spacing utility
 */

import { cn } from "@/lib/utils";

interface LSpacerProps {
    size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
    className?: string;
}

const sizeClasses = {
    xs: "h-1",
    sm: "h-2",
    md: "h-4",
    lg: "h-6",
    xl: "h-8",
    "2xl": "h-12",
};

export function LSpacer({ size = "md", className }: LSpacerProps) {
    return <div className={cn(sizeClasses[size], className)} />;
}
