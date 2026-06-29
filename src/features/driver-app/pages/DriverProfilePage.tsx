/**
 * Driver Profile — built to the Enterprise Laundry CRM design system (--c-* tokens).
 * Single-column: identity header · online toggle · lifetime stats · account details ·
 * preferences (language) · help + sign out. Logic/handlers preserved exactly.
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDriverAuth } from "../DriverAuthContext";
import { useDriverTasks } from "../hooks/use-driver-tasks";
import { LLanguageSelector, useLToast } from "@/components/laundry";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    Phone,
    Mail,
    Truck,
    MapPin,
    Package,
    LogOut,
    Globe,
    HelpCircle,
    ChevronRight,
    User,
    Building2,
    Loader2,
} from "lucide-react";

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const card: CSSProperties = {
    background: "var(--c-surface)", border: "1px solid var(--c-border)",
    borderRadius: 12, boxShadow: "var(--sh-sm)",
};
const secHead: CSSProperties = { padding: "14px 18px", borderBottom: "1px solid var(--c-border)", fontSize: 13, fontWeight: 700, letterSpacing: ".03em", color: "var(--c-text-2)", textTransform: "uppercase" };
const rowBtn: CSSProperties = { width: "100%", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "15px 18px", font: "inherit", background: "transparent", border: 0 };

export function DriverProfilePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { agent, signOut, isOnline, goOnline, goOffline, loading: authLoading, firebaseUser, shopName } = useDriverAuth();
    const { lifetimeStats } = useDriverTasks();
    const { addToast } = useLToast();
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            signOut();
            navigate("/team/login");
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            setLoggingOut(false);
        }
    };

    const handleOnlineToggle = async (checked: boolean) => {
        try {
            if (checked) {
                await goOnline();
            } else {
                await goOffline();
            }
        } catch (error) {
            console.error("Failed to update online status:", error);
        }
    };

    const handleLanguageChange = async (lang: string) => {
        if (firebaseUser) {
            try {
                await updateDoc(doc(db, "users", firebaseUser.uid), { language: lang });
                addToast({ type: "success", title: "Language updated" });
            } catch (err) {
                console.error("Failed to sync language", err);
            }
        }
    };

    return (
        <div style={{ color: "var(--c-text)", fontSize: 14, lineHeight: 1.45, padding: "20px 22px 40px", maxWidth: 720, margin: "0 auto" }}>

            {/* ===== Identity ===== */}
            <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", marginBottom: 16 }}>
                <span style={{ width: 52, height: 52, flex: "none", borderRadius: "50%", background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <User size={26} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {agent?.name || t("agent.unknownAgent", "Agent")}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--c-text-3)" }}>
                        <Phone size={12} />
                        {agent?.phone || agent?.email || "---"}
                    </div>
                    <span style={{ display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 600, textTransform: "capitalize", color: "var(--c-primary)", background: "var(--c-primary-soft)", padding: "2px 9px", borderRadius: 20 }}>
                        {agent?.role || t("agent.role", "Agent")}
                    </span>
                </div>
            </div>

            {/* ===== Vehicle + Service areas ===== */}
            {(agent?.vehicle || (agent?.serviceAreas && agent.serviceAreas.length > 0)) && (
                <div style={{ ...card, overflow: "hidden", marginBottom: 16 }}>
                    {agent?.vehicle && (
                        <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 18px", borderBottom: agent?.serviceAreas && agent.serviceAreas.length > 0 ? "1px solid var(--c-border)" : "none" }}>
                            <ChipIcon soft="c-info-soft" refColor="c-info"><Truck size={16} /></ChipIcon>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)" }}>{t("agent.vehicle", "Vehicle")}</div>
                                <div style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ textTransform: "capitalize" }}>{agent.vehicle.type}</span>
                                    {agent.vehicle.number && (
                                        <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--c-text-2)" }}>{agent.vehicle.number}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {agent?.serviceAreas && agent.serviceAreas.length > 0 && (
                        <div style={{ padding: "14px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)", marginBottom: 9 }}>
                                <MapPin size={13} />
                                {t("agent.serviceAreas", "Service Areas")}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {agent.serviceAreas.map((area, idx) => (
                                    <span key={idx} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", padding: "3px 10px", borderRadius: 20 }}>
                                        {area}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ===== Online status ===== */}
            <div style={{ ...card, display: "flex", alignItems: "center", gap: 13, padding: "15px 18px", marginBottom: 16 }}>
                <span style={{ width: 40, height: 40, flex: "none", borderRadius: 10, background: isOnline ? "var(--c-success-soft)" : "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className={isOnline ? "animate-pulse" : undefined} style={{ width: 11, height: 11, borderRadius: "50%", background: isOnline ? "var(--c-success)" : "var(--c-text-3)" }} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                        {isOnline ? t("agent.online", "Online") : t("agent.offline", "Offline")}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>
                        {isOnline
                            ? t("agent.readyForTasks", "Ready to receive tasks")
                            : t("agent.notReceivingTasks", "Not receiving new tasks")}
                    </div>
                </div>
                <button
                    role="switch"
                    aria-checked={isOnline}
                    disabled={authLoading}
                    onClick={() => handleOnlineToggle(!isOnline)}
                    style={{
                        position: "relative", width: 46, height: 26, flex: "none", borderRadius: 20, border: 0,
                        cursor: authLoading ? "default" : "pointer", padding: 0,
                        background: isOnline ? "var(--c-success)" : "var(--c-border-strong)",
                        opacity: authLoading ? 0.6 : 1, transition: "background .15s",
                    }}
                >
                    <span style={{
                        position: "absolute", top: 3, left: isOnline ? 23 : 3, width: 20, height: 20,
                        borderRadius: "50%", background: "#fff", boxShadow: "var(--sh-sm)", transition: "left .15s",
                    }} />
                </button>
            </div>

            {/* ===== Lifetime stats ===== */}
            <div style={{ ...card, overflow: "hidden", marginBottom: 16 }}>
                <div style={secHead}>{t("agent.lifetimeStats", "Total Stats")}</div>
                <div className="lb-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 0 }}>
                    <StatTile
                        icon={<Package size={16} />}
                        soft="c-primary-soft"
                        refColor="c-primary"
                        label={t("agent.pickups", "Pickups")}
                        value={lifetimeStats.pickupsCompleted}
                    />
                    <StatTile
                        icon={<Truck size={16} />}
                        soft="c-cyan-soft"
                        refColor="c-cyan"
                        label={t("agent.deliveries", "Deliveries")}
                        value={lifetimeStats.deliveriesCompleted}
                        divider
                    />
                </div>
            </div>

            {/* ===== Account details ===== */}
            <div style={{ ...card, overflow: "hidden", marginBottom: 16 }}>
                <div style={secHead}>{t("staff.profile.accountDetails", "Account details")}</div>
                <Row icon={<Phone size={16} />} label={t("common.phone", "Phone")} value={agent?.phone} />
                <Row icon={<Mail size={16} />} label={t("common.email", "Email")} value={firebaseUser?.email || agent?.email || undefined} />
                <Row icon={<Building2 size={16} />} label={t("common.shop", "Shop")} value={shopName || undefined} last />
            </div>

            {/* ===== Preferences ===== */}
            <div style={{ ...card, overflow: "hidden", marginBottom: 16 }}>
                <div style={secHead}>{t("settings.preferences", "Preferences")}</div>
                <div style={{ padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", marginBottom: 12 }}>
                        <Globe size={16} style={{ color: "var(--c-text-3)" }} />
                        {t("settings.language", "Language")}
                    </div>
                    <LLanguageSelector variant="list" onLanguageChange={handleLanguageChange} />
                </div>
            </div>

            {/* ===== Help + Sign out ===== */}
            <div style={{ ...card, overflow: "hidden" }}>
                <button onClick={() => {/* TODO: Open help */ }} style={rowBtn}>
                    <HelpCircle size={18} style={{ color: "var(--c-text-3)" }} />
                    <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 600 }}>{t("agent.help", "Help & Support")}</span>
                    <ChevronRight size={17} style={{ color: "var(--c-text-3)" }} />
                </button>
                <button onClick={handleLogout} disabled={loggingOut} style={{ ...rowBtn, borderTop: "1px solid var(--c-border)", opacity: loggingOut ? 0.6 : 1 }}>
                    {loggingOut
                        ? <Loader2 size={18} className="animate-spin" style={{ color: "var(--c-error)" }} />
                        : <LogOut size={18} style={{ color: "var(--c-error)" }} />}
                    <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 600, color: "var(--c-error)" }}>{t("agent.logout", "Logout")}</span>
                </button>
            </div>

            <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--c-text-3)", marginTop: 24 }}>LaundryBill</p>
        </div>
    );
}

function ChipIcon({ children, soft, refColor }: { children: ReactNode; soft: string; refColor: string }) {
    return <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${soft})`, color: `var(--${refColor})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>;
}

function StatTile({ icon, soft, refColor, label, value, divider }: { icon: ReactNode; soft: string; refColor: string; label: string; value: number; divider?: boolean }) {
    return (
        <div style={{ padding: "15px 16px", borderLeft: divider ? "1px solid var(--c-border)" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <ChipIcon soft={soft} refColor={refColor}>{icon}</ChipIcon>
                <span style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{label}</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 25, fontWeight: 600 }}>{value}</div>
        </div>
    );
}

function Row({ icon, label, value, last }: { icon: ReactNode; label: string; value?: string; last?: boolean }) {
    if (!value) return null;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 18px", borderBottom: last ? "none" : "1px solid var(--c-border)" }}>
            <span style={{ width: 32, height: 32, flex: "none", borderRadius: 8, background: "var(--c-surface-2)", color: "var(--c-text-3)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)" }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{value}</div>
            </div>
        </div>
    );
}
