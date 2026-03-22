/**
 * Team Member Form Sheet
 *
 * Create app logins (Staff App, Agent App, Plant) - email + invite code.
 * Plan limits (maxStaff, maxDeliveryAgents, maxPlantStaff) apply.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    LResponsiveDialog,
    LTextInput,
    LButton,
    LDivider,
    LRadioGroup,
    LSelect,
} from "@/components/laundry";
import { useTeamMemberMutations, useTeamMembers } from "@/hooks/use-team-members";
import { useStaff } from "@/hooks/use-staff";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useDeliverySettings } from "@/hooks/use-delivery-settings";
import type { MemberType, VehicleType } from "@/types/staff";
import { useTranslation } from "react-i18next";

interface TeamMemberFormSheetProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function TeamMemberFormSheet({ open, onClose, onSuccess }: TeamMemberFormSheetProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { createTeamMember } = useTeamMemberMutations();
    const { teamMembers } = useTeamMembers();
    const { staff } = useStaff();
    const { checkLimit } = useShopLimits();
    const { settings: deliverySettings } = useDeliverySettings();

    const staffCount = teamMembers.filter((t) => t.memberType === "staff").length;
    const agentCount = teamMembers.filter((t) => t.memberType === "agent").length;
    const plantCount = teamMembers.filter((t) => t.memberType === "plant").length;

    const staffLimit = checkLimit("maxStaff", staffCount);
    const agentLimit = checkLimit("maxDeliveryAgents", agentCount);
    const plantLimit = checkLimit("maxPlantStaff", plantCount);

    const memberTypeOptions = [
        {
            value: "staff",
            label: t("staff.memberTypeStaff", "Staff App"),
            description: !staffLimit.allowed ? t("staff.limitReachedUpgrade") : t("staff.memberTypeStaffDesc"),
            disabled: !staffLimit.allowed,
        },
        {
            value: "agent",
            label: t("staff.memberTypeAgent", "Delivery Agent"),
            description: !agentLimit.allowed ? t("staff.limitReachedUpgrade") : t("staff.memberTypeAgentDesc"),
            disabled: !agentLimit.allowed,
        },
        {
            value: "plant",
            label: t("staff.memberTypePlant", "Plant Operator"),
            description: !plantLimit.allowed ? t("staff.limitReachedUpgrade") : t("staff.memberTypePlantDesc"),
            disabled: !plantLimit.allowed,
        },
    ].filter((opt) => {
        if (opt.value === "agent") return agentLimit.limit !== 0;
        if (opt.value === "plant") return plantLimit.limit !== 0;
        return true;
    });

    const [form, setForm] = useState({
        email: "",
        memberType: "staff" as MemberType,
        name: "",
        staffId: "",
        vehicleType: "bike" as VehicleType,
        vehicleNumber: "",
        serviceAreas: [] as string[],
    });

    const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) {
            const defaultType: MemberType =
                staffLimit.allowed ? "staff" : agentLimit.allowed ? "agent" : plantLimit.allowed ? "plant" : "staff";
            setForm({
                email: "",
                memberType: defaultType,
                name: "",
                staffId: "",
                vehicleType: "bike",
                vehicleNumber: "",
                serviceAreas: [],
            });
            setCreatedInviteCode(null);
        }
    }, [open]);

    const handleSubmit = async () => {
        const newErrors: Record<string, string> = {};
        const emailTrim = form.email.trim();
        if (!emailTrim) newErrors.email = t("common.required");
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) newErrors.email = t("common.invalidEmail", "Invalid email");
        else if (teamMembers.some((tm) => tm.email.toLowerCase() === emailTrim.toLowerCase())) {
            newErrors.email = t("staff.emailAlreadyUsed", "This email is already registered for an app login.");
        } else if (staff.some((s) => s.email?.toLowerCase() === emailTrim.toLowerCase())) {
            newErrors.email = t("staff.emailAlreadyUsed", "This email is already registered for an app login.");
        }

        const limit = form.memberType === "agent" ? agentLimit : form.memberType === "plant" ? plantLimit : staffLimit;
        if (!limit.allowed) {
            newErrors.memberType = t("validation.planLimitReached");
        }

        if (form.memberType === "agent") {
            if (!form.vehicleNumber?.trim()) newErrors.vehicleNumber = t("common.required");
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLoading(true);
        setErrors({});
        try {
            const result = await createTeamMember({
                email: emailTrim.toLowerCase(),
                memberType: form.memberType,
                name: form.name || undefined,
                staffId: form.staffId || undefined,
                vehicle:
                    form.memberType === "agent" && form.vehicleNumber
                        ? { type: form.vehicleType, number: form.vehicleNumber }
                        : undefined,
                serviceAreas: form.memberType === "agent" && form.serviceAreas.length > 0 ? form.serviceAreas : undefined,
            });
            setCreatedInviteCode(result.inviteCode);
        } catch (err: unknown) {
            console.error("Create team member failed:", err);

            // Map known duplicate-email error to a clear UI message on the email field as well.
            if (err instanceof Error && err.message === "EMAIL_ALREADY_USED") {
                const msg = t(
                    "staff.emailAlreadyUsed",
                    "This email address is already used. Please try another email."
                );
                setErrors({ email: msg, submit: msg });
            } else {
                setErrors({
                    submit: t("staff.createFailedGeneric", "Failed to create app login. Please try again."),
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const rosterOptions = staff
        .filter((s) => s.isActive)
        .map((s) => ({ value: s.id, label: `${s.name} (${s.phone})` }));

    return (
        <LResponsiveDialog open={open} onClose={onClose} title={t("staff.addAppLogin", "Add App Login")} size="md">
            <div className="space-y-4 p-4">
                {createdInviteCode ? (
                    <div className="space-y-4">
                        <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-center">{t("staff.appLoginCreated")}</h3>
                        <p className="text-sm text-muted-foreground text-center">
                            {t("staff.shareInviteCode", { name: form.name || form.email })}
                        </p>
                        <div className="bg-primary/5 border-2 border-primary/30 rounded-xl p-4 text-center">
                            <p className="text-xs text-muted-foreground mb-1">{t("staff.inviteCode")}</p>
                            <p className="text-xl font-mono font-bold text-primary tracking-wider">{createdInviteCode}</p>
                        </div>
                        <div className="flex gap-2">
                            <LButton
                                variant="outline"
                                className="flex-1"
                                onClick={() => navigator.clipboard.writeText(createdInviteCode)}
                            >
                                {t("common.copy")}
                            </LButton>
                            <LButton
                                variant="primary"
                                className="flex-1"
                                onClick={() => {
                                    const msg = t("staff.whatsappInviteMessage", {
                                        name: form.name || form.email,
                                        code: createdInviteCode,
                                        link: `${window.location.origin}/${form.memberType === "agent" ? "driver" : form.memberType === "plant" ? "plant" : "staff"}/signup`,
                                    });
                                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
                                }}
                            >
                                WhatsApp
                            </LButton>
                        </div>
                        <LButton variant="ghost" fullWidth onClick={() => { setCreatedInviteCode(null); onSuccess?.(); onClose(); }}>
                            {t("common.done")}
                        </LButton>
                    </div>
                ) : (
                    <>
                        {/* Global submit error (e.g. duplicate email from server) */}
                        {errors.submit && (
                            <div className="bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm font-medium border border-red-100">
                                {errors.submit}
                            </div>
                        )}

                        <LTextInput
                            label={t("staff.emailRequired", "Email (required)")}
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="user@example.com"
                            type="email"
                            required
                            error={errors.email}
                            hint={t("staff.emailRequiredHint", "Required for app login. Use a working email so they can receive the invite and password reset links.")}
                        />
                        <LTextInput
                            label={t("staff.name", "Name")}
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder={t("staff.namePlaceholder")}
                            hint={t("common.optional")}
                        />

                        <LDivider label={t("staff.memberTypeLabel")} />
                        <LRadioGroup
                            name="memberType"
                            value={form.memberType}
                            onChange={(v) => setForm({ ...form, memberType: v as MemberType })}
                            options={memberTypeOptions}
                        />

                        {form.memberType === "agent" && (
                            <>
                                <LDivider label={t("staff.vehicleInfo")} />
                                <div className="grid grid-cols-2 gap-4">
                                    <LSelect
                                        label={t("staff.vehicleType")}
                                        value={form.vehicleType}
                                        onChange={(v) => setForm({ ...form, vehicleType: v as VehicleType })}
                                        options={[
                                            { value: "bike", label: t("staff.vehicleBike") },
                                            { value: "scooter", label: t("staff.vehicleScooter") },
                                            { value: "car", label: t("staff.vehicleCar") },
                                            { value: "van", label: t("staff.vehicleVan") },
                                        ]}
                                    />
                                    <LTextInput
                                        label={t("staff.vehicleNumber")}
                                        value={form.vehicleNumber}
                                        onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value.toUpperCase() })}
                                        placeholder="KA-01-AB-1234"
                                        error={errors.vehicleNumber}
                                    />
                                </div>

                                {/* Assign Service Areas - always show for agents */}
                                <LDivider label={t("staff.assignAreas", "Assign Service Areas")} />
                                {deliverySettings?.serviceAreas?.length > 0 ? (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-2">
                                            {t("staff.assignAreasHint", "Select areas this agent will serve (optional)")}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {deliverySettings.serviceAreas
                                                .filter((a) => a.isActive)
                                                .map((area) => (
                                                    <button
                                                        key={area.value}
                                                        type="button"
                                                        onClick={() =>
                                                            setForm({
                                                                ...form,
                                                                serviceAreas: form.serviceAreas.includes(area.value)
                                                                    ? form.serviceAreas.filter((a) => a !== area.value)
                                                                    : [...form.serviceAreas, area.value],
                                                            })
                                                        }
                                                        className={`px-3 py-1 rounded-full text-sm border ${
                                                            form.serviceAreas.includes(area.value)
                                                                ? "bg-primary text-primary-foreground border-primary"
                                                                : "bg-muted border-border"
                                                        }`}
                                                    >
                                                        {area.value}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        {t("staff.noServiceAreasConfigured", "No service areas configured.")}{" "}
                                        <button
                                            type="button"
                                            onClick={() => navigate("/inventory?tab=service-areas")}
                                            className="text-primary underline hover:no-underline"
                                        >
                                            {t("staff.configureServiceAreas", "Configure in settings")}
                                        </button>
                                    </p>
                                )}
                            </>
                        )}

                        <LDivider />
                        <div>
                            <label className="text-sm font-medium mb-2 block">{t("staff.linkToRoster", "Link to Roster (optional)")}</label>
                            <LSelect
                                value={form.staffId}
                                onChange={(v) => setForm({ ...form, staffId: v })}
                                options={[{ value: "", label: t("common.none", "None") }, ...rosterOptions]}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {t("staff.linkToRosterDesc", "Link if this login is for an existing roster member")}
                            </p>
                        </div>

                        <LButton variant="primary" size="lg" fullWidth onClick={handleSubmit} loading={loading} disabled={loading}>
                            {t("staff.createAppLogin", "Create & Get Invite Code")}
                        </LButton>
                    </>
                )}
            </div>
        </LResponsiveDialog>
    );
}
