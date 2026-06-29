import { useNavigate } from "react-router-dom";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { Order, OrderStatus } from "@/types/order";
import { format } from "date-fns";
import {
    Clock,
    Package,
    ArrowRight,
    Search,
    Loader2
} from "lucide-react";

interface PlantOrderListProps {
    title: string;
    status: OrderStatus;
    orders?: Order[]; // Optional for now until we have real data
    loading?: boolean;
    emptyMessage?: string;
    actionLabel?: string;
    onAction?: (orderId: string) => void;
    actionVariant?: "primary" | "secondary" | "outline" | "destructive" | "ghost" | "link" | "success";
    secondaryActionLabel?: string;
    onSecondaryAction?: (order: Order) => void;
}

export function PlantOrderList({
    title,
    status,
    orders = [],
    loading = false,
    emptyMessage = "No orders found",
    actionLabel,
    onAction,
    actionVariant = "outline",
    secondaryActionLabel,
    onSecondaryAction
}: PlantOrderListProps) {
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState("");
    const [visibleCount, setVisibleCount] = useState(20);

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
                <Loader2 className="animate-spin" size={28} style={{ color: "var(--c-primary)" }} />
            </div>
        );
    }

    const filteredOrders = orders.filter(order => {
        if (!searchTerm) return true;
        const lowerTerm = searchTerm.toLowerCase();
        return (
            order.orderNumber.toLowerCase().includes(lowerTerm) ||
            order.customerName.toLowerCase().includes(lowerTerm)
        );
    });

    const displayOrders = filteredOrders.slice(0, visibleCount);
    const hasMore = visibleCount < filteredOrders.length;

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 20);
    };

    const actionStyle = actionVariant === "primary" ? btnPrimary : btnOutline;

    return (
        <div style={{ color: "var(--c-text)", fontSize: 14, lineHeight: 1.45, padding: "20px 22px 40px" }}>
            {/* header + search */}
            <div className="lb-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.01em" }}>{title}</h1>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--c-text-3)" }}>
                        {filteredOrders.length} orders {status === "pickup_completed" ? "waiting" : "active"}
                    </p>
                </div>
                {/* Search Bar - Visible on Mobile now */}
                <div style={{ position: "relative", width: "100%", maxWidth: 260 }}>
                    <Search size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                    <input
                        placeholder="Search Order ID or Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: "100%", font: "inherit", fontSize: 14, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 9, padding: "11px 13px 11px 38px", outline: "none" }}
                    />
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {displayOrders.map((order: any) => {
                    // Due Date Alert logic
                    let dueBadge: { label: string; ref: string } | null = null;
                    if (order.targetDate) {
                        const targetDate = order.targetDate.toDate ? order.targetDate.toDate() : new Date(order.targetDate);
                        const now = new Date();
                        const isOverdue = now > targetDate;
                        const isDueSoon = !isOverdue && (targetDate.getTime() - now.getTime() < 4 * 60 * 60 * 1000);
                        if (isOverdue) dueBadge = { label: "OVERDUE", ref: "c-error" };
                        else if (isDueSoon) dueBadge = { label: "DUE SOON", ref: "c-warning" };
                    }

                    return (
                        <div key={order.id} style={{ ...card, padding: "14px 16px" }}>
                            <div className="lb-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
                                    <ChipIcon soft="c-primary-soft" refColor="c-primary"><Package size={16} /></ChipIcon>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700 }}>{order.orderNumber}</span>
                                            <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", padding: "2px 8px", borderRadius: 20 }}>{order.items.length} Items</span>
                                            {dueBadge && (
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: `var(--${dueBadge.ref}-soft)`, color: `var(--${dueBadge.ref})` }}>
                                                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: `var(--${dueBadge.ref})` }} />{dueBadge.label}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--c-text-3)", marginTop: 4 }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                                <Clock size={13} />
                                                {format(new Date(order.createdAt?.seconds * 1000 || Date.now()), "dd MMM, hh:mm a")}
                                            </span>
                                            <span>•</span>
                                            <span style={{ color: "var(--c-text-2)", fontWeight: 600 }}>{order.customerName}</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                                    <button
                                        style={btnGhost}
                                        onClick={() => navigate(`/plant/orders/${order.id}`)}
                                    >
                                        View Details
                                    </button>
                                    {secondaryActionLabel && onSecondaryAction && (
                                        <button
                                            style={btnOutline}
                                            onClick={() => onSecondaryAction(order)}
                                        >
                                            {secondaryActionLabel}
                                        </button>
                                    )}
                                    {actionLabel && onAction && (
                                        <button
                                            style={actionStyle}
                                            onClick={() => onAction(order.id)}
                                        >
                                            {actionLabel} <ArrowRight size={15} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {hasMore && (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 18 }}>
                    <button style={btnOutline} onClick={handleLoadMore}>
                        Load More Orders
                    </button>
                </div>
            )}

            {filteredOrders.length === 0 && (
                <div style={{ textAlign: "center", padding: "48px 0", color: "var(--c-text-3)" }}>
                    <p style={{ margin: 0 }}>{searchTerm ? "No orders match your search" : emptyMessage}</p>
                </div>
            )}
        </div>
    );
}

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)" };
const btnPrimary: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 9, padding: "10px 16px", boxShadow: "var(--sh-sm)" };
const btnOutline: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-surface)", border: "1px solid var(--c-primary)", borderRadius: 9, padding: "10px 16px" };
const btnGhost: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "transparent", border: 0, padding: "8px 10px" };
function ChipIcon({ children, soft, refColor }: { children: ReactNode; soft: string; refColor: string }) { return <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${soft})`, color: `var(--${refColor})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>; }
