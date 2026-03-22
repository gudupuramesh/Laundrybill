/**
 * Date Picker Component
 * 
 * Native date picker with custom styling
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";
import { format } from "date-fns";

export interface LDatePickerProps {
    value?: Date;
    onChange?: (date: Date) => void;
    label?: string;
    placeholder?: string;
    minDate?: Date;
    maxDate?: Date;
    disabled?: boolean;
    className?: string;
}

const LDatePicker = React.forwardRef<HTMLDivElement, LDatePickerProps>(
    (
        {
            value,
            onChange,
            label,
            placeholder = "Select date",
            minDate,
            maxDate,
            disabled = false,
            className,
        },
        ref
    ) => {
        const inputRef = React.useRef<HTMLInputElement>(null);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.value && onChange) {
                onChange(new Date(e.target.value));
            }
        };

        const openPicker = () => {
            const input = inputRef.current;
            if (!input || disabled) return;
            if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === "function") {
                (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
            } else {
                input.click();
                input.focus();
            }
        };

        const formatDateForInput = (date?: Date): string => {
            if (!date) return "";
            return format(date, "yyyy-MM-dd");
        };

        const displayValue = value ? format(value, "EEE, d MMM yyyy") : "";

        return (
            <div ref={ref} className={cn("relative", className)}>
                {label && (
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                        {label}
                    </label>
                )}

                <div className="relative">
                    {/* Display element */}
                    <button
                        type="button"
                        onClick={openPicker}
                        disabled={disabled}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card text-left",
                            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
                            "transition-all duration-200",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <span className={value ? "text-foreground" : "text-muted-foreground"}>
                            {displayValue || placeholder}
                        </span>
                    </button>

                    {/* Hidden native input – pointer-events-none so button always receives click and opens picker */}
                    <input
                        ref={inputRef}
                        type="date"
                        value={formatDateForInput(value)}
                        onChange={handleChange}
                        min={minDate ? formatDateForInput(minDate) : undefined}
                        max={maxDate ? formatDateForInput(maxDate) : undefined}
                        disabled={disabled}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer pointer-events-none"
                        style={{ colorScheme: "normal" }}
                        aria-hidden
                    />
                </div>
            </div>
        );
    }
);
LDatePicker.displayName = "LDatePicker";

export { LDatePicker };
