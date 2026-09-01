/**
 * LDrawer — panel that slides in from the screen edge (desktop pattern for big
 * filter/settings panels; on phones prefer LBottomSheet / LResponsiveDialog).
 * Defaults to the RIGHT edge — the left belongs to the navigation sidebar.
 * Overlay click and Escape both close it; body scroll is locked while open.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const ANIM_MS = 220;

export function LDrawer({ open, onClose, title, children, width = 420, side = "right" }: {
    open: boolean;
    onClose: () => void;
    title?: ReactNode;
    children: ReactNode;
    width?: number;
    side?: "left" | "right";
}) {
    const [render, setRender] = useState(open);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        if (open) {
            setRender(true);
            setClosing(false);
            return;
        }
        if (!render) return;
        setClosing(true);
        const id = window.setTimeout(() => { setRender(false); setClosing(false); }, ANIM_MS);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!render) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [render, onClose]);

    if (!render) return null;

    const panel: CSSProperties = {
        position: "absolute", top: 0, bottom: 0, [side]: 0,
        width, maxWidth: "92vw",
        background: "var(--c-surface)",
        boxShadow: side === "right" ? "-8px 0 32px rgba(15, 23, 42, .18)" : "8px 0 32px rgba(15, 23, 42, .18)",
        display: "flex", flexDirection: "column",
        animation: `${closing ? "lb-drawer-out" : "lb-drawer-in"} ${ANIM_MS}ms cubic-bezier(.32,.72,.35,1) both`,
    };
    const off = side === "right" ? "100%" : "-100%";

    return createPortal(
        <div role="dialog" aria-modal="true" onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,.45)", animation: `${closing ? "lb-drawer-fade-out" : "lb-drawer-fade-in"} ${ANIM_MS}ms ease both` }}>
            <style>{`
                @keyframes lb-drawer-in { from { transform: translateX(${off}); } to { transform: none; } }
                @keyframes lb-drawer-out { from { transform: none; } to { transform: translateX(${off}); } }
                @keyframes lb-drawer-fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes lb-drawer-fade-out { from { opacity: 1; } to { opacity: 0; } }
            `}</style>
            <div onClick={(e) => e.stopPropagation()} style={panel}>
                <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--c-border)" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.01em" }}>{title}</div>
                    <button onClick={onClose} aria-label="Close" style={{ cursor: "pointer", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-3)", background: "var(--c-surface-2)", border: 0, borderRadius: 8 }}>
                        <X size={17} />
                    </button>
                </div>
                <div className="lb-thin" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    );
}
