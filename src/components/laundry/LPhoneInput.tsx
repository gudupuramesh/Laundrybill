/**
 * Phone Input Component
 *
 * Country-aware phone input with configurable country code prefix.
 * Defaults to +91 (India) for backward compatibility.
 */

import { forwardRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LPhoneInputProps {
    label?: string;
    value: string;
    onValueChange: (value: string) => void;
    onBlur?: () => void;
    showClear?: boolean;
    helperText?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    /** Country dial code, e.g. "+91", "+1". Defaults to "+91". */
    countryCode?: string;
    /** Max phone digits (after country code). Defaults to 10. */
    maxDigits?: number;
}

export const LPhoneInput = forwardRef<HTMLInputElement, LPhoneInputProps>(
    (
        {
            label,
            value,
            onValueChange,
            onBlur,
            showClear = false,
            helperText,
            error,
            required = false,
            disabled = false,
            className,
            countryCode = "+91",
            maxDigits = 10,
        },
        ref
    ) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            // Only allow digits, up to maxDigits
            const digits = e.target.value.replace(/\D/g, "").slice(0, maxDigits);
            onValueChange(digits);
        };

        const handleClear = () => {
            onValueChange("");
        };

        // Adjust left padding based on country code length
        const prefixWidth = countryCode.length <= 3 ? "pl-14" : countryCode.length <= 4 ? "pl-16" : "pl-[4.5rem]";

        return (
            <div className={cn("space-y-1.5", className)}>
                {label && (
                    <label className="text-sm font-medium text-foreground">{label}</label>
                )}

                <div className="relative">
                    {/* Country Code Prefix */}
                    <div className="absolute left-0 inset-y-0 flex items-center pl-4 pointer-events-none">
                        <span className="text-muted-foreground font-medium">{countryCode}</span>
                    </div>

                    <input
                        ref={ref}
                        type="tel"
                        inputMode="numeric"
                        value={value}
                        onChange={handleChange}
                        onBlur={onBlur}
                        required={required}
                        disabled={disabled}
                        placeholder={"0".repeat(maxDigits)}
                        className={cn(
                            "flex h-12 w-full rounded-xl border bg-background pr-10 text-base",
                            prefixWidth,
                            "placeholder:text-muted-foreground",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                            error
                                ? "border-destructive focus-visible:ring-destructive"
                                : "border-input"
                        )}
                    />

                    {/* Clear button - only show when not disabled */}
                    {showClear && value && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="absolute right-3 inset-y-0 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Helper/Error text */}
                {(helperText || error) && (
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
);

LPhoneInput.displayName = "LPhoneInput";
