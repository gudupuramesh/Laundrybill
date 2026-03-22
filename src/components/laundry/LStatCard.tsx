import * as React from "react";
import { cn } from "@/lib/utils";
import { LCard } from "./LCard";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface LStatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: React.ReactNode;
    trend?: {
        value: number;
        label?: string;
    };
    variant?: "default" | "primary" | "success" | "warning" | "destructive";
    className?: string;
    onClick?: () => void;
}

const variantClasses = {
    default: "bg-card",
    primary: "bg-primary-muted border-primary/20",
    success: "bg-success-muted border-success/20",
    warning: "bg-warning-muted border-warning/20",
    destructive: "bg-destructive-muted border-destructive/20",
};

const iconBgClasses = {
    default: "bg-muted",
    primary: "bg-primary/10",
    success: "bg-success/10",
    warning: "bg-warning/10",
    destructive: "bg-destructive/10",
};

const iconColorClasses = {
    default: "text-muted-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
};

export function LStatCard({
    title,
    value,
    subtitle,
    icon,
    trend,
    variant = "default",
    className,
    onClick,
}: LStatCardProps) {
    const TrendIcon = trend
        ? trend.value > 0
            ? TrendingUp
            : trend.value < 0
                ? TrendingDown
                : Minus
        : null;

    return (
        <LCard
            variant="outlined"
            interactive={!!onClick}
            padding="sm"
            className={cn(variantClasses[variant], "min-w-0 sm:p-4", className)}
            onClick={onClick}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                        {title}
                    </p>
                    <p className="text-lg sm:text-xl font-bold text-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                        {value}
                    </p>
                    {subtitle && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">{subtitle}</p>
                    )}
                    {trend && TrendIcon && (
                        <div
                            className={cn(
                                "flex items-center gap-1 mt-1.5 text-xs sm:text-sm",
                                trend.value > 0 && "text-success",
                                trend.value < 0 && "text-destructive",
                                trend.value === 0 && "text-muted-foreground"
                            )}
                        >
                            <TrendIcon className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span>
                                {trend.value > 0 ? "+" : ""}
                                {trend.value}%
                            </span>
                        </div>
                    )}
                </div>

                {icon && (
                    <div
                        className={cn(
                            "flex-shrink-0 p-2 sm:p-3 rounded-lg sm:rounded-xl",
                            iconBgClasses[variant]
                        )}
                    >
                        <div className={cn("h-4 w-4 sm:h-5 sm:w-5", iconColorClasses[variant])}>
                            {icon}
                        </div>
                    </div>
                )}
            </div>
        </LCard>
    );
}
