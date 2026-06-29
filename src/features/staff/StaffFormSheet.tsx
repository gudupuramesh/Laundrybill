/**
 * Staff Form Sheet — design-system tokens.
 * Add/edit staff: name · phone · email · optional app-login (type) · pay details ·
 * bank details. Shows the invite code on a success view when a login is created.
 */

import { useState, useEffect, type CSSProperties } from "react";
import { LResponsiveDialog } from "@/components/laundry";
import { useStaffMutations, useStaff } from "@/hooks/use-staff";
import { useTeamMembers, useTeamMemberMutations } from "@/hooks/use-team-members";
import { useCurrency } from "@/hooks/use-currency";
import { useShopLimits } from "@/hooks/use-shop-limits";
import type { Staff, StaffRole, PayType, MemberType } from "@/types/staff";
import { Timestamp } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const lbl: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 };
const fld: CSSProperties = { width: "100%", font: "inherit", fontSize: 13.5, color: "var(--c-text)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 9, padding: "10px 12px", outline: "none" };
const errTxt: CSSProperties = { fontSize: 11.5, color: "var(--c-error)", marginTop: 5 };
const MONO = "'IBM Plex Mono'";

function Divider({ label }: { label: string }) {
    return <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-text-3)" }}>{label}</span><span style={{ flex: 1, height: 1, background: "var(--c-border)" }} /></div>;
}

function RadioCards({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string; description?: string }[] }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((o) => {
                const on = value === o.value;
                return (
                    <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{ cursor: "pointer", font: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 10, border: `1.5px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)" }}>
                        <span style={{ width: 18, height: 18, flex: "none", borderRadius: "50%", border: `2px solid ${on ? "var(--c-primary)" : "var(--c-border-strong)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{on && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--c-primary)" }} />}</span>
                        <span><span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: on ? "var(--c-primary)" : "var(--c-text)" }}>{o.label}</span>{o.description && <span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-3)", marginTop: 1 }}>{o.description}</span>}</span>
                    </button>
                );
            })}
        </div>
    );
}

interface StaffFormSheetProps {
    open: boolean;
    onClose: () => void;
    staff?: Staff;
    onSubmit?: (data: Record<string, unknown>) => void;
}

