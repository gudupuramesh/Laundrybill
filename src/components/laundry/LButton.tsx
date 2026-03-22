import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { LInlineLoader } from "./LLoader";

const lButtonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    {
        variants: {
            variant: {
                primary: "bg-primary text-primary-foreground hover:bg-primary-dark shadow-sm",
                secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-sm",
                outline: "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground",
                ghost: "text-foreground hover:bg-muted",
                destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
                success: "bg-success text-success-foreground hover:bg-success/90 shadow-sm",
                link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
            },
            size: {
                sm: "h-9 px-4 text-sm rounded-lg",
                md: "h-11 px-6 text-base rounded-xl",
                lg: "h-14 px-8 text-lg rounded-xl",
                icon: "h-10 w-10 rounded-full",
                "icon-sm": "h-8 w-8 rounded-full",
                "icon-lg": "h-12 w-12 rounded-full",
            },
            fullWidth: {
                true: "w-full",
                false: "",
            },
        },
        defaultVariants: {
            variant: "primary",
            size: "md",
            fullWidth: false,
        },
    }
);

export interface LButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof lButtonVariants> {
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const LButton = React.forwardRef<HTMLButtonElement, LButtonProps>(
    (
        {
            className,
            variant,
            size,
            fullWidth,
            loading = false,
            leftIcon,
            rightIcon,
            children,
            disabled,
            ...props
        },
        ref
    ) => {
        const isDisabled = disabled || loading;

        return (
            <button
                className={cn(lButtonVariants({ variant, size, fullWidth, className }))}
                ref={ref}
                disabled={isDisabled}
                {...props}
            >
                {loading ? (
                    <LInlineLoader variant="bubbles" light={true} size="sm" />
                ) : leftIcon ? (
                    <span className="flex-shrink-0">{leftIcon}</span>
                ) : null}
                {children}
                {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
            </button>
        );
    }
);
LButton.displayName = "LButton";

export { LButton, lButtonVariants };
