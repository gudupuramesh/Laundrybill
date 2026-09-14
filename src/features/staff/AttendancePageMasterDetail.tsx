/**
 * Attendance — 1000% to the design system (Attendance.dc.html):
 * header (date + Day/Month toggle + Mark all present) · KPI row · branch filter ·
 * Day view (per-staff status marking) · Month grid. Wired to useStaff +
 * useAttendance + useAttendanceMutations. Status-based (no clock times in model).
 */

import { useState, useMemo, type CSSProperties, type ReactNode } from "react";
import { LSpinner } from "@/components/laundry";
import { MobileAttendance } from "./MobileStaff";
import { useNavigate } from "react-router-dom";
import { useStaff, useAttendance, useAttendanceMutations } from "@/hooks/use-staff";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AttendanceStatus } from "@/types/staff";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, addMonths, addDays, isSameMonth, isAfter } from "date-fns";
import { Check, X, Clock, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Plane, Sun, CircleCheck, CircleX, CircleHelp, UserCheck, MoreVertical, Info, Eraser, UserRound } from "lucide-react";

const AV = ["c-primary", "c-info", "c-violet", "c-cyan", "c-success", "c-warning"];
const av = (i: number) => AV[i % AV.length];

const STATUS: Record<string, { label: string; tint: string }> = {
    present: { label: "Present", tint: "c-success" },
    absent: { label: "Absent", tint: "c-error" },
    half: { label: "Half day", tint: "c-warning" },
    leave: { label: "On leave", tint: "c-violet" },
    holiday: { label: "Holiday", tint: "c-info" },
};
const QUICK: { status: AttendanceStatus; short: string; tint: string }[] = [
    { status: "present", short: "P", tint: "c-success" },
    { status: "half", short: "½", tint: "c-warning" },
    { status: "absent", short: "A", tint: "c-error" },
    { status: "leave", short: "L", tint: "c-violet" },
];

