/**
 * App-style list rows for MOBILE views of screens whose desktop view is a
 * table. Matches the owner mobile app's list language: white card, hairline
 * separators, 38px avatar, bold title + muted meta, right-side value/chip and
 * a chevron. Desktop keeps its tables — render these only when isMobile.
 */

import type { CSSProperties, ReactNode } from "react";
import { ChevronRight, ChevronLeft, Search } from "lucide-react";

/* Clones of the owner app's screen chrome (StaffListScreen.tsx s.header /
 * s.statsCard / search field): 40px round icon buttons on a white header bar,
 * an 18px bold title, one stats card with hairline column dividers. */

/** App-style screen header: [round back btn] Title + sub [right icon buttons]. */
export function MHeader({ title, sub, onBack, right }: { title: ReactNode; sub?: ReactNode; onBack?: () => void; right?: ReactNode }) {
    return (
        <header style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, minHeight: 54, padding: "8px 12px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
            {onBack && <MIconBtn aria-label="Back" onClick={onBack}><ChevronLeft size={22} /></MIconBtn>}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                {sub != null && <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 1 }}>{sub}</div>}
            </div>
            {right}
        </header>
    );
}

/** App-style 40px round icon button (surfaceMuted circle). */
export function MIconBtn({ children, onClick, tint, "aria-label": ariaLabel }: { children: ReactNode; onClick?: () => void; tint?: string; "aria-label"?: string }) {
    return (
        <button onClick={onClick} aria-label={ariaLabel} style={{ cursor: "pointer", flex: "none", width: 40, height: 40, borderRadius: 20, border: 0, background: tint ? `var(--${tint}-soft)` : "var(--c-surface-2)", color: tint ? `var(--${tint})` : "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {children}
        </button>
    );
}

/** App-style stats card: one white card, columns separated by hairlines. */
export function MStatBar({ stats, style }: { stats: { label: string; value: ReactNode; color?: string }[]; style?: CSSProperties }) {
    return (
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 16, boxShadow: "var(--sh-sm)", padding: "10px 8px", display: "flex", alignItems: "stretch", ...style }}>
            {stats.map((st, i) => (
                <div key={st.label} style={{ flex: 1, display: "flex", minWidth: 0 }}>
                    {i > 0 && <span style={{ width: 1, background: "var(--c-border)", margin: "0 4px", flex: "none" }} />}
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textAlign: "center" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: "var(--c-text-3)", textTransform: "uppercase", letterSpacing: ".3px", whiteSpace: "nowrap" }}>{st.label}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: st.color ? `var(--${st.color})` : "var(--c-text)", fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{st.value}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

/** App-style search field: full-width, muted fill, 42px tall. */
export function MSearch({ value, onChange, placeholder, style }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties }) {
    return (
        <div style={{ position: "relative", ...style }}>
            <Search size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
            <input value={value} onChange={(e) => onChange(e.target.value)} type="search" placeholder={placeholder}
                style={{ width: "100%", height: 42, font: "inherit", fontSize: 14, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "0 12px 0 38px", outline: "none" }} />
        </div>
    );
}

/** Card container for rows (RN-style inset list). */
export function MRows({ children, style }: { children: ReactNode; style?: CSSProperties }) {
    return (
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, boxShadow: "var(--sh-sm)", overflow: "hidden", ...style }}>
            {children}
        </div>
    );
}

export function MRow({
    left, title, titleRight, sub, right, chevron = true, selected, last, onClick,
}: {
    /** 38px leading visual — avatar circle, icon chip… */
    left?: ReactNode;
    title: ReactNode;
    /** Small chip next to the title (role, status…) */
    titleRight?: ReactNode;
    sub?: ReactNode;
    /** Trailing value — amount, status chip, count… */
    right?: ReactNode;
    chevron?: boolean;
    selected?: boolean;
    last?: boolean;
    onClick?: () => void;
}) {
    return (
        <div
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
            style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderBottom: last ? "none" : "1px solid var(--c-border)",
                background: selected ? "var(--c-primary-soft)" : "transparent",
                cursor: onClick ? "pointer" : "default", minHeight: 60,
            }}
        >
            {left && <span style={{ flex: "none", display: "flex" }}>{left}</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                    {titleRight}
                </div>
                {sub != null && <div style={{ fontSize: 12, color: "var(--c-text-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
            </div>
            {right != null && <span style={{ flex: "none", display: "flex", alignItems: "center" }}>{right}</span>}
            {chevron && <ChevronRight size={16} style={{ flex: "none", color: "var(--c-text-3)" }} />}
        </div>
    );
}

/** 38px round avatar with initials, tinted from the design-system palette. */
export function MAvatar({ name, tint }: { name: string; tint: string }) {
    const initials = (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    return (
        <span style={{ width: 38, height: 38, borderRadius: "50%", background: `var(--${tint}-soft)`, color: `var(--${tint})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>
            {initials}
        </span>
    );
}

/**
 * App-style page shell for mobile screens whose body is existing web content:
 * the owner app's back-header (round back button + title/subtitle) over a
 * padded, bottom-nav-safe scroll area.
 */
export function MPageShell({ title, sub, onBack, right, children }: {
    title: ReactNode; sub?: ReactNode; onBack: () => void; right?: ReactNode; children: ReactNode;
}) {
    return (
        <div style={{ minHeight: "100%", background: "var(--c-bg)", display: "flex", flexDirection: "column" }}>
            <div style={{ position: "sticky", top: 0, zIndex: 5, flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)" }}>
                <button onClick={onBack} aria-label="Back"
                    style={{ cursor: "pointer", flex: "none", width: 40, height: 40, borderRadius: 20, border: 0, background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ChevronLeft size={24} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                    {sub != null && <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{sub}</div>}
                </div>
                {right}
            </div>
            <div style={{ flex: 1, padding: 16, paddingBottom: "calc(110px + env(safe-area-inset-bottom, 0px))" }}>
                {children}
            </div>
        </div>
    );
}

/** App-style section card: icon chip + title/subtitle header over its content. */
export function MSectionCard({ icon, tint, title, sub, children }: {
    icon: ReactNode; tint: string; title: string; sub?: string; children: ReactNode;
}) {
    return (
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 18, boxShadow: "var(--sh-sm)", padding: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
                <span style={{ width: 38, height: 38, flex: "none", borderRadius: 11, background: `var(--${tint}-soft)`, color: `var(--${tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
                    {sub && <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 1 }}>{sub}</div>}
                </div>
            </div>
            {children}
        </div>
    );
}
