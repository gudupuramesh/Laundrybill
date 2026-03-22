/**
 * Ad Slot Component
 * 
 * Displays ads or self-promotion fallback in sidebar, card, or banner style
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { useAds } from "@/hooks/use-ads";
import { ArrowRight } from "lucide-react";
import type { SelfPromo } from "@/types/ads";

interface LAdSlotProps {
    variant: 'sidebar' | 'card' | 'banner';
    position?: string;
    className?: string;
}

// Self-promotion fallback content
const selfPromos: SelfPromo[] = [
    {
        id: 'upgrade',
        icon: '🚀',
        title: 'Upgrade to Pro',
        description: 'Unlimited orders & staff members',
        action: 'Learn More',
        route: '/settings/billing',
    },
    {
        id: 'whatsapp',
        icon: '💬',
        title: 'Enable WhatsApp',
        description: 'Auto-notify customers on updates',
        action: 'Setup Now',
        route: '/settings/notifications',
    },
    {
        id: 'reports',
        icon: '📊',
        title: 'Try Reports',
        description: 'Track revenue & expenses easily',
        action: 'View Reports',
        route: '/reports',
    },
    {
        id: 'staff',
        icon: '👥',
        title: 'Add Staff',
        description: 'Invite team members to help',
        action: 'Add Staff',
        route: '/staff',
    },
    {
        id: 'app',
        icon: '📱',
        title: 'Install App',
        description: 'Faster access from home screen',
        action: 'Install',
    },
];

export function LAdSlot({ variant, position, className }: LAdSlotProps) {
    const { ad, isEnabled, trackImpression } = useAds(position);

    // Get random self-promo for fallback
    const selfPromo = React.useMemo(
        () => selfPromos[Math.floor(Math.random() * selfPromos.length)],
        []
    );

    // Track impression on mount
    React.useEffect(() => {
        if (ad) {
            trackImpression(ad.id, position);
        }
    }, [ad, position, trackImpression]);

    // SIDEBAR variant (Desktop right panel)
    if (variant === 'sidebar') {
        return (
            <div
                className={cn(
                    "w-[300px] flex-shrink-0 h-full",
                    "border-l border-border bg-card",
                    "hidden xl:block",
                    className
                )}
            >
                <div className="p-4 h-full flex flex-col">
                    {/* Ad Label */}
                    <span className="text-xs text-muted-foreground mb-2">Sponsored</span>

                    {/* Ad Content or Fallback */}
                    {ad && isEnabled ? (
                        <a
                            href={ad.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 rounded-xl overflow-hidden"
                        >
                            <img
                                src={ad.imageUrl}
                                alt={ad.title || 'Advertisement'}
                                className="w-full h-full object-cover rounded-xl"
                            />
                        </a>
                    ) : (
                        <SelfPromoCard promo={selfPromo} variant="sidebar" />
                    )}
                </div>
            </div>
        );
    }

    // CARD variant (Mobile inline)
    if (variant === 'card') {
        return (
            <div
                className={cn(
                    "w-full my-2",
                    "xl:hidden", // Hide on desktop (using sidebar instead)
                    className
                )}
            >
                {ad && isEnabled ? (
                    <a
                        href={ad.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                    >
                        <div className="relative bg-card border border-border rounded-xl overflow-hidden">
                            <span className="absolute top-2 right-2 text-[10px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded">
                                Ad
                            </span>
                            <img
                                src={ad.imageUrl}
                                alt={ad.title || 'Advertisement'}
                                className="w-full h-20 object-cover"
                            />
                            {ad.title && (
                                <div className="p-2">
                                    <p className="text-sm font-medium truncate">{ad.title}</p>
                                </div>
                            )}
                        </div>
                    </a>
                ) : (
                    <SelfPromoCard promo={selfPromo} variant="card" />
                )}
            </div>
        );
    }

    // BANNER variant (Dashboard sections)
    if (variant === 'banner') {
        return (
            <div className={cn("w-full my-4", className)}>
                {ad && isEnabled ? (
                    <a
                        href={ad.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                    >
                        <div className="relative bg-card border border-border rounded-xl overflow-hidden">
                            <span className="absolute top-2 right-2 text-[10px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded">
                                Ad
                            </span>
                            <img
                                src={ad.imageUrl}
                                alt={ad.title || 'Advertisement'}
                                className="w-full h-28 object-cover"
                            />
                        </div>
                    </a>
                ) : (
                    <SelfPromoCard promo={selfPromo} variant="banner" />
                )}
            </div>
        );
    }

    return null;
}

// Self-Promotion Fallback Card
function SelfPromoCard({
    promo,
    variant,
}: {
    promo: SelfPromo;
    variant: 'sidebar' | 'card' | 'banner';
}) {
    const isSidebar = variant === 'sidebar';

    return (
        <div
            className={cn(
                "bg-gradient-to-br from-primary-muted to-secondary-muted",
                "border border-border rounded-xl",
                "flex items-center gap-3 cursor-pointer",
                "hover:shadow-md transition-shadow",
                isSidebar ? "flex-col p-6 text-center h-full justify-center" : "p-4"
            )}
        >
            <span className={cn("text-3xl", isSidebar && "text-5xl mb-2")}>
                {promo.icon}
            </span>
            <div className={cn("flex-1", isSidebar && "space-y-2")}>
                <p className={cn(
                    "font-semibold text-foreground",
                    isSidebar ? "text-lg" : "text-sm"
                )}>
                    {promo.title}
                </p>
                <p className={cn(
                    "text-muted-foreground",
                    isSidebar ? "text-sm" : "text-xs"
                )}>
                    {promo.description}
                </p>
                {isSidebar && (
                    <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium inline-flex items-center gap-1">
                        {promo.action}
                        <ArrowRight className="h-4 w-4" />
                    </button>
                )}
            </div>
            {!isSidebar && (
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
            )}
        </div>
    );
}
