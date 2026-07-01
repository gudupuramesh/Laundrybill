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
 * Simple, fast ring spinner — pure CSS `animate-spin`, no injected styles/blur/motion.
 *
 * The border colors are set INLINE via the design-system CSS var, not Tailwind's
 * `border-primary`/`border-t-primary`: those aren't registered as color utilities in
 * this Tailwind v4 setup, so they generate no CSS and the border falls back to the
 * global grey default (`* { border-color: hsl(var(--border)) }`) — a uniform grey
 * ring that looks static. Track = primary-soft, top arc = primary, so it's clearly
 * visible and the rotation reads as motion.
 */
export function LSpinner({ size = "md", className }: LSpinnerProps) {
    return (
        <span
            role="status"
            aria-label="Loading"
            className={cn(
                "inline-block align-middle animate-spin rounded-full border-solid",
                RING[size],
                className
            )}
            style={{
                borderColor: "var(--c-primary-soft, #EAEFFC)",
                borderTopColor: "var(--c-primary, #1A4FD6)",
            }}
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
