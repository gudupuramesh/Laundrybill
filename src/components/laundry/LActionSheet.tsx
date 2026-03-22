/**
 * Action Sheet Component
 * 
 * Bottom sheet with action buttons (mobile) or dropdown (desktop)
 */

import { cn } from "@/lib/utils";
import { LResponsiveDialog } from "./LResponsiveDialog";

interface ActionItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    destructive?: boolean;
    disabled?: boolean;
}

interface LActionSheetProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    actions: ActionItem[];
    className?: string;
}

export function LActionSheet({
    open,
    onClose,
    title = "Actions",
    actions,
    className,
}: LActionSheetProps) {
    const handleAction = (action: ActionItem) => {
        if (action.disabled) return;
        action.onClick();
        onClose();
    };

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={title}
            size="sm"
            snapPoints={[0.5]}
        >
            <div className={cn("space-y-1", className)}>
                {actions.map((action) => (
                    <button
                        key={action.id}
                        onClick={() => handleAction(action)}
                        disabled={action.disabled}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl",
                            "text-left transition-colors",
                            action.disabled
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-muted active:bg-muted",
                            action.destructive
                                ? "text-destructive hover:bg-destructive/10"
                                : "text-foreground"
                        )}
                    >
                        {action.icon && (
                            <span className={cn(
                                "flex-shrink-0",
                                action.destructive ? "text-destructive" : "text-muted-foreground"
                            )}>
                                {action.icon}
                            </span>
                        )}
                        <span className="font-medium">{action.label}</span>
                    </button>
                ))}
            </div>
        </LResponsiveDialog>
    );
}
