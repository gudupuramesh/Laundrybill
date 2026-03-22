/**
 * Radio Group Component
 * 
 * Radio button options with labels and descriptions
 */

import { cn } from "@/lib/utils";

interface RadioOption {
    value: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
}

interface LRadioGroupProps {
    name: string;
    options: RadioOption[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

export function LRadioGroup({
    name,
    options,
    value,
    onChange,
    className,
}: LRadioGroupProps) {
    return (
        <div className={cn("space-y-2", className)}>
            {options.map((option) => {
                const isSelected = value === option.value;

                return (
                    <label
                        key={option.value}
                        className={cn(
                            "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                            isSelected
                                ? "border-primary bg-primary-muted"
                                : "border-border hover:border-primary/50",
                            option.disabled && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={isSelected}
                            onChange={() => !option.disabled && onChange(option.value)}
                            disabled={option.disabled}
                            className="sr-only"
                        />
                        <div
                            className={cn(
                                "w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5",
                                "flex items-center justify-center",
                                isSelected ? "border-primary" : "border-muted-foreground"
                            )}
                        >
                            {isSelected && (
                                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                {option.icon && (
                                    <span className="text-muted-foreground">{option.icon}</span>
                                )}
                                <p className="text-sm font-medium text-foreground">{option.label}</p>
                            </div>
                            {option.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                                    {option.description}
                                </p>
                            )}
                        </div>
                    </label>
                );
            })}
        </div>
    );
}
