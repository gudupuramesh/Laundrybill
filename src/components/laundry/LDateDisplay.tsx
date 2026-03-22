/**
 * Date Display Component
 * 
 * Smart date formatting with relative and absolute options
 */

import { cn } from "@/lib/utils";
import { format, isToday, isYesterday, isThisYear, formatDistanceToNow } from "date-fns";

interface LDateDisplayProps {
    date: Date | { toDate: () => Date };
    format?: "smart" | "relative" | "date" | "datetime" | "time";
    className?: string;
}

export function LDateDisplay({
    date,
    format: formatType = "smart",
    className,
}: LDateDisplayProps) {
    // Handle Firestore Timestamp
    if (!date) return null;
    const dateObj = date instanceof Date ? date : (date as any)?.toDate ? (date as any).toDate() : new Date(date as any);

    const getFormattedDate = () => {
        switch (formatType) {
            case "relative":
                return formatDistanceToNow(dateObj, { addSuffix: true });

            case "date":
                return format(dateObj, "MMM d, yyyy");

            case "datetime":
                return format(dateObj, "MMM d, yyyy 'at' h:mm a");

            case "time":
                return format(dateObj, "h:mm a");

            case "smart":
            default:
                if (isToday(dateObj)) {
                    return `Today, ${format(dateObj, "h:mm a")}`;
                }
                if (isYesterday(dateObj)) {
                    return `Yesterday, ${format(dateObj, "h:mm a")}`;
                }
                if (isThisYear(dateObj)) {
                    return format(dateObj, "MMM d");
                }
                return format(dateObj, "MMM d, yyyy");
        }
    };

    return (
        <span className={cn("text-muted-foreground", className)}>
            {getFormattedDate()}
        </span>
    );
}
