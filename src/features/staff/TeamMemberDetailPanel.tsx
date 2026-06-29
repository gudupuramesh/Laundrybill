/**
 * Team Member (App Login) Detail — design-system tokens.
 * Profile + invite code + agent controls (contact, enable, online, areas, vehicle).
 * Wired to useTeamMembers / mutations + password reset.
 */

import { useState, type CSSProperties } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LSpinner, useLToast } from "@/components/laundry";
import { useTeamMembers, useTeamMemberMutations } from "@/hooks/use-team-members";
import { TeamMemberAreasSheet } from "./TeamMemberAreasSheet";
import { ChevronLeft, Copy, MessageCircle, MapPin, Truck, Check, Phone, Pencil, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";

const MONO = "'IBM Plex Mono'";
const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
const tintFor = (s: string) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; };
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, boxShadow: "var(--sh-sm)" };
const fld: CSSProperties = { width: "100%", font: "inherit", fontSize: 13.5, fontFamily: MONO, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 9, padding: "10px 12px", outline: "none" };
const VEHICLE_LABELS: Record<string, string> = { bike: "Bike", scooter: "Scooter", car: "Car", van: "Van" };

interface TeamMemberDetailPanelProps {
    teamMemberId: string;
    onClose?: () => void;
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => !disabled && onChange(!checked)} aria-label="Toggle" style={{ position: "relative", cursor: disabled ? "not-allowed" : "pointer", width: 44, height: 25, border: 0, borderRadius: 20, flex: "none", background: checked ? "var(--c-success)" : "var(--c-border-strong)", opacity: disabled ? 0.6 : 1 }}>
            <span style={{ position: "absolute", top: 3, left: 3, width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)", transition: "transform .15s", transform: checked ? "translateX(19px)" : "translateX(0)" }} />
        </button>
    );
}

