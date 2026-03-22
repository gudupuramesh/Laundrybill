import * as React from "react";
import { cn } from "@/lib/utils";
import { LButton } from "./LButton";

export interface LEmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function LEmptyState({
    icon,
    title,
    description,
    action,
    className,
}: LEmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center text-center py-12 px-4",
                className
            )}
        >
            {icon && (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <div className="w-8 h-8 text-muted-foreground">{icon}</div>
                </div>
            )}
            <h3 className="text-heading-sm text-foreground">{title}</h3>
            {description && (
                <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    {description}
                </p>
            )}
            {action && (
                <LButton
                    variant="primary"
                    size="sm"
                    className="mt-6"
                    onClick={action.onClick}
                >
                    {action.label}
                </LButton>
            )}
        </div>
    );
}
