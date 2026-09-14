/**
 * Apps — 1000% to the design system (Apps.dc.html):
 * two-pane (app list + detail). Header · platforms · features · access & roles ·
 * release/share. Real actions: Share via WhatsApp / Copy link / Open; live login
 * counts from useTeamMembers. (Feature/platform "toggles" are informational —
 * the app suite has no per-app flag backend, so they show what each app includes.)
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import { TEAM_GOOGLE_PLAY_URL } from "@/config/app-links";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/features/auth/AuthContext";
import { useTeamMembers } from "@/hooks/use-team-members";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { MPageShell } from "@/components/laundry/LMobileRows";
import { GOOGLE_PLAY_URL, APP_STORE_URL, detectMobileOS } from "@/config/app-links";
import { Smartphone, Truck, Factory, Share2, ExternalLink, Check, Copy, Apple, ClipboardList, Users, Clock, Tag, Scan, Camera, MapPin, Boxes, BarChart3, Bell, Info } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";


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


export function AppsPage({ embedded }: { embedded?: boolean } = {}) {
    const { t } = useTranslation();
    const { staffCount, agentCount, plantCount } = useTeamMembers();
    const isMobile = useIsMobile();
    const navigate = useNavigate();

    const counts: Record<string, number> = { staff: staffCount, agent: agentCount, plant: plantCount };



    // MOBILE: app-style page, led by the owner-app store links — a phone user
    // should be pushed to the real app before the team-app invite links.
    if (isMobile) return (
        <MPageShell title={t("apps.title", "Apps")} sub={`${t("apps.suite", "LaundryBill app suite")} · ${APPS.length} ${t("apps.apps", "apps")}`} onBack={() => navigate("/settings")}>
            <div style={{ background: "linear-gradient(135deg, #1B61E5, #124BB8)", color: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: "var(--sh-md, var(--sh-sm))" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "rgba(255,255,255,.75)" }}>{t("apps.ownerApp", "Owner app")}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{t("appPromo.title", "Get the Laundrybill app")}</div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.85)", marginTop: 4, lineHeight: 1.45 }}>{t("appPromo.body", "Run your shop from your phone — orders, billing and instant notifications.")}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    {(detectMobileOS() === "ios"
                        ? [{ id: "appstore", label: "App Store", url: APP_STORE_URL }, { id: "play", label: "Google Play", url: GOOGLE_PLAY_URL }]
                        : [{ id: "play", label: "Google Play", url: GOOGLE_PLAY_URL }, { id: "appstore", label: "App Store", url: APP_STORE_URL }]
                    ).map((st, i) => (
                        <a key={st.id} href={st.url} target="_blank" rel="noopener noreferrer"
                            style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 8px", borderRadius: 11, textDecoration: "none", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                                color: i === 0 ? "var(--c-primary)" : "#fff", background: i === 0 ? "#fff" : "rgba(255,255,255,.18)", border: i === 0 ? "0" : "1px solid rgba(255,255,255,.35)" }}>
                            {st.label}
                        </a>
                    ))}
                </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: ".5px", margin: "4px 4px 8px" }}>{t("apps.teamApps", "Team apps")}</div>
            <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 18, boxShadow: "var(--sh-sm)", overflow: "hidden" }}>
                {APPS.map((a, i) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < APPS.length - 1 ? "1px solid var(--c-border)" : "none" }}>
                        <span style={{ width: 38, height: 38, flex: "none", borderRadius: 11, background: `var(--${a.tint}-soft)`, color: `var(--${a.tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{a.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
                            <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{counts[a.id] ?? 0} {t("apps.logins", "logins")}</div>
                        </div>
                        <button onClick={() => { window.open(`${window.location.origin}${a.path}`, "_blank"); }}
                            style={{ cursor: "pointer", flex: "none", font: "inherit", fontSize: 12.5, fontWeight: 700, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 9, padding: "8px 12px" }}>
                            {t("apps.open", "Open")}
                        </button>
                    </div>
                ))}
            </div>
        </MPageShell>
    );

    if (!isMobile) return <AppsSuiteView embedded={embedded} />;
    return <AppsSuiteView embedded={embedded} />;
}


/* ------------------------------------------------------------------ */
/* Desktop: owner app + Team app cards (reference layout)              */
/* ------------------------------------------------------------------ */

