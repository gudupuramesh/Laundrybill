/**
 * Chip Select Component
 * 
 * Horizontal scrollable chip filter
 */

import { cn } from "@/lib/utils";

interface ChipOption {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface LChipSelectProps {
    options: ChipOption[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

export function LChipSelect({
    options,
    value,
    onChange,
    className,
}: LChipSelectProps) {
    return (
        <div
            className={cn(
                "flex gap-2 overflow-x-auto scrollbar-hide",
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
                            "flex items-center gap-1.5 px-4 py-2 rounded-full",
                            "text-sm font-medium whitespace-nowrap",
                            "transition-colors flex-shrink-0",
                            isActive
                                ? "bg-primary text-white"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                    >
                        {option.icon}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
