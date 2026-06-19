/**
 * Staff Detail — 1000% to the design system (Staff.dc.html detail):
 * profile header · stat tiles · attendance · agent card · contact · payroll ·
 * app access · bank · join date. Wired to useStaff / attendance / payroll.
 */

import { useState, useMemo, type CSSProperties } from "react";
import { LSpinner, useLToast } from "@/components/laundry";
import { useStaff, useStaffMutations, useAttendance, usePayroll } from "@/hooks/use-staff";
import { useTeamMembers, useTeamMemberMutations } from "@/hooks/use-team-members";
import { StaffFormSheet } from "./StaffFormSheet";
import { TeamMemberFormSheet } from "./TeamMemberFormSheet";
import { ChevronLeft, Phone, MessageCircle, Edit, Power, Calendar, Wallet, Mail, Truck, Copy, KeyRound, Ban, Plus } from "lucide-react";
import type { MemberType } from "@/types/staff";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";

const MONO = "'IBM Plex Mono'";
const TINTS = ["c-primary", "c-violet", "c-info", "c-cyan", "c-success", "c-warning"];
const tintFor = (s: string) => { let h = 0; for (const c of s || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; };
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14, boxShadow: "var(--sh-sm)" };
const secLbl: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".05em", color: "var(--c-text-3)", marginBottom: 14 };
const hdrBtn: CSSProperties = { cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: 8, padding: "8px 13px" };

interface StaffDetailPanelProps {
    staffId: string;
    onClose?: () => void;
}