export function StaffFormSheet({ open, onClose, staff, onSubmit }: StaffFormSheetProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const { currencySymbol } = useCurrency();
    const isEdit = !!staff;
    const { checkLimit } = useShopLimits();
    const { activeStaff } = useStaff();
    const { teamMembers } = useTeamMembers();
    const { createTeamMember } = useTeamMemberMutations();

    const rosterLimit = checkLimit("maxRoster", activeStaff.length);
    const staffLoginLimit = checkLimit("maxStaff", teamMembers.filter((m) => m.memberType === "staff").length);
    const agentLoginLimit = checkLimit("maxDeliveryAgents", teamMembers.filter((m) => m.memberType === "agent").length);
    const plantLoginLimit = checkLimit("maxPlantStaff", teamMembers.filter((m) => m.memberType === "plant").length);
    const loginLimitFor = (k: string) => (k === "agent" ? agentLoginLimit : k === "plant" ? plantLoginLimit : staffLoginLimit);
    const memberTypeForLogin = (k: string): MemberType => (k === "agent" ? "agent" : k === "plant" ? "plant" : "staff");
    const roleForLogin = (k: string): StaffRole => (k === "manager" ? "manager" : k === "plant" ? "plant_operator" : "staff");

    const payTypeOptions = [
        { value: "monthly", label: t("staff.monthlySalary", "Monthly Salary"), description: t("staff.monthlySalaryDesc", "Fixed monthly payment") },
        { value: "daily", label: t("staff.dailyWage", "Daily Wage"), description: t("staff.dailyWageDesc", "Daily rate payment") },
    ];
    const memberTypeOptions = [
        { value: "staff", label: t("staff.memberTypeStaff", "Staff App"), description: !staffLoginLimit.allowed ? t("staff.limitReachedUpgrade", "Limit reached — upgrade plan") : t("staff.memberTypeStaffDesc", "Order management & basic access") },
        { value: "manager", label: t("staff.memberTypeManager", "Manager"), description: !staffLoginLimit.allowed ? t("staff.limitReachedUpgrade", "Limit reached — upgrade plan") : t("staff.memberTypeManagerDesc", "Staff App access with manager role") },
        { value: "agent", label: t("staff.memberTypeAgent", "Delivery Agent"), description: !agentLoginLimit.allowed ? t("staff.limitReachedUpgrade", "Limit reached — upgrade plan") : t("staff.memberTypeAgentDesc", "Pickup & delivery tracking") },
        { value: "plant", label: t("staff.memberTypePlant", "Plant Operator"), description: !plantLoginLimit.allowed ? t("staff.limitReachedUpgrade", "Limit reached — upgrade plan") : t("staff.memberTypePlantDesc", "Processing & plant management") },
    ];
    const { createStaff, updateStaff } = useStaffMutations();
    const [loading, setLoading] = useState(false);

    const [createLogin, setCreateLogin] = useState(false);
    const [loginType, setLoginType] = useState<"staff" | "manager" | "agent" | "plant">("staff");
    const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
    const [createdName, setCreatedName] = useState("");

    const [form, setForm] = useState({ name: "", phone: "", email: "", role: "staff" as StaffRole, payType: "monthly" as PayType, baseSalary: 15000, overtimeRate: 0, bankName: "", accountNumber: "", ifscCode: "" });
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!open) return;
        if (staff) {
            setForm({ name: staff.name, phone: staff.phone, email: staff.email || "", role: staff.role, payType: staff.payType, baseSalary: staff.baseSalary, overtimeRate: staff.overtimeRate || 0, bankName: staff.bankDetails?.bankName || "", accountNumber: staff.bankDetails?.accountNumber || "", ifscCode: staff.bankDetails?.ifscCode || "" });
        } else {
            setForm({ name: "", phone: "", email: "", role: "staff", payType: "monthly", baseSalary: 15000, overtimeRate: 0, bankName: "", accountNumber: "", ifscCode: "" });
        }
        setCreateLogin(false); setLoginType("staff"); setCreatedInviteCode(null); setCreatedName(""); setErrors({});
    }, [staff, open]);

    const handleSubmit = async () => {
        const newErrors: Record<string, string> = {};
        if (!form.name.trim()) newErrors.name = t("common.required", "Required");
        if (!form.phone.trim() || form.phone.length !== 10) newErrors.phone = t("common.invalidPhone", "Enter a valid phone number");
        const wantsLogin = !isEdit && createLogin;
        if (wantsLogin) {
            if (!form.email.trim()) newErrors.email = t("staff.emailRequiredForLogin", "Email is required to create an app login");
            if (!loginLimitFor(loginType).allowed) newErrors.loginType = t("validation.planLimitReached", "Plan limit reached for this login type. Upgrade to add more.");
        }
        if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
        if (!isEdit && !rosterLimit.allowed) { alert(t("validation.planLimitReachedDesc", "You have reached the roster limit. Upgrade plan to add more staff.")); return; }

        setLoading(true); setErrors({});
        try {
            const data: Record<string, unknown> = { name: form.name, phone: form.phone, role: wantsLogin ? roleForLogin(loginType) : form.role, payType: form.payType, baseSalary: form.baseSalary, joiningDate: staff?.joiningDate || Timestamp.now(), isActive: staff?.isActive ?? true };
            if (form.email) data.email = form.email.trim().toLowerCase();
            if (form.overtimeRate > 0) data.overtimeRate = form.overtimeRate;
            if (form.bankName || form.accountNumber || form.ifscCode) data.bankDetails = { bankName: form.bankName || "", accountNumber: form.accountNumber || "", ifscCode: form.ifscCode || "" };

            if (isEdit && staff) {
                await updateStaff(staff.id, data as never);
                onSubmit?.(data); onClose();
            } else {
                const { id: newStaffId } = await createStaff(data as never);
                if (wantsLogin) {
                    try {
                        const { inviteCode } = await createTeamMember({ email: form.email.trim().toLowerCase(), memberType: memberTypeForLogin(loginType), role: roleForLogin(loginType), name: form.name, staffId: newStaffId });
                        onSubmit?.(data); setCreatedName(form.name); setCreatedInviteCode(inviteCode); return;
                    } catch (err) {
                        setErrors({ email: err instanceof Error && err.message === "EMAIL_ALREADY_USED" ? t("staff.emailAlreadyUsed", "That email already has a login.") : t("staff.loginCreateFailed", "Staff added, but the login could not be created.") });
                        return;
                    }
                }
                onSubmit?.(data); onClose();
            }
        } catch (error) {
            console.error("Error saving staff:", error);
        } finally {
            setLoading(false);
        }
    };

    // Success view — invite code after a login was created.
    if (createdInviteCode) {
        const typeLabel = loginType === "agent" ? t("staff.memberTypeAgent", "Delivery Agent") : loginType === "plant" ? t("staff.memberTypePlant", "Plant Operator") : loginType === "manager" ? t("staff.memberTypeManager", "Manager") : t("staff.memberTypeStaff", "Staff App");
        return (
            <LResponsiveDialog open={open} onClose={onClose} title={t("staff.loginCreatedTitle", "App Login Created")} size="md">
                <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "center", padding: "8px 0" }}>
                    <span style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--c-success-soft)", color: "var(--c-success)", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><Check size={28} strokeWidth={2.4} /></span>
                    <div><div style={{ fontWeight: 700, fontSize: 16 }}>{createdName}</div><div style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 3 }}>{typeLabel} · {t("staff.loginCreated", "Login created")}</div></div>
                    <div style={{ background: "var(--c-primary-soft)", border: "1px solid var(--c-primary)", borderRadius: 12, padding: 16, textAlign: "left" }}>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginBottom: 6 }}>{t("staff.inviteCode", "Invite Code")}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 18, letterSpacing: ".06em", color: "var(--c-primary)" }}>{createdInviteCode}</span>
                            <button type="button" onClick={() => navigator.clipboard.writeText(createdInviteCode)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, font: "inherit", fontSize: 12, fontWeight: 600, color: "var(--c-primary)", background: "transparent", border: 0 }}><Copy size={13} />{t("common.copy", "Copy")}</button>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 8 }}>{t("staff.shareInviteCode", "Share this code so they can sign up and log in.")}</div>
                    </div>
                    <button type="button" onClick={onClose} style={{ width: "100%", cursor: "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 14 }}>{t("common.done", "Done")}</button>
                </div>
            </LResponsiveDialog>
        );
    }

    return (
        <LResponsiveDialog open={open} onClose={onClose} title={isEdit ? t("staff.editStaff", "Edit Staff") : t("staff.addStaff", "Add Staff")} size="md">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                    <label style={lbl}>{t("staff.name", "Name")}</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("staff.namePlaceholder", "Staff member name")} style={{ ...fld, borderColor: errors.name ? "var(--c-error)" : "var(--c-border-strong)" }} />
                    {errors.name && <div style={errTxt}>{errors.name}</div>}
                </div>
                <div>
                    <label style={lbl}>{t("staff.phoneNumber", "Phone Number")}</label>
                    <input value={form.phone} inputMode="numeric" placeholder="9876543210" onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} style={{ ...fld, fontFamily: MONO, borderColor: errors.phone ? "var(--c-error)" : "var(--c-border-strong)" }} />
                    {errors.phone && <div style={errTxt}>{errors.phone}</div>}
                </div>
                <div>
                    <label style={lbl}>{createLogin ? t("staff.email", "Email") : t("staff.emailOptional", "Email (optional)")}</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="staff@example.com" style={{ ...fld, borderColor: errors.email ? "var(--c-error)" : "var(--c-border-strong)" }} />
                    {errors.email && <div style={errTxt}>{errors.email}</div>}
                </div>

                {/* Optional app login — new staff only */}
                {!isEdit && (
                    <div style={{ border: "1px solid var(--c-border)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }}>
                            <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("staff.createLoginQuestion", "Create app login for this person?")}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 2 }}>{t("staff.createLoginHint", "Give them access to the Staff, Agent, or Plant app via an invite code.")}</div></div>
                            <button type="button" role="switch" aria-checked={createLogin} onClick={() => setCreateLogin(!createLogin)} aria-label="Create login" style={{ position: "relative", cursor: "pointer", width: 44, height: 25, border: 0, borderRadius: 20, flex: "none", background: createLogin ? "var(--c-primary)" : "var(--c-border-strong)" }}><span style={{ position: "absolute", top: 3, left: 3, width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)", transition: "transform .15s", transform: createLogin ? "translateX(19px)" : "translateX(0)" }} /></button>
                        </label>
                        {createLogin && (
                            <div>
                                <label style={lbl}>{t("staff.loginType", "Login type")}</label>
                                <RadioCards value={loginType} onChange={(v) => setLoginType(v as "staff" | "manager" | "agent" | "plant")} options={memberTypeOptions} />
                                {errors.loginType && <div style={errTxt}>{errors.loginType}</div>}
                            </div>
                        )}
                    </div>
                )}

                {/* Legacy invite code for existing staff with access */}
                {isEdit && staff?.inviteCode && (
                    <div style={{ background: "var(--c-primary-soft)", border: "1px solid var(--c-primary)", borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginBottom: 6 }}>{t("staff.inviteCode", "Invite Code")}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 17, letterSpacing: ".06em", color: "var(--c-primary)" }}>{staff.inviteCode}</span>
                            <button type="button" onClick={() => navigator.clipboard.writeText(staff.inviteCode!)} style={{ cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, color: "var(--c-primary)", background: "transparent", border: 0 }}>{t("common.copy", "Copy")}</button>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: 8 }}>{staff.inviteStatus === "accepted" ? t("staff.inviteAccepted", "Active") : t("staff.invitePending", "Pending")}</div>
                    </div>
                )}

                <Divider label={t("staff.paySection", "Pay Details")} />
                <div>
                    <label style={lbl}>{t("staff.payType", "Pay Type")}</label>
                    <RadioCards value={form.payType} onChange={(v) => setForm({ ...form, payType: v as PayType })} options={payTypeOptions} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                    <div>
                        <label style={lbl}>{form.payType === "monthly" ? t("staff.monthlySalary", "Monthly Salary") : t("staff.dailyWage", "Daily Wage")}</label>
                        <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--c-border-strong)", borderRadius: 9, background: "var(--c-surface)" }}>
                            <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--c-text-3)", paddingLeft: 11 }}>{currencySymbol}</span>
                            <input type="text" inputMode="decimal" value={form.baseSalary || ""} onChange={(e) => { const n = parseFloat(e.target.value); setForm({ ...form, baseSalary: isNaN(n) || n < 0 ? 0 : n }); }} style={{ ...fld, border: 0, fontFamily: MONO, fontWeight: 700, paddingLeft: 8, background: "transparent" }} />
                        </div>
                    </div>
                    <div>
                        <label style={lbl}>{t("staff.overtimeRate", "Overtime Rate / hr")}</label>
                        <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--c-border-strong)", borderRadius: 9, background: "var(--c-surface)" }}>
                            <span style={{ fontFamily: MONO, fontSize: 13, color: "var(--c-text-3)", paddingLeft: 11 }}>{currencySymbol}</span>
                            <input type="text" inputMode="decimal" value={form.overtimeRate || ""} placeholder="0" onChange={(e) => { const n = parseFloat(e.target.value); setForm({ ...form, overtimeRate: isNaN(n) || n < 0 ? 0 : n }); }} style={{ ...fld, border: 0, fontFamily: MONO, fontWeight: 700, paddingLeft: 8, background: "transparent" }} />
                        </div>
                    </div>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginTop: -6 }}>{t("staff.overtimeRateDesc", "If empty, overtime is calculated at 1.5× the hourly rate.")}</div>

                <Divider label={t("staff.bankDetails", "Bank Details (optional)")} />
                <div>
                    <label style={lbl}>{t("staff.bankName", "Bank Name")}</label>
                    <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder={t("staff.bankNamePlaceholder", "e.g. State Bank of India")} style={fld} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                    <div>
                        <label style={lbl}>{t("staff.accountNumber", "Account Number")}</label>
                        <input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder={t("staff.accountNumberPlaceholder", "Account number")} style={{ ...fld, fontFamily: MONO }} />
                    </div>
                    <div>
                        <label style={lbl}>{t("staff.ifscCode", "IFSC Code")}</label>
                        <input value={form.ifscCode} onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })} placeholder="SBIN0001234" style={{ ...fld, fontFamily: MONO }} />
                    </div>
                </div>

                <button type="button" onClick={handleSubmit} disabled={loading} style={{ width: "100%", marginTop: 4, cursor: loading ? "wait" : "pointer", font: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 11, padding: 14, boxShadow: "var(--sh-sm)", opacity: loading ? 0.6 : 1 }}>
                    {loading ? t("common.loading", "Saving…") : isEdit ? t("common.save", "Save") : t("staff.addStaff", "Add Staff")}
                </button>
            </div>
        </LResponsiveDialog>
    );
}
