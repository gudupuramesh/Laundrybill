/**
 * Staff Profile — built to the Enterprise Laundry CRM design system (--c-* tokens).
 * Single-column: identity header · account details · preferences (language) · help + sign out.
 */

import { type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useStaffAuth } from "../StaffAuthContext";
import { LLanguageSelector, useLToast } from "@/components/laundry";
import { Phone, Mail, Building2, LogOut, User, Globe, HelpCircle, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const card: CSSProperties = {
    background: "var(--c-surface)", border: "1px solid var(--c-border)",
    borderRadius: 12, boxShadow: "var(--sh-sm)",
};
const secHead: CSSProperties = { padding: "14px 18px", borderBottom: "1px solid var(--c-border)", fontSize: 13, fontWeight: 700, letterSpacing: ".03em", color: "var(--c-text-2)", textTransform: "uppercase" };

export function StaffProfilePage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { staff, shopName, signOut, firebaseUser } = useStaffAuth();
    const { addToast } = useLToast();

    const handleSignOut = () => {
        signOut();
        navigate("/team/login");
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
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{staff?.name || shopName}</div>
                    <div style={{ fontSize: 12.5, color: "var(--c-text-3)" }}>{staff?.phone || staff?.email}</div>
                    <span style={{ display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 600, textTransform: "capitalize", color: "var(--c-primary)", background: "var(--c-primary-soft)", padding: "2px 9px", borderRadius: 20 }}>
                        {staff?.role || "Staff"}
                    </span>
                </div>
            </div>

            {/* ===== Account details ===== */}
            <div style={{ ...card, overflow: "hidden", marginBottom: 16 }}>
                <div style={secHead}>{t("staff.profile.accountDetails", "Account details")}</div>
                <Row icon={<Phone size={16} />} label={t("common.phone", "Phone")} value={staff?.phone} />
                <Row icon={<Mail size={16} />} label={t("common.email", "Email")} value={firebaseUser?.email || undefined} />
                <Row icon={<Building2 size={16} />} label={t("common.shop", "Shop")} value={shopName || undefined} last />
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", borderTop: "1px solid var(--c-border)" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)", marginRight: "auto" }}>{t("staff.profile.accountStatus", "Status")}</span>
                    <Pill ref_="c-success" soft="c-success-soft">{t("staff.profile.active", "Active")}</Pill>
                    {firebaseUser?.emailVerified && <Pill ref_="c-info" soft="c-info-soft">{t("staff.profile.verified", "Verified")}</Pill>}
                </div>
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
                <button onClick={() => navigate("/staff")} style={rowBtn}>
                    <HelpCircle size={18} style={{ color: "var(--c-text-3)" }} />
                    <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 600 }}>{t("settings.helpSupport", "Help & Support")}</span>
                    <ChevronRight size={17} style={{ color: "var(--c-text-3)" }} />
                </button>
                <button onClick={handleSignOut} style={{ ...rowBtn, borderTop: "1px solid var(--c-border)" }}>
                    <LogOut size={18} style={{ color: "var(--c-error)" }} />
                    <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 600, color: "var(--c-error)" }}>{t("auth.signOut", "Sign out")}</span>
                </button>
            </div>

            <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--c-text-3)", marginTop: 24 }}>LaundryBill</p>
        </div>
    );
}

const rowBtn: CSSProperties = { width: "100%", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "15px 18px", font: "inherit", background: "transparent", border: 0 };

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

function Pill({ children, ref_, soft }: { children: ReactNode; ref_: string; soft: string }) {
    return <span style={{ fontSize: 11, fontWeight: 600, color: `var(--${ref_})`, background: `var(--${soft})`, padding: "3px 10px", borderRadius: 20 }}>{children}</span>;
}
