/**
 * MOBILE Staff / Attendance / Payroll — clones of the owner app's
 * StaffListScreen, AttendanceScreen and the payroll list:
 *  · Staff      — header + stats card (TOTAL | ACTIVE | INACTIVE | LOGINS) +
 *                 avatar rows with a key badge for app logins and a status pill.
 *  · Attendance — Daily Log / Monthly Overview segmented control, date stepper,
 *                 "tap a status — it saves automatically" hint, and one card per
 *                 person with a 4-column P/A/H/L grid.
 *  · Payroll    — month stepper + per-staff rows with net salary and amount due.
 *
 * Desktop keeps the master-detail pages.
 */

import type { CSSProperties, ReactNode } from "react";
import { MPageShell, MAvatar } from "@/components/laundry/LMobileRows";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, CalendarDays, Zap, Check, KeyRound, Users } from "lucide-react";

const AV = ["c-primary", "c-info", "c-violet", "c-cyan", "c-success", "c-warning"];
const card: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 18, boxShadow: "var(--sh-sm)" };

/* ── Staff roster ─────────────────────────────────────────────────────── */
export function MobileStaffList({ staff, activeCount, loginCount, loginCap, agentCount, hasLogin, onBack, onOpen, onAdd }: {
    staff: { id: string; name: string; phone?: string; role?: string; isActive?: boolean }[];
    activeCount: number; loginCount: number; loginCap: number; agentCount: number;
    hasLogin: (id: string) => boolean;
    onBack: () => void; onOpen: (id: string) => void; onAdd?: () => void;
}) {
    const { t } = useTranslation();
    const inactive = staff.length - activeCount;
    const overCap = loginCap > 0 && loginCount > loginCap;

    return (
        <MPageShell title={t("staff.title", "Staff")} sub={`${staff.length} ${t("staff.members", "members")}`} onBack={onBack}
            right={onAdd ? <button onClick={onAdd} aria-label={t("staff.addStaff", "Add Staff")} style={{ cursor: "pointer", flex: "none", width: 40, height: 40, borderRadius: 20, border: 0, background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700 }}>+</button> : undefined}>
            {/* Stats card */}
            <div style={{ ...card, padding: "10px 8px", display: "flex", alignItems: "stretch", marginBottom: 14 }}>
                {[
                    { label: t("staff.total", "Total"), value: String(staff.length) },
                    { label: t("common.active", "Active"), value: String(activeCount) },
                    { label: t("staff.inactive", "Inactive"), value: String(inactive) },
                    { label: t("staff.appLogins", "Logins"), value: loginCap > 0 ? `${loginCount}/${loginCap}` : String(loginCount), color: overCap ? "var(--c-error)" : "var(--c-primary)" },
                ].map((st, i) => (
                    <div key={st.label} style={{ flex: 1, display: "flex", minWidth: 0 }}>
                        {i > 0 && <span style={{ width: 1, background: "var(--c-border)", margin: "0 4px", flex: "none" }} />}
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: ".3px", whiteSpace: "nowrap" }}>{st.label}</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: st.color || "var(--c-text)" }}>{st.value}</span>
                        </div>
                    </div>
                ))}
            </div>

            {staff.length === 0 ? (
                <div style={{ ...card, padding: "48px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <Users size={44} style={{ color: "var(--c-text-3)" }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-text-2)" }}>{t("staff.empty", "No staff yet")}</span>
                    <span style={{ fontSize: 12, color: "var(--c-text-3)" }}>{t("staff.emptyDesc", "Add your first team member.")}</span>
                </div>
            ) : (
                <div style={{ ...card, overflow: "hidden" }}>
                    {staff.map((m, i) => {
                        const isActive = m.isActive !== false;
                        return (
                            <div key={m.id} role="button" tabIndex={0} onClick={() => onOpen(m.id)}
                                onKeyDown={(e) => { if (e.key === "Enter") onOpen(m.id); }}
                                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer", borderBottom: i < staff.length - 1 ? "1px solid var(--c-border)" : "none" }}>
                                <MAvatar name={m.name || "?"} tint={AV[i % AV.length]} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                                        {hasLogin(m.id) && (
                                            <span style={{ width: 18, height: 18, flex: "none", borderRadius: 9, background: "var(--c-primary-soft)", color: "var(--c-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><KeyRound size={11} /></span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 13, color: "var(--c-text-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {m.phone || "—"} · {m.role || "Staff"}
                                    </div>
                                </div>
                                <span style={{ flex: "none", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: isActive ? "var(--c-success-soft)" : "var(--c-warning-soft)", color: isActive ? "var(--c-success)" : "var(--c-warning)" }}>
                                    {isActive ? t("common.active", "Active") : t("staff.inactive", "Inactive")}
                                </span>
                                <ChevronRight size={16} style={{ flex: "none", color: "var(--c-text-3)" }} />
                            </div>
                        );
                    })}
                    <div style={{ padding: "10px 16px", fontSize: 11.5, color: "var(--c-text-3)", borderTop: "1px solid var(--c-border)" }}>
                        {agentCount} {t("staff.agents", "delivery agents")}
                    </div>
                </div>
            )}
        </MPageShell>
    );
}

/* ── Attendance ───────────────────────────────────────────────────────── */
export function MobileAttendance({
    tab, onTabChange, dateLabel, canNext, onPrevDate, onNextDate,
    staff, statusFor, onMark, statusDefs, savingId, monthView, onBack,
}: {
    tab: "daily" | "monthly"; onTabChange: (t: "daily" | "monthly") => void;
    dateLabel: string; canNext: boolean; onPrevDate: () => void; onNextDate: () => void;
    staff: { id: string; name: string; role?: string }[];
    statusFor: (staffId: string) => string | undefined;
    onMark: (staffId: string, status: string) => void;
    statusDefs: { key: string; short: string; label: string; tint: string }[];
    savingId?: string | null;
    monthView: ReactNode;
    onBack: () => void;
}) {
    const { t } = useTranslation();
    return (
        <MPageShell title={t("attendance.title", "Staff Attendance")} onBack={onBack}>
            {/* Segmented control */}
            <div style={{ display: "flex", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 12, padding: 3, marginBottom: 14 }}>
                {([{ id: "daily", label: t("attendance.dailyLog", "Daily Log") }, { id: "monthly", label: t("attendance.monthlyOverview", "Monthly Overview") }] as const).map((tb) => {
                    const on = tab === tb.id;
                    return (
                        <button key={tb.id} onClick={() => onTabChange(tb.id)} style={{ cursor: "pointer", flex: 1, font: "inherit", fontSize: 13, fontWeight: 700, padding: "9px 6px", border: 0, borderRadius: 9, background: on ? "var(--c-surface)" : "transparent", color: on ? "var(--c-text)" : "var(--c-text-3)", boxShadow: on ? "var(--sh-sm)" : undefined }}>
                            {tb.label}
                        </button>
                    );
                })}
            </div>

            {tab === "monthly" ? monthView : (
                <>
                    {/* Date stepper */}
                    <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", marginBottom: 12 }}>
                        <button onClick={onPrevDate} aria-label="Previous day" style={{ cursor: "pointer", width: 34, height: 34, borderRadius: 9, border: 0, background: "var(--c-surface-2)", color: "var(--c-text)", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={20} /></button>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 700 }}>
                            <CalendarDays size={16} style={{ color: "var(--c-primary)" }} />{dateLabel}
                        </span>
                        <button onClick={onNextDate} disabled={!canNext} aria-label="Next day" style={{ cursor: canNext ? "pointer" : "not-allowed", opacity: canNext ? 1 : 0.3, width: 34, height: 34, borderRadius: 9, border: 0, background: "var(--c-surface-2)", color: "var(--c-text)", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={20} /></button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, color: "var(--c-text-3)", fontSize: 12 }}>
                        <Zap size={14} />{t("attendance.autosaveHint", "Tap a status — it saves automatically")}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {staff.map((m, i) => {
                            const current = statusFor(m.id);
                            return (
                                <div key={m.id} style={{ ...card, padding: 14 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                                        <MAvatar name={m.name || "?"} tint={AV[i % AV.length]} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                                            {m.role && <div style={{ fontSize: 12, color: "var(--c-text-3)" }}>{m.role}</div>}
                                        </div>
                                        {savingId === m.id ? <span style={{ fontSize: 11, color: "var(--c-text-3)" }}>…</span>
                                            : current ? <Check size={20} style={{ color: "var(--c-success)" }} /> : null}
                                    </div>
                                    <div style={{ display: "flex", gap: 7 }}>
                                        {statusDefs.map((sd) => {
                                            const on = current === sd.key;
                                            return (
                                                <button key={sd.key} onClick={() => onMark(m.id, sd.key)}
                                                    style={{ cursor: "pointer", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "9px 2px", borderRadius: 10, font: "inherit",
                                                        border: `1px solid ${on ? `var(--${sd.tint})` : "var(--c-border)"}`,
                                                        background: on ? `var(--${sd.tint}-soft)` : "var(--c-surface)",
                                                        color: on ? `var(--${sd.tint})` : "var(--c-text-2)" }}>
                                                    <span style={{ fontSize: 15, fontWeight: 700 }}>{sd.short}</span>
                                                    <span style={{ fontSize: 10, fontWeight: 600 }}>{sd.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </MPageShell>
    );
}

/* ── Payroll ──────────────────────────────────────────────────────────── */
export function MobilePayroll({ monthLabel, canNext, onPrevMonth, onNextMonth, rows, onOpen, onBack, formatAmount }: {
    monthLabel: string; canNext: boolean; onPrevMonth: () => void; onNextMonth: () => void;
    rows: { id: string; name: string; daysWorked?: number; netSalary?: number; paid?: number; remaining?: number; statusLabel?: string; statusTint?: string }[];
    onOpen: (id: string) => void; onBack: () => void; formatAmount: (n: number) => string;
}) {
    const { t } = useTranslation();
    const totalNet = rows.reduce((s, r) => s + (r.netSalary || 0), 0);
    const totalDue = rows.reduce((s, r) => s + (r.remaining || 0), 0);

    return (
        <MPageShell title={t("staff.payroll", "Payroll")} sub={monthLabel} onBack={onBack}
            right={
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={onPrevMonth} aria-label="Previous month" style={{ cursor: "pointer", width: 40, height: 40, borderRadius: 20, border: 0, background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={19} /></button>
                    <button onClick={onNextMonth} disabled={!canNext} aria-label="Next month" style={{ cursor: canNext ? "pointer" : "not-allowed", opacity: canNext ? 1 : 0.35, width: 40, height: 40, borderRadius: 20, border: 0, background: "var(--c-surface-2)", color: "var(--c-text-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={19} /></button>
                </div>
            }>
            <div style={{ ...card, padding: "10px 8px", display: "flex", alignItems: "stretch", marginBottom: 14 }}>
                {[
                    { label: t("staff.staffCount", "Staff"), value: String(rows.length) },
                    { label: t("staff.netSalary", "Net salary"), value: formatAmount(totalNet) },
                    { label: t("staff.due", "Due"), value: formatAmount(totalDue), color: totalDue > 0 ? "var(--c-warning)" : undefined },
                ].map((st, i) => (
                    <div key={st.label} style={{ flex: 1, display: "flex", minWidth: 0 }}>
                        {i > 0 && <span style={{ width: 1, background: "var(--c-border)", margin: "0 4px", flex: "none" }} />}
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: "var(--c-text-2)", textTransform: "uppercase", letterSpacing: ".3px", whiteSpace: "nowrap" }}>{st.label}</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: st.color || "var(--c-text)" }}>{st.value}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ ...card, overflow: "hidden" }}>
                {rows.map((r, i) => (
                    <div key={r.id} role="button" tabIndex={0} onClick={() => onOpen(r.id)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(r.id); }}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer", borderBottom: i < rows.length - 1 ? "1px solid var(--c-border)" : "none" }}>
                        <MAvatar name={r.name || "?"} tint={AV[i % AV.length]} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                                {r.statusLabel && <span style={{ flex: "none", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: `var(--${r.statusTint || "c-text-3"}-soft)`, color: `var(--${r.statusTint || "c-text-3"})` }}>{r.statusLabel}</span>}
                            </div>
                            <div style={{ fontSize: 12.5, color: "var(--c-text-2)", marginTop: 2 }}>
                                {r.daysWorked != null ? `${r.daysWorked} ${t("staff.daysWorked", "days")}` : t("staff.notGenerated", "Not generated")}
                                {r.paid ? ` · ${t("staff.paid", "Paid")} ${formatAmount(r.paid)}` : ""}
                            </div>
                        </div>
                        <div style={{ flex: "none", textAlign: "right" }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{r.netSalary != null ? formatAmount(r.netSalary) : "—"}</div>
                            {!!r.remaining && r.remaining > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--c-warning)" }}>{formatAmount(r.remaining)} {t("staff.due", "due")}</div>}
                        </div>
                        <ChevronRight size={16} style={{ flex: "none", color: "var(--c-text-3)" }} />
                    </div>
                ))}
            </div>
        </MPageShell>
    );
}
