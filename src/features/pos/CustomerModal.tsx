/**
 * Customer modal — 1000% to the design system (POS Order.dc.html):
 * Existing (search + list) / New (name·phone·email·address·area) tabs.
 * Wired to useCustomers + service areas + shop country dial code.
 */

import { useMemo, useState, type CSSProperties } from "react";
import { useCustomers } from "@/hooks/use-customers";
import { useDeliverySettings } from "@/hooks/use-delivery-settings";
import { useShop } from "@/hooks/use-shop";
import { getCountry } from "@/config/countries";
import { useLToast } from "@/components/laundry";
import { Search, X, ChevronRight } from "lucide-react";
import type { Customer } from "@/types/customer";

const MONO = "'IBM Plex Mono'";
const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
const tintFor = (s: string) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; };

const fld: CSSProperties = { width: "100%", font: "inherit", fontSize: 13, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "9px 11px", outline: "none" };
const lbl: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 };

export function CustomerModal({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (c: Customer) => void }) {
    const { customers, createCustomer } = useCustomers();
    const { settings } = useDeliverySettings();
    const { shop } = useShop();
    const { addToast } = useLToast();
    const country = getCountry(shop?.settings?.countryCode || "IN");
    const areas = (settings.serviceAreas || []).filter((a) => a.isActive).map((a) => a.value);

    const [tab, setTab] = useState<"existing" | "new">("existing");
    const [q, setQ] = useState("");
    const [nc, setNc] = useState({ name: "", phone: "", email: "", address: "", area: areas[0] || "" });
    const [saving, setSaving] = useState(false);

    const results = useMemo(() => {
        const s = q.trim().toLowerCase();
        const list = s ? customers.filter((c) => c.name.toLowerCase().includes(s) || c.phone.includes(s)) : customers;
        return list.slice(0, 20);
    }, [q, customers]);

    if (!open) return null;

    const handleAdd = async () => {
        if (!nc.name.trim() || nc.phone.replace(/\D/g, "").length < 6) return;
        setSaving(true);
        try {
            const created = await createCustomer({ name: nc.name, phone: nc.phone, email: nc.email || undefined, address: nc.address || undefined, area: nc.area || undefined });
            if (created) { onSelect(created); onClose(); setNc({ name: "", phone: "", email: "", address: "", area: areas[0] || "" }); }
        } catch (e) {
            addToast({ type: "error", title: e instanceof Error && e.message === "DUPLICATE_PHONE" ? "Phone already used" : "Could not save" });
        } finally { setSaving(false); }
    };

    return (
        <div role="dialog" aria-modal="true" aria-label="Select customer" onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(13,17,23,.5)" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, boxShadow: "var(--sh-md)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid var(--c-border)" }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>Customer</div>
                    <button onClick={onClose} aria-label="Close" style={{ marginLeft: "auto", cursor: "pointer", width: 30, height: 30, color: "var(--c-text-2)", background: "transparent", border: "1px solid var(--c-border)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
                </div>

                <div style={{ padding: "14px 20px 0" }}>
                    <div style={{ display: "flex", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 9, padding: 3 }}>
                        {(["existing", "new"] as const).map((tb) => (
                            <button key={tb} onClick={() => setTab(tb)} style={{ flex: 1, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, padding: 8, border: 0, borderRadius: 7, background: tab === tb ? "var(--c-surface)" : "transparent", color: tab === tb ? "var(--c-text)" : "var(--c-text-3)", boxShadow: tab === tb ? "var(--sh-sm)" : undefined }}>
                                {tb === "existing" ? "Existing customer" : "New customer"}
                            </button>
                        ))}
                    </div>
                </div>

                {tab === "existing" ? (
                    <>
                        <div style={{ padding: "14px 20px 4px" }}>
                            <div style={{ position: "relative" }}>
                                <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                                <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search name or phone…" style={{ width: "100%", font: "inherit", fontSize: 13, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "9px 11px 9px 33px", outline: "none" }} />
                            </div>
                        </div>
                        <div style={{ flex: 1, overflow: "auto", padding: "8px 12px 14px", minHeight: 160, maxHeight: 340 }}>
                            {results.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--c-text-3)" }}>No customers found</div>}
                            {results.map((cu) => {
                                const ref = tintFor(cu.id);
                                return (
                                    <button key={cu.id} onClick={() => { onSelect(cu); onClose(); }} style={{ width: "100%", cursor: "pointer", font: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 11, padding: 10, border: 0, borderRadius: 10, background: "transparent" }}>
                                        <span style={{ width: 38, height: 38, flex: "none", borderRadius: "50%", background: `var(--${ref}-soft)`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{cu.name.slice(0, 2).toUpperCase()}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{cu.name}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)", fontFamily: MONO }}>{cu.phone}{cu.area ? ` · ${cu.area}` : ""}</div></div>
                                        <ChevronRight size={16} style={{ color: "var(--c-text-3)" }} />
                                    </button>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
                            <div style={{ display: "flex", gap: 12 }}>
                                <div style={{ flex: 1 }}><label style={lbl}>Full name</label><input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value.replace(/[0-9]/g, "") })} placeholder="e.g. Priya Sharma" style={fld} /></div>
                                <div style={{ flex: 1 }}><label style={lbl}>Phone</label>
                                    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--c-border-strong)", borderRadius: 8, background: "var(--c-surface)" }}>
                                        <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--c-text-3)", paddingLeft: 10 }}>{country.phoneCode}</span>
                                        <input value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value.replace(/\D/g, "").slice(0, country.phoneDigits) })} inputMode="numeric" placeholder={"0".repeat(country.phoneDigits)} style={{ ...fld, border: 0, fontFamily: MONO, paddingLeft: 6 }} />
                                    </div>
                                </div>
                            </div>
                            <div><label style={lbl}>Email</label><input type="email" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} placeholder="name@email.com" style={fld} /></div>
                            <div><label style={lbl}>Address</label><textarea rows={2} value={nc.address} onChange={(e) => setNc({ ...nc, address: e.target.value })} placeholder="Flat / building, street, city, ZIP" style={{ ...fld, resize: "vertical" }} /></div>
                            {areas.length > 0 && (
                                <div><label style={lbl}>Service area</label><select value={nc.area} onChange={(e) => setNc({ ...nc, area: e.target.value })} style={fld}>{areas.map((a) => <option key={a}>{a}</option>)}</select></div>
                            )}
                        </div>
                        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--c-border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                            <button onClick={onClose} style={{ cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "9px 16px" }}>Cancel</button>
                            <button onClick={handleAdd} disabled={saving || !nc.name.trim() || nc.phone.replace(/\D/g, "").length < 6} style={{ cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 8, padding: "9px 16px", opacity: saving || !nc.name.trim() ? 0.6 : 1 }}>{saving ? "Saving…" : "Add & select"}</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
