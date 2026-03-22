/**
 * Toggle Component
 * 
 * Switch toggle for boolean settings
 */

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface LToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    size?: "sm" | "md";
    className?: string;
}

export function LToggle({
    checked,
    onChange,
    disabled = false,
    size = "md",
    className,
}: LToggleProps) {
    const sizes = {
        sm: { track: "w-8 h-5", thumb: "w-3.5 h-3.5", translate: "translate-x-3.5" },
        md: { track: "w-11 h-6", thumb: "w-5 h-5", translate: "translate-x-5" },
    };

    const s = sizes[size];

    return (
        <button
            role="switch"
            aria-checked={checked}
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={cn(
                "relative inline-flex items-center rounded-full transition-colors",
                s.track,
                checked ? "bg-primary" : "bg-neutral-200 dark:bg-neutral-700",
                disabled && "opacity-50 cursor-not-allowed",
                className
            )}
        >
            <motion.span
                layout
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                    "inline-block rounded-full bg-white shadow-sm",
                    s.thumb,
                    "transform",
                    checked ? s.translate : "translate-x-0.5"
                )}
            />
        </button>
    );
}
