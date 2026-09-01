/**
 * Staff List — 1000% to the design system (Staff.dc.html):
 * header (title + count + search + Add Staff / Add App Login) · KPI tiles ·
 * Roster / App Logins tabs · roster table · app-login cards. Wired to
 * useStaff + useTeamMembers (+ plan limits, invite copy/share, edit areas).
 */

import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { LEmptyState, LSkeletonList, useLToast } from "@/components/laundry";
import { useStaff } from "@/hooks/use-staff";
import { useTeamMembers, useTeamMemberMutations } from "@/hooks/use-team-members";
import { useAuth } from "@/features/auth";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useCurrency } from "@/hooks/use-currency";
import { StaffFormSheet } from "./StaffFormSheet";
import { TeamMemberAreasSheet } from "./TeamMemberAreasSheet";
import { Play, Users, UserCheck, Smartphone, Copy, MessageCircle, Check, MapPin, Search, Plus, ChevronRight, Trash2 } from "lucide-react";
import { MRow, MAvatar, MHeader, MIconBtn, MStatBar, MSearch } from "@/components/laundry/LMobileRows";
import { MobileStaffList } from "./MobileStaff";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TEAM_GOOGLE_PLAY_URL, buildTeamInviteMessage } from "@/config/app-links";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TeamMember } from "@/types/staff";

const MONO = "'IBM Plex Mono'";
const AV = ["c-primary", "c-info", "c-violet", "c-cyan", "c-success", "c-warning"];

const TH: CSSProperties = { padding: "9px 14px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-text-3)", borderBottom: "1px solid var(--c-border)", whiteSpace: "nowrap", background: "var(--c-surface-2)" };
const TD: CSSProperties = { padding: "10px 14px", borderBottom: "1px solid var(--c-border)" };

interface StaffListProps {
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    onTabChange?: () => void;
}

