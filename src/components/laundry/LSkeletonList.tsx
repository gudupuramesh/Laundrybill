/**
 * Skeleton List Component
 * 
 * Loading placeholder for lists
 */

import { cn } from "@/lib/utils";
import { LSkeleton } from "./LSkeleton";

interface LSkeletonListProps {
    count?: number;
    showAvatar?: boolean;
    className?: string;
}

export function LSkeletonList({
    count = 5,
    showAvatar = true,
    className,
}: LSkeletonListProps) {
    return (
        <div className={cn("space-y-3", className)}>
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-xl bg-card"
                >
                    {showAvatar && (
                        <LSkeleton width={40} height={40} className="rounded-full" />
                    )}
                    <div className="flex-1 space-y-2">
                        <LSkeleton width="60%" height={16} />
                        <LSkeleton width="40%" height={12} />
                    </div>
                    <div className="text-right space-y-2">
                        <LSkeleton width={60} height={16} />
                        <LSkeleton width={50} height={20} className="rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}
