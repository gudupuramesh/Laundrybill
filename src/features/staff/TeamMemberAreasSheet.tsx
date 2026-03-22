/**
 * Team Member Areas Sheet
 *
 * Edit service areas for a Delivery Agent. Updates are reflected immediately
 * so the agent sees the correct orders in their Agent App.
 */

import { useState, useEffect } from "react";
import { LResponsiveDialog, LButton, LDivider } from "@/components/laundry";
import { useTeamMemberMutations } from "@/hooks/use-team-members";
import { useDeliverySettings } from "@/hooks/use-delivery-settings";
import type { TeamMember } from "@/types/staff";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

interface TeamMemberAreasSheetProps {
    open: boolean;
    onClose: () => void;
    teamMember: TeamMember | null;
    onSuccess?: () => void;
}

export function TeamMemberAreasSheet({ open, onClose, teamMember, onSuccess }: TeamMemberAreasSheetProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { updateTeamMember } = useTeamMemberMutations();
    const { settings: deliverySettings } = useDeliverySettings();

    const [serviceAreas, setServiceAreas] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && teamMember) {
            setServiceAreas(teamMember.serviceAreas || []);
            setError(null);
        }
    }, [open, teamMember]);

    const handleSave = async () => {
        if (!teamMember) return;
        setLoading(true);
        setError(null);
        try {
            await updateTeamMember(teamMember.id, { serviceAreas });
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error("Failed to update agent areas:", err);
            setError(t("common.errorGeneric", "Something went wrong. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    if (!teamMember) return null;

    return (
        <LResponsiveDialog
            open={open}
            onClose={onClose}
            title={t("staff.editAgentAreas", "Edit Agent Areas")}
            size="sm"
        >
            <div className="space-y-4 p-4">
                <p className="text-sm text-muted-foreground">
                    {t("staff.editAgentAreasDesc", "Update areas for {{name}}. Orders from these areas will appear in their Agent App.", {
                        name: teamMember.name || teamMember.email,
                    })}
                </p>

                {deliverySettings?.serviceAreas?.length > 0 ? (
                    <div>
                        <label className="text-sm font-medium mb-2 block">
                            {t("staff.serviceAreas", "Service Areas")}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {deliverySettings.serviceAreas
                                .filter((a) => a.isActive)
                                .map((area) => (
                                    <button
                                        key={area.value}
                                        type="button"
                                        onClick={() =>
                                            setServiceAreas(
                                                serviceAreas.includes(area.value)
                                                    ? serviceAreas.filter((a) => a !== area.value)
                                                    : [...serviceAreas, area.value]
                                            )
                                        }
                                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                                            serviceAreas.includes(area.value)
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-muted border-border hover:bg-muted/80"
                                        }`}
                                    >
                                        {area.value}
                                    </button>
                                ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {serviceAreas.length === 0
                                ? t("staff.noAreasSelected", "No areas selected. Agent will see all orders.")
                                : t("staff.areasSelectedCount", "{{count}} areas selected", { count: serviceAreas.length })}
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {t("staff.noServiceAreasConfigured", "No service areas configured.")}{" "}
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                navigate("/inventory?tab=service-areas");
                            }}
                            className="text-primary underline hover:no-underline"
                        >
                            {t("staff.configureServiceAreas", "Configure in settings")}
                        </button>
                    </p>
                )}

                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}

                <LDivider />

                <div className="flex gap-2">
                    <LButton variant="ghost" onClick={onClose} className="flex-1">
                        {t("common.cancel")}
                    </LButton>
                    <LButton
                        variant="primary"
                        onClick={handleSave}
                        loading={loading}
                        disabled={loading || !deliverySettings?.serviceAreas?.length}
                        className="flex-1"
                    >
                        {t("common.save")}
                    </LButton>
                </div>
            </div>
        </LResponsiveDialog>
    );
}
