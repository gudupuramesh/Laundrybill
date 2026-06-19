/**
 * Attendance — 1000% to the design system (Attendance.dc.html):
 * header (date + Day/Month toggle + Mark all present) · KPI row · branch filter ·
 * Day view (per-staff status marking) · Month grid. Wired to useStaff +
 * useAttendance + useAttendanceMutations. Status-based (no clock times in model).
 */

import { useState, useMemo, type CSSProperties } from "react";
import { LSpinner } from "@/components/laundry";
import { useStaff, useAttendance, useAttendanceMutations } from "@/hooks/use-staff";
import type { AttendanceStatus } from "@/types/staff";
import { useMinLoading } from "@/hooks/use-min-loading";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, addMonths, addDays, isSameMonth, isAfter } from "date-fns";
import { Check, X, Clock, CalendarDays, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";

const MONO = "'IBM Plex Mono'";
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
    const [view, setView] = useState<"day" | "month">("day");
    const now = useMemo(() => new Date(), []);
    const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
    const [dayDate, setDayDate] = useState(() => new Date());
    const dayKey = format(dayDate, "yyyy-MM-dd");
    const atCurrentMonth = isSameMonth(viewMonth, now);

    const { activeStaff, loading } = useStaff();
    const { attendance } = useAttendance(viewMonth);
    const { markAttendance, markBulkAttendance } = useAttendanceMutations();
    const showLoading = useMinLoading(loading, { minDuration: 500 });

    const prevMonth = () => { const m = addMonths(viewMonth, -1); setViewMonth(m); setDayDate(startOfMonth(m)); };
    const nextMonth = () => { if (atCurrentMonth) return; const m = addMonths(viewMonth, 1); setViewMonth(m); setDayDate(isSameMonth(m, now) ? now : startOfMonth(m)); };
    const prevDay = () => { const d = addDays(dayDate, -1); if (isSameMonth(d, viewMonth)) setDayDate(d); };
    const nextDay = () => { const d = addDays(dayDate, 1); if (isSameMonth(d, viewMonth) && !isAfter(d, now)) setDayDate(d); };
    const canNextDay = isSameMonth(addDays(dayDate, 1), viewMonth) && !isAfter(addDays(dayDate, 1), now);
    const canPrevDay = isSameMonth(addDays(dayDate, -1), viewMonth);

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

    const kpis = [
        { label: t("staff.present", "Present"), value: counts.present, tint: "c-success", icon: <Check size={16} /> },
        { label: t("staff.absent", "Absent"), value: counts.absent, tint: "c-error", icon: <X size={16} /> },
        { label: t("staff.halfDay", "Half day"), value: counts.half, tint: "c-warning", icon: <Clock size={16} /> },
        { label: t("staff.leave", "On leave"), value: counts.leave, tint: "c-violet", icon: <CalendarDays size={16} /> },
        { label: t("attendance.unmarked", "Unmarked"), value: counts.unmarked, tint: "c-info", icon: <Clock size={16} /> },
    ];
    const TH: CSSProperties = { padding: "10px 14px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--c-text-3)", borderBottom: "1px solid var(--c-border)", whiteSpace: "nowrap", background: "var(--c-surface-2)" };
    const TD: CSSProperties = { padding: "9px 14px", borderBottom: "1px solid var(--c-border)" };
    const navBtn: CSSProperties = { cursor: "pointer", width: 30, height: 30, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-text-2)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 7 };

    return (
        <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-bg)" }}>
            {/* header */}
            <header style={{ flex: "none", minHeight: 58, background: "var(--c-surface)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "10px 22px" }}>
                <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em" }}>{t("attendance.title", "Attendance")}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button onClick={prevMonth} aria-label="Previous month" style={navBtn}><ChevronLeft size={16} /></button>
                    <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 116, textAlign: "center" }}>{format(viewMonth, "MMMM yyyy")}</span>
                    <button onClick={nextMonth} disabled={atCurrentMonth} aria-label="Next month" style={{ ...navBtn, opacity: atCurrentMonth ? 0.4 : 1, cursor: atCurrentMonth ? "not-allowed" : "pointer" }}><ChevronRight size={16} /></button>
                </div>
                <div style={{ flex: 1 }} />
                <div role="group" aria-label="View" style={{ display: "flex", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 2 }}>
                    {(["day", "month"] as const).map((v) => (
                        <button key={v} onClick={() => setView(v)} aria-pressed={view === v} style={{ cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 600, padding: "5px 14px", border: 0, borderRadius: 6, background: view === v ? "var(--c-surface)" : "transparent", color: view === v ? "var(--c-text)" : "var(--c-text-3)", boxShadow: view === v ? "var(--sh-sm)" : undefined }}>{v === "day" ? t("attendance.day", "Day") : t("attendance.month", "Month")}</button>
                    ))}
                </div>
                {view === "day" && counts.unmarked > 0 && (
                    <button onClick={markAllPresent} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--c-primary)", border: 0, borderRadius: 8, padding: "8px 14px", boxShadow: "var(--sh-sm)" }}><CheckCheck size={15} />{t("attendance.markAllPresent", "Mark all present")}</button>
                )}
            </header>

            <div className="lb-scroll" style={{ flex: 1, overflow: "auto", padding: "20px 22px 40px", minHeight: 0 }}>
                {/* KPI row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 18 }}>
                    {kpis.map((k) => (
                        <div key={k.label} style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: "15px 16px", boxShadow: "var(--sh-sm)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: `var(--${k.tint}-soft)`, color: `var(--${k.tint})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{k.icon}</span>
                                <span style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{k.label}</span>
                            </div>
                            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 24, letterSpacing: "-.02em", marginTop: 11, color: `var(--${k.tint})` }}>{k.value}</div>
                        </div>
                    ))}
                </div>

                {/* legend */}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
                    {Object.values(STATUS).map((s) => (
                        <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--c-text-2)" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: `var(--${s.tint})` }} />{s.label}</span>
                    ))}
                </div>

                {activeStaff.length === 0 ? (
                    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, padding: 40, textAlign: "center", color: "var(--c-text-3)", fontSize: 13.5 }}>{t("attendance.noStaff", "No active staff to track. Add staff in the Staff tab.")}</div>
                ) : view === "day" ? (
                  <>
                    {/* day picker */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <button onClick={prevDay} disabled={!canPrevDay} aria-label="Previous day" style={{ ...navBtn, opacity: canPrevDay ? 1 : 0.4, cursor: canPrevDay ? "pointer" : "not-allowed" }}><ChevronLeft size={16} /></button>
                        <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 150, textAlign: "center" }}>{format(dayDate, "EEE, MMM d")}{format(dayDate, "yyyy-MM-dd") === format(now, "yyyy-MM-dd") ? ` · ${t("attendance.today", "Today")}` : ""}</span>
                        <button onClick={nextDay} disabled={!canNextDay} aria-label="Next day" style={{ ...navBtn, opacity: canNextDay ? 1 : 0.4, cursor: canNextDay ? "pointer" : "not-allowed" }}><ChevronRight size={16} /></button>
                    </div>
                    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)", overflow: "hidden" }}>
                        <div className="lb-scroll" style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 620 }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...TH, textAlign: "left", paddingLeft: 18 }}>{t("staff.name", "Staff")}</th>
                                        <th style={{ ...TH, textAlign: "left" }}>{t("orders.status", "Status")}</th>
                                        <th style={{ ...TH, textAlign: "right", paddingRight: 18 }}>{t("attendance.mark", "Mark")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeStaff.map((s, i) => {
                                        const status = todayByStaff.get(s.id);
                                        const meta = status ? STATUS[status] : null;
                                        const initials = s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                                        const tint = av(i);
                                        return (
                                            <tr key={s.id}>
                                                <td style={{ ...TD, paddingLeft: 18 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                                                        <span style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", background: `var(--${tint}-soft)`, color: `var(--${tint})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 600 }}>{initials}</span>
                                                        <div><div style={{ fontWeight: 600 }}>{s.name}</div><div style={{ fontSize: 11, color: "var(--c-text-3)" }}>{s.role || "Staff"}</div></div>
                                                    </div>
                                                </td>
                                                <td style={TD}>{meta ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: `var(--${meta.tint}-soft)`, color: `var(--${meta.tint})` }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: `var(--${meta.tint})` }} />{meta.label}</span> : <span style={{ fontSize: 11.5, color: "var(--c-text-3)" }}>{t("attendance.unmarked", "Unmarked")}</span>}</td>
                                                <td style={{ ...TD, paddingRight: 18 }}>
                                                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                                        {QUICK.map((q) => {
                                                            const on = status === q.status;
                                                            return <button key={q.status} onClick={() => setStatus(s.id, q.status)} title={STATUS[q.status].label} aria-pressed={on} style={{ cursor: "pointer", width: 30, height: 30, font: "inherit", fontSize: 13, fontWeight: 700, borderRadius: 8, border: `1px solid ${on ? `var(--${q.tint})` : "var(--c-border)"}`, background: on ? `var(--${q.tint})` : "var(--c-surface)", color: on ? "#fff" : "var(--c-text-2)" }}>{q.short}</button>;
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                  </>
                ) : (
                    /* MONTH VIEW */
                    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 12, boxShadow: "var(--sh-sm)", overflow: "hidden" }}>
                        <div className="lb-scroll" style={{ overflowX: "auto" }}>
                            <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 880, width: "100%" }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...TH, position: "sticky", left: 0, zIndex: 1, textAlign: "left", paddingLeft: 16, minWidth: 180 }}>{t("staff.name", "Staff")}</th>
                                        {monthMeta.cols.map((c) => <th key={c.n} style={{ padding: "8px 0", width: 26, textAlign: "center", fontFamily: MONO, fontSize: 10, fontWeight: 600, color: c.weekend ? "var(--c-text-3)" : "var(--c-text-2)", borderBottom: "1px solid var(--c-border)", background: "var(--c-surface-2)" }}>{c.n}</th>)}
                                        <th style={{ ...TH, textAlign: "right", paddingRight: 16 }}>%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeStaff.map((s, i) => {
                                        const recs = monthMeta.byStaff.get(s.id) || new Map<string, AttendanceStatus>();
                                        let present = 0, marked = 0;
                                        recs.forEach((st) => { marked++; if (st === "present") present += 1; else if (st === "half") present += 0.5; });
                                        const pct = marked ? Math.round((present / marked) * 100) : null;
                                        const initials = s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                                        const tint = av(i);
                                        return (
                                            <tr key={s.id} style={{ borderBottom: "1px solid var(--c-border)" }}>
                                                <td style={{ position: "sticky", left: 0, zIndex: 1, background: "var(--c-surface)", padding: "8px 16px", borderBottom: "1px solid var(--c-border)" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                        <span style={{ width: 28, height: 28, flex: "none", borderRadius: "50%", background: `var(--${tint}-soft)`, color: `var(--${tint})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 600 }}>{initials}</span>
                                                        <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div><div style={{ fontSize: 10.5, color: "var(--c-text-3)" }}>{s.role || "Staff"}</div></div>
                                                    </div>
                                                </td>
                                                {monthMeta.cols.map((c) => {
                                                    const st = recs.get(c.key);
                                                    const tintC = st ? STATUS[st].tint : null;
                                                    return <td key={c.n} style={{ padding: "3px 0", textAlign: "center" }}><span title={`${c.n} · ${st ? STATUS[st].label : "—"}`} style={{ display: "inline-block", width: 15, height: 15, borderRadius: 4, background: tintC ? `var(--${tintC})` : "var(--c-surface-3)" }} /></td>;
                                                })}
                                                <td style={{ padding: "8px 16px", textAlign: "right", fontFamily: MONO, fontWeight: 600, color: pct == null ? "var(--c-text-3)" : pct >= 90 ? "var(--c-success)" : pct >= 75 ? "var(--c-warning)" : "var(--c-error)" }}>{pct == null ? "—" : `${pct}%`}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
