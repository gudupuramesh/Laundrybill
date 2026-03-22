/**
 * Quantity Stepper Component
 * 
 * +/- buttons with quantity display
 */

import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";

interface LQuantityStepperProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    size?: "sm" | "md" | "lg";
    className?: string;
}

export function LQuantityStepper({
    value,
    onChange,
    min = 1,
    max = 99,
    size = "md",
    className,
}: LQuantityStepperProps) {
    const sizes = {
        sm: { button: "h-7 w-7", text: "text-sm w-8" },
        md: { button: "h-8 w-8", text: "text-base w-10" },
        lg: { button: "h-10 w-10", text: "text-lg w-12" },
    };

    const s = sizes[size];

    const handleDecrement = () => {
        if (value > min) {
            onChange(value - 1);
        }
    };

    const handleIncrement = () => {
        if (value < max) {
            onChange(value + 1);
        }
    };

    return (
        <div
            className={cn(
                "inline-flex items-center gap-1 bg-muted rounded-lg p-1",
                className
            )}
        >
            <button
                type="button"
                onClick={handleDecrement}
                disabled={value <= min}
                className={cn(
                    "flex items-center justify-center rounded-md",
                    "bg-background transition-colors",
                    "hover:bg-primary-muted hover:text-primary",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    s.button
                )}
            >
                <Minus className="h-4 w-4" />
            </button>

            <span
                className={cn(
                    "font-semibold text-center text-foreground",
                    s.text
                )}
            >
                {value}
            </span>

            <button
                type="button"
                onClick={handleIncrement}
                disabled={value >= max}
                className={cn(
                    "flex items-center justify-center rounded-md",
                    "bg-background transition-colors",
                    "hover:bg-primary-muted hover:text-primary",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    s.button
                )}
            >
                <Plus className="h-4 w-4" />
            </button>
        </div>
    );
}
