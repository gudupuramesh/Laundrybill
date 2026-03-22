/**
 * Container Component
 * 
 * Responsive container with max-width options
 */

import { cn } from "@/lib/utils";

interface LContainerProps {
    children: React.ReactNode;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl" | "7xl" | "full";
    padding?: boolean;
    className?: string;
}

const maxWidthClasses = {
    sm: "max-w-sm",      // 384px
    md: "max-w-md",      // 448px
    lg: "max-w-lg",      // 512px
    xl: "max-w-xl",      // 576px
    "2xl": "max-w-2xl",  // 672px
    "4xl": "max-w-4xl",  // 896px
    "6xl": "max-w-6xl",  // 1152px
    "7xl": "max-w-7xl",  // 1280px
    full: "max-w-full",  // 100%
};

export function LContainer({
    children,
    maxWidth = "lg",
    padding = true,
    className,
}: LContainerProps) {
    return (
        <div
            className={cn(
                "mx-auto w-full",
                maxWidthClasses[maxWidth],
                padding && "px-4",
                className
            )}
        >
            {children}
        </div>
    );
}
