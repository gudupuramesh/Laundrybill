/**
 * Sidebar — Enterprise Laundry CRM design system.
 *
 * Desktop navigation rail. Collapsible by hand (floating toggle) and
 * auto-collapses at tablet width via matchMedia — a manual toggle persists
 * until the next breakpoint crossing.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Below this viewport width the rail auto-minimizes (tablet & down). */
const TABLET_BP = 1024;

interface SidebarItem {
    id: string;
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    /** Optional badge count (e.g. online orders count) */
    badge?: number;
}

interface LSidebarProps {
    items: SidebarItem[];
    activeId: string;
    logo?: ReactNode;
    collapsedLogo?: ReactNode;
    footer?: ReactNode;
}

export function LSidebar({ items, activeId, logo, collapsedLogo, footer }: LSidebarProps) {
    const [collapsed, setCollapsed] = useState(
        () => typeof window !== "undefined" && window.innerWidth < TABLET_BP
    );

    // Auto-collapse on tablet; only fires on breakpoint crossing so a manual
    // toggle within the same breakpoint is preserved.
    useEffect(() => {
        const mq = window.matchMedia(`(max-width:${TABLET_BP - 1}px)`);
        const handler = (e: MediaQueryListEvent) => setCollapsed(e.matches);
        setCollapsed(mq.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    const asideStyle: CSSProperties = {
        position: "sticky",
        top: 0,
        height: "100vh",
        flex: "none",
        width: collapsed ? 64 : 218,
        background: "var(--c-surface)",
        borderRight: "1px solid var(--c-border)",
        display: "flex",
        flexDirection: "column",
        transition: "width .2s ease",
    };

    return (
        <aside style={asideStyle}>
            {/* Header / brand */}
            <div
                style={{
                    position: "relative",
                    height: 58,
                    flex: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: collapsed ? "center" : "flex-start",
                    padding: collapsed ? 0 : "0 16px",
                    borderBottom: "1px solid var(--c-border)",
                }}
            >
                {collapsed ? collapsedLogo : logo}

                {/* Floating collapse toggle straddling the border */}
                <button
                    onClick={() => setCollapsed((c) => !c)}
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    title={collapsed ? "Expand" : "Collapse"}
                    style={{
                        position: "absolute",
                        top: 17,
                        right: -12,
                        zIndex: 20,
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "var(--c-surface)",
                        border: "1px solid var(--c-border-strong)",
                        boxShadow: "var(--sh-sm)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "var(--c-text-2)",
                        padding: 0,
                    }}
                >
                    {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                </button>
            </div>

            {/* Navigation */}
            <nav
                className="lb-thin"
                style={{ flex: 1, overflow: "auto", padding: collapsed ? "10px 8px" : "10px", display: "flex", flexDirection: "column", gap: 2 }}
            >
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeId === item.id;
                    const hasBadge = item.badge != null && item.badge > 0;
                    return (
                        <button
                            key={item.id}
                            onClick={item.onClick}
                            title={collapsed ? item.label : undefined}
                            aria-current={isActive ? "page" : undefined}
                            style={{
                                position: "relative",
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: 11,
                                justifyContent: collapsed ? "center" : "flex-start",
                                padding: collapsed ? "9px 0" : "8px 11px",
                                borderRadius: 8,
                                border: 0,
                                cursor: "pointer",
                                font: "inherit",
                                fontSize: 13,
                                fontWeight: isActive ? 600 : 500,
                                color: isActive ? "var(--c-primary)" : "var(--c-text-2)",
                                background: isActive ? "var(--c-primary-soft)" : "transparent",
                                textAlign: "left",
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) e.currentTarget.style.background = "var(--c-surface-2)";
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) e.currentTarget.style.background = "transparent";
                            }}
                        >
                            <span style={{ position: "relative", flex: "none", display: "inline-flex" }}>
                                <Icon size={18} />
                                {collapsed && hasBadge && (
                                    <span
                                        style={{
                                            position: "absolute",
                                            top: -5,
                                            right: -6,
                                            minWidth: 15,
                                            height: 15,
                                            padding: "0 3px",
                                            borderRadius: 999,
                                            background: "var(--c-primary)",
                                            color: "#fff",
                                            fontSize: 9,
                                            fontWeight: 700,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        {item.badge! > 9 ? "9+" : item.badge}
                                    </span>
                                )}
                            </span>
                            {!collapsed && (
                                <>
                                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {item.label}
                                    </span>
                                    {hasBadge && (
                                        <span
                                            style={{
                                                flex: "none",
                                                minWidth: 20,
                                                height: 20,
                                                padding: "0 6px",
                                                borderRadius: 999,
                                                background: "var(--c-primary)",
                                                color: "#fff",
                                                fontSize: 11,
                                                fontWeight: 600,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            {item.badge! > 99 ? "99+" : item.badge}
                                        </span>
                                    )}
                                </>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Footer */}
            {footer && !collapsed && (
                <div style={{ flex: "none", padding: 14, borderTop: "1px solid var(--c-border)" }}>{footer}</div>
            )}
        </aside>
    );
}
