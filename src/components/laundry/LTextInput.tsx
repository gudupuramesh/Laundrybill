import * as React from "react";
import { cn } from "@/lib/utils";

export interface LTextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    size?: "sm" | "md" | "lg";
}

const sizeClasses = {
    sm: "h-9 text-sm px-3",
    md: "h-11 text-base px-4",
    lg: "h-14 text-lg px-5",
};

const LTextInput = React.forwardRef<HTMLInputElement, LTextInputProps>(
    ({ className, label, error, hint, leftIcon, rightIcon, size = "md", id, ...props }, ref) => {
        const inputId = id || React.useId();

        return (
            <div className="space-y-1.5">
                {label && (
                    <label htmlFor={inputId} className="text-sm font-medium text-foreground">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        id={inputId}
                        ref={ref}
                        className={cn(
                            "w-full rounded-xl border bg-background ring-offset-background transition-colors",
                            "placeholder:text-muted-foreground",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                            sizeClasses[size],
                            leftIcon && "pl-10",
                            rightIcon && "pr-10",
                            error
                                ? "border-destructive focus-visible:ring-destructive"
                                : "border-input",
                            className
                        )}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                {hint && !error && <p className="text-sm text-muted-foreground">{hint}</p>}
            </div>
        );
    }
);
LTextInput.displayName = "LTextInput";

export { LTextInput };
