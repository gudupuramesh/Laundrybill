import { cn } from "@/lib/utils";
import { LBadge } from "./LBadge";
import type { OrderStatus } from "@/types/order";
import { STATUS_LABELS, STATUS_COLORS } from "@/types/order";

export interface LStatusBadgeProps {
    status: OrderStatus;
    size?: "sm" | "md" | "lg";
    showDot?: boolean;
    className?: string;
}

const variantMap: Record<string, "warning" | "default" | "success" | "destructive" | "muted"> = {
    warning: "warning",
    primary: "default",
    success: "success",
    destructive: "destructive",
};

export function LStatusBadge({ status, size = "md", showDot = true, className }: LStatusBadgeProps) {
    const label = STATUS_LABELS[status] || status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const color = STATUS_COLORS[status] || "primary";
    const variant = variantMap[color] || "muted";

    return (
        <LBadge
            variant={variant}
            size={size}
            dot={showDot}
            className={cn("capitalize", className)}
        >
            {label}
        </LBadge>
    );
}
