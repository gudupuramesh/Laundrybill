import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const lCardVariants = cva("rounded-xl transition-all", {
    variants: {
        variant: {
            elevated: "bg-card shadow-md",
            outlined: "bg-card border border-border",
            filled: "bg-muted",
        },
        interactive: {
            true: "cursor-pointer active:scale-[0.99] hover:shadow-lg",
            false: "",
        },
        padding: {
            none: "",
            sm: "p-3",
            md: "p-4",
            lg: "p-6",
        },
    },
    defaultVariants: {
        variant: "elevated",
        interactive: false,
        padding: "md",
    },
});

export interface LCardProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof lCardVariants> { }

const LCard = React.forwardRef<HTMLDivElement, LCardProps>(
    ({ className, variant, interactive, padding, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(lCardVariants({ variant, interactive, padding, className }))}
                {...props}
            />
        );
    }
);
LCard.displayName = "LCard";

// Card Header
interface LCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}

const LCardHeader = React.forwardRef<HTMLDivElement, LCardHeaderProps>(
    ({ className, title, subtitle, action, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn("flex items-start justify-between gap-4", className)}
                {...props}
            >
                <div className="flex-1 min-w-0">
                    <h3 className="text-heading-sm truncate">{title}</h3>
                    {subtitle && (
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
                    )}
                </div>
                {action && <div className="flex-shrink-0">{action}</div>}
            </div>
        );
    }
);
LCardHeader.displayName = "LCardHeader";

// Card Content
const LCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => {
        return <div ref={ref} className={cn("mt-4", className)} {...props} />;
    }
);
LCardContent.displayName = "LCardContent";

// Card Footer
const LCardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn("mt-4 pt-4 border-t border-border flex items-center gap-3", className)}
                {...props}
            />
        );
    }
);
LCardFooter.displayName = "LCardFooter";

export { LCard, LCardHeader, LCardContent, LCardFooter, lCardVariants };
