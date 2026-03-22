/**
 * Team Member Detail Panel
 *
 * Shows full details for an App Login (Staff/Agent/Plant) with
 * enable/disable toggle for agents and edit areas.
 */

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
    LCard,
    LButton,
    LAvatar,
    LBadge,
    LSpinner,
    LToggle,
    LPhoneInput,
    useLToast,
} from "@/components/laundry";
import { useTeamMembers, useTeamMemberMutations } from "@/hooks/use-team-members";
import { TeamMemberAreasSheet } from "./TeamMemberAreasSheet";
import {
    ArrowLeft,
    Copy,
    MessageCircle,
    MapPin,
    Truck,
    Check,
    Power,
    Phone,
    Pencil,
    KeyRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const VEHICLE_LABELS: Record<string, string> = {
    bike: "Bike",
    scooter: "Scooter",
    car: "Car",
    van: "Van",
};

interface TeamMemberDetailPanelProps {
    teamMemberId: string;
    onClose?: () => void;
}

export function TeamMemberDetailPanel({ teamMemberId, onClose }: TeamMemberDetailPanelProps) {
    const { t } = useTranslation();
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

    const teamMember = teamMembers.find((tm) => tm.id === teamMemberId);

    const handleCopyInvite = () => {
        if (!teamMember) return;
        const text = `${teamMember.name || teamMember.email}\nEmail: ${teamMember.email}\nInvite Code: ${teamMember.inviteCode}`;
        navigator.clipboard.writeText(text);
    };

    const handleSendPasswordReset = async () => {
        if (!teamMember?.email || teamMember.inviteStatus !== "accepted") return;
        setSendingReset(true);
        try {
            await sendPasswordResetEmail(auth, teamMember.email.trim());
            addToast({
                type: "success",
                title: t("staff.passwordResetSent", "Reset email sent"),
                description: t("staff.passwordResetSentDesc", "They will receive a link to reset their password at {{email}}", { email: teamMember.email }),
            });
        } catch (err: any) {
            addToast({
                type: "error",
                title: t("staff.passwordResetFailed", "Could not send reset email"),
                description: err.message || (err.code === "auth/user-not-found" ? t("auth.noUserForEmail", "No account found with this email") : ""),
            });
        } finally {
            setSendingReset(false);
        }
    };

    const handleWhatsAppShare = () => {
        if (!teamMember) return;
        const link = `${window.location.origin}/${teamMember.memberType === "agent" ? "driver" : teamMember.memberType === "plant" ? "plant" : "staff"}/signup`;
        const msg = t("staff.whatsappInviteMessage", {
            name: teamMember.name || teamMember.email,
            code: teamMember.inviteCode,
            link,
        });
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    };

    const handleToggleActive = async (checked: boolean) => {
        if (!teamMember || teamMember.memberType !== "agent") return;
        setToggling(true);
        try {
            await updateTeamMember(teamMember.id, { isActive: checked });
        } catch (err) {
            console.error("Failed to toggle agent:", err);
        } finally {
            setToggling(false);
        }
    };

    const handleToggleOnline = async (checked: boolean) => {
        if (!teamMember || teamMember.memberType !== "agent") return;
        setTogglingOnline(true);
        try {
            await updateTeamMember(teamMember.id, { isOnline: checked });
        } catch (err) {
            console.error("Failed to set agent online status:", err);
        } finally {
            setTogglingOnline(false);
        }
    };

    const startEditPhone = () => {
        setPhoneValue(teamMember?.phone || "");
        setEditingPhone(true);
    };

    const cancelEditPhone = () => {
        setEditingPhone(false);
        setPhoneValue("");
    };

    const savePhone = async () => {
        if (!teamMember) return;
        setSavingPhone(true);
        try {
            await updateTeamMember(teamMember.id, { phone: phoneValue.trim() || undefined });
            setEditingPhone(false);
            setPhoneValue("");
        } catch (err) {
            console.error("Failed to update agent phone:", err);
        } finally {
            setSavingPhone(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <LSpinner size="lg" />
            </div>
        );
    }

    if (!teamMember) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
                <p className="text-lg font-medium">{t("staff.notFound")}</p>
                <LButton variant="ghost" className="mt-4" onClick={onClose}>
                    {t("common.goBack")}
                </LButton>
            </div>
        );
    }

    const isAgent = teamMember.memberType === "agent";
    const isActive = teamMember.isActive !== false;

    return (
        <div className="h-full flex flex-col overflow-y-auto min-w-0">
            {/* Header */}
            <div className="p-4 border-b border-border bg-card min-w-0">
                <div className="flex items-center gap-3 mb-4">
                    {onClose && (
                        <LButton variant="ghost" size="icon" onClick={onClose}>
                            <ArrowLeft className="h-5 w-5" />
                        </LButton>
                    )}
                    <h2 className="text-lg font-semibold text-foreground">{t("staff.appLoginDetails", "App Login Details")}</h2>
                </div>

                <div className="flex items-center gap-4">
                    <LAvatar name={teamMember.name || teamMember.email} size="xl" />
                    <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-semibold text-foreground truncate">
                            {teamMember.name || teamMember.email}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">{teamMember.email}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <LBadge
                                variant={
                                    teamMember.memberType === "agent"
                                        ? "success"
                                        : teamMember.memberType === "plant"
                                        ? "secondary"
                                        : "outline"
                                }
                            >
                                {teamMember.memberType === "staff"
                                    ? t("staff.memberTypeStaff", "Staff App")
                                    : teamMember.memberType === "agent"
                                    ? t("staff.memberTypeAgent", "Delivery Agent")
                                    : t("staff.memberTypePlant", "Plant Operator")}
                            </LBadge>
                            {teamMember.inviteStatus === "accepted" && (
                                <LBadge variant="success">
                                    <Check className="h-3 w-3 mr-1" />
                                    {t("staff.inviteAccepted", "Active")}
                                </LBadge>
                            )}
                            {isAgent && (
                                <span
                                    className={cn(
                                        "inline-flex items-center gap-1.5 text-sm font-medium",
                                        teamMember.isOnline ? "text-success" : "text-muted-foreground"
                                    )}
                                    title={t("staff.availabilityHint", "Agent opens the app and taps 'Go Online' to appear available")}
                                >
                                    <span
                                        className={cn(
                                            "w-2 h-2 rounded-full shrink-0",
                                            teamMember.isOnline ? "bg-success animate-pulse" : "bg-muted-foreground"
                                        )}
                                    />
                                    {teamMember.isOnline ? t("staff.online", "Online") : t("staff.availabilityAway", "Away")}
                                </span>
                            )}
                            {isAgent && !isActive && (
                                <LBadge variant="destructive">{t("staff.disabled", "Disabled")}</LBadge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Invite code + actions */}
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">{t("staff.inviteCode")}</p>
                    <p className="text-lg font-mono font-semibold text-primary break-all">{teamMember.inviteCode}</p>
                    <div className="flex flex-wrap gap-2 mt-2 min-w-0">
                        <LButton variant="outline" size="sm" leftIcon={<Copy className="h-4 w-4 shrink-0" />} onClick={handleCopyInvite} className="shrink-0">
                            {t("common.copy")}
                        </LButton>
                        <LButton variant="outline" size="sm" leftIcon={<MessageCircle className="h-4 w-4 shrink-0" />} onClick={handleWhatsAppShare} className="shrink-0">
                            WhatsApp
                        </LButton>
                        {teamMember.inviteStatus === "accepted" && teamMember.email && (
                            <LButton
                                variant="outline"
                                size="sm"
                                leftIcon={<KeyRound className="h-4 w-4 shrink-0" />}
                                onClick={handleSendPasswordReset}
                                disabled={sendingReset}
                                className="shrink-0"
                            >
                                {sendingReset ? t("common.sending", "Sending...") : t("staff.sendPasswordReset", "Send password reset")}
                            </LButton>
                        )}
                    </div>
                </div>
            </div>

            {/* Details */}
            <div className="flex-1 p-4 space-y-4">
                {/* Contact Number - Agents only (shown on order tracking & order details) */}
                {isAgent && (
                    <LCard variant="outlined" padding="md">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                {t("staff.contactNumber", "Contact Number")}
                            </h4>
                            {!editingPhone ? (
                                <LButton variant="outline" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={startEditPhone}>
                                    {teamMember.phone ? t("common.edit", "Edit") : t("staff.addContact", "Add")}
                                </LButton>
                            ) : null}
                        </div>
                        {editingPhone ? (
                            <div className="space-y-2">
                                <LPhoneInput
                                    value={phoneValue}
                                    onValueChange={setPhoneValue}
                                    helperText={t("staff.contactNumberHint", "Shown on order tracking so customers can call or WhatsApp the agent.")}
                                />
                                <div className="flex gap-2">
                                    <LButton variant="primary" size="sm" onClick={savePhone} disabled={savingPhone}>
                                        {savingPhone ? t("common.saving", "Saving...") : t("common.save", "Save")}
                                    </LButton>
                                    <LButton variant="outline" size="sm" onClick={cancelEditPhone} disabled={savingPhone}>
                                        {t("common.cancel", "Cancel")}
                                    </LButton>
                                </div>
                            </div>
                        ) : (
                            <p className={cn("text-sm", teamMember.phone ? "text-foreground" : "text-muted-foreground")}>
                                {teamMember.phone || t("staff.noContactSet", "No contact number set. Customers won’t see a number for this agent on tracking.")}
                            </p>
                        )}
                    </LCard>
                )}

                {/* Enable/Disable - Agents only */}
                {isAgent && (
                    <LCard variant="outlined" padding="md">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div
                                    className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                        isActive ? "bg-success/10" : "bg-muted"
                                    )}
                                >
                                    <Power className={cn("h-5 w-5", isActive ? "text-success" : "text-muted-foreground")} />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium text-foreground">{t("staff.enableAgent", "Enable for Orders")}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {t(
                                            "staff.enableAgentDesc",
                                            "When enabled, this agent appears in New Order and can receive delivery assignments."
                                        )}
                                    </p>
                                </div>
                            </div>
                            <LToggle
                                checked={isActive}
                                onChange={handleToggleActive}
                                disabled={toggling}
                                className="shrink-0"
                            />
                        </div>
                        {isActive && !teamMember.isOnline && (
                            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                                {t("staff.awayNote", "Agent is 'Away' until they open the Agent App and tap 'Go Online'.")}
                            </p>
                        )}
                    </LCard>
                )}

                {/* Set Online - Owner control (Agents only) */}
                {isAgent && (
                    <LCard variant="outlined" padding="md">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div
                                    className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                        teamMember.isOnline ? "bg-success/10" : "bg-muted"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "w-3 h-3 rounded-full",
                                            teamMember.isOnline ? "bg-success animate-pulse" : "bg-muted-foreground"
                                        )}
                                    />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium text-foreground">{t("staff.setAgentOnline", "Set Agent Online")}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {t(
                                            "staff.setAgentOnlineDesc",
                                            "You control agent availability. When on, agent receives tasks. Agent app will update immediately."
                                        )}
                                    </p>
                                </div>
                            </div>
                            <LToggle
                                checked={teamMember.isOnline ?? false}
                                onChange={handleToggleOnline}
                                disabled={togglingOnline || !isActive}
                                className="shrink-0"
                            />
                        </div>
                    </LCard>
                )}

                {/* Service Areas - Agents only */}
                {isAgent && (
                    <LCard variant="outlined" padding="md">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                {t("staff.serviceAreas", "Service Areas")}
                            </h4>
                            <LButton variant="outline" size="sm" onClick={() => setAreasSheetOpen(true)}>
                                {t("staff.editAreas", "Edit")}
                            </LButton>
                        </div>
                        {teamMember.serviceAreas && teamMember.serviceAreas.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {teamMember.serviceAreas.map((area) => (
                                    <LBadge key={area} variant="outline" size="sm">
                                        {area}
                                    </LBadge>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">{t("staff.noAreasSelected", "No areas assigned. Agent will see all orders.")}</p>
                        )}
                    </LCard>
                )}

                {/* Vehicle - Agents only */}
                {isAgent && teamMember.vehicle && (
                    <LCard variant="outlined" padding="md">
                        <h4 className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                            <Truck className="h-4 w-4" />
                            {t("staff.vehicle", "Vehicle")}
                        </h4>
                        <p className="text-sm text-foreground">
                            {VEHICLE_LABELS[teamMember.vehicle.type] || teamMember.vehicle.type}
                            {teamMember.vehicle.number && ` • ${teamMember.vehicle.number}`}
                        </p>
                    </LCard>
                )}
            </div>

            <TeamMemberAreasSheet
                open={areasSheetOpen}
                onClose={() => setAreasSheetOpen(false)}
                teamMember={teamMember}
            />
        </div>
    );
}
