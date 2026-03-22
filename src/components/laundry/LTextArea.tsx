/**
 * TextArea Component
 * 
 * Multi-line text input
 */

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface LTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helperText?: string;
    minRows?: number;
}

export const LTextArea = forwardRef<HTMLTextAreaElement, LTextAreaProps>(
    ({ label, error, helperText, minRows = 3, className, ...props }, ref) => {
        return (
            <div className="space-y-1.5">
                {label && (
                    <label className="text-sm font-medium text-foreground">{label}</label>
                )}
                <textarea
                    ref={ref}
                    rows={minRows}
                    className={cn(
                        "flex w-full rounded-xl border bg-background px-4 py-3 text-sm",
                        "placeholder:text-muted-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "resize-none",
                        error ? "border-destructive" : "border-input",
                        className
                    )}
                    {...props}
                />
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

LTextArea.displayName = "LTextArea";
