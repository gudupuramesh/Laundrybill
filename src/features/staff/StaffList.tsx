/**
 * Staff List Component
 * 
 * Used within master-detail layout
 * Displays searchable list of staff members
 */

import { useState, useEffect } from "react";
import {
    LSearchInput,
    LList,
    LListItem,
    LAvatar,
    LBadge,
    LAmount,
    LEmptyState,
    LSkeletonList,
    LButton,
    LToggle,
    LAdSlot,
    LSegmentedControl,
    LCard,
    LHelpButton,
} from "@/components/laundry";
import { useStaff } from "@/hooks/use-staff";
import { useTeamMembers } from "@/hooks/use-team-members";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useIsMobile } from "@/hooks/use-mobile";
import { StaffFormSheet } from "./StaffFormSheet";
import { TeamMemberFormSheet } from "./TeamMemberFormSheet";
import { TeamMemberAreasSheet } from "./TeamMemberAreasSheet";
import { Users, UserPlus, Shield, Smartphone, Copy, MessageCircle, Check, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import type { TeamMember } from "@/types/staff";

const AD_FREQUENCY = 8; // Show ad every 8 staff on mobile

interface StaffListProps {
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    onTabChange?: () => void;
}

export function StaffList({ selectedId, onSelect, onTabChange }: StaffListProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [formSheetOpen, setFormSheetOpen] = useState(false);
    const [teamMemberSheetOpen, setTeamMemberSheetOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"roster" | "appLogins">("roster");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [editingAreasFor, setEditingAreasFor] = useState<TeamMember | null>(null);

    const { staff: staffList, activeStaff, loading } = useStaff();
    const { teamMembers, staffCount: appStaffCount, agentCount: appAgentCount, plantCount: appPlantCount, loading: teamMembersLoading } = useTeamMembers();
    const { checkLimit } = useShopLimits();

    const rosterLimit = checkLimit("maxRoster", activeStaff.length);
    const appStaffLimit = checkLimit("maxStaff", appStaffCount);
    const appAgentLimit = checkLimit("maxDeliveryAgents", appAgentCount);
    const appPlantLimit = checkLimit("maxPlantStaff", appPlantCount);
    const isRosterAddAllowed = rosterLimit.allowed;

    // Auto-open sheet if ?new=true
    useEffect(() => {
        if (searchParams.get("new") === "true") {
            setFormSheetOpen(true);
            // Optional: Clean up URL
            setSearchParams(params => {
                params.delete("new");
                return params;
            });
        }
    }, [searchParams, setSearchParams]);

    // Filter based on search and inactive toggle
    const displayStaff = showInactive ? staffList : activeStaff;
    const filteredStaff = displayStaff.filter((staff) =>
        staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.phone.includes(searchQuery)
    );


    const handleStaffClick = (staffId: string) => {
        if (onSelect) {
            onSelect(staffId);
        }
    };

    const handleCopyInvite = (tm: { id: string; email: string; inviteCode: string; name?: string }) => {
        const text = `${tm.name || tm.email}\nEmail: ${tm.email}\nInvite Code: ${tm.inviteCode}`;
        navigator.clipboard.writeText(text);
        setCopiedId(tm.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleWhatsAppShare = (tm: { email: string; inviteCode: string; name?: string; memberType: string }) => {
        const link = `${window.location.origin}/${tm.memberType === "agent" ? "driver" : tm.memberType === "plant" ? "plant" : "staff"}/signup`;
        const msg = t("staff.whatsappInviteMessage", {
            name: tm.name || tm.email,
            code: tm.inviteCode,
            link,
        });
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    };

    const filteredTeamMembers = teamMembers.filter(
        (tm) =>
            tm.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (tm.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            tm.inviteCode.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-card p-4 space-y-4 border-b border-border">
                {/* Title + Add Button */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-foreground">{t('staff.title')}</h1>
                        <LHelpButton size="icon" />
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="flex gap-2">
                            <LButton
                                variant="primary"
                                size="sm"
                                leftIcon={<UserPlus className="h-4 w-4" />}
                                onClick={() => {
                                    if (isRosterAddAllowed) setFormSheetOpen(true);
                                    else alert(t('staff.rosterLimitReached', 'Roster limit reached. Upgrade to add more.'));
                                }}
                                disabled={!isRosterAddAllowed}
                            >
                                {t('staff.addStaff')}
                            </LButton>
                            <LButton
                                variant="outline"
                                size="sm"
                                leftIcon={<Smartphone className="h-4 w-4" />}
                                onClick={() => setTeamMemberSheetOpen(true)}
                            >
                                {t('staff.addAppLogin', 'Add App Login')}
                            </LButton>
                        </div>
                        {/* debug info - optional, remove later */}
                        {/* <span className="text-[9px] text-muted-foreground">
                            S:{staffCount}/{staffLimit.limit} A:{agentCount}/{agentLimit.limit}
                        </span> */}
                    </div>
                </div>

                {/* Search */}
                <LSearchInput
                    placeholder={t('common.search')}
                    onChange={setSearchQuery}
                />

                {/* Usage Stats: Roster + App Logins */}
                <div className="flex flex-wrap gap-2 text-xs">
                    <div className={cn(
                        "px-2 py-1 rounded bg-muted/50 border",
                        !rosterLimit.allowed && "bg-destructive/10 border-destructive/20 text-destructive"
                    )}>
                        <span className="font-medium">{t('staff.limitRoster', 'Roster')}: </span>
                        {activeStaff.length}/{rosterLimit.limit < 0 ? '∞' : rosterLimit.limit}
                    </div>
                    {(appStaffLimit.limit !== 0 || appStaffCount > 0) && (
                        <div className={cn(
                            "px-2 py-1 rounded bg-muted/50 border",
                            !appStaffLimit.allowed && "bg-destructive/10 border-destructive/20 text-destructive"
                        )}>
                            <span className="font-medium">{t('staff.limitStaff', 'Staff App')}: </span>
                            {appStaffCount}/{appStaffLimit.limit < 0 ? '∞' : appStaffLimit.limit}
                        </div>
                    )}
                    {(appAgentLimit.limit !== 0 || appAgentCount > 0) && (
                        <div className={cn(
                            "px-2 py-1 rounded bg-muted/50 border",
                            !appAgentLimit.allowed && "bg-destructive/10 border-destructive/20 text-destructive"
                        )}>
                            <span className="font-medium">{t('staff.limitAgents', 'Agents')}: </span>
                            {appAgentCount}/{appAgentLimit.limit < 0 ? '∞' : appAgentLimit.limit}
                        </div>
                    )}
                    {(appPlantLimit.limit !== 0 || appPlantCount > 0) && (
                        <div className={cn(
                            "px-2 py-1 rounded bg-muted/50 border",
                            !appPlantLimit.allowed && "bg-destructive/10 border-destructive/20 text-destructive"
                        )}>
                            <span className="font-medium">{t('staff.limitPlant', 'Plant')}: </span>
                            {appPlantCount}/{appPlantLimit.limit < 0 ? '∞' : appPlantLimit.limit}
                        </div>
                    )}
                </div>

                {/* Roster / App Logins Tabs */}
                <LSegmentedControl
                    options={[
                        { id: "roster", label: t("staff.tabRoster", "Roster") },
                        { id: "appLogins", label: t("staff.tabAppLogins", "App Logins") },
                    ]}
                    value={activeTab}
                    onChange={(v) => {
                        setActiveTab(v as "roster" | "appLogins");
                        onTabChange?.();
                    }}
                    fullWidth
                />

                {/* Show Inactive Toggle - only for Roster */}
                {activeTab === "roster" && (
                    <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-muted-foreground">{t('staff.showInactive')}</span>
                        <LToggle
                            checked={showInactive}
                            onChange={setShowInactive}
                            size="sm"
                        />
                    </div>
                )}
            </div>

            {/* Content: Roster or App Logins */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-w-0">
                {activeTab === "appLogins" ? (
                    /* App Logins List */
                    teamMembersLoading ? (
                        <LSkeletonList count={4} />
                    ) : teamMembers.length === 0 ? (
                        <LEmptyState
                            icon={<Smartphone className="h-8 w-8" />}
                            title={t("staff.noAppLogins", "No App Logins")}
                            description={t("staff.noAppLoginsDesc", "Create app logins for Staff App, Agents, or Plant operators. They'll receive an email and invite code to sign up.")}
                            action={{
                                label: t("staff.addAppLogin", "Add App Login"),
                                onClick: () => setTeamMemberSheetOpen(true),
                            }}
                        />
                    ) : (
                        <div className="space-y-3 min-w-0">
                            {filteredTeamMembers.map((tm) => (
                                <LCard
                                    key={tm.id}
                                    className={cn(
                                        "p-4 cursor-pointer transition-all hover:shadow-md min-w-0 overflow-hidden",
                                        selectedId === tm.id && "ring-2 ring-primary ring-offset-2"
                                    )}
                                    onClick={() => onSelect?.(tm.id)}
                                >
                                    <div className="flex flex-col gap-3 min-w-0">
                                        {/* Row 1: Avatar, name, badges */}
                                        <div className="flex items-start gap-4">
                                            <LAvatar name={tm.name || tm.email} size="lg" className="shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-base text-foreground">
                                                        {tm.name || tm.email}
                                                    </span>
                                                    <LBadge
                                                        variant={
                                                            tm.memberType === "agent"
                                                                ? "success"
                                                                : tm.memberType === "plant"
                                                                ? "secondary"
                                                                : "outline"
                                                        }
                                                        size="sm"
                                                    >
                                                        {tm.memberType === "staff"
                                                            ? t("staff.memberTypeStaff", "Staff App")
                                                            : tm.memberType === "agent"
                                                            ? t("staff.memberTypeAgent", "Delivery Agent")
                                                            : t("staff.memberTypePlant", "Plant Operator")}
                                                    </LBadge>
                                                    {tm.inviteStatus === "accepted" && (
                                                        <LBadge variant="success" size="sm">
                                                            <Check className="h-3 w-3 mr-1" />
                                                            {t("staff.inviteAccepted", "Active")}
                                                        </LBadge>
                                                    )}
                                                    {tm.memberType === "agent" && (
                                                        <span
                                                            className={cn(
                                                                "text-xs font-medium",
                                                                tm.isOnline ? "text-success" : "text-muted-foreground"
                                                            )}
                                                        >
                                                            {tm.isOnline ? "🟢 Online" : "⚪ Away"}
                                                        </span>
                                                    )}
                                                    {tm.memberType === "agent" && tm.isActive === false && (
                                                        <LBadge variant="destructive" size="sm">
                                                            {t("staff.disabled", "Disabled")}
                                                        </LBadge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-1 truncate">{tm.email}</p>
                                                {tm.memberType === "agent" && tm.serviceAreas && tm.serviceAreas.length > 0 && (
                                                    <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1 flex-wrap">
                                                        <MapPin className="h-4 w-4 shrink-0" />
                                                        {tm.serviceAreas.join(", ")}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {/* Row 2: Invite code + actions */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border min-w-0">
                                            <span className="text-sm font-mono font-medium text-primary bg-primary/10 px-2 py-1 rounded shrink-0">
                                                {tm.inviteCode}
                                            </span>
                                            <div className="flex flex-wrap gap-2 shrink-0 min-w-0" onClick={(e) => e.stopPropagation()}>
                                                {tm.memberType === "agent" && (
                                                    <LButton
                                                        variant="outline"
                                                        size="sm"
                                                        leftIcon={<MapPin className="h-4 w-4 shrink-0" />}
                                                        onClick={(e) => { e.stopPropagation(); setEditingAreasFor(tm); }}
                                                        title={t("staff.editAreas", "Edit areas")}
                                                        className="shrink-0"
                                                    >
                                                        {t("staff.editAreas", "Edit")}
                                                    </LButton>
                                                )}
                                                <LButton
                                                    variant="outline"
                                                    size="sm"
                                                    leftIcon={copiedId === tm.id ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}
                                                    onClick={(e) => { e.stopPropagation(); handleCopyInvite(tm); }}
                                                    className="shrink-0"
                                                >
                                                    {copiedId === tm.id ? t("common.copied", "Copied") : t("common.copy")}
                                                </LButton>
                                                <LButton
                                                    variant="outline"
                                                    size="sm"
                                                    leftIcon={<MessageCircle className="h-4 w-4 shrink-0" />}
                                                    onClick={(e) => { e.stopPropagation(); handleWhatsAppShare(tm); }}
                                                    className="shrink-0"
                                                >
                                                    WhatsApp
                                                </LButton>
                                            </div>
                                        </div>
                                    </div>
                                </LCard>
                            ))}
                        </div>
                    )
                ) : loading ? (
                    <LSkeletonList count={8} />
                ) : filteredStaff.length === 0 ? (
                    <LEmptyState
                        icon={<Users className="h-8 w-8" />}
                        title={searchQuery ? t('common.noResults') : t('staff.empty')}
                        description={
                            searchQuery
                                ? t('common.tryDifferentSearch')
                                : t('staff.emptyDesc')
                        }
                        action={
                            !searchQuery
                                ? {
                                    label: t('staff.addStaff'),
                                    onClick: () => setFormSheetOpen(true),
                                }
                                : undefined
                        }
                    />
                ) : (
                    <LList>
                        {filteredStaff.map((staff, index) => (
                            <div key={staff.id}>
                                <LListItem
                                    title={staff.name}
                                    subtitle={staff.phone}
                                    leftContent={<LAvatar name={staff.name} size="md" />}
                                    rightContent={
                                        <div className="flex items-center gap-2">
                                            <div className="text-right">
                                                <div className="flex items-center justify-end gap-1 mb-1">
                                                    {staff.role === "admin" && (
                                                        <LBadge variant="default" size="sm" className="bg-primary text-primary-foreground">
                                                            <Shield className="h-3 w-3 mr-1" />
                                                            {t('staff.roleAdmin', 'Admin')}
                                                        </LBadge>
                                                    )}
                                                    {staff.memberType === "plant" && (
                                                        <LBadge variant="secondary" size="sm" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                            {/* Factory icon is not in lucide-react standard, using Settings or similar */}
                                                            {/* Or just text */}
                                                            {t('staff.rolePlant', 'Plant Operator')}
                                                        </LBadge>
                                                    )}
                                                    {staff.memberType === "agent" && (
                                                        <LBadge variant="success" size="sm" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                                            {t('staff.roleAgent', 'Agent')}
                                                        </LBadge>
                                                    )}
                                                    {staff.memberType === "staff" && staff.role !== "admin" && (
                                                        <LBadge variant="outline" size="sm">
                                                            {t('staff.roleStaff', 'Staff')}
                                                        </LBadge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    <LAmount value={staff.baseSalary} size="sm" />
                                                    /{staff.payType === "monthly" ? t('staff.month') : t('staff.day')}
                                                </p>
                                            </div>
                                            {!staff.isActive && (
                                                <LBadge variant="destructive" size="sm">
                                                    {t('staff.inactive')}
                                                </LBadge>
                                            )}
                                        </div>
                                    }
                                    onClick={() => handleStaffClick(staff.id)}
                                    className={cn(
                                        "cursor-pointer transition-colors",
                                        selectedId === staff.id &&
                                        "bg-primary-muted border-l-4 border-l-primary"
                                    )}
                                />
                                {/* Mobile: Show ad card every N items */}
                                {isMobile && (index + 1) % AD_FREQUENCY === 0 && (
                                    <LAdSlot
                                        variant="card"
                                        position={`staff-list-${index + 1}`}
                                    />
                                )}
                            </div>
                        ))}
                    </LList>
                )}
            </div>

            <StaffFormSheet open={formSheetOpen} onClose={() => setFormSheetOpen(false)} />
            <TeamMemberFormSheet open={teamMemberSheetOpen} onClose={() => setTeamMemberSheetOpen(false)} />
            <TeamMemberAreasSheet
                open={!!editingAreasFor}
                onClose={() => setEditingAreasFor(null)}
                teamMember={editingAreasFor}
            />
        </div>
    );
}
