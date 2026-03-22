import * as React from "react";
import { cn } from "@/lib/utils";
import { useCurrency, formatCurrencyValue } from "@/hooks/use-currency";

export interface LAmountProps {
    value: number;
    /** Override currency symbol. If omitted, reads from shop settings via useCurrency(). */
    currency?: string;
    size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
    variant?: "default" | "positive" | "negative";
    highlight?: boolean;
    className?: string;
}

const sizeClasses = {
    xs: "text-xs",
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl font-semibold",
    xl: "text-2xl font-bold",
    "2xl": "text-3xl font-bold",
};

const variantClasses = {
    default: "",
    positive: "text-success",
    negative: "text-destructive",
};

const LAmount = React.forwardRef<HTMLSpanElement, LAmountProps>(
    ({ value, currency, size = "md", variant = "default", highlight, className }, ref) => {
        const { currencySymbol, locale } = useCurrency();
        const symbol = currency ?? currencySymbol;

        return (
            <span
                ref={ref}
                className={cn(
                    "tabular-nums",
                    sizeClasses[size],
                    variantClasses[variant],
                    highlight && "text-primary font-semibold",
                    className
                )}
            >
                {formatCurrencyValue(value, symbol, locale)}
            </span>
        );
    }
);
LAmount.displayName = "LAmount";

export { LAmount };
