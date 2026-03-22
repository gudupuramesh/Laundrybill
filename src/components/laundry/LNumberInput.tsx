/**
 * Number Input Component
 * 
 * Input for numeric values with optional currency formatting
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LNumberInputProps {
    label?: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    prefix?: string;
    suffix?: string;
    formatAsCurrency?: boolean;
    disabled?: boolean;
    error?: string;
    helperText?: string;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

export function LNumberInput({
    label,
    value,
    onChange,
    min,
    max,
    prefix,
    suffix,
    formatAsCurrency = false,
    disabled = false,
    error,
    helperText,
    placeholder,
    required = false,
    className,
}: LNumberInputProps) {
    const [inputValue, setInputValue] = useState(value.toString());

    useEffect(() => {
        setInputValue(value.toString());
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/[^0-9.]/g, "");
        setInputValue(rawValue);

        const numValue = parseFloat(rawValue) || 0;

        let clampedValue = numValue;
        if (min !== undefined) clampedValue = Math.max(min, clampedValue);
        if (max !== undefined) clampedValue = Math.min(max, clampedValue);

        onChange(clampedValue);
    };

    const handleBlur = () => {
        // Format on blur
        setInputValue(value.toString());
    };

    const displayValue = formatAsCurrency
        ? value.toLocaleString("en-IN")
        : inputValue;

    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <label className="text-sm font-medium text-foreground">
                    {label}
                </label>
            )}
            <div
                className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-background",
                    "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary",
                    disabled && "opacity-50 cursor-not-allowed bg-muted",
                    error ? "border-destructive" : "border-input"
                )}
            >
                {prefix && (
                    <span className="text-muted-foreground font-medium">
                        {prefix}
                    </span>
                )}
                <input
                    type="text"
                    inputMode="numeric"
                    value={displayValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={disabled}
                    placeholder={placeholder}
                    required={required}
                    className={cn(
                        "flex-1 bg-transparent outline-none text-foreground",
                        "text-lg font-semibold",
                        disabled && "cursor-not-allowed"
                    )}
                />
                {suffix && (
                    <span className="text-muted-foreground">{suffix}</span>
                )}
            </div>
            {(error || helperText) && (
                <p
                    className={cn(
                        "text-xs",
                        error ? "text-destructive" : "text-muted-foreground"
                    )}
                >
                    {error || helperText}
                </p>
            )}
        </div>
    );
}
