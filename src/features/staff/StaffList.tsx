/**
 * Staff List — 1000% to the design system (Staff.dc.html):
 * header (title + count + search + Add Staff / Add App Login) · KPI tiles ·
 * Roster / App Logins tabs · roster table · app-login cards. Wired to
 * useStaff + useTeamMembers (+ plan limits, invite copy/share, edit areas).
 */

import { useState, useEffect, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { LEmptyState, LSkeletonList, useLToast } from "@/components/laundry";
import { useStaff, useAttendance, usePayroll } from "@/hooks/use-staff";
import { TeamMemberFormSheet } from "./TeamMemberFormSheet";
import { format } from "date-fns";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTeamMembers, useTeamMemberMutations } from "@/hooks/use-team-members";
import { useAuth } from "@/features/auth";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useCurrency } from "@/hooks/use-currency";
import { StaffFormSheet } from "./StaffFormSheet";
import { TeamMemberAreasSheet } from "./TeamMemberAreasSheet";
import { Play, Users, Copy, MessageCircle, Check, MapPin, Search, Plus, ChevronRight, Trash2, Eye, MoreVertical, CircleCheck, LockKeyhole, Bike, KeyRound, X, Phone, CalendarDays } from "lucide-react";
import { MobileStaffList } from "./MobileStaff";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TEAM_GOOGLE_PLAY_URL, buildTeamInviteMessage } from "@/config/app-links";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TeamMember, Staff } from "@/types/staff";

const AV = ["c-primary", "c-info", "c-violet", "c-cyan", "c-success", "c-warning"];


interface StaffListProps {
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    onTabChange?: () => void;
}



