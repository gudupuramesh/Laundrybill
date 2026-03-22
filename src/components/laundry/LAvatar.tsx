import * as React from "react";
import { cn } from "@/lib/utils";

export interface LAvatarProps {
    src?: string;
    name?: string;
    size?: "xs" | "sm" | "md" | "lg" | "xl";
    status?: "online" | "offline" | "away";
    className?: string;
}

const sizeClasses = {
    xs: "h-6 w-6 text-xs",
    sm: "h-8 w-8 text-sm",
    md: "h-10 w-10 text-base",
    lg: "h-12 w-12 text-lg",
    xl: "h-16 w-16 text-xl",
};

const statusClasses = {
    online: "bg-success",
    offline: "bg-gray-400",
    away: "bg-warning",
};

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

const LAvatar = React.forwardRef<HTMLDivElement, LAvatarProps>(
    ({ src, name = "", size = "md", status, className }, ref) => {
        const [imgError, setImgError] = React.useState(false);
        const showFallback = !src || imgError;
        const initials = getInitials(name);

        return (
            <div ref={ref} className={cn("relative inline-flex", className)}>
                <div
                    className={cn(
                        "flex items-center justify-center rounded-full bg-primary-muted text-primary font-semibold overflow-hidden",
                        sizeClasses[size]
                    )}
                >
                    {showFallback ? (
                        <span>{initials || "?"}</span>
                    ) : (
                        <img
                            src={src}
                            alt={name}
                            className="w-full h-full object-cover"
                            onError={() => setImgError(true)}
                        />
                    )}
                </div>

                {status && (
                    <span
                        className={cn(
                            "absolute bottom-0 right-0 rounded-full border-2 border-background",
                            statusClasses[status],
                            size === "xs" && "h-2 w-2",
                            size === "sm" && "h-2.5 w-2.5",
                            size === "md" && "h-3 w-3",
                            size === "lg" && "h-3.5 w-3.5",
                            size === "xl" && "h-4 w-4"
                        )}
                    />
                )}
            </div>
        );
    }
);
LAvatar.displayName = "LAvatar";

export { LAvatar };
