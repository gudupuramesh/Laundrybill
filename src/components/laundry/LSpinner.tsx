import { cn } from "@/lib/utils";

export interface LSpinnerProps {
    size?: "sm" | "md" | "lg";
    className?: string;
}

const RING: Record<NonNullable<LSpinnerProps["size"]>, string> = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-10 w-10 border-[3px]",
};

/**
 * Simple, fast ring spinner — pure CSS `animate-spin`, nothing else.
 * No injected <style>, no backdrop-blur, no framer-motion. This is the
 * single loading animation used across the whole web app; the branded
 * washing-machine/bubbles loaders were removed for performance.
 */
export function LSpinner({ size = "md", className }: LSpinnerProps) {
    return (
        <div
            role="status"
            aria-label="Loading"
            className={cn(
                "inline-block align-middle animate-spin rounded-full border-primary/25 border-t-primary",
                RING[size],
                className
            )}
        />
    );
}

export interface LLoadingOverlayProps {
    visible?: boolean;
    message?: string;
    className?: string;
}

/** Lightweight full-screen loading overlay — a centered ring, no blur or motion. */
export function LLoadingOverlay({
    visible = true,
    message,
    className,
}: LLoadingOverlayProps) {
    if (!visible) return null;
    return (
        <div
            className={cn(
                "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80",
                className
            )}
        >
            <LSpinner size="lg" />
            {message && (
                <p className="mt-4 text-sm text-muted-foreground">{message}</p>
            )}
        </div>
    );
}