export function StaffDetailPanel({ staffId, onClose }: StaffDetailPanelProps) {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const { staff: staffList, loading } = useStaff();
    const { updateStaff, deactivateStaff } = useStaffMutations();
    const { getStaffSummary } = useAttendance(new Date());
    const { payroll } = usePayroll(format(new Date(), "yyyy-MM"));
    const { teamMembers } = useTeamMembers();
    const { deleteTeamMember } = useTeamMemberMutations();
    const { addToast } = useLToast();

    const [editSheetOpen, setEditSheetOpen] = useState(false);
    const [createLoginOpen, setCreateLoginOpen] = useState(false);

    const staff = useMemo(() => staffList.find((s) => s.id === staffId), [staffList, staffId]);
    const attendanceSummary = useMemo(() => getStaffSummary(staffId), [getStaffSummary, staffId]);
    const staffPayroll = useMemo(() => payroll.find((p) => p.staffId === staffId), [payroll, staffId]);

    if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}><LSpinner size="lg" /></div>;
    if (!staff) {
        return (
            <div style={{ textAlign: "center", padding: 48 }}>
                <p style={{ color: "var(--c-text-3)" }}>{t("staff.notFound", "Staff member not found")}</p>
                <button onClick={onClose} style={{ marginTop: 16, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-primary)", background: "var(--c-primary-soft)", border: 0, borderRadius: 8, padding: "8px 14px" }}>{t("common.goBack", "Back")}</button>
            </div>
        );
    }

    const handleUpdateStaff = async (data: Parameters<typeof updateStaff>[1]) => { await updateStaff(staff.id, data); setEditSheetOpen(false); };
    const handleDeactivate = async () => { await deactivateStaff(staff.id); };

    const ref = tintFor(staff.id);
    const initials = staff.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const roleMeta = staff.role === "admin" ? { label: t("staff.roleAdmin", "Admin"), tint: "c-primary" } : staff.memberType === "plant" ? { label: t("staff.rolePlant", "Plant"), tint: "c-cyan" } : staff.memberType === "agent" ? { label: t("staff.roleAgent", "Agent"), tint: "c-success" } : { label: t("staff.roleStaff", "Staff"), tint: "c-info" };
    const joined = staff.joiningDate?.toDate ? staff.joiningDate.toDate() : null;

    // Linked app login (owner-app pattern: match by staffId or email)
    const linkedLogin = teamMembers.find((tm) => tm.staffId === staff.id || (!!staff.email && tm.email?.toLowerCase() === staff.email.toLowerCase()));
    const loginMemberType: MemberType = staff.memberType === "plant" ? "plant" : staff.memberType === "agent" ? "agent" : "staff";
    const loginTypeLabel = linkedLogin?.memberType === "agent" ? t("staff.memberTypeAgent", "Delivery Agent") : linkedLogin?.memberType === "plant" ? t("staff.memberTypePlant", "Plant Operator") : t("staff.memberTypeStaff", "Staff App");
    const handleRevoke = async () => {
        if (!linkedLogin) return;
        if (!window.confirm(t("staff.revokeConfirm", `Remove app login access for ${staff.name}?`))) return;
        try { await deleteTeamMember(linkedLogin.id); addToast({ type: "success", title: t("staff.loginRevoked", "Login revoked") }); }
        catch (e) { console.error(e); addToast({ type: "error", title: t("common.error", "Could not revoke") }); }
    };

    const stats: { label: string; value: string }[] = [
        { label: staff.payType === "monthly" ? t("staff.monthlySalary", "Monthly salary") : t("staff.dailyWage", "Daily wage"), value: formatAmount(staff.baseSalary || 0) },
        { label: t("staff.present", "Present (month)"), value: String(attendanceSummary.present) },
        { label: t("staff.daysWorked", "Days worked"), value: staffPayroll ? String(staffPayroll.daysWorked) : "—" },
        { label: t("staff.netPay", "Net pay"), value: staffPayroll ? formatAmount(staffPayroll.netSalary) : "—" },
    ];
    const iconBtn = (color: string, soft: string): CSSProperties => ({ cursor: "pointer", width: 38, height: 38, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: `var(--${color})`, background: `var(--${soft})`, border: 0, borderRadius: 9 });
    const att = [
        { label: t("staff.present", "Present"), value: attendanceSummary.present, tint: "c-success" },
        { label: t("staff.absent", "Absent"), value: attendanceSummary.absent, tint: "c-error" },
        { label: t("staff.halfDay", "Half day"), value: attendanceSummary.half, tint: "c-warning" },
        { label: t("staff.leave", "Leave"), value: attendanceSummary.leave, tint: "c-info" },
    ];

    return (
        <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header */}
            <header style={{ position: "sticky", top: 0, zIndex: 5, flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 12, padding: "0 22px" }}>
                <button onClick={onClose} aria-label="Back" style={{ cursor: "pointer", width: 30, height: 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "transparent", border: 0, borderRadius: 7 }}><ChevronLeft size={18} /></button>
                <nav style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--c-text-3)", minWidth: 0 }}>
                    <button onClick={onClose} style={{ cursor: "pointer", font: "inherit", fontSize: 13, color: "var(--c-text-2)", background: "transparent", border: 0 }}>{t("staff.title", "Staff")}</button><span>/</span>
                    <span style={{ color: "var(--c-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{staff.name}</span>
                </nav>
                <div style={{ flex: 1 }} />
                <button onClick={() => setEditSheetOpen(true)} style={hdrBtn}><Edit size={15} />{t("common.edit", "Edit")}</button>
                <button onClick={handleDeactivate} style={{ ...hdrBtn, color: staff.isActive ? "var(--c-error)" : "var(--c-success)", borderColor: staff.isActive ? "var(--c-error)" : "var(--c-success)" }}><Power size={15} />{staff.isActive ? t("staff.deactivate", "Deactivate") : t("staff.activate", "Activate")}</button>
            </header>

            <div style={{ padding: "20px 22px 40px" }}>
                {/* profile header */}
                <div style={{ ...card, padding: "20px 22px", display: "flex", alignItems: "center", gap: 18, marginBottom: 16, flexWrap: "wrap" }}>
                    <span style={{ width: 60, height: 60, flex: "none", borderRadius: 16, background: `var(--${ref}-soft)`, color: `var(--${ref})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, fontWeight: 600 }}>{initials}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.01em" }}>{staff.name}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: `var(--${roleMeta.tint})`, background: `var(--${roleMeta.tint}-soft)`, padding: "3px 10px", borderRadius: 20 }}>{roleMeta.label}</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: staff.isActive ? "var(--c-success)" : "var(--c-text-3)", background: staff.isActive ? "var(--c-success-soft)" : "var(--c-surface-2)", padding: "3px 10px", borderRadius: 20 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: staff.isActive ? "var(--c-success)" : "var(--c-text-3)" }} />{staff.isActive ? t("common.active", "Active") : t("staff.inactive", "Inactive")}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, fontSize: 12.5, color: "var(--c-text-3)", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: MONO }}>{staff.phone}</span>
                            {staff.email && <><span>·</span><span>{staff.email}</span></>}
                            {joined && <><span>·</span><span>{t("staff.joinedShort", "Joined")} {format(joined, "MMM yyyy")}</span></>}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => window.open(`tel:${staff.phone}`)} aria-label="Call" style={iconBtn("c-primary", "c-primary-soft")}><Phone size={17} /></button>
                        <button onClick={() => window.open(`https://wa.me/${(staff.phone || "").replace(/\D/g, "")}`)} aria-label="WhatsApp" style={iconBtn("c-success", "c-success-soft")}><MessageCircle size={17} /></button>
                    </div>
                </div>

                {/* stat tiles */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
                    {stats.map((s) => (
                        <div key={s.label} style={{ ...card, padding: "15px 16px" }}>
                            <div style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{s.label}</div>
                            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: "-.02em", marginTop: 8 }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                <div className="lb-row" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    {/* LEFT */}
                    <div style={{ flex: 1.6, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* attendance */}
                        <div style={{ ...card, padding: "18px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", marginBottom: 15 }}>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{t("staff.attendance", "Attendance")}</div>
                                <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--c-text-3)" }}>{format(new Date(), "MMM yyyy")}</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                                {att.map((a) => (
                                    <div key={a.label} style={{ background: `var(--${a.tint}-soft)`, borderRadius: 11, padding: "12px 10px", textAlign: "center" }}>
                                        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 20, color: `var(--${a.tint})` }}>{a.value}</div>
                                        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--c-text-2)", marginTop: 3 }}>{a.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* agent card */}
                        {staff.memberType === "agent" && (
                            <div style={{ ...card, padding: "18px 20px" }}>
                                <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: ".05em", color: "var(--c-text-3)" }}><Truck size={14} />{t("staff.agentStatus", "AGENT STATUS")}</span>
                                    <label style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                        <span style={{ fontSize: 11.5, fontWeight: 600, color: staff.isOnline ? "var(--c-success)" : "var(--c-text-3)" }}>{staff.isOnline ? t("staff.online", "Online") : t("staff.offline", "Offline")}</span>
                                        <button type="button" role="switch" aria-checked={staff.isOnline ?? false} onClick={() => updateStaff(staff.id, { isOnline: !staff.isOnline })} aria-label="Online" style={{ position: "relative", cursor: "pointer", width: 44, height: 25, border: 0, borderRadius: 20, flex: "none", background: staff.isOnline ? "var(--c-success)" : "var(--c-border-strong)" }}><span style={{ position: "absolute", top: 3, left: 3, width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.3)", transition: "transform .15s", transform: staff.isOnline ? "translateX(19px)" : "translateX(0)" }} /></button>
                                    </label>
                                </div>
                                {staff.vehicle && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 9 }}><span style={{ color: "var(--c-text-2)" }}>{t("staff.vehicle", "Vehicle")}</span><span style={{ fontWeight: 600, textTransform: "capitalize" }}>{staff.vehicle.type}{staff.vehicle.number ? ` · ${staff.vehicle.number}` : ""}</span></div>}
                                {staff.serviceAreas && staff.serviceAreas.length > 0 && (
                                    <div style={{ marginTop: 6 }}>
                                        <div style={{ fontSize: 11.5, color: "var(--c-text-3)", marginBottom: 7 }}>{t("staff.serviceAreas", "Service areas")}</div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{staff.serviceAreas.map((a, i) => <span key={i} style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 7, padding: "4px 10px" }}>{a}</span>)}</div>
                                    </div>
                                )}
                                {staff.stats && (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--c-border)", textAlign: "center" }}>
                                        <div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 17 }}>{staff.stats.totalPickups}</div><div style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 2 }}>{t("staff.pickups", "Pickups")}</div></div>
                                        <div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 17 }}>{staff.stats.totalDeliveries}</div><div style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 2 }}>{t("staff.deliveries", "Deliveries")}</div></div>
                                        <div><div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 17 }}>{formatAmount(staff.stats.totalCollected)}</div><div style={{ fontSize: 10.5, color: "var(--c-text-3)", marginTop: 2 }}>{t("staff.collected", "Collected")}</div></div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT */}
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* contact */}
                        <div style={{ ...card, padding: "18px 20px" }}>
                            <div style={secLbl}>{t("staff.contactDetails", "CONTACT & INFO")}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 11 }}><span style={{ color: "var(--c-text-3)", flex: "none" }}><Phone size={16} /></span><span style={{ fontFamily: MONO, fontSize: 13 }}>{staff.phone}</span></div>
                                {staff.email && <div style={{ display: "flex", alignItems: "center", gap: 11 }}><span style={{ color: "var(--c-text-3)", flex: "none" }}><Mail size={16} /></span><span style={{ fontSize: 13, color: "var(--c-text-2)" }}>{staff.email}</span></div>}
                                {joined && <div style={{ display: "flex", alignItems: "center", gap: 11, paddingTop: 12, borderTop: "1px solid var(--c-border)" }}><span style={{ color: "var(--c-text-3)", flex: "none" }}><Calendar size={16} /></span><div><div style={{ fontSize: 13, fontWeight: 500 }}>{format(joined, "MMM d, yyyy")}</div><div style={{ fontSize: 11, color: "var(--c-text-3)" }}>{t("staff.joinDate", "Join date")}</div></div></div>}
                            </div>
                        </div>

                        {/* app login (linked teamMember) */}
                        <div style={{ ...card, padding: "18px 20px" }}>
                            <div style={secLbl}>{t("staff.appLogin", "APP LOGIN")}</div>
                            {linkedLogin ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: 13 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "var(--c-text-2)" }}>{t("staff.email", "Email")}</span><span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{linkedLogin.email}</span></div>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ color: "var(--c-text-2)" }}>{t("staff.inviteCode", "Invite code")}</span><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: MONO, fontWeight: 700, color: "var(--c-primary)", background: "var(--c-primary-soft)", padding: "3px 9px", borderRadius: 6 }}>{linkedLogin.inviteCode}</span><button onClick={() => navigator.clipboard.writeText(linkedLogin.inviteCode)} style={{ cursor: "pointer", color: "var(--c-primary)", background: "transparent", border: 0, display: "inline-flex" }}><Copy size={14} /></button></span></div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--c-text-2)" }}>{t("staff.type", "Type")}</span><span style={{ fontWeight: 600 }}>{loginTypeLabel}</span></div>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ color: "var(--c-text-2)" }}>{t("staff.status", "Status")}</span>{(() => { const ok = linkedLogin.inviteStatus === "accepted"; return <span style={{ fontSize: 11, fontWeight: 600, color: ok ? "var(--c-success)" : "var(--c-warning)", background: ok ? "var(--c-success-soft)" : "var(--c-warning-soft)", padding: "3px 9px", borderRadius: 20 }}>{ok ? t("staff.inviteAccepted", "Accepted") : t("staff.invitePending", "Pending")}</span>; })()}</div>
                                    <button onClick={handleRevoke} style={{ marginTop: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--c-error)", background: "var(--c-error-soft)", border: "1px solid var(--c-error-soft)", borderRadius: 10, padding: 11 }}><Ban size={15} />{t("staff.revokeLogin", "Revoke login access")}</button>
                                </div>
                            ) : (
                                <button onClick={() => setCreateLoginOpen(true)} style={{ width: "100%", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, font: "inherit", textAlign: "left", padding: 13, borderRadius: 11, border: "1px dashed var(--c-primary)", background: "var(--c-primary-soft)" }}>
                                    <span style={{ width: 36, height: 36, flex: "none", borderRadius: 9, background: "var(--c-surface)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><KeyRound size={17} /></span>
                                    <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--c-primary)" }}>{t("staff.createLogin", "Create Login")}</span><span style={{ display: "block", fontSize: 11.5, color: "var(--c-text-2)", marginTop: 1 }}>{t("staff.createLoginSub", "Give {{name}} app access — details pre-filled", { name: staff.name.split(" ")[0] || "this member" })}</span></span>
                                    <Plus size={18} style={{ color: "var(--c-primary)", flex: "none" }} />
                                </button>
                            )}
                        </div>

                        {/* payroll */}
                        {staffPayroll && (
                            <div style={{ ...card, padding: "18px 20px" }}>
                                <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: ".05em", color: "var(--c-text-3)" }}><Wallet size={14} />{t("staff.payroll", "PAYROLL")}</span>
                                    {(() => { const paid = staffPayroll.status === "paid"; return <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 600, color: paid ? "var(--c-success)" : "var(--c-warning)", background: paid ? "var(--c-success-soft)" : "var(--c-warning-soft)", padding: "3px 9px", borderRadius: 20 }}>{paid ? t("staff.paid", "Paid") : t("staff.pending", "Pending")}</span>; })()}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--c-text-2)" }}>{t("staff.daysWorked", "Days worked")}</span><span style={{ fontFamily: MONO, fontWeight: 600 }}>{staffPayroll.daysWorked}</span></div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--c-border)" }}><span style={{ fontWeight: 700 }}>{t("staff.netPay", "Net pay")}</span><span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16 }}>{formatAmount(staffPayroll.netSalary)}</span></div>
                                </div>
                            </div>
                        )}

                        {/* bank */}
                        {(staff.bankDetails?.bankName || staff.bankDetails?.accountNumber) && (
                            <div style={{ ...card, padding: "18px 20px" }}>
                                <div style={secLbl}>{t("staff.bankDetails", "BANK DETAILS")}</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                                    {staff.bankDetails?.bankName && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--c-text-2)" }}>{t("staff.bankName", "Bank")}</span><span style={{ fontWeight: 600 }}>{staff.bankDetails.bankName}</span></div>}
                                    {staff.bankDetails?.accountNumber && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--c-text-2)" }}>{t("staff.accountNumber", "Account")}</span><span style={{ fontFamily: MONO, fontWeight: 600 }}>{staff.bankDetails.accountNumber}</span></div>}
                                    {staff.bankDetails?.ifscCode && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--c-text-2)" }}>{t("staff.ifscCode", "IFSC")}</span><span style={{ fontFamily: MONO, fontWeight: 600 }}>{staff.bankDetails.ifscCode}</span></div>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <StaffFormSheet open={editSheetOpen} onClose={() => setEditSheetOpen(false)} staff={staff} onSubmit={handleUpdateStaff} />
            <TeamMemberFormSheet open={createLoginOpen} onClose={() => setCreateLoginOpen(false)} prefill={{ name: staff.name, email: staff.email, memberType: loginMemberType, staffId: staff.id }} />
        </div>
    );
}