export function StoreBadge({ store, href }: { store: "apple" | "google"; href: string }) {
    return (
        <a href={href} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "#000", color: "#fff", borderRadius: 8, padding: "7px 14px 7px 11px", textDecoration: "none", minWidth: 150 }}>
            {store === "apple" ? <Apple size={26} fill="#fff" /> : (
                <svg width="24" height="26" viewBox="0 0 24 26" aria-hidden="true"><path d="M1.2.6 13.4 13 1.2 25.4c-.4-.3-.7-.8-.7-1.4V2c0-.6.3-1.1.7-1.4Z" fill="#2196F3" /><path d="M17.5 8.8 13.4 13 1.2.6c.2-.1.5-.2.8-.2.3 0 .6.1.9.2l14.6 8.2Z" fill="#4CAF50" /><path d="M17.5 17.2 2.9 25.4c-.3.2-.6.2-.9.2-.3 0-.6-.1-.8-.2L13.4 13l4.1 4.2Z" fill="#F44336" /><path d="M22.4 13c0 .7-.4 1.3-1 1.6l-3.9 2.6-4.1-4.2 4.1-4.2 3.9 2.6c.6.3 1 .9 1 1.6Z" fill="#FFC107" /></svg>
            )}
            <span style={{ lineHeight: 1.05, textAlign: "left" }}>
                <span style={{ display: "block", fontSize: store === "apple" ? 9.5 : 8.5, letterSpacing: store === "apple" ? 0 : ".05em" }}>{store === "apple" ? "Download on the" : "GET IT ON"}</span>
                <span style={{ display: "block", fontSize: 19, fontWeight: 500, letterSpacing: "-.01em" }}>{store === "apple" ? "App Store" : "Google Play"}</span>
            </span>
        </a>
    );
}

