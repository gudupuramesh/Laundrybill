/**
 * Page Wrapper Component
 * 
 * Consistent page styling with container and padding
 */

import { cn } from "@/lib/utils";
import { LContainer, LSpacer } from "@/components/laundry";

interface PageWrapperProps {
    children: React.ReactNode;
    className?: string;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl" | "7xl" | "full";
    noPadding?: boolean;
}

export function PageWrapper({
    children,
    className,
    maxWidth = "7xl",
    noPadding = false,
}: PageWrapperProps) {
    return (
        <LContainer
            maxWidth={maxWidth}
            padding={!noPadding}
            className={cn("py-4 md:py-6", className)}
        >
            {children}
            {/* Bottom padding for mobile tab bar */}
            <LSpacer size="2xl" className="md:hidden" />
        </LContainer>
    );
}