export function StaffList({ onSelect }: StaffListProps) {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { formatAmount } = useCurrency();
    const [searchQuery, setSearchQuery] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [formSheetOpen, setFormSheetOpen] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [editingAreasFor, setEditingAreasFor] = useState<TeamMember | null>(null);
    const [panelId, setPanelId] = useState<string | null>(null);
    const [rowMenu, setRowMenu] = useState<string | null>(null);
    const [createLoginFor_, setCreateLoginFor] = useState<Staff | null>(null);
    const { attendance: monthAttendance } = useAttendance(new Date());
    const { payroll: monthPayroll } = usePayroll(format(new Date(), "yyyy-MM"));
    const onRoute = useOutForDeliveryCount();

    const { staff: staffList, activeStaff, loading } = useStaff();
    const { teamMembers, agentCount: appAgentCount } = useTeamMembers();
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
    const filteredStaff = displayStaff.filter((s) => {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || (s.phone || "").includes(searchQuery) || (s.role || "").replace("_", " ").includes(q) || (s.memberType === "agent" && "delivery agent".includes(q));
    });
    const filteredTeamMembers = teamMembers.filter((tm) => tm.email.toLowerCase().includes(searchQuery.toLowerCase()) || (tm.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || tm.inviteCode.toLowerCase().includes(searchQuery.toLowerCase()));

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

    // ---- desktop (reference layout) ------------------------------------------
    const monthLabel = format(new Date(), "MMM");
    const loginFor = (st: Staff) => teamMembers.find((tm) => tm.staffId === st.id)
        || teamMembers.find((tm) => !tm.staffId && !!st.email && tm.email?.toLowerCase() === st.email.toLowerCase());
    const linkedLoginIds = new Set(filteredStaff.map((st) => loginFor(st)?.id).filter(Boolean) as string[]);
    const orphanLogins = filteredTeamMembers.filter((tm) => !tm.staffId || !staffList.some((st) => st.id === tm.staffId)).filter((tm) => !linkedLoginIds.has(tm.id));
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const presentToday = monthAttendance.filter((r) => r.date === todayKey && (r.status === "present" || r.status === "half")).length;
    const attFor = (id: string) => {
        const recs = monthAttendance.filter((r) => r.staffId === id && r.status !== "holiday");
        const present = recs.filter((r) => r.status === "present").length;
        const half = recs.filter((r) => r.status === "half").length;
        const leave = recs.filter((r) => r.status === "leave").length;
        const attended = present + half * 0.5;
        const pct = recs.length ? Math.round((attended / recs.length) * 100) : null;
        return { present, half, leave, attended, marked: recs.length, pct };
    };
    const pctColor = (p: number | null) => (p == null ? "var(--ds-text-3)" : p >= 85 ? "#16A34A" : p >= 70 ? "#D97706" : "#DC2626");
    const roleChip = (st: Staff): { label: string; bg: string; fg: string; bd: string } => {
        if (st.role === "admin") return { label: t("staff.roleAdmin", "Admin"), bg: "#EEF2FF", fg: "#4338CA", bd: "#C7D2FE" };
        if (st.role === "manager") return { label: t("staff.roleManager", "Manager"), bg: "#EFF6FF", fg: "#1D4ED8", bd: "#BFDBFE" };
        if (st.memberType === "agent") return { label: t("staff.roleDeliveryAgent", "Delivery agent"), bg: "#F5F3FF", fg: "#6D28D9", bd: "#DDD6FE" };
        if (st.memberType === "plant" || st.role === "plant_operator") return { label: t("staff.rolePlant", "Plant"), bg: "#F0FDF4", fg: "#15803D", bd: "#BBF7D0" };
        return { label: t("staff.roleStaff", "Staff"), bg: "#F0F9FF", fg: "#0369A1", bd: "#BAE6FD" };
    };
    const loginStatus = (tm?: TeamMember) => !tm
        ? { label: t("staff.loginNotCreated", "Not created"), bg: "#F9FAFB", fg: "#6B7280", bd: "#E5E7EB" }
        : tm.inviteStatus === "accepted"
            ? { label: t("staff.loginActive", "Active"), bg: "#F0FDF4", fg: "#15803D", bd: "#BBF7D0" }
            : { label: t("staff.inviteSent", "Invite sent"), bg: "#FFFBEB", fg: "#B45309", bd: "#FDE68A" };
    const loginCapText = loginLimit.limit === -1
        ? t("staff.loginsUsedUnlimited", "{{n}} used", { n: teamMembers.length })
        : t("staff.loginsUsedOf", "{{n}} of {{cap}} used", { n: teamMembers.length, cap: loginLimit.limit });
    const loginPct = loginLimit.limit > 0 ? Math.min(100, (teamMembers.length / loginLimit.limit) * 100) : 0;
    const canCreateLogin = isOwner && canTeamLogins && (loginLimit.limit === -1 || teamMembers.length < loginLimit.limit);
    const createLoginFor = (st: Staff) => {
        if (!canTeamLogins) { navigate("/settings/subscription"); return; }
        if (!canCreateLogin) { addToast({ type: "error", title: t("staff.loginLimitReached", "Login limit reached"), description: t("staff.loginLimitDesc", "Remove a login or upgrade your plan to add more.") }); return; }
        setCreateLoginFor(st);
    };

    const sel = filteredStaff.find((st) => st.id === panelId) || null;
    const selLogin = sel ? loginFor(sel) : undefined;
    const selAtt = sel ? attFor(sel.id) : null;
    const selPay = sel ? monthPayroll.find((p) => p.staffId === sel.id) : undefined;
    const inviteText = selLogin
        ? buildTeamInviteMessage({ name: selLogin.name || sel?.name, email: selLogin.email, inviteCode: selLogin.inviteCode })
        : "";
    const previewCode = selLogin?.inviteCode || teamMembers.find((tm) => tm.inviteStatus === "pending")?.inviteCode || "";
    const copyText = async (text: string, id: string) => {
        try { await navigator.clipboard.writeText(text); } catch { /* blocked */ }
        setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
    };

    const dsCard: CSSProperties = { background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };
    const TH2: CSSProperties = { padding: "18px 12px", fontSize: 13.5, fontWeight: 500, color: "var(--ds-text)", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid var(--ds-border)" };
    const TD2: CSSProperties = { padding: "14px 12px", fontSize: 14.5, borderBottom: "1px solid var(--ds-divider)", whiteSpace: "nowrap" };
    const chip = (c: { label: string; bg: string; fg: string; bd: string }) => <span style={{ fontSize: 12.5, fontWeight: 500, padding: "4px 9px", borderRadius: 5, background: c.bg, color: c.fg, border: `1px solid ${c.bd}` }}>{c.label}</span>;
    const menuRow: CSSProperties = { width: "100%", cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 500, color: "var(--ds-text)", background: "transparent", border: 0, borderRadius: 8, padding: "9px 10px", textAlign: "left" };

    return (
        <div className="lb-ds" style={{ height: "100%", minHeight: 0, display: "flex", background: "var(--ds-bg)" }}>
            <div className="lb-scroll" style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "22px 22px 30px" }}>
                {/* header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
                    <span style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-.02em", marginRight: "auto" }}>{t("staff.title", "Staff")}</span>
                    <div style={{ position: "relative", flex: "0 1 290px" }}>
                        <Search size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ds-text-2)" }} />
                        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="search" placeholder={t("staff.searchByNameRole", "Search staff by name or role")}
                            style={{ width: "100%", font: "inherit", fontSize: 14.5, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 11, padding: "11px 14px 11px 42px", outline: "none" }} />
                    </div>
                    <button onClick={() => { if (isRosterAddAllowed) setFormSheetOpen(true); }} disabled={!isRosterAddAllowed} title={!isRosterAddAllowed ? t("staff.rosterLimit", "Staff limit reached on your plan") : undefined}
                        style={{ cursor: isRosterAddAllowed ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 10, font: "inherit", fontSize: 15, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 11, padding: "12px 22px", opacity: isRosterAddAllowed ? 1 : 0.55 }}>
                        <Plus size={18} />{t("staff.addStaffBtn", "Add staff")}
                    </button>
                </div>

                {/* KPIs */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 22 }}>
                    {[
                        { label: t("staff.totalStaff", "Total staff"), value: String(activeStaff.length), sub: inactiveCount > 0 ? t("staff.inactiveCount", "{{n}} inactive", { n: inactiveCount }) : t("staff.allTeamMembers", "All team members"), icon: <Users size={23} />, bg: "#EDE9FE", fg: "#7C3AED" },
                        { label: t("staff.presentToday", "Present today"), value: String(presentToday), sub: t("staff.markedPresent", "Marked present"), icon: <CircleCheck size={24} />, bg: "#DCFCE7", fg: "#16A34A" },
                        { label: t("staff.teamLogins", "Team logins"), value: loginCapText, sub: null, bar: loginLimit.limit > 0, icon: <LockKeyhole size={22} />, bg: "var(--ds-blue-soft)", fg: "var(--ds-blue)" },
                        { label: t("staff.onRouteNow", "On route now"), value: String(onRoute), sub: t("staff.deliveriesInProgress", "Deliveries in progress"), icon: <Bike size={23} />, bg: "#FFEDD5", fg: "#EA580C" },
                    ].map((k) => (
                        <div key={k.label} style={{ ...dsCard, padding: "20px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                            <span style={{ width: 50, height: 50, flex: "none", borderRadius: "50%", background: k.bg, color: k.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>{k.icon}</span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 13.5 }}>{k.label}</div>
                                <div style={{ fontSize: 21, fontWeight: 500, marginTop: 4, whiteSpace: "nowrap" }}>{k.value}</div>
                                {k.sub && <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginTop: 6 }}>{k.sub}</div>}
                                {"bar" in k && k.bar && <div style={{ height: 7, borderRadius: 7, background: "#E5E7EB", marginTop: 10, overflow: "hidden" }} title={loginSub}><div style={{ width: `${loginPct}%`, height: "100%", background: "var(--ds-blue)", borderRadius: 7 }} /></div>}
                            </div>
                        </div>
                    ))}
                </div>

                {/* roster table */}
                <div style={{ ...dsCard, overflow: "visible" }}>
                    {loading ? (
                        <div style={{ padding: 20 }}><LSkeletonList count={6} /></div>
                    ) : filteredStaff.length === 0 ? (
                        <LEmptyState icon={<Users className="h-8 w-8" />} title={searchQuery ? t("common.noResults", "No matches") : t("staff.empty", "No staff yet")} description={searchQuery ? t("common.tryDifferentSearch", "Try another name or number.") : t("staff.emptyDesc", "Add your first team member.")} action={!searchQuery ? { label: t("staff.addStaffBtn", "Add staff"), onClick: () => setFormSheetOpen(true) } : undefined} />
                    ) : (
                        <div className="lb-scroll" style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...TH2, paddingLeft: 18 }}>{t("staff.colStaff", "Staff")}</th>
                                        <th style={TH2}>{t("staff.colRole", "Role")}</th>
                                        <th style={TH2}>{t("staff.colPhone", "Phone")}</th>
                                        <th style={TH2}>{t("staff.colSalary", "Salary")}</th>
                                        <th style={TH2}>{t("staff.colAttendance", "Attendance ({{m}})", { m: monthLabel })}</th>
                                        <th style={{ ...TH2, textAlign: "center" }}>{t("staff.colTeamLogin", "Team app login")}</th>
                                        <th style={{ ...TH2, textAlign: "center", paddingRight: 18 }}>{t("staff.colActions", "Actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStaff.map((st, i) => {
                                        const tm = loginFor(st);
                                        const at = attFor(st.id);
                                        const on = panelId === st.id;
                                        return (
                                            <tr key={st.id} onClick={() => setPanelId(st.id)} style={{ cursor: "pointer", background: on ? "var(--ds-blue-soft)" : undefined, opacity: st.isActive ? 1 : 0.6 }}>
                                                <td style={{ ...TD2, paddingLeft: 18 }}>
                                                    <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                                        <span style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", background: `var(--${AV[i % AV.length]}-soft)`, color: `var(--${AV[i % AV.length]})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600 }}>{(st.name || "?").trim()[0]?.toUpperCase()}</span>
                                                        <span style={{ fontWeight: 500 }}>{st.name}</span>
                                                        {!st.isActive && <span style={{ fontSize: 11.5, color: "var(--ds-text-2)" }}>{t("staff.inactive", "Inactive")}</span>}
                                                    </span>
                                                </td>
                                                <td style={TD2}>{chip(roleChip(st))}</td>
                                                <td style={TD2}>{st.phone || "—"}</td>
                                                <td style={TD2}>{formatAmount(st.baseSalary || 0).replace(/\.00$/, "")}{st.payType !== "monthly" && <span style={{ fontSize: 12, color: "var(--ds-text-2)" }}>/{t("staff.day", "day")}</span>}</td>
                                                <td style={TD2}>
                                                    <div>{at.marked ? `${at.attended % 1 ? at.attended.toFixed(1) : at.attended} / ${at.marked}` : "—"}</div>
                                                    <div style={{ fontSize: 12.5, marginTop: 3, color: pctColor(at.pct) }}>{at.pct == null ? t("staff.noAttendance", "Not marked") : `${at.pct}%`}</div>
                                                </td>
                                                <td style={{ ...TD2, textAlign: "center" }}>{chip(loginStatus(tm))}</td>
                                                <td style={{ ...TD2, paddingRight: 18, position: "relative" }} onClick={(e) => e.stopPropagation()}>
                                                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                                                        {tm && tm.inviteStatus === "accepted" ? (
                                                            <button onClick={() => onSelect?.(st.id)} title={t("staff.viewProfile", "View profile")} aria-label={t("staff.viewProfile", "View profile")} style={{ cursor: "pointer", width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9 }}><Eye size={17} /></button>
                                                        ) : tm ? (
                                                            <button onClick={() => handleWhatsAppShare(tm)} style={{ cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 500, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", borderRadius: 7, padding: "7px 13px" }}>{t("staff.shareInvite", "Share invite")}</button>
                                                        ) : (isOwner && canTeamLogins) ? (
                                                            <button onClick={() => createLoginFor(st)} style={{ cursor: "pointer", font: "inherit", fontSize: 14, fontWeight: 500, color: "#fff", background: "var(--ds-blue)", border: "1px solid var(--ds-blue)", borderRadius: 7, padding: "7px 13px" }}>{t("staff.createLogin", "Create login")}</button>
                                                        ) : (
                                                            <button onClick={() => onSelect?.(st.id)} title={t("staff.viewProfile", "View profile")} aria-label={t("staff.viewProfile", "View profile")} style={{ cursor: "pointer", width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9 }}><Eye size={17} /></button>
                                                        )}
                                                        <button onClick={() => setRowMenu(rowMenu === st.id ? null : st.id)} aria-label={t("common.more", "More")} style={{ cursor: "pointer", width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text)", background: "transparent", border: 0 }}><MoreVertical size={18} /></button>
                                                    </span>
                                                    {rowMenu === st.id && (
                                                        <div onMouseLeave={() => setRowMenu(null)} style={{ position: "absolute", right: 16, top: "calc(100% - 8px)", zIndex: 30, minWidth: 210, background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12, boxShadow: "0 12px 32px rgba(16,24,40,.14)", padding: 6 }}>
                                                            <button onClick={() => { setRowMenu(null); onSelect?.(st.id); }} style={menuRow}><Eye size={15} />{t("staff.viewProfile", "View profile")}</button>
                                                            {tm && <button onClick={() => { setRowMenu(null); void copyText(buildTeamInviteMessage({ name: tm.name || st.name, email: tm.email, inviteCode: tm.inviteCode }), tm.id); }} style={menuRow}><Copy size={15} />{t("staff.copyInvite", "Copy invite message")}</button>}
                                                            {tm && <button onClick={() => { setRowMenu(null); handleWhatsAppShare(tm); }} style={menuRow}><MessageCircle size={15} />{t("staff.shareOnWhatsApp", "Share on WhatsApp")}</button>}
                                                            {tm?.memberType === "agent" && <button onClick={() => { setRowMenu(null); setEditingAreasFor(tm); }} style={menuRow}><MapPin size={15} />{t("staff.editAreas", "Service areas")}</button>}
                                                            {!tm && isOwner && canTeamLogins && <button onClick={() => { setRowMenu(null); createLoginFor(st); }} style={menuRow}><KeyRound size={15} />{t("staff.createLogin", "Create login")}</button>}
                                                            {tm && isOwner && <button onClick={() => { setRowMenu(null); void handleRemoveLogin(tm); }} style={{ ...menuRow, color: "var(--ds-negative)" }}><Trash2 size={15} />{t("staff.revokeLogin", "Revoke login")}</button>}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", fontSize: 13.5, color: "var(--ds-text-2)" }}>
                        <span>{filteredStaff.length ? `1–${filteredStaff.length}` : "0"} {t("common.of", "of")} {filteredStaff.length} {t("staff.staffLower", "staff")}</span>
                        <label style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ accentColor: "var(--ds-blue)", width: 14, height: 14 }} />
                            {t("staff.showInactive", "Show inactive")}
                        </label>
                    </div>
                </div>

                {/* logins that aren't linked to a roster profile */}
                {orphanLogins.length > 0 && (
                    <div style={{ ...dsCard, marginTop: 16, padding: "16px 18px" }}>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t("staff.unlinkedLogins", "Team logins without a staff profile")}</div>
                        <div style={{ fontSize: 13, color: "var(--ds-text-2)", marginBottom: 12 }}>{t("staff.unlinkedLoginsDesc", "These logins count toward your plan but aren't on the roster.")}</div>
                        {orphanLogins.map((tm) => (
                            <div key={tm.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--ds-divider)", flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 500 }}>{tm.name || tm.email}</span>
                                <span style={{ fontSize: 13, color: "var(--ds-text-2)" }}>{tm.email}</span>
                                {chip(loginStatus(tm))}
                                <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>
                                    <button onClick={() => void copyText(buildTeamInviteMessage({ name: tm.name, email: tm.email, inviteCode: tm.inviteCode }), tm.id)} style={{ cursor: "pointer", font: "inherit", fontSize: 13, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 8, padding: "6px 11px", display: "inline-flex", alignItems: "center", gap: 6 }}>{copiedId === tm.id ? <Check size={14} /> : <Copy size={14} />}{tm.inviteCode}</button>
                                    <button onClick={() => handleWhatsAppShare(tm)} style={{ cursor: "pointer", font: "inherit", fontSize: 13, color: "var(--ds-whatsapp)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 8, padding: "6px 11px", display: "inline-flex", alignItems: "center", gap: 6 }}><MessageCircle size={14} />WhatsApp</button>
                                    {tm.memberType === "agent" && <button onClick={() => setEditingAreasFor(tm)} style={{ cursor: "pointer", font: "inherit", fontSize: 13, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 8, padding: "6px 11px", display: "inline-flex", alignItems: "center", gap: 6 }}><MapPin size={14} />{t("staff.editAreas", "Areas")}</button>}
                                    {isOwner && <button onClick={() => void handleRemoveLogin(tm)} style={{ cursor: "pointer", font: "inherit", fontSize: 13, color: "var(--ds-negative)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 8, padding: "6px 11px", display: "inline-flex", alignItems: "center", gap: 6 }}><Trash2 size={14} />{t("staff.revokeLogin", "Revoke login")}</button>}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* right rail */}
            <aside className="lb-scroll" style={{ width: 318, flex: "none", overflow: "auto", padding: "22px 18px 22px 0", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Team app card */}
                <div style={{ ...dsCard, padding: "20px 18px" }}>
                    <div style={{ fontSize: 17.5, fontWeight: 600, marginBottom: 14 }}>{t("staff.teamAppCardTitle", "Laundrybill Team app")}</div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        <span style={{ width: 70, height: 128, flex: "none", border: "3px solid #111827", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", background: "#fff" }}>
                            <span style={{ position: "absolute", top: 5, width: 22, height: 4, borderRadius: 4, background: "#111827" }} />
                            <span style={{ width: 42, height: 42, borderRadius: 11, background: "var(--ds-blue)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Users size={22} /></span>
                        </span>
                        <div>
                            <div style={{ fontSize: 13, color: "var(--ds-text)", lineHeight: 1.55 }}>{t("staff.teamAppPitch", "Manage orders, mark attendance, update status and more on the go.")}</div>
                            <a href={TEAM_GOOGLE_PLAY_URL} target="_blank" rel="noopener noreferrer" style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8, background: "#000", color: "#fff", borderRadius: 7, padding: "6px 12px", textDecoration: "none" }}>
                                <Play size={20} fill="currentColor" />
                                <span style={{ lineHeight: 1.05 }}><span style={{ display: "block", fontSize: 8.5, letterSpacing: ".04em" }}>GET IT ON</span><span style={{ display: "block", fontSize: 16, fontWeight: 500 }}>Google Play</span></span>
                            </a>
                        </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>{t("staff.invitePreview", "Invite message preview")}</div>
                    <div style={{ background: "var(--ds-table-head)", border: "1px solid var(--ds-divider)", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                            {t("staff.inviteStep1", "Install the Laundrybill Team app")}<br />
                            → {t("staff.inviteStep2", "sign up with your email")}<br />
                            → {t("staff.inviteStep3", "enter invite code")} {previewCode ? <b style={{ fontWeight: 600 }}>{previewCode}</b> : <span style={{ color: "var(--ds-text-2)" }}>{t("staff.fromTheirLogin", "(from their login)")}</span>}
                        </div>
                        <button onClick={() => { if (inviteText) void copyText(inviteText, "panel"); }} disabled={!inviteText} title={!inviteText ? t("staff.selectWithLogin", "Select a staff member who has a login") : undefined}
                            style={{ marginTop: 12, width: "100%", cursor: inviteText ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 14, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 9, padding: "10px 12px", opacity: inviteText ? 1 : 0.55 }}>
                            {copiedId === "panel" ? <Check size={16} /> : <Copy size={16} />}{copiedId === "panel" ? t("common.copied", "Copied") : t("staff.copyMessage", "Copy message")}
                        </button>
                    </div>
                </div>

                {/* selected staff */}
                {sel && selAtt && (
                    <div style={{ ...dsCard, padding: "18px 14px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                            <span style={{ width: 52, height: 52, flex: "none", borderRadius: "50%", background: "#EDE9FE", color: "#6D28D9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, fontWeight: 600 }}>{(sel.name || "?").trim()[0]?.toUpperCase()}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 18, fontWeight: 600 }}>{sel.name}</div>
                                <div style={{ marginTop: 6 }}>{chip(roleChip(sel))}</div>
                            </div>
                            <button onClick={() => setPanelId(null)} aria-label={t("common.close", "Close")} style={{ cursor: "pointer", border: 0, background: "transparent", color: "var(--ds-text-2)", display: "inline-flex" }}><X size={20} /></button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "12px 0 14px 66px", fontSize: 13 }}>
                            {sel.phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><Phone size={15} style={{ color: "var(--ds-text-2)" }} />{sel.phone}</span>}
                            {sel.joiningDate?.toDate && <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><CalendarDays size={15} style={{ color: "var(--ds-text-2)" }} />{t("staff.joined", "Joined")} {format(sel.joiningDate.toDate(), "d MMM yyyy")}</span>}
                        </div>
                        <div style={{ display: "flex", border: "1px solid var(--ds-border)", borderRadius: 10 }}>
                            <div style={{ flex: 1, padding: "10px 6px", textAlign: "center", borderRight: "1px solid var(--ds-border)" }}>
                                <div style={{ fontSize: 11.5, fontWeight: 500 }}>{t("staff.attendanceMonth", "Attendance ({{m}})", { m: monthLabel })}</div>
                                <div style={{ position: "relative", width: 80, height: 80, margin: "10px auto 4px", borderRadius: "50%", background: `conic-gradient(#16A34A ${(selAtt.pct || 0) * 3.6}deg, #E5E7EB 0)` }}>
                                    <div style={{ position: "absolute", inset: 5, borderRadius: "50%", background: "var(--ds-card)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                        <span style={{ fontSize: 17, fontWeight: 600 }}>{selAtt.attended % 1 ? selAtt.attended.toFixed(1) : selAtt.attended}</span>
                                        <span style={{ fontSize: 9.5, color: "var(--ds-text-2)" }}>{t("staff.ofDays", "of {{n}} days", { n: selAtt.marked })}</span>
                                    </div>
                                </div>
                                <div style={{ fontSize: 12, color: pctColor(selAtt.pct) }}>{selAtt.pct == null ? "—" : `${selAtt.pct}%`}</div>
                            </div>
                            <div style={{ flex: 1, padding: "10px 12px" }}>
                                <div style={{ fontSize: 11.5, fontWeight: 500, textAlign: "center", marginBottom: 12 }}>{t("staff.thisMonth", "This month ({{m}})", { m: monthLabel })}</div>
                                {[[t("staff.presentDays", "Present days"), selAtt.present], [t("staff.halfDays", "Half days"), selAtt.half], [t("staff.leaveDays", "Leave days"), selAtt.leave]].map(([l, v]) => (
                                    <div key={String(l)} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 12 }}><span style={{ color: "var(--ds-text-2)" }}>{l}</span><span style={{ fontWeight: 500 }}>{v}</span></div>
                                ))}
                            </div>
                        </div>
                        <button onClick={() => navigate("/payroll")} style={{ marginTop: 12, width: "100%", cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 10, padding: "12px 10px", border: "1px solid var(--ds-border)", borderRadius: 10, background: "var(--ds-card)", color: "var(--ds-text)" }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{t("staff.payroll", "Payroll")}</span>
                            <span style={{ marginLeft: "auto", fontSize: 13.5 }}>{selPay ? `${formatAmount(selPay.netSalary).replace(/\.00$/, "")} ${t("staff.net", "net")}` : t("staff.notGenerated", "Not generated")}</span>
                            {selPay && <span style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 5, background: selPay.status === "paid" ? "#DCFCE7" : "#FEF3C7", color: selPay.status === "paid" ? "#15803D" : "#B45309" }}>{selPay.status === "paid" ? t("payroll.paid", "Paid") : t("payroll.pending", "Pending")}</span>}
                            <ChevronRight size={17} />
                        </button>
                        <div style={{ marginTop: 12, border: "1px solid var(--ds-border)", borderRadius: 10, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", fontSize: 13 }}><span>{t("staff.teamAppLogin", "Team app login")}</span><span style={{ marginLeft: "auto" }}>{chip(loginStatus(selLogin))}</span></div>
                            {selLogin && (
                                <div style={{ display: "flex", alignItems: "center", fontSize: 13 }}>
                                    <span>{t("staff.inviteCode", "Invite code")}</span>
                                    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                                        {selLogin.inviteCode}
                                        <button onClick={() => void copyText(selLogin.inviteCode, `code-${selLogin.id}`)} aria-label={t("common.copy", "Copy")} style={{ cursor: "pointer", border: 0, background: "transparent", color: "var(--ds-text-2)", display: "inline-flex", padding: 0 }}>{copiedId === `code-${selLogin.id}` ? <Check size={16} /> : <Copy size={16} />}</button>
                                    </span>
                                </div>
                            )}
                        </div>
                        {selLogin && isOwner ? (
                            <button onClick={() => void handleRemoveLogin(selLogin)} style={{ marginTop: 14, width: "100%", cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 14.5, fontWeight: 500, color: "var(--ds-negative)", background: "var(--ds-card)", border: "1px solid #FCA5A5", borderRadius: 9, padding: "10px 12px" }}>
                                <Trash2 size={17} />{t("staff.revokeLogin", "Revoke login")}
                            </button>
                        ) : !selLogin && isOwner && canTeamLogins ? (
                            <button onClick={() => createLoginFor(sel)} style={{ marginTop: 14, width: "100%", cursor: "pointer", font: "inherit", fontSize: 14.5, fontWeight: 600, color: "#fff", background: "var(--ds-blue)", border: 0, borderRadius: 9, padding: "11px 12px" }}>{t("staff.createLogin", "Create login")}</button>
                        ) : null}
                        <button onClick={() => onSelect?.(sel.id)} style={{ marginTop: 10, width: "100%", cursor: "pointer", font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--ds-blue)", background: "transparent", border: 0, padding: 6 }}>{t("staff.openFullProfile", "Open full profile")} →</button>
                    </div>
                )}
            </aside>

            <StaffFormSheet open={formSheetOpen} onClose={() => setFormSheetOpen(false)} />
            <TeamMemberAreasSheet open={!!editingAreasFor} onClose={() => setEditingAreasFor(null)} teamMember={editingAreasFor} />
            {createLoginFor_ && (
                <TeamMemberFormSheet open onClose={() => setCreateLoginFor(null)} prefill={{
                    name: createLoginFor_.name, email: createLoginFor_.email,
                    memberType: createLoginFor_.memberType === "plant" ? "plant" : createLoginFor_.memberType === "agent" ? "agent" : "staff",
                    staffId: createLoginFor_.id,
                }} />
            )}
        </div>
    );
}

/** Live count of orders currently out for delivery (the "On route now" tile). */
function useOutForDeliveryCount(): number {
    const { shopId } = useAuth();
    const [n, setN] = useState(0);
    useEffect(() => {
        if (!shopId) return;
        return onSnapshot(query(collection(db, `shops/${shopId}/orders`), where("status", "==", "out_for_delivery")), (snap) => setN(snap.size), () => setN(0));
    }, [shopId]);
    return n;
}
