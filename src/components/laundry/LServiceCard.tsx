/**
 * Service Card Component
 * 
 * Display a service/item for selection in POS
 * Uses div instead of button for better mobile flexbox support
 * Implements movement threshold to distinguish scroll from tap
 * Shows cart quantity badge when items are in cart
 */

import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useRef } from "react";
import { ShoppingCart } from "lucide-react";

// Movement threshold in pixels - if finger moves more than this, it's a scroll
const SCROLL_THRESHOLD = 15;

interface LServiceCardProps {
    name: string;
    price: number;
    unit?: string;
    imageUrl?: string;
    icon?: React.ReactNode;
    /** Category name to display (useful in "All" view) */
    categoryName?: string;
    /** Quantity of this item in cart */
    cartQuantity?: number;
    onClick: () => void;
    onLongPress?: () => void;
    className?: string;
}

export function LServiceCard({
    name,
    price,
    unit = "pc",
    imageUrl,
    icon,
    categoryName,
    cartQuantity,
    onClick,
    onLongPress,
    className,
}: LServiceCardProps) {
    const { formatAmount } = useCurrency();
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const isLongPress = useRef(false);
    const touchStartPos = useRef<{ x: number; y: number } | null>(null);
    const hasMoved = useRef(false);
    // Track when a touch interaction occurred so we can ignore the
    // synthesized mouse events that mobile browsers fire after touch.
    const recentTouchRef = useRef(false);
    const recentTouchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const handleTouchStart = (e: React.TouchEvent) => {
        // Mark that a touch interaction is active
        recentTouchRef.current = true;
        if (recentTouchTimer.current) clearTimeout(recentTouchTimer.current);

        // Record starting position
        const touch = e.touches[0];
        touchStartPos.current = { x: touch.clientX, y: touch.clientY };
        hasMoved.current = false;
        isLongPress.current = false;

        if (onLongPress) {
            longPressTimer.current = setTimeout(() => {
                // Only trigger long press if finger hasn't moved
                if (!hasMoved.current) {
                    isLongPress.current = true;
                    onLongPress();
                }
            }, 500);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartPos.current) return;

        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);

        // If moved more than threshold, it's a scroll
        if (deltaX > SCROLL_THRESHOLD || deltaY > SCROLL_THRESHOLD) {
            hasMoved.current = true;
            // Cancel long press timer
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
            }
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }

        // Only trigger click if:
        // 1. It wasn't a long press
        // 2. Finger didn't move (not a scroll)
        if (!isLongPress.current && !hasMoved.current) {
            onClick();
        }

        // Reset state
        touchStartPos.current = null;
        hasMoved.current = false;

        // Keep the "recent touch" flag for 400ms to block synthesized mouse events
        recentTouchTimer.current = setTimeout(() => {
            recentTouchRef.current = false;
        }, 400);
    };

    const handleTouchCancel = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
        touchStartPos.current = null;
        hasMoved.current = false;

        recentTouchTimer.current = setTimeout(() => {
            recentTouchRef.current = false;
        }, 400);
    };

    // Mouse handlers for desktop only — skipped when touch was used
    const handleMouseDown = () => {
        if (recentTouchRef.current) return; // ignore synthesized event
        isLongPress.current = false;
        if (onLongPress) {
            longPressTimer.current = setTimeout(() => {
                isLongPress.current = true;
                onLongPress();
            }, 500);
        }
    };

    const handleMouseUp = () => {
        if (recentTouchRef.current) return; // ignore synthesized event
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
        if (!isLongPress.current) {
            onClick();
        }
    };

    const handleMouseLeave = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        // Prevent default click — we handle interaction via touch/mouse handlers above
        e.preventDefault();
    };

    const hasItemsInCart = cartQuantity && cartQuantity > 0;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    onClick();
                }
            }}
            className={cn(
                "flex flex-col items-center justify-center relative",
                "p-2.5 rounded-xl cursor-pointer select-none",
                "min-h-[108px] w-full",
                "bg-card border border-border",
                "hover:border-primary hover:shadow-md",
                "active:scale-95 transition-all duration-150",
                "text-center touch-manipulation",
                // Highlight when items in cart
                hasItemsInCart && "border-primary bg-primary/5",
                className
            )}
        >
            {/* Cart Quantity Badge - Top Right */}
            {hasItemsInCart && (
                <div className="absolute -top-2 -right-2 z-10 flex items-center gap-0.5 bg-primary text-white text-xs font-bold rounded-full px-2 py-1 shadow-lg animate-in zoom-in-50">
                    <ShoppingCart className="h-3 w-3" />
                    <span>{cartQuantity}</span>
                </div>
            )}

            {/* Image or Icon - larger for better visibility (72px) */}
            <div
                className="flex-shrink-0 mb-2 relative overflow-hidden"
                style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '12px',
                    backgroundColor: hasItemsInCart ? 'hsl(168, 70%, 90%)' : 'hsl(168, 60%, 95%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                ) : (
                    <span style={{ color: 'hsl(168, 80%, 32%)' }}>{icon}</span>
                )}
            </div>

            {/* Category Name (small badge) */}
            {categoryName && (
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full mb-1 truncate max-w-full">
                    {categoryName}
                </span>
            )}

            {/* Name */}
            <p
                className="text-xs font-medium line-clamp-2 mb-0.5 flex-shrink-0"
                style={{ color: 'hsl(221, 39%, 11%)' }}
            >
                {name}
            </p>

            {/* Price */}
            <div className="flex items-baseline gap-0.5 flex-shrink-0">
                <span
                    className="text-xs font-semibold"
                    style={{ color: 'hsl(168, 80%, 32%)' }}
                >
                    {formatAmount(price)}
                </span>
                <span
                    className="text-[10px]"
                    style={{ color: 'hsl(220, 9%, 46%)' }}
                >
                    /{unit}
                </span>
            </div>
        </div>
    );
}
