/**
 * Bulk import wizard for services + items (web owner app only).
 * select → preview → running → done. Reuses the existing inventory mutations so
 * order/timestamps/title-casing are handled for free. xlsx is lazy-loaded via
 * the bulk-inventory module (only fetched when a file is parsed).
 */

import { useRef, useState } from "react";
import { LResponsiveDialog, LSpinner } from "@/components/laundry";
import { useLToast } from "@/components/laundry";
import { useInventoryMutations } from "@/hooks/use-inventory";
import type { InventoryCategory, InventoryItem } from "@/types/inventory";
import type { ImportPlan } from "./lib/bulk-inventory";
import { Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, X } from "lucide-react";

type Phase = "select" | "parsing" | "preview" | "running" | "done";

const btnBase: React.CSSProperties = {
    cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600,
    borderRadius: 8, padding: "9px 15px", display: "inline-flex", alignItems: "center", gap: 7,
};

export function BulkImportModal({
    open, onClose, categories, items,
}: {
    open: boolean;
    onClose: () => void;
    categories: InventoryCategory[];
    items: InventoryItem[];
}) {
    const { createCategory, updateCategory, createItem, updateItem } = useInventoryMutations();
    const { addToast } = useLToast();
    const fileRef = useRef<HTMLInputElement>(null);

    const [phase, setPhase] = useState<Phase>("select");
    const [plan, setPlan] = useState<ImportPlan | null>(null);
    const [fileName, setFileName] = useState("");
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [failedCount, setFailedCount] = useState(0);
    const [replace, setReplace] = useState(false); // opt-in: hide rows not present in the file

    const reset = () => { setPhase("select"); setPlan(null); setFileName(""); setProgress({ done: 0, total: 0 }); setFailedCount(0); setReplace(false); };
    const close = () => { if (phase === "running") return; reset(); onClose(); };

    const onPickFile = async (file: File) => {
        setFileName(file.name);
        setPhase("parsing");
        try {
            const { parseWorkbook, buildImportPlan } = await import("./lib/bulk-inventory");
            const raw = await parseWorkbook(file);
            const p = buildImportPlan(raw, categories, items);
            setPlan(p);
            setPhase("preview");
        } catch (e) {
            addToast({ type: "error", title: "Couldn't read that file", description: "Please use the downloaded template (.xlsx or .csv)." });
            console.error("Bulk import parse error:", e);
            reset();
        }
    };

    const downloadTemplate = async () => {
        try {
            const { generateTemplateBlob } = await import("./lib/bulk-inventory");
            const blob = await generateTemplateBlob(categories, items);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `services-template-${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (e) {
            addToast({ type: "error", title: "Couldn't generate template" });
            console.error(e);
        }
    };

    const runImport = async () => {
        if (!plan) return;
        setPhase("running");
        const total = plan.plannedCats.length + plan.svcUpdate.length + plan.itemUpdate.length + plan.itemCreate.length
            + (replace ? plan.itemDeactivate.length + plan.svcDeactivate.length : 0);
        let done = 0;
        const bump = () => { done++; setProgress({ done, total }); };
        const tempToReal = new Map<string, string>();
        const resolveRef = (ref: string) => (ref.startsWith("new:") ? tempToReal.get(ref) ?? "" : ref);
        let failed = 0;

        // 1) category updates
        for (const u of plan.svcUpdate) {
            try { await updateCategory(u.id, { name: u.name, icon: u.icon, turnaroundDays: u.turnaroundDays, isActive: u.isActive }); }
            catch (e) { failed++; console.error("updateCategory failed", u, e); }
            bump();
        }
        // 2) new categories (capture generated ids for item refs)
        for (const c of plan.plannedCats) {
            try {
                const created = await createCategory({ name: c.name, icon: c.icon, turnaroundDays: c.turnaroundDays, isActive: c.isActive });
                if (created) tempToReal.set(c.tempKey, created.id);
            } catch (e) { failed++; console.error("createCategory failed", c, e); }
            bump();
        }
        // 3) item updates
        for (const u of plan.itemUpdate) {
            try {
                await updateItem(u.id!, {
                    categoryId: resolveRef(u.categoryRef), categoryName: u.categoryName, name: u.name,
                    subCategory: u.subCategory, description: u.description ?? "", basePrice: u.basePrice,
                    pricingType: u.pricingType, expressMultiplier: u.expressMultiplier,
                    turnaroundDays: u.turnaroundDays, isActive: u.isActive,
                });
            } catch (e) { failed++; console.error("updateItem failed", u, e); }
            bump();
        }
        // 4) item creates
        for (const c of plan.itemCreate) {
            try {
                await createItem({
                    categoryId: resolveRef(c.categoryRef), categoryName: c.categoryName, name: c.name,
                    subCategory: c.subCategory, description: c.description, basePrice: c.basePrice,
                    pricingType: c.pricingType, expressMultiplier: c.expressMultiplier,
                    turnaroundDays: c.turnaroundDays, isActive: c.isActive,
                });
            } catch (e) { failed++; console.error("createItem failed", c, e); }
            bump();
        }
        // 5) replace mode — hide items + services not present in the file (soft delete)
        if (replace) {
            for (const id of plan.itemDeactivate) {
                try { await updateItem(id, { isActive: false }); } catch (e) { failed++; console.error("deactivate item failed", id, e); }
                bump();
            }
            for (const id of plan.svcDeactivate) {
                try { await updateCategory(id, { isActive: false }); } catch (e) { failed++; console.error("deactivate category failed", id, e); }
                bump();
            }
        }

        setFailedCount(failed);
        setPhase("done");
        if (failed === 0) {
            addToast({ type: "success", title: "Import complete", description: `${plan.counts.newCategories + plan.counts.servicesUpdate} service(s) · ${plan.counts.itemsCreate + plan.counts.itemsUpdate} item(s)` });
        } else {
            addToast({ type: "warning", title: "Imported with some errors", description: `${failed} row(s) couldn't be saved.` });
        }
    };

    const c = plan?.counts;
    const deactivatable = c ? c.itemsDeactivate + c.servicesDeactivate : 0;
    const netWrites = c ? c.newCategories + c.servicesUpdate + c.itemsCreate + c.itemsUpdate + (replace ? deactivatable : 0) : 0;

    return (
        <LResponsiveDialog open={open} onClose={close} title="Import services & items" size="lg">
            <div style={{ padding: "4px 2px 2px", display: "flex", flexDirection: "column", gap: 16, color: "var(--c-text)" }}>

                {/* ---------- SELECT ---------- */}
                {(phase === "select" || phase === "parsing") && (
                    <>
                        <p style={{ fontSize: 13, color: "var(--c-text-2)", margin: 0, lineHeight: 1.55 }}>
                            Download the Excel of your current services &amp; items, edit it, then upload it back.
                            Keep a <b>name</b> the same to update that row, add a row with a new name to add it,
                            set <b>isActive</b> to FALSE to hide. Nothing is ever deleted.
                        </p>

                        <button onClick={downloadTemplate} style={{ ...btnBase, alignSelf: "flex-start", color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0 }}>
                            <Download size={15} /> Download Excel template
                        </button>

                        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = ""; }} />

                        <button
                            onClick={() => phase !== "parsing" && fileRef.current?.click()}
                            disabled={phase === "parsing"}
                            style={{
                                cursor: phase === "parsing" ? "default" : "pointer", font: "inherit", width: "100%",
                                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
                                padding: "30px 16px", borderRadius: 12, border: "1.5px dashed var(--c-border-strong)",
                                background: "var(--c-surface-2)", color: "var(--c-text-2)",
                            }}>
                            {phase === "parsing" ? (
                                <><LSpinner size="md" /><span style={{ fontSize: 13 }}>Reading {fileName}…</span></>
                            ) : (
                                <>
                                    <span style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--c-surface)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-primary)" }}><Upload size={22} /></span>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-text)" }}>Choose a file to upload</span>
                                    <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>Accepts .xlsx or .csv</span>
                                </>
                            )}
                        </button>
                    </>
                )}

                {/* ---------- PREVIEW ---------- */}
                {phase === "preview" && c && (
                    <>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--c-text-2)" }}>
                            <FileSpreadsheet size={16} style={{ color: "var(--c-primary)" }} />
                            <span style={{ fontWeight: 600, color: "var(--c-text)" }}>{fileName}</span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
                            <StatBox label="New items" value={c.itemsCreate} tone="success" />
                            <StatBox label="Items updated" value={c.itemsUpdate} tone="primary" />
                            <StatBox label="New services" value={c.newCategories} tone="success" />
                            <StatBox label="Services updated" value={c.servicesUpdate} tone="primary" />
                            <StatBox label="Errors (skipped)" value={c.errors} tone={c.errors ? "error" : "muted"} />
                        </div>

                        {plan!.plannedCats.length > 0 && (
                            <div style={{ fontSize: 12.5, color: "var(--c-text-2)", background: "var(--c-surface-2)", borderRadius: 8, padding: "9px 12px" }}>
                                New service categories will be created: <b>{plan!.plannedCats.map((p) => p.name).join(", ")}</b>
                            </div>
                        )}

                        {deactivatable > 0 && (
                            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12.5, color: "var(--c-text-2)", cursor: "pointer", background: replace ? "var(--c-warning-soft)" : "var(--c-surface-2)", border: `1px solid ${replace ? "var(--c-warning)" : "var(--c-border)"}`, borderRadius: 10, padding: "10px 12px" }}>
                                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} style={{ accentColor: "var(--c-warning)", width: 15, height: 15, marginTop: 1, flex: "none" }} />
                                <span><b>Replace mode</b> — also hide the {c.itemsDeactivate} item(s){c.servicesDeactivate ? ` and ${c.servicesDeactivate} service(s)` : ""} that aren't in this file (e.g. the default items you left out). They're hidden, not deleted — you can restore them later.</span>
                            </label>
                        )}

                        {c.errors > 0 && (
                            <div style={{ border: "1px solid var(--c-error-soft)", borderRadius: 10, overflow: "hidden" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--c-error)", background: "var(--c-error-soft)", padding: "8px 12px" }}>
                                    <AlertTriangle size={14} /> {c.errors} row(s) will be skipped
                                </div>
                                <div style={{ maxHeight: 180, overflow: "auto", padding: "6px 0" }}>
                                    {plan!.errors.map((er, i) => (
                                        <div key={i} style={{ fontSize: 12, color: "var(--c-text-2)", padding: "4px 12px", display: "flex", gap: 8 }}>
                                            <span style={{ fontFamily: "'IBM Plex Mono'", color: "var(--c-text-3)", flex: "none" }}>{er.sheet}·row {er.rowNo}</span>
                                            <span><b>{er.field}</b> — {er.message}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                            <button onClick={reset} style={{ ...btnBase, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)" }}><X size={15} /> Choose another file</button>
                            <button onClick={runImport} disabled={netWrites === 0}
                                style={{ ...btnBase, color: "#fff", background: netWrites === 0 ? "var(--c-text-3)" : "var(--c-primary)", border: 0, opacity: netWrites === 0 ? 0.7 : 1, cursor: netWrites === 0 ? "not-allowed" : "pointer" }}>
                                <Upload size={15} /> {netWrites === 0 ? "Nothing to import" : `Import ${netWrites} change(s)`}
                            </button>
                        </div>
                    </>
                )}

                {/* ---------- RUNNING ---------- */}
                {phase === "running" && (
                    <div style={{ padding: "20px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                        <LSpinner size="lg" />
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Importing… {progress.done}/{progress.total}</div>
                        <div style={{ width: "100%", maxWidth: 360, height: 8, borderRadius: 999, background: "var(--c-surface-2)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: "var(--c-primary)", transition: "width .2s" }} />
                        </div>
                        <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>Please keep this window open until it finishes.</div>
                    </div>
                )}

                {/* ---------- DONE ---------- */}
                {phase === "done" && c && (
                    <div style={{ padding: "16px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
                        <span style={{ width: 54, height: 54, borderRadius: "50%", background: failedCount ? "var(--c-warning-soft)" : "var(--c-success-soft)", color: failedCount ? "var(--c-warning)" : "var(--c-success)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {failedCount ? <AlertTriangle size={26} /> : <CheckCircle2 size={26} />}
                        </span>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{failedCount ? "Imported with some errors" : "Import complete"}</div>
                        <div style={{ fontSize: 13, color: "var(--c-text-2)" }}>
                            {c.itemsCreate} new item(s), {c.itemsUpdate} updated · {c.newCategories} new service(s), {c.servicesUpdate} updated
                            {replace && deactivatable > 0 && <> · {c.itemsDeactivate} item(s){c.servicesDeactivate ? `/${c.servicesDeactivate} service(s)` : ""} hidden</>}
                            {c.errors > 0 && <> · {c.errors} skipped</>}
                            {failedCount > 0 && <> · {failedCount} failed to save</>}
                        </div>
                        <button onClick={close} style={{ ...btnBase, color: "#fff", background: "var(--c-primary)", border: 0, marginTop: 4 }}>Done</button>
                    </div>
                )}
            </div>
        </LResponsiveDialog>
    );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: "success" | "primary" | "error" | "muted" }) {
    const color = tone === "success" ? "var(--c-success)" : tone === "primary" ? "var(--c-primary)" : tone === "error" ? "var(--c-error)" : "var(--c-text-3)";
    const bg = tone === "success" ? "var(--c-success-soft)" : tone === "primary" ? "var(--c-primary-soft)" : tone === "error" ? "var(--c-error-soft)" : "var(--c-surface-2)";
    return (
        <div style={{ borderRadius: 10, background: bg, padding: "10px 12px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontWeight: 700, fontSize: 22, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11.5, color: "var(--c-text-2)", marginTop: 4 }}>{label}</div>
        </div>
    );
}
