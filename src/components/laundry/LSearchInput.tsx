/**
 * Search Input Component
 * 
 * Search field with icon and clear button
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

interface LSearchInputProps {
    placeholder?: string;
    value?: string;
    onChange: (value: string) => void;
    debounceMs?: number;
    className?: string;
}

export function LSearchInput({
    placeholder = "Search...",
    value: controlledValue,
    onChange,
    debounceMs = 300,
    className,
}: LSearchInputProps) {
    const [internalValue, setInternalValue] = useState(controlledValue || "");

    // Sync with controlled value
    useEffect(() => {
        if (controlledValue !== undefined) {
            setInternalValue(controlledValue);
        }
    }, [controlledValue]);

    // Debounced onChange
    useEffect(() => {
        const timer = setTimeout(() => {
            onChange(internalValue);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [internalValue, debounceMs, onChange]);

    const handleClear = () => {
        setInternalValue("");
        onChange("");
    };

    return (
        <div className={cn("relative", className)}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
                type="text"
                value={internalValue}
                onChange={(e) => setInternalValue(e.target.value)}
                placeholder={placeholder}
                className={cn(
                    "w-full h-10 pl-9 pr-8 rounded-xl border border-input bg-background",
                    "text-sm placeholder:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                )}
            />
            {internalValue && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