export function TeamMemberDetailPanel({ teamMemberId, onClose }: TeamMemberDetailPanelProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const { addToast } = useLToast();
    const { teamMembers, loading } = useTeamMembers();
    const { updateTeamMember } = useTeamMemberMutations();
    const [areasSheetOpen, setAreasSheetOpen] = useState(false);
    const [sendingReset, setSendingReset] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [togglingOnline, setTogglingOnline] = useState(false);
    const [editingPhone, setEditingPhone] = useState(false);
    const [phoneValue, setPhoneValue] = useState("");
    const [savingPhone, setSavingPhone] = useState(false);
    const [copied, setCopied] = useState(false);

    const teamMember = teamMembers.find((tm) => tm.id === teamMemberId);

    const handleCopyInvite = () => {
        if (!teamMember) return;
        navigator.clipboard.writeText(`${teamMember.name || teamMember.email}\nEmail: ${teamMember.email}\nInvite Code: ${teamMember.inviteCode}`);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
    };
    const handleSendPasswordReset = async () => {
        if (!teamMember?.email || teamMember.inviteStatus !== "accepted") return;
        setSendingReset(true);
        try {
            await sendPasswordResetEmail(auth, teamMember.email.trim());
            addToast({ type: "success", title: t("staff.passwordResetSent", "Reset email sent"), description: t("staff.passwordResetSentDesc", "They will receive a reset link at {{email}}", { email: teamMember.email }) });
        } catch (err) {
            addToast({ type: "error", title: t("staff.passwordResetFailed", "Could not send reset email"), description: err instanceof Error ? err.message : "" });
        } finally { setSendingReset(false); }
    };
    const handleWhatsAppShare = () => {
        if (!teamMember) return;
        const link = `${window.location.origin}/${teamMember.memberType === "agent" ? "driver" : teamMember.memberType === "plant" ? "plant" : "staff"}/signup`;
        const msg = String(t("staff.whatsappInviteMessage", { name: teamMember.name || teamMember.email, code: teamMember.inviteCode, link } as never));
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    };
    const handleToggleActive = async (checked: boolean) => { if (!teamMember || teamMember.memberType !== "agent") return; setToggling(true); try { await updateTeamMember(teamMember.id, { isActive: checked }); } catch (e) { console.error(e); } finally { setToggling(false); } };
    const handleToggleOnline = async (checked: boolean) => { if (!teamMember || teamMember.memberType !== "agent") return; setTogglingOnline(true); try { await updateTeamMember(teamMember.id, { isOnline: checked }); } catch (e) { console.error(e); } finally { setTogglingOnline(false); } };
    const savePhone = async () => { if (!teamMember) return; setSavingPhone(true); try { await updateTeamMember(teamMember.id, { phone: phoneValue.trim() || undefined }); setEditingPhone(false); setPhoneValue(""); } catch (e) { console.error(e); } finally { setSavingPhone(false); } };

    if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}><LSpinner size="lg" /></div>;
    if (!teamMember) {
        return (
            <div style={{ textAlign: "center", padding: 48 }}>
                <p style={{ color: "var(--c-text-3)" }}>{t("staff.notFound", "Not found")}</p>
                <button onClick={onClose} style={{ marginTop: 16, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 8, padding: "8px 14px" }}>{t("common.goBack", "Back")}</button>
            </div>
        );
    }

    const isAgent = teamMember.memberType === "agent";
    const isActive = teamMember.isActive !== false;
    const ref = tintFor(teamMember.id);
    const typeMeta = isAgent ? { label: t("staff.memberTypeAgent", "Delivery Agent"), tint: "c-success" } : teamMember.memberType === "plant" ? { label: t("staff.memberTypePlant", "Plant Operator"), tint: "c-cyan" } : { label: t("staff.memberTypeStaff", "Staff App"), tint: "c-info" };
    const secLbl: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600 };
    const ghostBtn: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 12.5, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "7px 12px" };

    const ToggleCard = ({ title, desc, checked, onChange, disabled, dotOnly }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; dotOnly?: boolean }) => (
        <div style={{ ...card, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 40, height: 40, flex: "none", borderRadius: 10, background: checked ? "var(--c-success-soft)" : "var(--c-surface-2)", color: checked ? "var(--c-success)" : "var(--c-text-3)", display: "flex", alignItems: "center", justifyContent: "center" }}>{dotOnly ? <span style={{ width: 12, height: 12, borderRadius: "50%", background: checked ? "var(--c-success)" : "var(--c-text-3)" }} /> : <Check size={18} />}</span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 2 }}>{desc}</div></div>
            <Switch checked={checked} onChange={onChange} disabled={disabled} />
        </div>
    );

    return (
        <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header */}
            <header style={{ position: "sticky", top: 0, zIndex: 5, flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "0 16px" : "0 22px" }}>
                <button onClick={onClose} aria-label="Back" style={{ cursor: "pointer", width: 30, height: 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "transparent", border: 0, borderRadius: 7 }}><ChevronLeft size={18} /></button>
                <nav style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--c-text-3)", minWidth: 0 }}>
                    <button onClick={onClose} style={{ cursor: "pointer", font: "inherit", fontSize: 13, color: "var(--c-text-2)", background: "transparent", border: 0 }}>{t("staff.title", "Staff")}</button><span>/</span>
                    <span style={{ color: "var(--c-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamMember.name || teamMember.email}</span>
                </nav>
            </header>

            <div style={{ padding: isMobile ? "16px 16px 40px" : "20px 22px 40px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
                {/* profile */}
                <div style={{ ...card, padding: isMobile ? "16px 16px" : "20px 22px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <span style={{ width: 56, height: 56, flex: "none", borderRadius: 14, background: `var(--${ref}-soft)`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 600 }}>{(teamMember.name || teamMember.email).slice(0, 2).toUpperCase()}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 19, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamMember.name || teamMember.email}</div>
                            <div style={{ fontSize: 13, color: "var(--c-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamMember.email}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11.5, fontWeight: 600, color: `var(--${typeMeta.tint})`, background: `var(--${typeMeta.tint}-soft)`, padding: "3px 10px", borderRadius: 20 }}>{typeMeta.label}</span>
                                {teamMember.inviteStatus === "accepted" && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "var(--c-success)", background: "var(--c-success-soft)", padding: "3px 10px", borderRadius: 20 }}><Check size={11} />{t("staff.inviteAccepted", "Active")}</span>}
                                {isAgent && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: teamMember.isOnline ? "var(--c-success)" : "var(--c-text-3)" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: teamMember.isOnline ? "var(--c-success)" : "var(--c-text-3)" }} />{teamMember.isOnline ? t("staff.online", "Online") : t("staff.availabilityAway", "Away")}</span>}
                                {isAgent && !isActive && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-error)", background: "var(--c-error-soft)", padding: "3px 9px", borderRadius: 20 }}>{t("staff.disabled", "Disabled")}</span>}
                            </div>
                        </div>
                    </div>
                    {/* invite code */}
                    <div style={{ marginTop: 16, background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginBottom: 5 }}>{t("staff.inviteCode", "Invite code")}</div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 18, letterSpacing: ".06em", color: "var(--c-primary)" }}>{teamMember.inviteCode}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                            <button onClick={handleCopyInvite} style={ghostBtn}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t("common.copied", "Copied") : t("common.copy", "Copy")}</button>
                            <button onClick={handleWhatsAppShare} style={{ ...ghostBtn, color: "var(--c-success)", borderColor: "var(--c-success-soft)", background: "var(--c-success-soft)" }}><MessageCircle size={14} />WhatsApp</button>
                            {teamMember.inviteStatus === "accepted" && teamMember.email && <button onClick={handleSendPasswordReset} disabled={sendingReset} style={{ ...ghostBtn, opacity: sendingReset ? 0.6 : 1 }}><KeyRound size={14} />{sendingReset ? t("common.sending", "Sending…") : t("staff.sendPasswordReset", "Reset password")}</button>}
                        </div>
                    </div>
                </div>

                {/* contact (agents) */}
                {isAgent && (
                    <div style={{ ...card, padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editingPhone ? 12 : 8 }}>
                            <span style={secLbl}><Phone size={15} />{t("staff.contactNumber", "Contact Number")}</span>
                            {!editingPhone && <button onClick={() => { setPhoneValue(teamMember.phone || ""); setEditingPhone(true); }} style={ghostBtn}><Pencil size={13} />{teamMember.phone ? t("common.edit", "Edit") : t("staff.addContact", "Add")}</button>}
                        </div>
                        {editingPhone ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <input value={phoneValue} inputMode="numeric" onChange={(e) => setPhoneValue(e.target.value.replace(/[^\d+\s-]/g, ""))} placeholder="Phone number" style={fld} />
                                <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{t("staff.contactNumberHint", "Shown on order tracking so customers can call or WhatsApp the agent.")}</div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button onClick={savePhone} disabled={savingPhone} style={{ cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 8, padding: "8px 16px", opacity: savingPhone ? 0.6 : 1 }}>{savingPhone ? t("common.saving", "Saving…") : t("common.save", "Save")}</button>
                                    <button onClick={() => { setEditingPhone(false); setPhoneValue(""); }} disabled={savingPhone} style={ghostBtn}>{t("common.cancel", "Cancel")}</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ fontSize: 13, fontFamily: teamMember.phone ? MONO : undefined, color: teamMember.phone ? "var(--c-text)" : "var(--c-text-3)" }}>{teamMember.phone || t("staff.noContactSet", "No contact number set.")}</div>
                        )}
                    </div>
                )}

                {/* enable / online (agents) */}
                {isAgent && <ToggleCard title={t("staff.enableAgent", "Enable for Orders")} desc={t("staff.enableAgentDesc", "When enabled, this agent appears in New Order and can receive assignments.")} checked={isActive} onChange={handleToggleActive} disabled={toggling} />}
                {isAgent && <ToggleCard title={t("staff.setAgentOnline", "Set Agent Online")} desc={t("staff.setAgentOnlineDesc", "You control availability. When on, the agent receives tasks.")} checked={teamMember.isOnline ?? false} onChange={handleToggleOnline} disabled={togglingOnline || !isActive} dotOnly />}

                {/* service areas (agents) */}
                {isAgent && (
                    <div style={{ ...card, padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <span style={secLbl}><MapPin size={15} />{t("staff.serviceAreas", "Service Areas")}</span>
                            <button onClick={() => setAreasSheetOpen(true)} style={ghostBtn}><Pencil size={13} />{t("staff.editAreas", "Edit")}</button>
                        </div>
                        {teamMember.serviceAreas && teamMember.serviceAreas.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{teamMember.serviceAreas.map((a) => <span key={a} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 7, padding: "4px 10px" }}>{a}</span>)}</div>
                        ) : (
                            <div style={{ fontSize: 13, color: "var(--c-text-3)" }}>{t("staff.noAreasSelected", "No areas assigned. Agent will see all orders.")}</div>
                        )}
                    </div>
                )}

                {/* vehicle (agents) */}
                {isAgent && teamMember.vehicle && (
                    <div style={{ ...card, padding: "16px 18px" }}>
                        <div style={{ ...secLbl, marginBottom: 8 }}><Truck size={15} />{t("staff.vehicle", "Vehicle")}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{VEHICLE_LABELS[teamMember.vehicle.type] || teamMember.vehicle.type}{teamMember.vehicle.number ? ` · ${teamMember.vehicle.number}` : ""}</div>
                    </div>
                )}
            </div>

            <TeamMemberAreasSheet open={areasSheetOpen} onClose={() => setAreasSheetOpen(false)} teamMember={teamMember} />
        </div>
    );
}
