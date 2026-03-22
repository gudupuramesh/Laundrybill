/**
 * Toast Provider and Hook
 * 
 * Provides toast notifications across the app
 */

import { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
    id: string;
    type: "success" | "error" | "info" | "warning";
    title: string;
    description?: string;
    duration?: number;
}

interface ToastContextType {
    addToast: (toast: Omit<Toast, "id">) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function LToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, "id">) => {
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const duration = toast.duration ?? 4000;

        setToasts((prev) => [...prev, { ...toast, id }]);

        // Auto remove
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}

            {/* Toast container */}
            <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col items-center gap-2 pointer-events-none sm:items-end sm:left-auto sm:right-4 sm:bottom-4">
                <AnimatePresence mode="popLayout">
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                            className={cn(
                                "pointer-events-auto w-full max-w-sm rounded-xl shadow-lg p-4",
                                "bg-card border border-border",
                                "flex items-start gap-3"
                            )}
                        >
                            {/* Icon */}
                            <div
                                className={cn(
                                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                                    toast.type === "success" && "bg-success-muted text-success",
                                    toast.type === "error" && "bg-destructive-muted text-destructive",
                                    toast.type === "info" && "bg-primary-muted text-primary",
                                    toast.type === "warning" && "bg-warning-muted text-warning"
                                )}
                            >
                                {toast.type === "success" && <CheckCircle className="h-5 w-5" />}
                                {toast.type === "error" && <AlertCircle className="h-5 w-5" />}
                                {toast.type === "info" && <Info className="h-5 w-5" />}
                                {toast.type === "warning" && <AlertTriangle className="h-5 w-5" />}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{toast.title}</p>
                                {toast.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {toast.description}
                                    </p>
                                )}
                            </div>

                            {/* Close button */}
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useLToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error("useLToast must be used within a LToastProvider");
    }
    return context;
}
