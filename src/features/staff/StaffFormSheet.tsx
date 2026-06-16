import { useState, useEffect } from "react";
import {
    LResponsiveDialog,
    LTextInput,
    LPhoneInput,
    LNumberInput,
    LButton,
    LDivider,
    LSpacer,
    LRadioGroup,
    LToggle,
} from "@/components/laundry";
import { useStaffMutations, useStaff } from "@/hooks/use-staff";
import { useTeamMembers, useTeamMemberMutations } from "@/hooks/use-team-members";
import { useCurrency } from "@/hooks/use-currency";
import { useShopLimits } from "@/hooks/use-shop-limits";
import type { Staff, StaffRole, PayType, MemberType } from "@/types/staff";
import { Timestamp } from "firebase/firestore";
import { useTranslation } from "react-i18next";

interface StaffFormSheetProps {
    open: boolean;
    onClose: () => void;
    staff?: Staff;
    onSubmit?: (data: any) => void;
}

export function StaffFormSheet({ open, onClose, staff, onSubmit }: StaffFormSheetProps) {
    const { t } = useTranslation();
    const { currencySymbol } = useCurrency();
    const isEdit = !!staff;
    const { checkLimit } = useShopLimits();
    const { activeStaff } = useStaff();
    const { teamMembers } = useTeamMembers();
    const { createTeamMember } = useTeamMemberMutations();

    // Roster limit (attendance/payroll - all plans)
    const rosterCount = activeStaff.length;
    const rosterLimit = checkLimit("maxRoster", rosterCount);

    // App-login limits are per type (separate quotas from the roster).
    // A "manager" login is a Staff-App login (memberType "staff") tagged with the
    // manager roster role, so it counts against the same maxStaff quota.
    const staffLoginLimit = checkLimit("maxStaff", teamMembers.filter((m) => m.memberType === "staff").length);
    const agentLoginLimit = checkLimit("maxDeliveryAgents", teamMembers.filter((m) => m.memberType === "agent").length);
    const plantLoginLimit = checkLimit("maxPlantStaff", teamMembers.filter((m) => m.memberType === "plant").length);
    const loginLimitFor = (k: string) =>
        k === "agent" ? agentLoginLimit : k === "plant" ? plantLoginLimit : staffLoginLimit;
    const memberTypeForLogin = (k: string): MemberType => (k === "agent" ? "agent" : k === "plant" ? "plant" : "staff");
    const roleForLogin = (k: string): StaffRole => (k === "manager" ? "manager" : k === "plant" ? "plant_operator" : "staff");

    const payTypeOptions = [
        { value: "monthly", label: t('staff.monthlySalary', 'Monthly Salary'), description: t('staff.monthlySalaryDesc', 'Fixed monthly payment') },
        { value: "daily", label: t('staff.dailyWage', 'Daily Wage'), description: t('staff.dailyWageDesc', 'Daily rate payment') },
    ];

    const memberTypeOptions = [
        {
            value: "staff",
            label: t("staff.memberTypeStaff", "Staff App"),
            description: !staffLoginLimit.allowed ? t("staff.limitReachedUpgrade", "Limit reached — upgrade plan") : t("staff.memberTypeStaffDesc", "Order management & basic access"),
        },
        {
            value: "manager",
            label: t("staff.memberTypeManager", "Manager"),
            description: !staffLoginLimit.allowed ? t("staff.limitReachedUpgrade", "Limit reached — upgrade plan") : t("staff.memberTypeManagerDesc", "Staff App access with manager role"),
        },
        {
            value: "agent",
            label: t("staff.memberTypeAgent", "Delivery Agent"),
            description: !agentLoginLimit.allowed ? t("staff.limitReachedUpgrade", "Limit reached — upgrade plan") : t("staff.memberTypeAgentDesc", "Pickup & delivery tracking"),
        },
        {
            value: "plant",
            label: t("staff.memberTypePlant", "Plant Operator"),
            description: !plantLoginLimit.allowed ? t("staff.limitReachedUpgrade", "Limit reached — upgrade plan") : t("staff.memberTypePlantDesc", "Processing & plant management"),
        },
    ];
    const { createStaff, updateStaff } = useStaffMutations();
    const [loading, setLoading] = useState(false);

    // Optional app-login creation (new staff only).
    const [createLogin, setCreateLogin] = useState(false);
    const [loginType, setLoginType] = useState<"staff" | "manager" | "agent" | "plant">("staff");
    const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
    const [createdName, setCreatedName] = useState("");

    const [form, setForm] = useState({
        name: "",
        phone: "",
        email: "",
        role: "staff" as StaffRole,
        payType: "monthly" as PayType,
        baseSalary: 15000,
        overtimeRate: 0,
        bankName: "",
        accountNumber: "",
        ifscCode: "",
    });

    useEffect(() => {
        if (!open) return;
        if (staff) {
            setForm({
                name: staff.name,
                phone: staff.phone,
                email: staff.email || "",
                role: staff.role,
                payType: staff.payType,
                baseSalary: staff.baseSalary,
                overtimeRate: staff.overtimeRate || 0,
                bankName: staff.bankDetails?.bankName || "",
                accountNumber: staff.bankDetails?.accountNumber || "",
                ifscCode: staff.bankDetails?.ifscCode || "",
            });
        } else {
            setForm({
                name: "",
                phone: "",
                email: "",
                role: "staff",
                payType: "monthly",
                baseSalary: 15000,
                overtimeRate: 0,
                bankName: "",
                accountNumber: "",
                ifscCode: "",
            });
        }
        // Reset the optional-login UI each time the sheet opens.
        setCreateLogin(false);
        setLoginType("staff");
        setCreatedInviteCode(null);
        setCreatedName("");
    }, [staff, open]);

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = async () => {
        const newErrors: Record<string, string> = {};
        if (!form.name.trim()) newErrors.name = t('common.required');
        if (!form.phone.trim() || form.phone.length !== 10) newErrors.phone = t('common.invalidPhone');

        // When creating an app login, email is required and the chosen login
        // type must be within its plan quota.
        const wantsLogin = !isEdit && createLogin;
        if (wantsLogin) {
            if (!form.email.trim()) {
                newErrors.email = t('staff.emailRequiredForLogin', 'Email is required to create an app login');
            }
            if (!loginLimitFor(loginType).allowed) {
                newErrors.loginType = t('validation.planLimitReached', 'Plan limit reached for this login type. Upgrade to add more.');
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        if (!isEdit && !rosterLimit.allowed) {
            alert(t('validation.planLimitReachedDesc', 'You have reached the roster limit. Upgrade plan to add more staff for attendance.'));
            return;
        }

        setLoading(true);
        setErrors({});
        try {
            const data: Record<string, any> = {
                name: form.name,
                phone: form.phone,
                role: wantsLogin ? roleForLogin(loginType) : form.role,
                payType: form.payType,
                baseSalary: form.baseSalary,
                joiningDate: staff?.joiningDate || Timestamp.now(),
                isActive: staff?.isActive ?? true,
            };

            if (form.email) data.email = form.email.trim().toLowerCase();
            if (form.overtimeRate > 0) data.overtimeRate = form.overtimeRate;
            if (form.bankName || form.accountNumber || form.ifscCode) {
                data.bankDetails = {
                    bankName: form.bankName || "",
                    accountNumber: form.accountNumber || "",
                    ifscCode: form.ifscCode || "",
                };
            }

            if (isEdit && staff) {
                await updateStaff(staff.id, data as any);
                if (onSubmit) onSubmit(data);
                onClose();
            } else {
                const { id: newStaffId } = await createStaff(data as any);

                // Optionally create the app login and link it to this roster row.
                if (wantsLogin) {
                    try {
                        const { inviteCode } = await createTeamMember({
                            email: form.email.trim().toLowerCase(),
                            memberType: memberTypeForLogin(loginType),
                            role: roleForLogin(loginType),
                            name: form.name,
                            staffId: newStaffId,
                        });
                        if (onSubmit) onSubmit(data);
                        // Show the invite code; the dialog stays open on a success view.
                        setCreatedName(form.name);
                        setCreatedInviteCode(inviteCode);
                        return;
                    } catch (err) {
                        const msg = err instanceof Error && err.message === "EMAIL_ALREADY_USED"
                            ? t('staff.emailAlreadyUsed', 'That email already has a login.')
                            : t('staff.loginCreateFailed', 'Staff added, but the login could not be created.');
                        setErrors({ email: msg });
                        return; // roster row is saved; let them retry the login or close
                    }
                }

                if (onSubmit) onSubmit(data);
                onClose();
            }
        } catch (error) {
            console.error("Error saving staff:", error);
        } finally {
            setLoading(false);
        }
    };

    // Success view — shows the invite code after a login was created.
    if (createdInviteCode) {
        const typeLabel = loginType === "agent"
            ? t("staff.memberTypeAgent", "Delivery Agent")
            : loginType === "plant"
                ? t("staff.memberTypePlant", "Plant Operator")
                : loginType === "manager"
                    ? t("staff.memberTypeManager", "Manager")
                    : t("staff.memberTypeStaff", "Staff App");
        return (
            <LResponsiveDialog open={open} onClose={onClose} title={t("staff.loginCreatedTitle", "App Login Created")} size="md">
                <div className="space-y-4 p-4 text-center">
                    <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div>
                        <p className="font-semibold text-foreground">{createdName}</p>
                        <p className="text-sm text-muted-foreground">{typeLabel} · {t("staff.loginCreated", "Login created")}</p>
                    </div>
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">{t("staff.inviteCode", "Invite Code")}</p>
                        <div className="flex items-center justify-between">
                            <span className="text-lg font-mono font-bold text-primary tracking-wider">{createdInviteCode}</span>
                            <button type="button" onClick={() => navigator.clipboard.writeText(createdInviteCode)} className="text-xs text-primary hover:underline">
                                {t("common.copy", "Copy")}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{t("staff.shareInviteCode", "Share this code so they can sign up and log in.")}</p>
                    </div>
                    <LButton variant="primary" size="lg" fullWidth onClick={onClose}>{t("common.done", "Done")}</LButton>
                </div>
            </LResponsiveDialog>
        );
    }

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={isEdit ? t("staff.editStaff", "Edit Staff") : t("staff.addStaff", "Add Staff")}
            size="md"
        >
            <div className="space-y-4 p-4">
                <LTextInput
                    label={t('staff.name', 'Name')}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t('staff.namePlaceholder', 'Staff member name')}
                    required
                    error={errors.name}
                    className="capitalize"
                />

                <LPhoneInput
                    label={t('staff.phoneNumber', 'Phone Number')}
                    value={form.phone}
                    onValueChange={(v) => setForm({ ...form, phone: v })}
                    required
                    error={errors.phone}
                />

                <LTextInput
                    label={createLogin ? t('staff.email', 'Email') : t('staff.emailOptional', 'Email (optional)')}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={t('staff.emailPlaceholder', 'staff@example.com')}
                    type="email"
                    required={createLogin}
                    error={errors.email}
                />

                {/* Optional app login — new staff only */}
                {!isEdit && (
                    <div className="rounded-xl border border-border p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-foreground">{t('staff.createLoginQuestion', 'Create app login for this person?')}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{t('staff.createLoginHint', 'Give them access to the Staff, Agent, or Plant app via an invite code.')}</p>
                            </div>
                            <LToggle checked={createLogin} onChange={setCreateLogin} />
                        </div>
                        {createLogin && (
                            <div>
                                <label className="text-sm font-medium text-foreground mb-2 block">{t('staff.loginType', 'Login type')}</label>
                                <LRadioGroup
                                    name="loginType"
                                    value={loginType}
                                    onChange={(v) => setLoginType(v as "staff" | "manager" | "agent" | "plant")}
                                    options={memberTypeOptions}
                                />
                                {errors.loginType && <p className="text-xs text-destructive mt-1">{errors.loginType}</p>}
                                <p className="text-xs text-muted-foreground mt-2">{t('staff.loginNeedsEmail', 'Email required above — the invite code is shown after you save.')}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Legacy: show invite code for existing staff with app access */}
                {isEdit && staff?.inviteCode && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                        <p className="text-sm text-muted-foreground mb-1">{t('staff.inviteCode')}</p>
                        <div className="flex items-center justify-between">
                            <span className="text-lg font-mono font-bold text-primary tracking-wider">
                                {staff.inviteCode}
                            </span>
                            <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(staff.inviteCode!)}
                                className="text-xs text-primary hover:underline"
                            >
                                {t('common.copy')}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {staff.inviteStatus === 'accepted'
                                ? t('staff.inviteAccepted')
                                : t('staff.invitePending')}
                        </p>
                    </div>
                )}

                <LDivider label={t('staff.paySection', 'Pay Details')} />

                        <div className="space-y-4">

                            <div>
                                <label className="text-sm font-medium text-foreground mb-2 block">
                                    {t('staff.payType', 'Pay Type')}
                                </label>
                                <LRadioGroup
                                    name="payType"
                                    value={form.payType}
                                    onChange={(v) => setForm({ ...form, payType: v as PayType })}
                                    options={payTypeOptions}
                                />
                            </div>
                        </div>

                        <LNumberInput
                            label={form.payType === "monthly" ? t('staff.monthlySalary') : t('staff.dailyWage')}
                            value={form.baseSalary}
                            onChange={(v) => setForm({ ...form, baseSalary: v })}
                            prefix={currencySymbol}
                            min={0}
                        />

                        <LNumberInput
                            label={t('staff.overtimeRate', 'Overtime Rate (per hour)')}
                            value={form.overtimeRate}
                            onChange={(v) => setForm({ ...form, overtimeRate: v })}
                            prefix={currencySymbol}
                            min={0}
                            placeholder={t('staff.overtimeRatePlaceholder', 'Leave 0 for auto-calculate')}
                        />
                        <p className="text-xs text-muted-foreground -mt-2">
                            {t('staff.overtimeRateDesc', 'If empty, overtime will be calculated at 1.5× the hourly rate')}
                        </p>

                        <LDivider label={t('staff.bankDetails', 'Bank Details (optional)')} />

                        <LTextInput
                            label={t('staff.bankName', 'Bank Name')}
                            value={form.bankName}
                            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                            placeholder={t('staff.bankNamePlaceholder', 'e.g., State Bank of India')}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <LTextInput
                                label={t('staff.accountNumber', 'Account Number')}
                                value={form.accountNumber}
                                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                                placeholder={t('staff.accountNumberPlaceholder', 'Account number')}
                            />

                            <LTextInput
                                label={t('staff.ifscCode', 'IFSC Code')}
                                value={form.ifscCode}
                                onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })}
                                placeholder={t('staff.ifscCodePlaceholder', 'SBIN0001234')}
                            />
                        </div>

                <LSpacer size="md" />

                <LButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleSubmit}
                    loading={loading}
                    disabled={loading} // Only disable while loading, let validation handle the rest to show errors
                >
                    {isEdit ? t("common.save") : t("staff.addStaff")}
                </LButton>
            </div>

        </LResponsiveDialog>
    );
}