function AppsSuiteView({ embedded }: { embedded?: boolean }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { shopName } = useAuth();
    const { staffCount, agentCount, plantCount } = useTeamMembers();
    const [ownerStore, setOwnerStore] = useState<"android" | "ios">(detectMobileOS() === "ios" ? "ios" : "android");
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const inviteMsg = [
        t("apps.inviteLine1", "Hi! Join our laundry team at {{shop}} on Laundrybill.", { shop: shopName || t("apps.ourShop", "our shop") }),
        "",
        `1. ${t("apps.inviteStep1", "Install the Laundrybill Team app")}: ${TEAM_GOOGLE_PLAY_URL}`,
        `2. ${t("apps.inviteStep2", "Tap “Sign up” and use the email and invite code we send you")}`,
    ].join("\n");
    const copy = async (text: string, key: string) => {
        try { await navigator.clipboard.writeText(text); } catch { /* blocked */ }
        setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000);
    };

    const card: CSSProperties = { border: "1px solid var(--ds-border)", borderRadius: 14, background: "var(--ds-card)", padding: "22px 22px" };
    const divider = (label: string) => (
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0 14px", fontSize: 11.5, fontWeight: 500, letterSpacing: ".05em", color: "var(--ds-text-2)" }}>
            <span style={{ flex: 1, height: 1, background: "var(--ds-divider)" }} />{label}<span style={{ flex: 1, height: 1, background: "var(--ds-divider)" }} />
        </div>
    );
    const qrTile = (value: string) => (
        <div style={{ width: 136, height: 136, margin: "0 auto", border: "1px solid var(--ds-border)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
            <QRCodeSVG value={value} size={108} />
        </div>
    );
    const feature = (icon: ReactNode, title: string, desc: string) => (
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <span style={{ width: 48, height: 48, flex: "none", borderRadius: 12, border: "1px solid var(--ds-border)", color: "var(--ds-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
            <div><div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div><div style={{ fontSize: 13, color: "var(--ds-text-2)", marginTop: 3 }}>{desc}</div></div>
        </div>
    );

    const webApps = [
        { key: "staff", name: t("apps.staffWeb", "Staff"), desc: t("apps.staffWebDesc", "Counter orders, status, customers, attendance"), path: "/staff", count: staffCount, icon: <Smartphone size={18} /> },
        { key: "agent", name: t("apps.agentWeb", "Delivery agent"), desc: t("apps.agentWebDesc", "Pickups, deliveries, proof photos, cash"), path: "/agent", count: agentCount, icon: <Truck size={18} /> },
        { key: "plant", name: t("apps.plantWeb", "Plant"), desc: t("apps.plantWebDesc", "Production queue, tag scans, stage updates"), path: "/plant", count: plantCount, icon: <Factory size={18} /> },
    ];

    return (
        <div className="lb-ds" style={{ padding: embedded ? "24px 26px 28px" : "24px 26px 32px", background: embedded ? "transparent" : "var(--ds-bg)", minHeight: "100%" }}>
            <div style={{ fontSize: embedded ? 21 : 27, fontWeight: 600 }}>{t("apps.title", "Apps")}</div>
            <div style={{ fontSize: 14, color: "var(--ds-text-2)", marginTop: 6, marginBottom: 20 }}>{t("apps.subtitle", "Get our apps for you and your team.")}</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 18 }}>
                {/* owner app */}
                <div style={card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                        <span style={{ width: 74, height: 74, flex: "none", borderRadius: 16, background: "var(--ds-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/icons/icon-192x192.png" alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: 74, height: 74, borderRadius: 16 }} /></span>
                        <div>
                            <div style={{ fontSize: 19, fontWeight: 600 }}>{t("apps.ownerTitle", "Laundry Bill owner app")}</div>
                            <div style={{ fontSize: 14.5, color: "var(--ds-text-2)", marginTop: 5, lineHeight: 1.5 }}>{t("apps.ownerDesc", "Manage your shop, orders and business on the go.")}</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 20, justifyContent: "center" }}>
                        <StoreBadge store="apple" href={APP_STORE_URL} />
                        <StoreBadge store="google" href={GOOGLE_PLAY_URL} />
                    </div>
                    {divider(t("apps.orScan", "OR SCAN TO DOWNLOAD"))}
                    <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 10 }}>
                        {(["android", "ios"] as const).map((k) => (
                            <button key={k} onClick={() => setOwnerStore(k)} style={{ cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "4px 12px", borderRadius: 20, border: `1px solid ${ownerStore === k ? "var(--ds-blue)" : "var(--ds-border)"}`, background: ownerStore === k ? "var(--ds-blue-soft)" : "var(--ds-card)", color: ownerStore === k ? "var(--ds-blue)" : "var(--ds-text-2)" }}>{k === "android" ? "Android" : "iPhone"}</button>
                        ))}
                    </div>
                    {qrTile(ownerStore === "ios" ? APP_STORE_URL : GOOGLE_PLAY_URL)}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
                        {feature(<BarChart3 size={22} />, t("apps.fDash", "Dashboard & reports"), t("apps.fDashDesc", "Track revenue, orders and payments."))}
                        {feature(<ClipboardList size={22} />, t("apps.fOrders", "Create & manage orders"), t("apps.fOrdersDesc", "Add orders, update status and more."))}
                        {feature(<Bell size={22} />, t("apps.fNotify", "Get notified"), t("apps.fNotifyDesc", "Never miss an update from your shop."))}
                    </div>
                </div>

                {/* team app */}
                <div style={card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                        <span style={{ width: 74, height: 74, flex: "none", borderRadius: 16, background: "var(--ds-blue)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Users size={38} /></span>
                        <div>
                            <div style={{ fontSize: 19, fontWeight: 600 }}>{t("apps.teamTitle", "Laundrybill Team app")}</div>
                            <div style={{ fontSize: 14.5, color: "var(--ds-text-2)", marginTop: 5, lineHeight: 1.5 }}>{t("apps.teamDesc", "For your staff to manage orders and updates.")}</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 20 }}>
                        <StoreBadge store="google" href={TEAM_GOOGLE_PLAY_URL} />
                    </div>
                    {divider(t("apps.orScan", "OR SCAN TO DOWNLOAD"))}
                    {qrTile(TEAM_GOOGLE_PLAY_URL)}
                    <div style={{ fontSize: 14, fontWeight: 500, marginTop: 24, marginBottom: 10 }}>{t("apps.inviteTitle", "Invite your team with this message")}</div>
                    <div style={{ border: "1px solid var(--ds-border)", background: "var(--ds-table-head)", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{inviteMsg}</div>
                    <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                        <button onClick={() => void copy(inviteMsg, "invite")} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 9, fontSize: 14.5, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", borderRadius: 9, padding: "9px 18px" }}>{copiedKey === "invite" ? <Check size={17} /> : <Copy size={17} />}{copiedKey === "invite" ? t("common.copied", "Copied") : t("apps.copyMessage", "Copy message")}</button>
                        <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(inviteMsg)}`, "_blank")} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 9, fontSize: 14.5, fontWeight: 600, color: "var(--ds-whatsapp)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9, padding: "9px 18px" }}><Share2 size={17} />WhatsApp</button>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ds-text-2)", marginTop: 10 }}>{t("apps.inviteCodeNote", "Each person's email and invite code are on the Staff page, under their login.")}</div>
                </div>
            </div>

            {/* browser links */}
            <div style={{ ...card, marginTop: 18, padding: "18px 22px" }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{t("apps.browserTitle", "Use the team apps in a browser")}</div>
                <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginTop: 3, marginBottom: 12 }}>{t("apps.browserDesc", "Same sign-in as the Team app — handy on a counter PC or a tablet.")}</div>
                {webApps.map((w, i) => {
                    const url = `${window.location.origin}${w.path}`;
                    return (
                        <div key={w.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderTop: i ? "1px solid var(--ds-divider)" : "1px solid var(--ds-divider)", flexWrap: "wrap" }}>
                            <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--ds-blue-soft)", color: "var(--ds-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>{w.icon}</span>
                            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 500 }}>{w.name} <span style={{ fontSize: 12, color: "var(--ds-text-2)", fontWeight: 400 }}>· {t("apps.loginsCount", "{{n}} logins", { n: w.count })}</span></div>
                                <div style={{ fontSize: 12.5, color: "var(--ds-text-2)", marginTop: 2 }}>{w.desc}</div>
                            </div>
                            <span style={{ fontSize: 13, color: "var(--ds-text-2)", fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{window.location.host}{w.path}</span>
                            <button onClick={() => void copy(url, w.key)} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 8, padding: "7px 12px" }}>{copiedKey === w.key ? <Check size={15} /> : <Copy size={15} />}{copiedKey === w.key ? t("common.copied", "Copied") : t("common.copy", "Copy")}</button>
                            <button onClick={() => window.open(url, "_blank")} style={{ cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 8, padding: "7px 12px" }}><ExternalLink size={15} />{t("apps.open", "Open")}</button>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, padding: "14px 18px", background: "var(--ds-blue-soft)", border: "1px solid #DBEAFE", borderRadius: 12, fontSize: 14 }}>
                <Info size={19} style={{ color: "var(--ds-blue)", flex: "none" }} />
                <span>{t("apps.signInNote", "Team members sign in with the invite code you share from the")} <button onClick={() => navigate("/manage-staff")} style={{ cursor: "pointer", font: "inherit", color: "var(--ds-blue)", background: "transparent", border: 0, padding: 0 }}>{t("apps.staffPage", "Staff page")}</button>.</span>
            </div>
        </div>
    );
}