function Kpi({ icon, value, label, tint, sub }: { icon: ReactNode; value: ReactNode; label: string; tint: string; sub?: string }) {
    return (
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "15px 16px", boxShadow: "var(--sh-sm)", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 38, height: 38, flex: "none", borderRadius: 10, background: `var(--${tint}-soft)`, color: `var(--${tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
            <div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 21, letterSpacing: "-.02em" }}>{value}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{label}{sub ? <span style={{ marginLeft: 5, color: "var(--c-text-3)", opacity: .8 }}>· {sub}</span> : null}</div></div>
        </div>
    );
}

function roleMeta(staff: { role?: string; memberType?: string }, t: (k: string, d: string) => string): { label: string; tint: string } {
    if (staff.role === "admin") return { label: t("staff.roleAdmin", "Admin"), tint: "c-primary" };
    if (staff.memberType === "plant") return { label: t("staff.rolePlant", "Plant"), tint: "c-cyan" };
    if (staff.memberType === "agent") return { label: t("staff.roleAgent", "Agent"), tint: "c-success" };
    return { label: t("staff.roleStaff", "Staff"), tint: "c-info" };
}

export function StaffList({ selectedId, onSelect, onTabChange }: StaffListProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { formatAmount } = useCurrency();
    const [searchQuery, setSearchQuery] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [formSheetOpen, setFormSheetOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"roster" | "appLogins">("roster");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [editingAreasFor, setEditingAreasFor] = useState<TeamMember | null>(null);

    const { staff: staffList, activeStaff, loading } = useStaff();
    const { teamMembers, agentCount: appAgentCount, loading: teamMembersLoading } = useTeamMembers();
    const { deleteTeamMember } = useTeamMemberMutations();
    const { addToast } = useLToast();
    const { role } = useAuth();
    const isOwner = role === "admin"; // login removal is owner-only, like in the profile panel
    const { checkLimit, hasFeature } = useShopLimits();
    // Team (app) logins are a Pro+/Business feature — hide all create UI on plans without it (Free, Pro, trial).
    const canTeamLogins = hasFeature("staffApp") || hasFeature("driverApp") || hasFeature("plantApp");

    const rosterLimit = checkLimit("maxRoster", activeStaff.length);
    const isRosterAddAllowed = rosterLimit.allowed;

    useEffect(() => {
        if (searchParams.get("new") === "true") {
            setFormSheetOpen(true);
            setSearchParams((params) => { params.delete("new"); return params; });
        }
    }, [searchParams, setSearchParams]);

    const displayStaff = showInactive ? staffList : activeStaff;
    const inactiveCount = staffList.length - activeStaff.length;
    // App logins are capped in TOTAL by the plan (any role mix) — show the cap next to
    // the count so "why do I have 7 logins for 4 people" answers itself.
    const loginLimit = checkLimit("maxTeamLogins", teamMembers.length);
    const loginSub = loginLimit.limit === -1
        ? t("staff.unlimitedLogins", "unlimited on your plan")
        : t("staff.ofPlanLogins", `of ${loginLimit.limit} on your plan`);
    const filteredStaff = displayStaff.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.phone.includes(searchQuery));
    const filteredTeamMembers = teamMembers.filter((tm) => tm.email.toLowerCase().includes(searchQuery.toLowerCase()) || (tm.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || tm.inviteCode.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleCopyInvite = (tm: { id: string; email: string; inviteCode: string; name?: string }) => {
        // Copy the FULL onboarding text (app link + steps), not just the code —
        // owners paste this straight into any chat app.
        navigator.clipboard.writeText(buildTeamInviteMessage({ name: tm.name, email: tm.email, inviteCode: tm.inviteCode }));
        setCopiedId(tm.id);
        setTimeout(() => setCopiedId(null), 2000);
    };
    const handleWhatsAppShare = (tm: { email: string; inviteCode: string; name?: string; memberType: string }) => {
        const webSignupUrl = `${window.location.origin}/${tm.memberType === "agent" ? "driver" : tm.memberType === "plant" ? "plant" : "staff"}/signup`;
        const msg = buildTeamInviteMessage({ name: tm.name, email: tm.email, inviteCode: tm.inviteCode, webSignupUrl });
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    };
    // Deleting the login doc also deletes the member's Firebase sign-in account
    // (onTeamMemberDeleted Cloud Function), so the email can be invited again.
    const handleRemoveLogin = async (tm: TeamMember) => {
        const ok = window.confirm(
            t("staff.removeLoginConfirm",
                `Remove ${tm.name || tm.email}'s app login? They can no longer sign in to the Team app, the login slot is freed, and their sign-in account is deleted so the same email can be used again. Roster, attendance and payroll history stays.`)
        );
        if (!ok) return;
        try {
            await deleteTeamMember(tm.id);
            addToast({ type: "success", title: t("staff.loginRemoved", "Login removed — the email is free to reuse") });
        } catch (e) {
            console.error(e);
            addToast({ type: "error", title: t("staff.removeLoginFailed", "Could not remove the login. Please try again.") });
        }
    };

    const ghostBtn: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, font: "inherit", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "6px 11px" };

    // MOBILE: the owner app's StaffListScreen.
    if (isMobile) return (
        <>
            <MobileStaffList
                staff={displayStaff}
                activeCount={activeStaff.length}
                loginCount={teamMembers.length}
                loginCap={loginLimit.limit > 0 ? loginLimit.limit : 0}
                agentCount={appAgentCount}
                hasLogin={(id) => teamMembers.some((tm) => tm.staffId === id)}
                onBack={() => navigate("/settings")}
                onOpen={(id) => onSelect?.(id)}
                onAdd={isRosterAddAllowed ? () => setFormSheetOpen(true) : undefined}
            />
            <StaffFormSheet open={formSheetOpen} onClose={() => setFormSheetOpen(false)} />
        </>
    );

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header — on mobile, the owner app's header bar (round icon button, big title) */}
            {isMobile ? (
                <MHeader
                    title={t("staff.title", "Staff")}
                    sub={`${displayStaff.length} ${t("staff.members", "members")}`}
                    right={isRosterAddAllowed ? <MIconBtn aria-label={t("staff.addStaff", "Add Staff")} tint="c-primary" onClick={() => setFormSheetOpen(true)}><Plus size={20} /></MIconBtn> : undefined}
                />
            ) : (
            <header style={{ flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "10px 22px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                    <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em" }}>{t("staff.title", "Staff")}</span>
                    <span style={{ fontSize: 12, color: "var(--c-text-3)", fontFamily: MONO }}>{displayStaff.length} {t("staff.members", "members")}</span>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ position: "relative" }}>
                    <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="search" placeholder={t("staff.searchStaff", "Search staff…")}
                        style={{ width: 200, font: "inherit", fontSize: 13, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "8px 11px 8px 33px", outline: "none" }} />
                </div>
                {/* Standalone "Add App Login" removed — logins are created via Add Staff (toggle) or a staff profile. */}
                <button onClick={() => { if (isRosterAddAllowed) setFormSheetOpen(true); }} disabled={!isRosterAddAllowed} style={{ cursor: isRosterAddAllowed ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 8, padding: "8px 14px", boxShadow: "var(--sh-sm)", opacity: isRosterAddAllowed ? 1 : 0.55 }}><Plus size={15} />{t("staff.addStaff", "Add Staff")}</button>
            </header>
            )}

            {/* tabs */}
            <div className="lb-thin" style={{ flex: "none", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", padding: isMobile ? "10px 16px" : "10px 22px", display: "flex", gap: 8, overflowX: "auto" }}>
                {([{ id: "roster", label: t("staff.tabRoster", "Roster") }, { id: "appLogins", label: t("staff.tabAppLogins", "App Logins") }] as const).map((tb) => {
                    const on = activeTab === tb.id;
                    return (
                        <button key={tb.id} onClick={() => { setActiveTab(tb.id); onTabChange?.(); }} style={{ cursor: "pointer", whiteSpace: "nowrap", font: "inherit", fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 9, border: `1px solid ${on ? "var(--c-primary)" : "var(--c-border)"}`, background: on ? "var(--c-primary-soft)" : "var(--c-surface)", color: on ? "var(--c-primary)" : "var(--c-text-2)" }}>{tb.label}</button>
                    );
                })}
                {activeTab === "roster" && (
                    <label style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--c-text-2)", cursor: "pointer" }}>
                        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ accentColor: "var(--c-primary)", width: 15, height: 15 }} />
                        {t("staff.showInactive", "Show inactive")}
                    </label>
                )}
            </div>

            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: isMobile ? "14px 14px calc(88px + env(safe-area-inset-bottom, 0px))" : "20px 22px 40px", minHeight: 0 }}>
                {/* Search (mobile: app-style full-width field above the stats card) */}
                {isMobile && (
                    <MSearch value={searchQuery} onChange={setSearchQuery} placeholder={t("staff.searchStaff", "Search staff…")} style={{ marginBottom: 12 }} />
                )}
                {/* KPIs — mobile clones the app's single stats card with dividers */}
                {/* The roster hides inactive staff unless "Show inactive" is ticked, so the
                    headline number is the ACTIVE count and deactivated people get their own
                    stat — a total that silently included them read as a broken list. */}
                {isMobile ? (
                    <MStatBar style={{ marginBottom: 14 }} stats={[
                        { label: t("staff.activeStaff", "Active staff"), value: activeStaff.length },
                        { label: t("staff.inactiveStaff", "Inactive"), value: inactiveCount, color: inactiveCount > 0 ? "c-warning" : undefined },
                        { label: t("staff.appLogins", "App logins"), value: loginLimit.limit > 0 ? `${teamMembers.length}/${loginLimit.limit}` : teamMembers.length, color: loginLimit.limit > 0 && teamMembers.length > loginLimit.limit ? "c-error" : "c-primary" },
                        { label: t("staff.agents", "Delivery agents"), value: appAgentCount },
                    ]} />
                ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
                    <Kpi icon={<Users size={18} />} value={activeStaff.length} label={t("staff.activeStaff", "Active staff")} tint="c-primary" />
                    <Kpi icon={<UserCheck size={18} />} value={inactiveCount} label={t("staff.inactiveStaff", "Inactive")} tint={inactiveCount > 0 ? "c-warning" : "c-success"} />
                    <Kpi icon={<Smartphone size={18} />} value={teamMembers.length} label={t("staff.appLogins", "App logins")} tint="c-violet" sub={loginSub} />
                    <Kpi icon={<MapPin size={18} />} value={appAgentCount} label={t("staff.agents", "Delivery agents")} tint="c-info" />
                </div>
                )}

                {activeTab === "roster" ? (
                    loading ? (
                        <LSkeletonList count={8} />
                    ) : filteredStaff.length === 0 ? (
                        <LEmptyState icon={<Users className="h-8 w-8" />} title={searchQuery ? t("common.noResults", "No matches") : t("staff.empty", "No staff yet")} description={searchQuery ? t("common.tryDifferentSearch", "Try another name or number.") : t("staff.emptyDesc", "Add your first team member.")} action={!searchQuery ? { label: t("staff.addStaff", "Add Staff"), onClick: () => setFormSheetOpen(true) } : undefined} />
                    ) : (
                        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)", overflow: "hidden" }}>
                            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--c-border)", fontSize: 14, fontWeight: 600 }}>{t("staff.teamRoster", "Team roster")}</div>
                            {isMobile ? (
                                /* App-style rows — the roster table reads as a website on a phone */
                                <div>
                                    {filteredStaff.map((s, i) => {
                                        const rm = roleMeta(s, t);
                                        return (
                                            <MRow key={s.id}
                                                left={<MAvatar name={s.name} tint={AV[i % AV.length]} />}
                                                title={s.name}
                                                titleRight={<span style={{ flex: "none", fontSize: 10.5, fontWeight: 600, color: `var(--${rm.tint})`, background: `var(--${rm.tint}-soft)`, padding: "2px 8px", borderRadius: 20 }}>{rm.label}</span>}
                                                sub={`${s.phone || "—"} · ${formatAmount(s.baseSalary || 0)}/${s.payType === "monthly" ? t("staff.month", "mo") : t("staff.day", "day")}`}
                                                right={<span style={{ width: 8, height: 8, borderRadius: "50%", background: s.isActive ? "var(--c-success)" : "var(--c-text-3)" }} />}
                                                selected={selectedId === s.id}
                                                last={i === filteredStaff.length - 1}
                                                onClick={() => onSelect?.(s.id)}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                            <div className="lb-scroll" style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...TH, textAlign: "left", paddingLeft: 18 }}>{t("staff.name", "Name")}</th>
                                            <th style={{ ...TH, textAlign: "left" }}>{t("staff.role", "Role")}</th>
                                            <th style={{ ...TH, textAlign: "left" }}>{t("staff.contact", "Contact")}</th>
                                            <th style={{ ...TH, textAlign: "right" }}>{t("staff.salary", "Salary")}</th>
                                            <th style={{ ...TH, textAlign: "left" }}>{t("orders.status", "Status")}</th>
                                            <th style={{ ...TH, width: 40, paddingRight: 18 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStaff.map((s, i) => {
                                            const av = AV[i % AV.length];
                                            const rm = roleMeta(s, t);
                                            const initials = s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                                            return (
                                                <tr key={s.id} onClick={() => onSelect?.(s.id)} tabIndex={0} role="button"
                                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(s.id); } }}
                                                    style={{ cursor: "pointer", background: selectedId === s.id ? "var(--c-primary-soft)" : "transparent" }}
                                                    onMouseEnter={(e) => { if (selectedId !== s.id) e.currentTarget.style.background = "var(--c-surface-2)"; }}
                                                    onMouseLeave={(e) => { if (selectedId !== s.id) e.currentTarget.style.background = "transparent"; }}>
                                                    <td style={{ ...TD, paddingLeft: 18 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                                                            <span style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", background: `var(--${av}-soft)`, color: `var(--${av})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 600 }}>{initials}</span>
                                                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                                                        </div>
                                                    </td>
                                                    <td style={TD}><span style={{ display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 600, color: `var(--${rm.tint})`, background: `var(--${rm.tint}-soft)`, padding: "3px 9px", borderRadius: 20 }}>{rm.label}</span></td>
                                                    <td style={{ ...TD, color: "var(--c-text-2)", fontFamily: MONO, fontSize: 12.5 }}>{s.phone}</td>
                                                    <td style={{ ...TD, textAlign: "right", fontFamily: MONO, fontWeight: 600 }}>{formatAmount(s.baseSalary || 0)}<span style={{ fontSize: 10.5, color: "var(--c-text-3)" }}>/{s.payType === "monthly" ? t("staff.month", "mo") : t("staff.day", "day")}</span></td>
                                                    <td style={TD}><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: s.isActive ? "var(--c-success-soft)" : "var(--c-surface-2)", color: s.isActive ? "var(--c-success)" : "var(--c-text-3)" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: s.isActive ? "var(--c-success)" : "var(--c-text-3)" }} />{s.isActive ? t("common.active", "Active") : t("staff.inactive", "Inactive")}</span></td>
                                                    <td style={{ ...TD, textAlign: "right", paddingRight: 18, color: "var(--c-text-3)" }}><ChevronRight size={16} /></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            )}
                        </div>
                    )
                ) : (
                    /* App Logins */
                    <>
                    {/* Team app onboarding — the app these logins sign in to */}
                    <div style={{ background: "var(--c-primary-soft)", border: "1px solid var(--c-primary)", borderRadius: 12, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                        <span style={{ width: 40, height: 40, flex: "none", borderRadius: 10, background: "var(--c-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Smartphone size={20} /></span>
                        <div style={{ flex: 1, minWidth: 230 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t("staff.teamAppCardTitle", "Laundrybill Team app")}</div>
                            <div style={{ fontSize: 12.5, color: "var(--c-text-2)", marginTop: 2, lineHeight: 1.55 }}>
                                {t("staff.teamAppCardHow", "Your member installs the Team app, taps Sign up, and enters their email, a password and the invite code below. Use an email that has never been used for any Laundrybill account — owner or team.")}
                            </div>
                        </div>
                        <a href={TEAM_GOOGLE_PLAY_URL} target="_blank" rel="noopener noreferrer"
                            style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "#fff", background: "var(--c-primary)", borderRadius: 9, padding: "9px 14px", textDecoration: "none", boxShadow: "var(--sh-sm)" }}>
                            <Play size={14} fill="currentColor" />{t("staff.teamAppGetPlay", "Get it on Google Play")}
                        </a>
                    </div>
                    {teamMembersLoading ? (
                        <LSkeletonList count={4} />
                    ) : teamMembers.length === 0 ? (
                        <LEmptyState icon={<Smartphone className="h-8 w-8" />} title={t("staff.noAppLogins", "No App Logins")} description={canTeamLogins ? t("staff.noAppLoginsDescAddStaff", "Add a staff member and turn on “Create app login”, or open an existing staff profile to create their login.") : t("staff.appLoginsUpgrade", "App logins (Staff, Agent, Plant) are available on the Pro+ and Business plans. Upgrade to add them.")} action={canTeamLogins ? { label: t("staff.addStaff", "Add Staff"), onClick: () => setFormSheetOpen(true) } : undefined} />
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {filteredTeamMembers.map((tm, i) => {
                                const av = AV[i % AV.length];
                                const typeMeta = tm.memberType === "agent" ? { label: t("staff.memberTypeAgent", "Delivery Agent"), tint: "c-success" } : tm.memberType === "plant" ? { label: t("staff.memberTypePlant", "Plant Operator"), tint: "c-cyan" } : { label: t("staff.memberTypeStaff", "Staff App"), tint: "c-info" };
                                return (
                                    <div key={tm.id} onClick={() => onSelect?.(tm.id)} style={{ cursor: "pointer", background: "var(--c-surface)", border: `1px solid ${selectedId === tm.id ? "var(--c-primary)" : "var(--c-border)"}`, borderRadius: 12, boxShadow: "var(--sh-sm)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                            <span style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", background: `var(--${av}-soft)`, color: `var(--${av})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>{(tm.name || tm.email).slice(0, 2).toUpperCase()}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                    <span style={{ fontSize: 15, fontWeight: 600 }}>{tm.name || tm.email}</span>
                                                    <span style={{ fontSize: 11, fontWeight: 600, color: `var(--${typeMeta.tint})`, background: `var(--${typeMeta.tint}-soft)`, padding: "2px 8px", borderRadius: 20 }}>{typeMeta.label}</span>
                                                    {tm.inviteStatus === "accepted" && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--c-success)", background: "var(--c-success-soft)", padding: "2px 8px", borderRadius: 20 }}><Check size={11} />{t("staff.inviteAccepted", "Active")}</span>}
                                                    {tm.memberType === "agent" && <span style={{ fontSize: 11.5, fontWeight: 600, color: tm.isOnline ? "var(--c-success)" : "var(--c-text-3)" }}>{tm.isOnline ? "🟢 Online" : "⚪ Away"}</span>}
                                                </div>
                                                <div style={{ fontSize: 13, color: "var(--c-text-3)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tm.email}</div>
                                                {tm.memberType === "agent" && tm.serviceAreas && tm.serviceAreas.length > 0 && <div style={{ fontSize: 12.5, color: "var(--c-text-3)", marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}><MapPin size={13} />{tm.serviceAreas.join(", ")}</div>}
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 12, borderTop: "1px solid var(--c-border)" }} onClick={(e) => e.stopPropagation()}>
                                            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", padding: "4px 9px", borderRadius: 6 }}>{tm.inviteCode}</span>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                {tm.memberType === "agent" && <button onClick={(e) => { e.stopPropagation(); setEditingAreasFor(tm); }} style={ghostBtn}><MapPin size={14} />{t("staff.editAreas", "Areas")}</button>}
                                                <button onClick={(e) => { e.stopPropagation(); handleCopyInvite(tm); }} style={ghostBtn}>{copiedId === tm.id ? <Check size={14} /> : <Copy size={14} />}{copiedId === tm.id ? t("common.copied", "Copied") : t("common.copy", "Copy")}</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleWhatsAppShare(tm); }} style={ghostBtn}><MessageCircle size={14} />WhatsApp</button>
                                                {isOwner && <button onClick={(e) => { e.stopPropagation(); handleRemoveLogin(tm); }}
                                                    title={t("staff.removeLoginHint", "Revokes app access, frees the login slot, and deletes their sign-in email so it can be invited again.")}
                                                    style={{ ...ghostBtn, color: "var(--c-error)", background: "var(--c-error-soft)", borderColor: "transparent" }}><Trash2 size={14} />{t("staff.removeLogin", "Remove")}</button>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    </>
                )}
            </div>

            <StaffFormSheet open={formSheetOpen} onClose={() => setFormSheetOpen(false)} />
            <TeamMemberAreasSheet open={!!editingAreasFor} onClose={() => setEditingAreasFor(null)} teamMember={editingAreasFor} />
        </div>
    );
}
