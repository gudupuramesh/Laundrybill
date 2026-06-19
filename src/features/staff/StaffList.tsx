/**
 * Staff List — 1000% to the design system (Staff.dc.html):
 * header (title + count + search + Add Staff / Add App Login) · KPI tiles ·
 * Roster / App Logins tabs · roster table · app-login cards. Wired to
 * useStaff + useTeamMembers (+ plan limits, invite copy/share, edit areas).
 */

import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { LEmptyState, LSkeletonList } from "@/components/laundry";
import { useStaff } from "@/hooks/use-staff";
import { useTeamMembers } from "@/hooks/use-team-members";
import { useShopLimits } from "@/hooks/use-shop-limits";
import { useCurrency } from "@/hooks/use-currency";
import { StaffFormSheet } from "./StaffFormSheet";
import { TeamMemberFormSheet } from "./TeamMemberFormSheet";
import { TeamMemberAreasSheet } from "./TeamMemberAreasSheet";
import { Users, UserCheck, Smartphone, Copy, MessageCircle, Check, MapPin, Search, Plus, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
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

function Kpi({ icon, value, label, tint }: { icon: ReactNode; value: ReactNode; label: string; tint: string }) {
    return (
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "15px 16px", boxShadow: "var(--sh-sm)", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 38, height: 38, flex: "none", borderRadius: 10, background: `var(--${tint}-soft)`, color: `var(--${tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
            <div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 21, letterSpacing: "-.02em" }}>{value}</div><div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{label}</div></div>
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
    const [searchParams, setSearchParams] = useSearchParams();
    const { formatAmount } = useCurrency();
    const [searchQuery, setSearchQuery] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [formSheetOpen, setFormSheetOpen] = useState(false);
    const [teamMemberSheetOpen, setTeamMemberSheetOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"roster" | "appLogins">("roster");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [editingAreasFor, setEditingAreasFor] = useState<TeamMember | null>(null);

    const { staff: staffList, activeStaff, loading } = useStaff();
    const { teamMembers, agentCount: appAgentCount, loading: teamMembersLoading } = useTeamMembers();
    const { checkLimit } = useShopLimits();

    const rosterLimit = checkLimit("maxRoster", activeStaff.length);
    const isRosterAddAllowed = rosterLimit.allowed;

    useEffect(() => {
        if (searchParams.get("new") === "true") {
            setFormSheetOpen(true);
            setSearchParams((params) => { params.delete("new"); return params; });
        }
    }, [searchParams, setSearchParams]);

    const displayStaff = showInactive ? staffList : activeStaff;
    const filteredStaff = displayStaff.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.phone.includes(searchQuery));
    const filteredTeamMembers = teamMembers.filter((tm) => tm.email.toLowerCase().includes(searchQuery.toLowerCase()) || (tm.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || tm.inviteCode.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleCopyInvite = (tm: { id: string; email: string; inviteCode: string; name?: string }) => {
        navigator.clipboard.writeText(`${tm.name || tm.email}\nEmail: ${tm.email}\nInvite Code: ${tm.inviteCode}`);
        setCopiedId(tm.id);
        setTimeout(() => setCopiedId(null), 2000);
    };
    const handleWhatsAppShare = (tm: { email: string; inviteCode: string; name?: string; memberType: string }) => {
        const link = `${window.location.origin}/${tm.memberType === "agent" ? "driver" : tm.memberType === "plant" ? "plant" : "staff"}/signup`;
        const msg = String(t("staff.whatsappInviteMessage", { name: tm.name || tm.email, code: tm.inviteCode, link }));
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    };

    const ghostBtn: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, font: "inherit", fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "6px 11px" };

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header */}
            <header style={{ flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "10px 22px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                    <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em" }}>{t("staff.title", "Staff")}</span>
                    <span style={{ fontSize: 12, color: "var(--c-text-3)", fontFamily: MONO }}>{staffList.length} {t("staff.members", "members")}</span>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ position: "relative" }}>
                    <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--c-text-3)" }} />
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="search" placeholder={t("staff.searchStaff", "Search staff…")}
                        style={{ width: 200, font: "inherit", fontSize: 13, color: "var(--c-text)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "8px 11px 8px 33px", outline: "none" }} />
                </div>
                <button onClick={() => setTeamMemberSheetOpen(true)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "8px 13px" }}><Smartphone size={15} />{t("staff.addAppLogin", "Add App Login")}</button>
                <button onClick={() => { if (isRosterAddAllowed) setFormSheetOpen(true); }} disabled={!isRosterAddAllowed} style={{ cursor: isRosterAddAllowed ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 8, padding: "8px 14px", boxShadow: "var(--sh-sm)", opacity: isRosterAddAllowed ? 1 : 0.55 }}><Plus size={15} />{t("staff.addStaff", "Add Staff")}</button>
            </header>

            {/* tabs */}
            <div className="lb-thin" style={{ flex: "none", background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", padding: "10px 22px", display: "flex", gap: 8, overflowX: "auto" }}>
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

            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: "20px 22px 40px", minHeight: 0 }}>
                {/* KPIs */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
                    <Kpi icon={<Users size={18} />} value={staffList.length} label={t("staff.totalStaff", "Total staff")} tint="c-primary" />
                    <Kpi icon={<UserCheck size={18} />} value={activeStaff.length} label={t("staff.activeStaff", "Active")} tint="c-success" />
                    <Kpi icon={<Smartphone size={18} />} value={teamMembers.length} label={t("staff.appLogins", "App logins")} tint="c-violet" />
                    <Kpi icon={<MapPin size={18} />} value={appAgentCount} label={t("staff.agents", "Delivery agents")} tint="c-info" />
                </div>

                {activeTab === "roster" ? (
                    loading ? (
                        <LSkeletonList count={8} />
                    ) : filteredStaff.length === 0 ? (
                        <LEmptyState icon={<Users className="h-8 w-8" />} title={searchQuery ? t("common.noResults", "No matches") : t("staff.empty", "No staff yet")} description={searchQuery ? t("common.tryDifferentSearch", "Try another name or number.") : t("staff.emptyDesc", "Add your first team member.")} action={!searchQuery ? { label: t("staff.addStaff", "Add Staff"), onClick: () => setFormSheetOpen(true) } : undefined} />
                    ) : (
                        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)", overflow: "hidden" }}>
                            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--c-border)", fontSize: 14, fontWeight: 600 }}>{t("staff.teamRoster", "Team roster")}</div>
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
                        </div>
                    )
                ) : (
                    /* App Logins */
                    teamMembersLoading ? (
                        <LSkeletonList count={4} />
                    ) : teamMembers.length === 0 ? (
                        <LEmptyState icon={<Smartphone className="h-8 w-8" />} title={t("staff.noAppLogins", "No App Logins")} description={t("staff.noAppLoginsDesc", "Create app logins for Staff App, Agents, or Plant operators.")} action={{ label: t("staff.addAppLogin", "Add App Login"), onClick: () => setTeamMemberSheetOpen(true) }} />
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
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}
            </div>

            <StaffFormSheet open={formSheetOpen} onClose={() => setFormSheetOpen(false)} />
            <TeamMemberFormSheet open={teamMemberSheetOpen} onClose={() => setTeamMemberSheetOpen(false)} />
            <TeamMemberAreasSheet open={!!editingAreasFor} onClose={() => setEditingAreasFor(null)} teamMember={editingAreasFor} />
        </div>
    );
}
