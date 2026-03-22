/**
 * Timeline Item Component
 * 
 * Display a single timeline event with icon, title, and timestamp
 */

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface LTimelineItemProps {
    icon: LucideIcon;
    title: string;
    description?: string | null;
    timestamp: string;
    status?: "completed" | "current" | "pending";
    isLast?: boolean;
    className?: string;
}

export function LTimelineItem({
    icon: Icon,
    title,
    description,
    timestamp,
    status = "completed",
    isLast = false,
    className,
}: LTimelineItemProps) {
    const statusColors = {
        completed: "bg-primary text-primary-foreground",
        current: "bg-primary text-primary-foreground ring-4 ring-primary/20",
        pending: "bg-muted text-muted-foreground",
    };

    const lineColors = {
        completed: "bg-primary",
        current: "bg-border",
        pending: "bg-border",
    };

    return (
        <div className={cn("relative flex gap-4", className)}>
            {/* Icon and Line */}
            <div className="flex flex-col items-center">
                <div
                    className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0",
                        statusColors[status]
                    )}
                >
                    <Icon className="h-4 w-4" />
                </div>
                {!isLast && (
                    <div
                        className={cn(
                            "w-0.5 flex-1 min-h-[24px] mt-2",
                            lineColors[status]
                        )}
                    />
                )}
            </div>

            {/* Content */}
            <div className={cn("flex-1 pb-4", isLast && "pb-0")}>
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="font-medium text-foreground">{title}</p>
                        {description && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {description}
                            </p>
                        )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {timestamp}
                    </span>
                </div>
            </div>
        </div>
    );
}