export function AttendancePageMasterDetail() {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const [view, setView] = useState<"day" | "month">("day");
    const now = useMemo(() => new Date(), []);
    const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
    const [dayDate, setDayDate] = useState(() => new Date());
    const dayKey = format(dayDate, "yyyy-MM-dd");
    const atCurrentMonth = isSameMonth(viewMonth, now);

    const { activeStaff, loading } = useStaff();
    const { attendance } = useAttendance(viewMonth);
    const { markAttendance, markBulkAttendance, updateAttendanceDetails, clearAttendance } = useAttendanceMutations();
    const [rowMenu, setRowMenu] = useState<string | null>(null);
    const showLoading = useMinLoading(loading, { minDuration: 500 });

    const prevMonth = () => { const m = addMonths(viewMonth, -1); setViewMonth(m); setDayDate(startOfMonth(m)); };
    const nextMonth = () => { if (atCurrentMonth) return; const m = addMonths(viewMonth, 1); setViewMonth(m); setDayDate(isSameMonth(m, now) ? now : startOfMonth(m)); };
    const prevDay = () => { const d = addDays(dayDate, -1); if (isSameMonth(d, viewMonth)) setDayDate(d); };
    const nextDay = () => { const d = addDays(dayDate, 1); if (isSameMonth(d, viewMonth) && !isAfter(d, now)) setDayDate(d); };
    const canNextDay = isSameMonth(addDays(dayDate, 1), viewMonth) && !isAfter(addDays(dayDate, 1), now);

    // today's status by staff
    const todayByStaff = useMemo(() => {
        const m = new Map<string, AttendanceStatus>();
        attendance.filter((a) => a.date === dayKey).forEach((a) => m.set(a.staffId, a.status));
        return m;
    }, [attendance, dayKey]);

    // month grid: per-staff per-date status
    const monthMeta = useMemo(() => {
        const year = viewMonth.getFullYear(), month = viewMonth.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const cols = Array.from({ length: days }, (_, i) => {
            const d = new Date(year, month, i + 1);
            return { n: i + 1, key: format(d, "yyyy-MM-dd"), weekend: d.getDay() === 0 || d.getDay() === 6 };
        });
        const byStaff = new Map<string, Map<string, AttendanceStatus>>();
        attendance.forEach((a) => { if (!byStaff.has(a.staffId)) byStaff.set(a.staffId, new Map()); byStaff.get(a.staffId)!.set(a.date, a.status); });
        return { cols, byStaff };
    }, [attendance, viewMonth]);

    const counts = useMemo(() => {
        let present = 0, absent = 0, half = 0, leave = 0;
        todayByStaff.forEach((s) => { if (s === "present") present++; else if (s === "absent") absent++; else if (s === "half") half++; else if (s === "leave") leave++; });
        return { present, absent, half, leave, unmarked: Math.max(0, activeStaff.length - todayByStaff.size) };
    }, [todayByStaff, activeStaff.length]);

    const setStatus = (staffId: string, status: AttendanceStatus) => { void markAttendance(staffId, dayKey, status); };
    const markAllPresent = () => { const todo = activeStaff.filter((s) => !todayByStaff.has(s.id)).map((s) => ({ staffId: s.id, date: dayKey, status: "present" as AttendanceStatus })); if (todo.length) void markBulkAttendance(todo); };

    if (showLoading) return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-bg)" }}><LSpinner size="lg" /></div>;

    const navBtn: CSSProperties = { cursor: "pointer", width: 30, height: 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 7 };

    // MOBILE: the owner app's AttendanceScreen (Daily Log / Monthly Overview).
    if (isMobile) return (
        <MobileAttendance
            tab={view === "day" ? "daily" : "monthly"}
            onTabChange={(tb) => setView(tb === "daily" ? "day" : "month")}
            dateLabel={format(dayDate, "EEE, MMM d")}
            canNext={canNextDay}
            onPrevDate={prevDay}
            onNextDate={nextDay}
            staff={activeStaff}
            statusFor={(id) => todayByStaff.get(id)}
            onMark={(id, st) => setStatus(id, st as AttendanceStatus)}
            statusDefs={QUICK.map((q) => ({ key: q.status, short: q.short, label: STATUS[q.status].label, tint: q.tint }))}
            onBack={() => navigate("/settings")}
            monthView={
                <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 18, boxShadow: "var(--sh-sm)", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--c-border)" }}>
                        <button onClick={prevMonth} aria-label="Previous month" style={navBtn}><ChevronLeft size={16} /></button>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{format(viewMonth, "MMMM yyyy")}</span>
                        <button onClick={nextMonth} disabled={atCurrentMonth} aria-label="Next month" style={{ ...navBtn, opacity: atCurrentMonth ? 0.4 : 1, cursor: atCurrentMonth ? "not-allowed" : "pointer" }}><ChevronRight size={16} /></button>
                    </div>
                    {/* Per-person month totals — the day-by-day grid needs a desktop-width table. */}
                    {activeStaff.map((s, i) => {
                        const marks = monthMeta.byStaff.get(s.id);
                        let present = 0, absent = 0, half = 0, leave = 0;
                        marks?.forEach((st) => { if (st === "present") present++; else if (st === "absent") absent++; else if (st === "half") half++; else if (st === "leave") leave++; });
                        return (
                            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i > 0 ? "1px solid var(--c-border)" : "none" }}>
                                <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                                {[{ n: present, tint: "c-success" }, { n: half, tint: "c-warning" }, { n: absent, tint: "c-error" }, { n: leave, tint: "c-violet" }].map((b, bi) => (
                                    <span key={bi} style={{ flex: "none", minWidth: 30, textAlign: "center", fontSize: 12, fontWeight: 700, padding: "3px 7px", borderRadius: 7, background: `var(--${b.tint}-soft)`, color: `var(--${b.tint})` }}>{b.n}</span>
                                ))}
                            </div>
                        );
                    })}
                </div>
            }
        />
    );

    // ---- desktop (reference layout) ------------------------------------------
    const todayKey = format(now, "yyyy-MM-dd");
    const recByStaff = new Map(attendance.filter((a) => a.date === dayKey).map((a) => [a.staffId, a]));
    const roleText = (r?: string) => ({ admin: t("staff.roleAdmin", "Admin"), manager: t("staff.roleManager", "Manager"), staff: t("staff.roleStaff", "Staff"), plant_operator: t("staff.rolePlant", "Plant operator") } as Record<string, string>)[r || "staff"] || (r || "");

    const goToDay = (d: Date) => {
        if (isAfter(d, now)) return;
        setDayDate(d);
        if (!isSameMonth(d, viewMonth)) setViewMonth(startOfMonth(d));
    };
    const canNext = !isAfter(addDays(dayDate, 1), now);

    const saveNote = (staffId: string, value: string) => {
        const rec = recByStaff.get(staffId);
        if (!rec || (rec.notes || "") === value) return;
        void updateAttendanceDetails(staffId, dayKey, { notes: value });
    };

    const SEG: { status: AttendanceStatus; label: string; on: { bg: string; fg: string; bd: string } }[] = [
        { status: "present", label: t("attendance.present", "Present"), on: { bg: "#DCFCE7", fg: "#15803D", bd: "#86EFAC" } },
        { status: "half", label: t("attendance.half", "Half"), on: { bg: "#FEF3C7", fg: "#B45309", bd: "#FCD34D" } },
        { status: "absent", label: t("attendance.absent", "Absent"), on: { bg: "#FEE2E2", fg: "#B91C1C", bd: "#FCA5A5" } },
        { status: "leave", label: t("attendance.leave", "Leave"), on: { bg: "#F3F4F6", fg: "#374151", bd: "#9CA3AF" } },
    ];

    const CELL: Record<string, { bg: string; fg: string; icon: ReactNode }> = {
        present: { bg: "#DCFCE7", fg: "#16A34A", icon: <Check size={11} strokeWidth={3} /> },
        half: { bg: "#FEF3C7", fg: "#D97706", icon: <Clock size={11} strokeWidth={2.6} /> },
        absent: { bg: "#FEE2E2", fg: "#DC2626", icon: <X size={11} strokeWidth={3} /> },
        leave: { bg: "#E5E7EB", fg: "#6B7280", icon: <Plane size={10} strokeWidth={2.4} /> },
        holiday: { bg: "#DBEAFE", fg: "#2563EB", icon: <Sun size={10} strokeWidth={2.4} /> },
    };

    const kpiCards = [
        { label: t("attendance.present", "Present"), value: counts.present, icon: <CircleCheck size={22} />, bg: "#DCFCE7", fg: "#16A34A" },
        { label: t("attendance.halfDay", "Half day"), value: counts.half, icon: <Clock size={22} />, bg: "#FEF3C7", fg: "#D97706" },
        { label: t("attendance.absent", "Absent"), value: counts.absent, icon: <CircleX size={22} />, bg: "#FEE2E2", fg: "#DC2626" },
        { label: t("attendance.leave", "Leave"), value: counts.leave, icon: <Plane size={21} />, bg: "#F3F4F6", fg: "#4B5563" },
        { label: t("attendance.notMarked", "Not marked"), value: counts.unmarked, icon: <CircleHelp size={22} />, bg: "#F3F4F6", fg: "#4B5563" },
    ];

    const dsCard: CSSProperties = { background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };
    const squareBtn: CSSProperties = { cursor: "pointer", width: 42, height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 11 };
    const initialOf = (n: string) => (n || "?").trim()[0]?.toUpperCase();
    const avStyle = (i: number): CSSProperties => ({ width: 30, height: 30, flex: "none", borderRadius: "50%", background: `var(--${av(i)}-soft)`, color: `var(--${av(i)})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 });

    const monthGrid = (
        <div style={{ ...dsCard, overflow: "hidden" }}>
            <div className="lb-scroll" style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1100 }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: "left", padding: "12px 12px 8px 16px", fontSize: 15, fontWeight: 600, minWidth: 190, position: "sticky", left: 0, background: "var(--ds-card)", zIndex: 1 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                    <button onClick={prevMonth} aria-label={t("attendance.prevMonth", "Previous month")} style={{ cursor: "pointer", border: 0, background: "transparent", color: "var(--ds-text-2)", display: "inline-flex", padding: 2 }}><ChevronLeft size={16} /></button>
                                    {format(viewMonth, "MMMM")}
                                    <button onClick={nextMonth} disabled={atCurrentMonth} aria-label={t("attendance.nextMonth", "Next month")} style={{ cursor: atCurrentMonth ? "default" : "pointer", border: 0, background: "transparent", color: "var(--ds-text-2)", display: "inline-flex", padding: 2, opacity: atCurrentMonth ? 0.35 : 1 }}><ChevronRight size={16} /></button>
                                </span>
                            </th>
                            {monthMeta.cols.map((c) => {
                                const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), c.n);
                                const sel = c.key === dayKey;
                                return (
                                    <th key={c.n} style={{ padding: "10px 0 6px", textAlign: "center", fontWeight: 500, minWidth: 30 }}>
                                        <button onClick={() => goToDay(d)} disabled={isAfter(d, now)} style={{ cursor: isAfter(d, now) ? "default" : "pointer", font: "inherit", border: 0, background: "transparent", padding: 0, display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                                            <span style={{ width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, background: sel ? "var(--ds-blue)" : "transparent", color: sel ? "#fff" : c.key === todayKey ? "var(--ds-blue)" : "var(--ds-text)", fontWeight: sel || c.key === todayKey ? 600 : 500 }}>{c.n}</span>
                                            <span style={{ fontSize: 10.5, color: "var(--ds-text-2)" }}>{format(d, "EEEEE")}</span>
                                        </button>
                                    </th>
                                );
                            })}
                            <th style={{ padding: "12px 16px 8px", textAlign: "center", fontSize: 13.5, fontWeight: 500, color: "var(--ds-text-2)", minWidth: 110 }}>{t("attendance.totals", "Totals")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activeStaff.map((s, i) => {
                            const recs = monthMeta.byStaff.get(s.id) || new Map<string, AttendanceStatus>();
                            let p = 0, h = 0, ab = 0, l = 0;
                            recs.forEach((st) => { if (st === "present") p++; else if (st === "half") h++; else if (st === "absent") ab++; else if (st === "leave") l++; });
                            return (
                                <tr key={s.id} style={{ borderTop: "1px solid var(--ds-divider)" }}>
                                    <td style={{ padding: "6px 12px 6px 16px", position: "sticky", left: 0, background: "var(--ds-card)", zIndex: 1 }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <span style={{ ...avStyle(i), width: 24, height: 24, fontSize: 11.5 }}>{initialOf(s.name)}</span>
                                            <span style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                                        </span>
                                    </td>
                                    {monthMeta.cols.map((c) => {
                                        const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), c.n);
                                        const future = isAfter(d, now);
                                        const st = recs.get(c.key);
                                        const cell = st ? CELL[st] : null;
                                        return (
                                            <td key={c.n} style={{ padding: "5px 0", textAlign: "center" }}>
                                                <button onClick={() => goToDay(d)} disabled={future} title={`${format(d, "d MMM")} · ${st ? (STATUS[st]?.label || st) : future ? "—" : t("attendance.notMarked", "Not marked")}`}
                                                    style={{ cursor: future ? "default" : "pointer", width: 17, height: 17, padding: 0, borderRadius: 4, border: cell ? 0 : `1px solid ${future ? "transparent" : "#E5E7EB"}`, background: cell ? cell.bg : future ? "transparent" : "#F9FAFB", color: cell ? cell.fg : "#9CA3AF", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 600, outline: c.key === dayKey ? "1.5px solid var(--ds-blue)" : undefined, outlineOffset: 1 }}>
                                                    {cell ? cell.icon : future ? "—" : "?"}
                                                </button>
                                            </td>
                                        );
                                    })}
                                    <td style={{ padding: "6px 16px", textAlign: "center", fontSize: 13, whiteSpace: "nowrap" }} title={`${t("attendance.present", "Present")} · ${t("attendance.half", "Half")} · ${t("attendance.absent", "Absent")} · ${t("attendance.leave", "Leave")}`}>{p} · {h} · {ab} · {l}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", padding: "16px 20px", borderTop: "1px solid var(--ds-divider)" }}>
                {[
                    { label: t("attendance.present", "Present"), bg: "#BBF7D0" },
                    { label: t("attendance.halfDay", "Half day"), bg: "#FCD34D" },
                    { label: t("attendance.absent", "Absent"), bg: "#FCA5A5" },
                    { label: t("attendance.leave", "Leave"), bg: "#E5E7EB" },
                ].map((lg) => (
                    <span key={lg.label} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ds-text-2)" }}><span style={{ width: 11, height: 11, borderRadius: 2, background: lg.bg }} />{lg.label}</span>
                ))}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ds-text-2)" }}><span style={{ width: 11, height: 11, borderRadius: 2, border: "1px solid #E5E7EB", background: "#F9FAFB", fontSize: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF" }}>?</span>{t("attendance.notMarked", "Not marked")}</span>
                <button onClick={() => navigate("/payroll")} style={{ marginLeft: "auto", cursor: "pointer", font: "inherit", display: "inline-flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--ds-text-2)", background: "transparent", border: 0 }} title={t("attendance.payrollHint", "Present and half days are used to calculate salaries on the Payroll page")}>
                    {t("attendance.totalsFlow", "Totals flow into Payroll")}<Info size={16} />
                </button>
            </div>
        </div>
    );

    return (
        <div className="lb-ds" style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--ds-bg)" }}>
            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: "18px 22px 36px", minHeight: 0 }}>
                {/* header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                    <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.02em", marginRight: "auto" }}>{t("attendance.title", "Attendance")}</span>
                    <label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 12, height: 42, padding: "0 16px", border: "1px solid var(--ds-border)", borderRadius: 11, background: "var(--ds-card)", minWidth: 180, cursor: "pointer" }}>
                        <CalendarDays size={18} style={{ color: "var(--ds-text-2)" }} />
                        <span style={{ fontSize: 14.5, fontWeight: 500, flex: 1 }}>{format(dayDate, "EEE, d MMM")}{dayKey === todayKey ? ` · ${t("attendance.today", "Today")}` : ""}</span>
                        <ChevronDown size={17} style={{ color: "var(--ds-text-2)" }} />
                        <input type="date" value={dayKey} max={todayKey} aria-label={t("attendance.pickDate", "Pick a date")}
                            onChange={(e) => { const [y, m, d] = e.target.value.split("-").map(Number); if (y && m && d) goToDay(new Date(y, m - 1, d)); }}
                            onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* unsupported */ } }}
                            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }} />
                    </label>
                    <button onClick={() => goToDay(addDays(dayDate, -1))} aria-label={t("attendance.prevDay", "Previous day")} style={squareBtn}><ChevronLeft size={19} /></button>
                    <button onClick={() => goToDay(addDays(dayDate, 1))} disabled={!canNext} aria-label={t("attendance.nextDay", "Next day")} style={{ ...squareBtn, opacity: canNext ? 1 : 0.4, cursor: canNext ? "pointer" : "not-allowed" }}><ChevronRight size={19} /></button>
                    <div style={{ flex: 1, minWidth: 20 }} />
                    <div role="group" aria-label={t("attendance.view", "View")} style={{ display: "inline-flex", border: "1px solid var(--ds-border)", borderRadius: 11, overflow: "hidden", background: "var(--ds-card)" }}>
                        {(["day", "month"] as const).map((v) => (
                            <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
                                style={{ cursor: "pointer", font: "inherit", fontSize: 14.5, fontWeight: 500, padding: "10px 20px", border: 0, background: view === v ? "var(--ds-blue)" : "transparent", color: view === v ? "#fff" : "var(--ds-text)", borderRadius: view === v ? 10 : 0 }}>
                                {v === "day" ? t("attendance.day", "Day") : t("attendance.month", "Month")}
                            </button>
                        ))}
                    </div>
                    <button onClick={markAllPresent} disabled={counts.unmarked === 0} title={counts.unmarked === 0 ? t("attendance.allMarked", "Everyone is marked for this day") : undefined}
                        style={{ cursor: counts.unmarked === 0 ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 10, font: "inherit", fontSize: 15, fontWeight: 600, color: "var(--ds-blue)", background: "var(--ds-card)", border: "1px solid var(--ds-blue)", borderRadius: 11, padding: "10px 18px", opacity: counts.unmarked === 0 ? 0.5 : 1 }}>
                        <UserCheck size={19} />{t("attendance.markAllPresent", "Mark all present")}
                    </button>
                </div>

                {/* KPIs */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 16 }}>
                    {kpiCards.map((k) => (
                        <div key={k.label} style={{ ...dsCard, padding: "16px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                            <span style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", background: k.bg, color: k.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>{k.icon}</span>
                            <div>
                                <div style={{ fontSize: 13.5, color: "var(--ds-text-2)" }}>{k.label}</div>
                                <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>{k.value}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {activeStaff.length === 0 ? (
                    <div style={{ ...dsCard, padding: 40, textAlign: "center", color: "var(--ds-text-2)", fontSize: 14 }}>{t("attendance.noStaff", "No active staff to track. Add staff in the Staff tab.")}</div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {view === "day" && (
                            <div style={{ ...dsCard, overflow: "visible" }}>
                                <div className="lb-scroll" style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1040 }}>
                                        <thead>
                                            <tr style={{ color: "var(--ds-text)" }}>
                                                <th style={{ textAlign: "left", padding: "14px 12px 12px 20px", fontSize: 13, fontWeight: 500 }}>{t("attendance.staff", "Staff")}</th>
                                                <th style={{ textAlign: "left", padding: "14px 12px 12px", fontSize: 13, fontWeight: 500 }}>{t("attendance.status", "Status")}</th>
                                                <th style={{ textAlign: "left", padding: "14px 12px 12px", fontSize: 13, fontWeight: 500 }}>{t("attendance.note", "Note")}</th>
                                                <th style={{ textAlign: "left", padding: "14px 12px 12px", fontSize: 13, fontWeight: 500 }}>{t("attendance.checkIn", "Check-in")}</th>
                                                <th style={{ width: 48 }} />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeStaff.map((s, i) => {
                                                const rec = recByStaff.get(s.id);
                                                const status = rec?.status;
                                                const checkIn = rec?.checkIn?.toDate?.();
                                                return (
                                                    <tr key={s.id} style={{ borderTop: "1px solid var(--ds-divider)" }}>
                                                        <td style={{ padding: "7px 12px 7px 20px", whiteSpace: "nowrap" }}>
                                                            <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                                                <span style={avStyle(i)}>{initialOf(s.name)}</span>
                                                                <span style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</span>
                                                                <span style={{ fontSize: 12, color: "var(--ds-text-2)" }}>{roleText(s.role)}</span>
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: "7px 12px" }}>
                                                            <span style={{ display: "inline-flex", border: "1px solid var(--ds-border)", borderRadius: 4, overflow: "hidden" }}>
                                                                {SEG.map((sg, si) => {
                                                                    const on = status === sg.status;
                                                                    return (
                                                                        <button key={sg.status} onClick={() => setStatus(s.id, sg.status)} aria-pressed={on}
                                                                            style={{ cursor: "pointer", font: "inherit", minWidth: sg.status === "present" ? 92 : 80, fontSize: 12, fontWeight: on ? 600 : 500, padding: "6px 10px", border: 0, borderLeft: si ? "1px solid var(--ds-border)" : 0, background: on ? sg.on.bg : "var(--ds-card)", color: on ? sg.on.fg : "var(--ds-text)", boxShadow: on ? `inset 0 0 0 1px ${sg.on.bd}` : undefined }}>
                                                                            {sg.label}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </span>
                                                            {status === "holiday" && <span style={{ marginLeft: 8, fontSize: 12, color: "#2563EB" }}>{t("attendance.holiday", "Holiday")}</span>}
                                                        </td>
                                                        <td style={{ padding: "7px 12px" }}>
                                                            <input key={`${s.id}-${dayKey}-${rec?.id || "none"}`} defaultValue={rec?.notes || ""} disabled={!rec}
                                                                placeholder={rec ? t("attendance.addNote", "Add note (optional)") : t("attendance.notMarkedYet", "Not marked yet")}
                                                                onBlur={(e) => saveNote(s.id, e.target.value.trim())}
                                                                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                                                maxLength={120}
                                                                style={{ width: 250, font: "inherit", fontSize: 13, color: "var(--ds-text)", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 4, padding: "6px 10px", outline: "none" }} />
                                                        </td>
                                                        <td style={{ padding: "7px 12px", fontSize: 13, whiteSpace: "nowrap" }}>{checkIn ? format(checkIn, "h:mm a") : <span style={{ color: "var(--ds-text-2)" }}>—</span>}</td>
                                                        <td style={{ padding: "7px 14px 7px 0", position: "relative", textAlign: "right" }}>
                                                            <button onClick={() => setRowMenu(rowMenu === s.id ? null : s.id)} aria-label={t("common.more", "More")} style={{ cursor: "pointer", width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ds-text)", background: "transparent", border: 0, borderRadius: 7 }}><MoreVertical size={17} /></button>
                                                            {rowMenu === s.id && (
                                                                <div onMouseLeave={() => setRowMenu(null)} style={{ position: "absolute", right: 14, top: "calc(100% - 4px)", zIndex: 30, minWidth: 220, textAlign: "left", background: "var(--ds-card)", border: "1px solid var(--ds-border)", borderRadius: 12, boxShadow: "0 12px 32px rgba(16,24,40,.14)", padding: 6 }}>
                                                                    {(status === "present" || status === "half") && (
                                                                        <label style={{ ...menuRow, cursor: "default" }}>
                                                                            <Clock size={15} />{t("attendance.checkInTime", "Check-in time")}
                                                                            <input type="time" defaultValue={checkIn ? format(checkIn, "HH:mm") : ""}
                                                                                onChange={(e) => {
                                                                                    const [hh, mm] = e.target.value.split(":").map(Number);
                                                                                    if (Number.isNaN(hh)) return;
                                                                                    const d = new Date(dayDate); d.setHours(hh, mm || 0, 0, 0);
                                                                                    void updateAttendanceDetails(s.id, dayKey, { checkIn: d });
                                                                                }}
                                                                                style={{ marginLeft: "auto", font: "inherit", fontSize: 12.5, border: "1px solid var(--ds-border)", borderRadius: 6, padding: "3px 5px" }} />
                                                                        </label>
                                                                    )}
                                                                    <button onClick={() => { setRowMenu(null); setStatus(s.id, "holiday"); }} style={menuRow}><Sun size={15} />{t("attendance.markHoliday", "Mark as holiday")}</button>
                                                                    {rec && <button onClick={() => { setRowMenu(null); void clearAttendance(s.id, dayKey); }} style={{ ...menuRow, color: "var(--ds-negative)" }}><Eraser size={15} />{t("attendance.clearMark", "Clear mark")}</button>}
                                                                    <button onClick={() => { setRowMenu(null); navigate(`/manage-staff?id=${s.id}`); }} style={menuRow}><UserRound size={15} />{t("attendance.openStaff", "Open staff profile")}</button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {monthGrid}
                    </div>
                )}
            </div>
        </div>
    );
}

const menuRow: CSSProperties = { width: "100%", cursor: "pointer", font: "inherit", display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 500, color: "var(--ds-text)", background: "transparent", border: 0, borderRadius: 8, padding: "9px 10px", textAlign: "left" };
