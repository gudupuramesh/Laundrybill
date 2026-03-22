/**
 * LSelect - Dropdown select component
 * 
 * A styled select dropdown with support for grouped options
 */

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface LSelectOption {
    value: string;
    label: string;
    group?: string;
}

interface LSelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: LSelectOption[];
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string;
    className?: string;
}

export const LSelect = forwardRef<HTMLSelectElement, LSelectProps>(
    ({ label, value, onChange, options, placeholder, required, disabled, error, className }, ref) => {
        // Group options by group name
        const groupedOptions = options.reduce((acc, option) => {
            const group = option.group || "";
            if (!acc[group]) {
                acc[group] = [];
            }
            acc[group].push(option);
            return acc;
        }, {} as Record<string, LSelectOption[]>);

        const hasGroups = Object.keys(groupedOptions).some(g => g !== "");

        return (
            <div className={cn("space-y-1.5", className)}>
                {label && (
                    <label className="text-sm font-medium text-foreground flex items-center gap-1">
                        {label}
                        {required && <span className="text-destructive">*</span>}
                    </label>
                )}
                <div className="relative">
                    <select
                        ref={ref}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={disabled}
                        className={cn(
                            "w-full h-11 px-3 pr-10 rounded-lg border appearance-none",
                            "bg-background text-foreground",
                            "border-border focus:border-primary focus:ring-2 focus:ring-primary/20",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "transition-colors duration-200",
                            error && "border-destructive focus:border-destructive focus:ring-destructive/20"
                        )}
                    >
                        {placeholder && (
                            <option value="" disabled>
                                {placeholder}
                            </option>
                        )}
                        {hasGroups ? (
                            Object.entries(groupedOptions).map(([group, opts]) => (
                                group ? (
                                    <optgroup key={group} label={group}>
                                        {opts.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                ) : (
                                    opts.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))
                                )
                            ))
                        ) : (
                            options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))
                        )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                {error && (
                    <p className="text-xs text-destructive">{error}</p>
                )}
            </div>
        );
    }
);

LSelect.displayName = "LSelect";
