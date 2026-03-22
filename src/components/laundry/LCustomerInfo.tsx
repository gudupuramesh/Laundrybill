/**
 * Customer Info Component
 * 
 * Display customer information with avatar, name, phone, and actions
 */

import { cn } from "@/lib/utils";
import { LAvatar } from "./LAvatar";
import { Phone, MessageCircle } from "lucide-react";

interface LCustomerInfoProps {
    name: string;
    phone: string;
    subtitle?: string;
    size?: "sm" | "md" | "lg";
    showActions?: boolean;
    className?: string;
}

export function LCustomerInfo({
    name,
    phone,
    subtitle,
    size = "md",
    showActions = true,
    className,
}: LCustomerInfoProps) {
    const sizeClasses = {
        sm: {
            container: "gap-2",
            name: "text-sm font-medium",
            phone: "text-xs",
        },
        md: {
            container: "gap-3",
            name: "text-base font-medium",
            phone: "text-sm",
        },
        lg: {
            container: "gap-4",
            name: "text-lg font-semibold",
            phone: "text-base",
        },
    };

    const handleCall = () => {
        window.open(`tel:${phone}`, "_self");
    };

    const handleWhatsApp = () => {
        window.open(`https://wa.me/91${phone}`, "_blank");
    };

    return (
        <div className={cn("flex items-center justify-between", className)}>
            <div className={cn("flex items-center", sizeClasses[size].container)}>
                <LAvatar name={name} size={size} />
                <div>
                    <p className={cn("text-foreground", sizeClasses[size].name)}>
                        {name}
                    </p>
                    <p className={cn("text-muted-foreground", sizeClasses[size].phone)}>
                        {phone}
                    </p>
                    {subtitle && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>

            {showActions && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCall}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        aria-label="Call customer"
                    >
                        <Phone className="h-5 w-5 text-primary" />
                    </button>
                    <button
                        onClick={handleWhatsApp}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        aria-label="WhatsApp customer"
                    >
                        <MessageCircle className="h-5 w-5 text-success" />
                    </button>
                </div>
            )}
        </div>
    );
}
