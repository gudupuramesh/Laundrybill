/**
 * Apps — 1000% to the design system (Apps.dc.html):
 * two-pane (app list + detail). Header · platforms · features · access & roles ·
 * release/share. Real actions: Share via WhatsApp / Copy link / Open; live login
 * counts from useTeamMembers. (Feature/platform "toggles" are informational —
 * the app suite has no per-app flag backend, so they show what each app includes.)
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLToast } from "@/components/laundry";
import { useAuth } from "@/features/auth/AuthContext";
import { useTeamMembers } from "@/hooks/use-team-members";
import { Smartphone, Truck, Factory, Share2, ExternalLink, Check, Copy, Apple, Globe, MonitorSmartphone, ClipboardList, Users, Clock, Tag, Scan, Camera, MapPin, Boxes } from "lucide-react";

const MONO = "'IBM Plex Mono'";
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, boxShadow: "var(--sh-sm)" };
const secLbl: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".05em", color: "var(--c-text-3)", marginBottom: 14 };

type Plat = { key: "ios" | "android" | "web"; name: string; detail: string | null };
type Feature = { name: string; desc: string; icon: ReactNode; tint: string };
interface AppDef {
    id: string; name: string; role: string; tint: string; tagline: string; path: string; version: string; updated: string;
    icon: ReactNode; platforms: Plat[]; features: Feature[]; access: string[];
    countKey?: "staff" | "agent" | "plant";
}

const APPS: AppDef[] = [
    {
        id: "staff", name: "Staff App", role: "Front desk", tint: "c-info", path: "/staff", version: "v3.8.0", updated: "Jun 11, 2026",
        tagline: "Counter operations — take orders, update status, look up customers and clock in.",
        icon: <Smartphone size={26} />, countKey: "staff",
        platforms: [{ key: "ios", name: "iOS", detail: "iOS 14+ · 58 MB" }, { key: "android", name: "Android", detail: "Android 8+ · 44 MB" }, { key: "web", name: "Web", detail: "Browser · responsive" }],
        features: [
            { name: "POS order intake", desc: "Create & price new orders", icon: <ClipboardList size={17} />, tint: "c-primary" },
            { name: "Status updates", desc: "Move orders through stages", icon: <Clock size={17} />, tint: "c-info" },
            { name: "Customer lookup", desc: "Search profiles & history", icon: <Users size={17} />, tint: "c-violet" },
            { name: "Attendance clock", desc: "Clock in / out on shift", icon: <Clock size={17} />, tint: "c-success" },
            { name: "Tag printing", desc: "Print garment tags & receipts", icon: <Tag size={17} />, tint: "c-warning" },
        ],
        access: ["Staff", "Manager"],
    },
    {
        id: "agent", name: "Delivery Agent", role: "Pickup & delivery", tint: "c-success", path: "/agent", version: "v3.1.2", updated: "Jun 13, 2026",
        tagline: "On the road — assigned pickups & deliveries, navigation, proof photos and cash collection.",
        icon: <Truck size={26} />, countKey: "agent",
        platforms: [{ key: "ios", name: "iOS", detail: "iOS 14+ · 49 MB" }, { key: "android", name: "Android", detail: "Android 8+ · 38 MB" }, { key: "web", name: "Web", detail: null }],
        features: [
            { name: "My route", desc: "Assigned pickups & deliveries", icon: <MapPin size={17} />, tint: "c-primary" },
            { name: "Navigation", desc: "Open address in maps", icon: <MapPin size={17} />, tint: "c-info" },
            { name: "Proof photos", desc: "Capture pickup / delivery proof", icon: <Camera size={17} />, tint: "c-violet" },
            { name: "Collect payment", desc: "Mark cash collected on delivery", icon: <Check size={17} />, tint: "c-success" },
        ],
        access: ["Delivery Agent"],
    },
    {
        id: "plant", name: "Plant App", role: "Washers / Pressers", tint: "c-cyan", path: "/plant", version: "v2.5.3", updated: "Jun 09, 2026",
        tagline: "Production floor — batch queue, barcode scanning, stage updates and processing photos.",
        icon: <Factory size={26} />, countKey: "plant",
        platforms: [{ key: "ios", name: "iOS", detail: null }, { key: "android", name: "Android", detail: "Android 9+ tablet · 51 MB" }, { key: "web", name: "Web", detail: "Browser · responsive" }],
        features: [
            { name: "Production queue", desc: "Items by stage & priority", icon: <Boxes size={17} />, tint: "c-primary" },
            { name: "Barcode / QR scan", desc: "Scan tags to update stage", icon: <Scan size={17} />, tint: "c-info" },
            { name: "Processing photos", desc: "Log damage & processing proof", icon: <Camera size={17} />, tint: "c-violet" },
            { name: "Tag generation", desc: "Generate basket & item tags", icon: <Tag size={17} />, tint: "c-warning" },
        ],
        access: ["Plant Operator"],
    },
];

const platIcon = (k: Plat["key"]): ReactNode => (k === "ios" ? <Apple size={18} /> : k === "android" ? <MonitorSmartphone size={18} /> : <Globe size={18} />);

export function AppsPage() {
    const { t } = useTranslation();
    const { shopName } = useAuth();
    const { addToast } = useLToast();
    const { staffCount, agentCount, plantCount } = useTeamMembers();
    const [selectedId, setSelectedId] = useState("staff");
    const [copied, setCopied] = useState(false);

    const counts: Record<string, number> = { staff: staffCount, agent: agentCount, plant: plantCount };
    const d = APPS.find((a) => a.id === selectedId) || APPS[0];
    const url = `${window.location.origin}${d.path}`;

    const copyLink = () => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
    const openApp = () => window.open(url, "_blank");
    const share = () => {
        const msg = `${shopName || "Our shop"} is using LaundryBill!\n\n${d.name}: ${url}\n\n1. Open the link\n2. Sign in with your invite code\n3. Start working`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
        addToast({ type: "success", title: t("apps.opening", "Opening WhatsApp…") });
    };

    const ghostBtn: CSSProperties = { flex: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 12.5, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 9, padding: 9 };

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            <header style={{ flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 14, padding: "0 22px" }}>
                <div><div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1.1 }}>{t("apps.title", "Apps")}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{t("apps.suite", "LaundryBill app suite")} · {APPS.length} {t("apps.apps", "apps")}</div></div>
            </header>

            <div className="lb-cols" style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
                {/* app list */}
                <section className="lb-svclist lb-scroll" style={{ width: 300, flex: "none", overflow: "auto", borderRight: "1px solid var(--c-border)", background: "var(--c-surface)", padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)", padding: "4px 6px 10px" }}>{t("apps.applications", "Applications")}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {APPS.map((a) => {
                            const on = a.id === selectedId;
                            return (
                                <button key={a.id} onClick={() => setSelectedId(a.id)} style={{ cursor: "pointer", font: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: 11, borderRadius: 11, border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)" }}>
                                    <span style={{ width: 42, height: 42, flex: "none", borderRadius: 11, background: `var(--${a.tint}-soft)`, color: `var(--${a.tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{a.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.name}</div>
                                        <div style={{ fontSize: 11, color: "var(--c-text-3)", marginTop: 1 }}>{a.role}</div>
                                        <div style={{ display: "flex", gap: 5, marginTop: 6 }}>{a.platforms.filter((p) => p.detail).map((p) => <span key={p.key} style={{ fontSize: 9, fontWeight: 600, color: "var(--c-text-3)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", padding: "1px 6px", borderRadius: 5 }}>{p.name}</span>)}</div>
                                    </div>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-success)", flex: "none" }} />
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* detail */}
                <section className="lb-scroll" style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "20px 22px 40px" }}>
                    {/* header */}
                    <div style={{ ...card, padding: "20px 22px", display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                        <span style={{ width: 58, height: 58, flex: "none", borderRadius: 15, background: `var(--${d.tint}-soft)`, color: `var(--${d.tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{d.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.01em" }}>{d.name}</span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "var(--c-success)", background: "var(--c-success-soft)", padding: "3px 10px", borderRadius: 20 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--c-success)" }} />{t("apps.live", "Live")}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: `var(--${d.tint})`, background: `var(--${d.tint}-soft)`, padding: "3px 10px", borderRadius: 20 }}>{d.role}</span>
                            </div>
                            <div style={{ fontSize: 13, color: "var(--c-text-2)", marginTop: 6 }}>{d.tagline}</div>
                        </div>
                        <div style={{ display: "flex", gap: 24, flex: "none" }}>
                            <div style={{ textAlign: "right" }}><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 18 }}>{d.countKey ? counts[d.countKey] ?? 0 : 0}</div><div style={{ fontSize: 11, color: "var(--c-text-3)" }}>{t("apps.activeLogins", "active logins")}</div></div>
                            <div style={{ textAlign: "right" }}><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 18 }}>{d.version}</div><div style={{ fontSize: 11, color: "var(--c-text-3)" }}>{t("apps.version", "version")}</div></div>
                        </div>
                    </div>

                    {/* platforms */}
                    <div style={{ ...card, padding: "18px 20px", marginBottom: 16 }}>
                        <div style={secLbl}>{t("apps.platforms", "PLATFORMS & DISTRIBUTION")}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                            {d.platforms.map((p) => (
                                <div key={p.key} style={{ border: "1px solid var(--c-border)", borderRadius: 11, padding: 14, display: "flex", alignItems: "center", gap: 12, opacity: p.detail ? 1 : 0.45 }}>
                                    <span style={{ width: 38, height: 38, flex: "none", borderRadius: 10, background: "var(--c-surface-2)", color: "var(--c-text)", display: "flex", alignItems: "center", justifyContent: "center" }}>{platIcon(p.key)}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: "var(--c-text-3)", fontFamily: MONO }}>{p.detail || t("apps.notAvailable", "Not available")}</div></div>
                                    {p.detail && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 600, color: "var(--c-success)" }}><Check size={13} />{t("apps.on", "On")}</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="lb-cols" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                        {/* features */}
                        <div style={{ ...card, flex: 1.6, minWidth: 0, overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "15px 20px", borderBottom: "1px solid var(--c-border)" }}><div style={{ fontSize: 14, fontWeight: 600 }}>{t("apps.features", "Features")}</div><span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", padding: "2px 8px", borderRadius: 20 }}>{d.features.length} {t("apps.included", "included")}</span></div>
                            {d.features.map((f, i) => (
                                <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 20px", borderBottom: i < d.features.length - 1 ? "1px solid var(--c-border)" : undefined }}>
                                    <span style={{ width: 36, height: 36, flex: "none", borderRadius: 9, background: `var(--${f.tint}-soft)`, color: `var(--${f.tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{f.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{f.name}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{f.desc}</div></div>
                                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: "var(--c-success-soft)", color: "var(--c-success)" }}><Check size={14} /></span>
                                </div>
                            ))}
                        </div>

                        {/* access + share */}
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                            <div style={{ ...card, padding: "18px 20px" }}>
                                <div style={secLbl}>{t("apps.accessRoles", "ACCESS & ROLES")}</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {d.access.map((r) => <span key={r} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: `var(--${d.tint})`, background: `var(--${d.tint}-soft)`, padding: "6px 12px", borderRadius: 20 }}><Users size={13} />{r}</span>)}
                                </div>
                            </div>
                            <div style={{ ...card, padding: "18px 20px" }}>
                                <div style={secLbl}>{t("apps.release", "RELEASE & SHARE")}</div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 10 }}><span style={{ color: "var(--c-text-2)" }}>{t("apps.currentVersion", "Current version")}</span><span style={{ fontFamily: MONO, fontWeight: 600 }}>{d.version}</span></div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 14 }}><span style={{ color: "var(--c-text-2)" }}>{t("apps.lastUpdated", "Last updated")}</span><span style={{ fontWeight: 600 }}>{d.updated}</span></div>
                                <button onClick={share} style={{ width: "100%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 14, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 10, padding: 12, boxShadow: "var(--sh-sm)", marginBottom: 10 }}><Share2 size={16} />{t("apps.shareWhatsApp", "Share via WhatsApp")}</button>
                                <div style={{ display: "flex", gap: 9 }}>
                                    <button onClick={copyLink} style={ghostBtn}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? t("apps.copied", "Copied") : t("apps.copyLink", "Copy link")}</button>
                                    <button onClick={openApp} style={ghostBtn}><ExternalLink size={15} />{t("apps.open", "Open")}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
