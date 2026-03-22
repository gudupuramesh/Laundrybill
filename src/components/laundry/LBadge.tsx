import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const lBadgeVariants = cva(
    "inline-flex items-center gap-1 rounded-full font-medium transition-colors",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground",
                secondary: "bg-secondary text-secondary-foreground",
                outline: "border border-border text-foreground",
                success: "bg-success-muted text-success",
                warning: "bg-warning-muted text-warning-foreground",
                destructive: "bg-destructive-muted text-destructive",
                muted: "bg-muted text-muted-foreground",
            },
            size: {
                sm: "text-[10px] px-2 py-0.5",
                md: "text-xs px-2.5 py-1",
                lg: "text-sm px-3 py-1.5",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "md",
        },
    }
);

export interface LBadgeProps
    extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof lBadgeVariants> {
    dot?: boolean;
}

const LBadge = React.forwardRef<HTMLSpanElement, LBadgeProps>(
    ({ className, variant, size, dot, children, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(lBadgeVariants({ variant, size, className }))}
                {...props}
            >
                {dot && (
                    <span
                        className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            variant === "success" && "bg-success",
                            variant === "warning" && "bg-warning",
                            variant === "destructive" && "bg-destructive",
                            variant === "default" && "bg-primary-foreground",
                            (!variant || variant === "muted" || variant === "outline" || variant === "secondary") && "bg-current"
                        )}
                    />
                )}
                {children}
            </span>
        );
    }
);
LBadge.displayName = "LBadge";

export { LBadge, lBadgeVariants };
