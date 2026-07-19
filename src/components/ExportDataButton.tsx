/**
 * ExportDataButton — header button that downloads a full dataset (orders or
 * customers) as Excel or CSV. Opens a small popover with the two format choices,
 * shows a spinner while fetching/writing, and toasts the row count on success.
 * Visible only to the owner/manager (bulk data extraction is a management action).
 */

import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/features/auth/AuthContext";
import { useLToast } from "@/components/laundry";
import type { ExportFormat } from "@/lib/data-export";

interface ExportDataButtonProps {
    /** Runs the export for the chosen format; resolves to the number of rows written. */
    onExport: (shopId: string, format: ExportFormat) => Promise<number>;
    /** Short label shown in the success toast, e.g. "orders" / "customers". */
    kind: string;
    label?: string;
}

export function ExportDataButton({ onExport, kind, label }: ExportDataButtonProps) {
    const { t } = useTranslation();
    const { shopId, role } = useAuth();
    const { addToast } = useLToast();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState<ExportFormat | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    // Owner only — managers, staff, agents and plant operators can't bulk-export.
    const canExport = role === "admin";

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);

    if (!canExport) return null;

    const run = async (format: ExportFormat) => {
        if (!shopId || busy) return;
        setBusy(format);
        try {
            const count = await onExport(shopId, format);
            setOpen(false);
            addToast({
                type: "success",
                title: t("export.done", "Download ready"),
                description: t("export.doneDesc", "Exported {{count}} {{kind}}.", { count, kind }),
            });
        } catch (err) {
            addToast({
                type: "error",
                title: t("export.failed", "Export failed"),
                description: err instanceof Error ? err.message : t("export.failedDesc", "Please try again."),
            });
        } finally {
            setBusy(null);
        }
    };

    const itemStyle: React.CSSProperties = {
        display: "flex", alignItems: "center", gap: 9, width: "100%", cursor: "pointer",
        font: "inherit", fontSize: 13, fontWeight: 500, color: "var(--c-text)", background: "transparent",
        border: 0, borderRadius: 7, padding: "9px 11px", textAlign: "left",
    };

    return (
        <div ref={wrapRef} style={{ position: "relative" }}>
            <button
                onClick={() => setOpen((v) => !v)}
                disabled={!!busy}
                title={t("export.title", "Export data")}
                style={{
                    cursor: busy ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 7,
                    font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)",
                    background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8,
                    padding: "8px 13px", opacity: busy ? 0.7 : 1,
                }}
            >
                {busy ? <Loader2 size={15} className="lb-spin" /> : <Download size={15} />}
                {label || t("export.button", "Export")}
            </button>

            {open && (
                <div
                    role="menu"
                    style={{
                        position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 40, minWidth: 216,
                        background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 10,
                        boxShadow: "var(--sh-lg, 0 10px 30px rgba(0,0,0,.18))", padding: 6,
                    }}
                >
                    <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-text-3)", padding: "6px 11px 4px" }}>
                        {t("export.downloadAll", "Download all")}
                    </div>
                    <button role="menuitem" style={itemStyle} disabled={!!busy} onClick={() => run("xlsx")}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-surface-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <FileSpreadsheet size={16} style={{ color: "var(--c-success)" }} />
                        <span>{t("export.excel", "Excel (.xlsx)")}</span>
                    </button>
                    <button role="menuitem" style={itemStyle} disabled={!!busy} onClick={() => run("csv")}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-surface-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <FileText size={16} style={{ color: "var(--c-info)" }} />
                        <span>{t("export.csv", "CSV (.csv)")}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
