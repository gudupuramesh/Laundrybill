/**
 * Bottom Sheet Component
 * 
 * Mobile-first modal that slides up from the bottom
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface LBottomSheetProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    snapPoints?: number[];
    className?: string;
}

export function LBottomSheet({
    open,
    onClose,
    title,
    children,
    snapPoints = [0.9],
    className,
}: LBottomSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const dragControls = useDragControls();

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
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                    />

                    {/* Sheet */}
                    <motion.div
                        ref={sheetRef}
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        drag="y"
                        dragControls={dragControls}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.5 }}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 100 || info.velocity.y > 500) {
                                onClose();
                            }
                        }}
                        className={cn(
                            "fixed bottom-0 left-0 right-0 z-[100]",
                            "bg-card rounded-t-3xl shadow-2xl",
                            "flex flex-col",
                            className
                        )}
                        style={{ maxHeight: `${maxHeight}vh` }}
                    >
                        {/* Handle */}
                        <div
                            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
                            onPointerDown={(e) => dragControls.start(e)}
                        >
                            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
                        </div>

                        {/* Header */}
                        {title && (
                            <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
                                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 -mr-2 rounded-lg hover:bg-muted transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto overscroll-contain">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
