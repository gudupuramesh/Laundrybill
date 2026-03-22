import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { LLoader } from "./LLoader";

export interface LSpinnerProps {
    size?: "sm" | "md" | "lg";
    className?: string;
}

export function LSpinner({ size = "md", className }: LSpinnerProps) {
    const loaderSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "md";
    return (
        <LLoader
            variant="bubbles"
            size={loaderSize}
            className={className}
        />
    );
}

export interface LLoadingOverlayProps {
    visible?: boolean;
    message?: string;
    className?: string;
}

export function LLoadingOverlay({
    visible = true,
    message,
    className,
}: LLoadingOverlayProps) {
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm",
                        className
                    )}
                >
                    <LSpinner size="lg" />
                    {message && (
                        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
