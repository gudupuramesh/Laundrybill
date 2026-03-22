/**
 * Time Picker Component
 * 
 * Native time picker with custom styling
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

export interface LTimePickerProps {
    value?: string;
    onChange?: (time: string) => void;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

const LTimePicker = React.forwardRef<HTMLDivElement, LTimePickerProps>(
    (
        {
            value,
            onChange,
            label,
            placeholder = "Select time",
            disabled = false,
            className,
        },
        ref
    ) => {
        const inputRef = React.useRef<HTMLInputElement>(null);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (onChange) {
                onChange(e.target.value);
            }
        };

        // Format time for display (HH:MM to hh:mm AM/PM)
        const formatTimeDisplay = (time?: string): string => {
            if (!time) return "";
            const [hours, minutes] = time.split(":").map(Number);
            const period = hours >= 12 ? "PM" : "AM";
            const displayHours = hours % 12 || 12;
            return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
        };

        const displayValue = value ? formatTimeDisplay(value) : "";

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
                        onClick={() => inputRef.current?.showPicker()}
                        disabled={disabled}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card text-left",
                            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
                            "transition-all duration-200",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <span className={value ? "text-foreground" : "text-muted-foreground"}>
                            {displayValue || placeholder}
                        </span>
                    </button>

                    {/* Hidden native input */}
                    <input
                        ref={inputRef}
                        type="time"
                        value={value || ""}
                        onChange={handleChange}
                        disabled={disabled}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        style={{ colorScheme: "normal" }}
                    />
                </div>
            </div>
        );
    }
);
LTimePicker.displayName = "LTimePicker";

export { LTimePicker };
