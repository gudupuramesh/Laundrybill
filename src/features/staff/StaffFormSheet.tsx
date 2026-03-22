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
} from "@/components/laundry";
import { useStaffMutations, useStaff } from "@/hooks/use-staff";
import { useCurrency } from "@/hooks/use-currency";
import { useShopLimits } from "@/hooks/use-shop-limits";
import type { Staff, StaffRole, PayType } from "@/types/staff";
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

    // Roster limit (attendance/payroll - all plans)
    const rosterCount = activeStaff.length;
    const rosterLimit = checkLimit("maxRoster", rosterCount);

    const payTypeOptions = [
        { value: "monthly", label: t('staff.monthlySalary', 'Monthly Salary'), description: t('staff.monthlySalaryDesc', 'Fixed monthly payment') },
        { value: "daily", label: t('staff.dailyWage', 'Daily Wage'), description: t('staff.dailyWageDesc', 'Daily rate payment') },
    ];
    const { createStaff, updateStaff } = useStaffMutations();
    const [loading, setLoading] = useState(false);

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
    }, [staff, open]);

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = async () => {
        const newErrors: Record<string, string> = {};
        if (!form.name.trim()) newErrors.name = t('common.required');
        if (!form.phone.trim() || form.phone.length !== 10) newErrors.phone = t('common.invalidPhone');

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
                role: form.role,
                payType: form.payType,
                baseSalary: form.baseSalary,
                joiningDate: staff?.joiningDate || Timestamp.now(),
                isActive: staff?.isActive ?? true,
            };

            if (form.email) data.email = form.email;
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
                await createStaff(data as any);
                if (onSubmit) onSubmit(data);
                onClose();
            }
        } catch (error) {
            console.error("Error saving staff:", error);
        } finally {
            setLoading(false);
        }
    };

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
                    label={t('staff.emailOptional', 'Email (optional)')}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={t('staff.emailPlaceholder', 'staff@example.com')}
                    type="email"
                />

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
