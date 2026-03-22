/**
 * Segmented Control Component
 * 
 * iOS-style segmented tabs
 */

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SegmentOption {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface LSegmentedControlProps {
    options: SegmentOption[];
    value: string;
    onChange: (value: string) => void;
    size?: "sm" | "md";
    fullWidth?: boolean;
    className?: string;
}

export function LSegmentedControl({
    options,
    value,
    onChange,
    size = "md",
    fullWidth,
    className,
}: LSegmentedControlProps) {
    const sizes = {
        sm: "h-8 text-xs",
        md: "h-10 text-sm",
    };

    return (
        <div
            className={cn(
                "inline-flex p-1 rounded-xl bg-muted",
                fullWidth && "flex w-full",
                className
            )}
        >
            {options.map((option) => {
                const isActive = option.id === value;

                return (
                    <button
                        key={option.id}
                        onClick={() => onChange(option.id)}
                        className={cn(
                            "relative px-4 font-medium rounded-lg transition-colors",
                            fullWidth && "flex-1",
                            sizes[size],
                            "flex items-center justify-center gap-1.5",
                            isActive ? "text-foreground" : "text-muted-foreground"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="segmented-active"
                                className="absolute inset-0 bg-card rounded-lg shadow-sm"
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-1.5">
                            {option.icon}
                            {option.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
