/**
 * Team Member Form Sheet — design-system tokens.
 * Create app logins (Staff App, Agent, Plant) → email + invite code.
 * Plan limits (maxStaff, maxDeliveryAgents, maxPlantStaff) apply.
 */

import { useState, useEffect, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { LResponsiveDialog } from "@/components/laundry";
import { useTeamMemberMutations, useTeamMembers } from "@/hooks/use-team-members";
import { useStaff } from "@/hooks/use-staff";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useDeliverySettings } from "@/hooks/use-delivery-settings";
import type { MemberType, VehicleType } from "@/types/staff";
import { useTranslation } from "react-i18next";
import { Check, Copy, MessageCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const MONO = "'IBM Plex Mono'";
const lbl: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 };
const fld: CSSProperties = { width: "100%", font: "inherit", fontSize: 13.5, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 9, padding: "10px 12px", outline: "none" };
const errTxt: CSSProperties = { fontSize: 11.5, color: "var(--c-error)", marginTop: 5 };

function Divider({ label }: { label?: string }) {
    return <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}>{label && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)" }}>{label}</span>}<span style={{ flex: 1, height: 1, background: "var(--c-border)" }} /></div>;
}

function RadioCards({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string; description?: string; disabled?: boolean }[] }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((o) => {
                const on = value === o.value;
                return (
                    <button key={o.value} type="button" disabled={o.disabled} onClick={() => !o.disabled && onChange(o.value)} style={{ cursor: o.disabled ? "not-allowed" : "pointer", font: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 10, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", opacity: o.disabled ? 0.5 : 1 }}>
                        <span style={{ width: 18, height: 18, flex: "none", borderRadius: "50%", border: `2px solid ${on ? "var(--c-primary)" : "var(--c-border-strong)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{on && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--c-primary)" }} />}</span>
                        <span><span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: on ? "var(--c-primary)" : "var(--c-text)" }}>{o.label}</span>{o.description && <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-3)", marginTop: 1 }}>{o.description}</span>}</span>
                    </button>
                );
            })}
        </div>
    );
}

interface TeamMemberFormSheetProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    /** Pre-fill when creating a login for an existing staff member. */
    prefill?: { name?: string; email?: string; memberType?: MemberType; staffId?: string };
}

export function TeamMemberFormSheet({ open, onClose, onSuccess, prefill }: TeamMemberFormSheetProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const { createTeamMember } = useTeamMemberMutations();
    const { teamMembers } = useTeamMembers();
    const { staff } = useStaff();
    const { checkLimit } = useShopLimits();
    const { settings: deliverySettings } = useDeliverySettings();

    const staffLimit = checkLimit("maxStaff", teamMembers.filter((m) => m.memberType === "staff").length);
    const agentLimit = checkLimit("maxDeliveryAgents", teamMembers.filter((m) => m.memberType === "agent").length);
    const plantLimit = checkLimit("maxPlantStaff", teamMembers.filter((m) => m.memberType === "plant").length);

    const memberTypeOptions = [
        { value: "staff", label: t("staff.memberTypeStaff", "Staff App"), description: !staffLimit.allowed ? t("staff.limitReachedUpgrade", "Limit reached — upgrade plan") : t("staff.memberTypeStaffDesc", "Order management & basic access"), disabled: !staffLimit.allowed },
        { value: "agent", label: t("staff.memberTypeAgent", "Delivery Agent"), description: !agentLimit.allowed ? t("staff.limitReachedUpgrade", "Limit reached — upgrade plan") : t("staff.memberTypeAgentDesc", "Pickup & delivery tracking"), disabled: !agentLimit.allowed },
        { value: "plant", label: t("staff.memberTypePlant", "Plant Operator"), description: !plantLimit.allowed ? t("staff.limitReachedUpgrade", "Limit reached — upgrade plan") : t("staff.memberTypePlantDesc", "Processing & plant management"), disabled: !plantLimit.allowed },
    ].filter((opt) => (opt.value === "agent" ? agentLimit.limit !== 0 : opt.value === "plant" ? plantLimit.limit !== 0 : true));

    const [form, setForm] = useState({ email: "", memberType: "staff" as MemberType, name: "", staffId: "", vehicleType: "bike" as VehicleType, vehicleNumber: "", serviceAreas: [] as string[] });
    const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) {
            const defaultType: MemberType = staffLimit.allowed ? "staff" : agentLimit.allowed ? "agent" : plantLimit.allowed ? "plant" : "staff";
            setForm({ email: prefill?.email || "", memberType: prefill?.memberType || defaultType, name: prefill?.name || "", staffId: prefill?.staffId || "", vehicleType: "bike", vehicleNumber: "", serviceAreas: [] });
            setCreatedInviteCode(null);
            setErrors({});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleSubmit = async () => {
        const newErrors: Record<string, string> = {};
        const emailTrim = form.email.trim();
        if (!emailTrim) newErrors.email = t("common.required", "Required");
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) newErrors.email = t("common.invalidEmail", "Invalid email");
        else if (teamMembers.some((tm) => tm.email.toLowerCase() === emailTrim.toLowerCase())) newErrors.email = t("staff.emailAlreadyUsed", "This email is already registered for an app login.");
        else if (staff.some((s) => s.email?.toLowerCase() === emailTrim.toLowerCase())) newErrors.email = t("staff.emailAlreadyUsed", "This email is already registered for an app login.");

        const limit = form.memberType === "agent" ? agentLimit : form.memberType === "plant" ? plantLimit : staffLimit;
        if (!limit.allowed) newErrors.memberType = t("validation.planLimitReached", "Plan limit reached.");
        if (form.memberType === "agent" && !form.vehicleNumber?.trim()) newErrors.vehicleNumber = t("common.required", "Required");

        if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

        setLoading(true); setErrors({});
        try {
            const result = await createTeamMember({
                email: emailTrim.toLowerCase(),
                memberType: form.memberType,
                name: form.name || undefined,
                staffId: form.staffId || undefined,
                vehicle: form.memberType === "agent" && form.vehicleNumber ? { type: form.vehicleType, number: form.vehicleNumber } : undefined,
                serviceAreas: form.memberType === "agent" && form.serviceAreas.length > 0 ? form.serviceAreas : undefined,
            });
            setCreatedInviteCode(result.inviteCode);
        } catch (err: unknown) {
            console.error("Create team member failed:", err);
            if (err instanceof Error && err.message === "EMAIL_ALREADY_USED") {
                const msg = t("staff.emailAlreadyUsed", "This email address is already used. Please try another email.");
                setErrors({ email: msg, submit: msg });
            } else {
                setErrors({ submit: t("staff.createFailedGeneric", "Failed to create app login. Please try again.") });
            }
        } finally {
            setLoading(false);
        }
    };

    const rosterOptions = staff.filter((s) => s.isActive).map((s) => ({ value: s.id, label: `${s.name} (${s.phone})` }));
    const ghostBtn: CSSProperties = { flex: 1, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 10, padding: 11 };

    return (
        <LResponsiveDialog open={open} onClose={onClose} title={t("staff.addAppLogin", "Add App Login")} size="md">
            {createdInviteCode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "center", padding: "8px 0" }}>
                    <span style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--c-success-soft)", color: "var(--c-success)", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><Check size={28} strokeWidth={2.4} /></span>
                    <div><div style={{ fontSize: 17, fontWeight: 700 }}>{t("staff.appLoginCreated", "App login created")}</div><div style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 4 }}>{String(t("staff.shareInviteCode", { name: form.name || form.email } as never))}</div></div>
                    <div style={{ background: "var(--c-primary-soft)", border: "1px solid var(--c-primary)", borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginBottom: 6 }}>{t("staff.inviteCode", "Invite Code")}</div>
                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: ".08em", color: "var(--c-primary)" }}>{createdInviteCode}</div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => navigator.clipboard.writeText(createdInviteCode)} style={ghostBtn}><Copy size={16} />{t("common.copy", "Copy")}</button>
                        <button onClick={() => { const msg = String(t("staff.whatsappInviteMessage", { name: form.name || form.email, code: createdInviteCode, link: `${window.location.origin}/${form.memberType === "agent" ? "driver" : form.memberType === "plant" ? "plant" : "staff"}/signup` } as never)); window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank"); }} style={{ ...ghostBtn, color: "var(--c-success)", borderColor: "var(--c-success-soft)", background: "var(--c-success-soft)" }}><MessageCircle size={16} />WhatsApp</button>
                    </div>
                    <button onClick={() => { setCreatedInviteCode(null); onSuccess?.(); onClose(); }} style={{ width: "100%", cursor: "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 14 }}>{t("common.done", "Done")}</button>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {errors.submit && <div style={{ background: "var(--c-error-soft)", color: "var(--c-error)", borderRadius: 10, padding: "10px 13px", fontSize: 13, fontWeight: 500 }}>{errors.submit}</div>}

                    <div>
                        <label style={lbl}>{t("staff.emailRequired", "Email (required)")}</label>
                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" style={{ ...fld, borderColor: errors.email ? "var(--c-error)" : "var(--c-border-strong)" }} />
                        {errors.email ? <div style={errTxt}>{errors.email}</div> : <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 5 }}>{t("staff.emailRequiredHint", "Use an active email the staff can access — it's required to reset this login's password if needed. Each login needs its own unique email.")}</div>}
                    </div>
                    <div>
                        <label style={lbl}>{t("staff.name", "Name")} <span style={{ color: "var(--c-text-3)", fontWeight: 400 }}>· {t("common.optional", "optional")}</span></label>
                        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("staff.namePlaceholder", "Full name")} style={fld} />
                    </div>

                    <Divider label={t("staff.memberTypeLabel", "Login type")} />
                    <RadioCards value={form.memberType} onChange={(v) => setForm({ ...form, memberType: v as MemberType })} options={memberTypeOptions} />
                    {errors.memberType && <div style={errTxt}>{errors.memberType}</div>}

                    {form.memberType === "agent" && (
                        <>
                            <Divider label={t("staff.vehicleInfo", "Vehicle info")} />
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                                <div>
                                    <label style={lbl}>{t("staff.vehicleType", "Vehicle type")}</label>
                                    <select value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value as VehicleType })} style={fld}>
                                        <option value="bike">{t("staff.vehicleBike", "Bike")}</option>
                                        <option value="scooter">{t("staff.vehicleScooter", "Scooter")}</option>
                                        <option value="car">{t("staff.vehicleCar", "Car")}</option>
                                        <option value="van">{t("staff.vehicleVan", "Van")}</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={lbl}>{t("staff.vehicleNumber", "Vehicle number")}</label>
                                    <input value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value.toUpperCase() })} placeholder="KA-01-AB-1234" style={{ ...fld, fontFamily: MONO, borderColor: errors.vehicleNumber ? "var(--c-error)" : "var(--c-border-strong)" }} />
                                    {errors.vehicleNumber && <div style={errTxt}>{errors.vehicleNumber}</div>}
                                </div>
                            </div>

                            <Divider label={t("staff.assignAreas", "Assign service areas")} />
                            {deliverySettings?.serviceAreas?.length > 0 ? (
                                <div>
                                    <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginBottom: 8 }}>{t("staff.assignAreasHint", "Select areas this agent will serve (optional)")}</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        {deliverySettings.serviceAreas.filter((a) => a.isActive).map((area) => {
                                            const on = form.serviceAreas.includes(area.value);
                                            return (
                                                <button key={area.value} type="button" onClick={() => setForm({ ...form, serviceAreas: on ? form.serviceAreas.filter((a) => a !== area.value) : [...form.serviceAreas, area.value] })} style={{ cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, padding: "6px 13px", borderRadius: 20, border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary)" : "var(--c-surface)", color: on ? "#fff" : "var(--c-text-2)" }}>{area.value}</button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: 13, color: "var(--c-text-3)" }}>{t("staff.noServiceAreasConfigured", "No service areas configured.")}{" "}<button type="button" onClick={() => navigate("/inventory?tab=service-areas")} style={{ cursor: "pointer", font: "inherit", color: "var(--c-primary)", background: "transparent", border: 0, textDecoration: "underline" }}>{t("staff.configureServiceAreas", "Configure in settings")}</button></div>
                            )}
                        </>
                    )}

                    <Divider />
                    <div>
                        <label style={lbl}>{t("staff.linkToRoster", "Link to Roster (optional)")}</label>
                        <select value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} style={fld}>
                            <option value="">{t("common.none", "None")}</option>
                            {rosterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 5 }}>{t("staff.linkToRosterDesc", "Link if this login is for an existing roster member.")}</div>
                    </div>

                    <button type="button" onClick={handleSubmit} disabled={loading} style={{ width: "100%", marginTop: 4, cursor: loading ? "wait" : "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 14, boxShadow: "var(--sh-sm)", opacity: loading ? 0.6 : 1 }}>
                        {loading ? t("common.loading", "Creating…") : t("staff.createAppLogin", "Create & Get Invite Code")}
                    </button>
                </div>
            )}
        </LResponsiveDialog>
    );
}
