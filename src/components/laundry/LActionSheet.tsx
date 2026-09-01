/**
 * Action Sheet Component
 * 
 * Bottom sheet with action buttons (mobile) or dropdown (desktop)
 */

import { cn } from "@/lib/utils";
import { LResponsiveDialog } from "./LResponsiveDialog";
import { LDrawer } from "./LDrawer";
import { useIsMobile } from "@/hooks/use-mobile";

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
    const isMobile = useIsMobile();

    const handleAction = (action: ActionItem) => {
        if (action.disabled) return;
        action.onClick();
        onClose();
    };

    const row = (action: ActionItem, compact: boolean) => (
        <button
            key={action.id}
            onClick={() => handleAction(action)}
            disabled={action.disabled}
            className={cn(
                "flex items-center text-left transition-colors",
                compact
                    ? "gap-2.5 px-3 py-2.5 rounded-lg border border-border text-sm"
                    : "w-full gap-3 px-4 py-3 rounded-xl",
                action.disabled
                    ? "opacity-50 cursor-not-allowed"
                    : compact
                        ? "hover:border-primary hover:bg-primary/5"
                        : "hover:bg-muted active:bg-muted",
                action.destructive
                    ? compact
                        ? "text-destructive border-destructive/40 hover:border-destructive hover:bg-destructive/10 col-span-2 justify-center"
                        : "text-destructive hover:bg-destructive/10"
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
    );

    // Desktop: a compact two-column grid halves the dialog height; destructive
    // actions sit apart on their own full-width row. Mobile keeps the classic
    // one-per-line bottom-sheet list.
    const normal = actions.filter((a) => !a.destructive);
    const destructive = actions.filter((a) => a.destructive);

    // Phones: classic bottom sheet. Desktop: right-edge drawer (matches the
    // filter panel — centered popups felt heavy), compact two-column grid with
    // destructive actions set apart at the bottom.
    return isMobile ? (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={title}
            size="sm"
            snapPoints={[0.5]}
        >
            <div className={cn("space-y-1", className)}>
                {actions.map((a) => row(a, false))}
            </div>
        </LResponsiveDialog>
    ) : (
        <LDrawer open={open} onClose={onClose} title={title} width={340}>
            <div className={cn("grid grid-cols-2 gap-2", className)}>
                {normal.map((a) => row(a, true))}
                {destructive.length > 0 && (
                    <div className="col-span-2 border-t border-border my-1" />
                )}
                {destructive.map((a) => row(a, true))}
            </div>
        </LDrawer>
    );
}
