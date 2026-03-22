/**
 * Confirm Dialog Component
 * 
 * A beautiful confirmation dialog to replace window.confirm
 */

import { LButton, LResponsiveDialog } from "@/components/laundry";
import { AlertTriangle } from "lucide-react";

interface LConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive";
    loading?: boolean;
}

export function LConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default",
    loading = false,
}: LConfirmDialogProps) {
    return (
        <LResponsiveDialog open={open} onClose={onClose} size="sm">
            <div className="text-center py-4">
                {/* Icon */}
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${variant === "destructive"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary"
                    }`}>
                    <AlertTriangle className="h-8 w-8" />
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>

                {/* Description */}
                {description && (
                    <p className="text-muted-foreground text-sm mb-6">{description}</p>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-center">
                    <LButton variant="outline" onClick={onClose} disabled={loading}>
                        {cancelText}
                    </LButton>
                    <LButton
                        variant={variant === "destructive" ? "destructive" : "primary"}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        disabled={loading}
                    >
                        {confirmText}
                    </LButton>
                </div>
            </div>
        </LResponsiveDialog>
    );
}
