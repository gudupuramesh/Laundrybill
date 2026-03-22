/**
 * Responsive Dialog Component
 * 
 * Desktop: Modal dialog
 * Mobile: Bottom sheet
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface LResponsiveDialogProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: "sm" | "md" | "lg";
    snapPoints?: number[];
    className?: string;
}

const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
};

export function LResponsiveDialog({
    open,
    onClose,
    title,
    children,
    size = "md",
    snapPoints = [0.9],
    className,
}: LResponsiveDialogProps) {
    const isMobile = useIsMobile();

    // Lock body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (open) {
            window.addEventListener("keydown", handleEscape);
        }
        return () => window.removeEventListener("keydown", handleEscape);
    }, [open, onClose]);

    if (isMobile) {
        // Mobile: Bottom Sheet
        const maxHeight = snapPoints[0] * 100;

        return (
            <AnimatePresence>
                {open && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                        />

                        {/* Sheet */}
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                                "fixed bottom-0 left-0 right-0 z-50",
                                "bg-card rounded-t-3xl shadow-2xl",
                                "flex flex-col",
                                className
                            )}
                            style={{ maxHeight: `${maxHeight}vh` }}
                        >
                            {/* Handle - tappable to close */}
                            <div 
                                className="flex justify-center pt-3 pb-2 cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                            >
                                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
                            </div>

                            {/* Header */}
                            {title && (
                                <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
                                    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onClose();
                                        }}
                                        className="p-2 -mr-2 rounded-lg hover:bg-muted transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto overscroll-contain p-4">
                                {children}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        );
    }

    // Desktop: Modal Dialog
    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
                            "w-full bg-card rounded-2xl shadow-2xl",
                            "max-h-[85vh] flex flex-col",
                            sizeClasses[size],
                            className
                        )}
                    >
                        {/* Header */}
                        {title && (
                            <div className="flex items-center justify-between p-4 border-b border-border">
                                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClose();
                                    }}
                                    className="p-2 -mr-2 rounded-lg hover:bg-muted transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">{children}</div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
