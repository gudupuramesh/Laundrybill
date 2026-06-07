import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { colors, fonts, radii, shadows, spacing } from '../theme';
import { Avatar } from '../components/ui';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type AttendanceStatus = 'present' | 'absent' | 'half' | 'leave';
type Tab = 'daily' | 'monthly';

const LEAVE_COLOR = '#8B5CF6';
const LEAVE_BG = '#EDE9FE';

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; short: string; color: string; bg: string }
> = {
  present: { label: 'Present', short: 'P', color: colors.success, bg: '#E6F6EC' },
  absent: { label: 'Absent', short: 'A', color: colors.error, bg: '#FDECEC' },
  half: { label: 'Half Day', short: 'H', color: colors.warning, bg: '#FEF1E6' },
  leave: { label: 'Leave', short: 'L', color: LEAVE_COLOR, bg: LEAVE_BG },
};

const STATUS_KEYS: AttendanceStatus[] = ['present', 'absent', 'half', 'leave'];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function formatDisplay(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const base = `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  return isToday ? `Today, ${base}` : base;
}

function monthLabel(d: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AttendanceScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const shopId = getShopId();

  // --- state ---
  const [tab, setTab] = useState<Tab>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [staff, setStaff] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);

  // daily attendance (local draft until saved)
  const [dailyMap, setDailyMap] = useState<Record<string, AttendanceStatus>>({});
  const [loadingAtt, setLoadingAtt] = useState(true);
  const [saving, setSaving] = useState(false);

  // monthly attendance docs
  const [monthlyDocs, setMonthlyDocs] = useState<any[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(true);

  const dk = dateKey(selectedDate);

  // --- Firestore: staff ---
  useEffect(() => {
    if (!shopId) return;
    const unsub = firestore()
      .collection(`shops/${shopId}/staff`)
      .orderBy('name')
      .onSnapshot(
        (snap: any) => {
          setStaff(
            snap.docs
              .map((d: any) => ({ id: d.id, ...d.data() }))
              .filter((s: any) => s.isActive !== false),
          );
          setLoadingStaff(false);
        },
        () => setLoadingStaff(false),
      );
    return unsub;
  }, [shopId]);

  // --- Firestore: attendance for selected date ---
  useEffect(() => {
    if (!shopId) return;
    setLoadingAtt(true);
    const unsub = firestore()
      .collection(`shops/${shopId}/attendance`)
      .where('date', '==', dk)
      .onSnapshot(
        (snap: any) => {
          const map: Record<string, AttendanceStatus> = {};
          snap.docs.forEach((d: any) => {
            const data = d.data();
            if (data.staffId && data.status) {
              map[data.staffId] = data.status as AttendanceStatus;
            }
          });
          setDailyMap(map);
          setLoadingAtt(false);
        },
        () => setLoadingAtt(false),
      );
    return unsub;
  }, [shopId, dk]);

  // --- Firestore: monthly attendance ---
  useEffect(() => {
    if (!shopId || tab !== 'monthly') return;
    setLoadingMonthly(true);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const startKey = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endKey = `${year}-${month.toString().padStart(2, '0')}-31`;
    const unsub = firestore()
      .collection(`shops/${shopId}/attendance`)
      .where('date', '>=', startKey)
      .where('date', '<=', endKey)
      .onSnapshot(
        (snap: any) => {
          setMonthlyDocs(snap.docs.map((d: any) => d.data()));
          setLoadingMonthly(false);
        },
        () => setLoadingMonthly(false),
      );
    return unsub;
  }, [shopId, tab, selectedDate]);

  // --- actions ---
  const isFutureDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sel = new Date(selectedDate);
    sel.setHours(0, 0, 0, 0);
    return sel >= today;
  }, [selectedDate]);

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    // Block future dates
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d > today) return;
    setSelectedDate(d);
  };

  const navigateMonth = (dir: number) => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() + dir);
    // Block future months
    const today = new Date();
    if (d.getFullYear() > today.getFullYear() || (d.getFullYear() === today.getFullYear() && d.getMonth() > today.getMonth())) return;
    setSelectedDate(d);
  };

  const toggleStatus = (staffId: string, status: AttendanceStatus) => {
    setDailyMap((prev) => ({ ...prev, [staffId]: status }));
  };

  const saveAttendance = useCallback(async () => {
    if (!shopId || saving) return;
    setSaving(true);
    try {
      const batch = firestore().batch();
      const collRef = firestore().collection(`shops/${shopId}/attendance`);

      // fetch existing docs for this date to update/create
      const existingSnap = await collRef.where('date', '==', dk).get();
      const existingByStaff: Record<string, any> = {};
      existingSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (data.staffId) existingByStaff[data.staffId] = d.ref;
      });

      const now = new Date();
      for (const member of staff) {
        const status = dailyMap[member.id];
        if (!status) continue;
        const docData = {
          staffId: member.id,
          date: dk,
          status,
          markedBy: 'mobile',
          updatedAt: now,
        };
        if (existingByStaff[member.id]) {
          batch.update(existingByStaff[member.id], docData);
        } else {
          batch.set(collRef.doc(), { ...docData, createdAt: now });
        }
      }
      await batch.commit();
      Alert.alert('Saved', `Attendance for ${formatDisplay(selectedDate)} saved.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save attendance');
    }
    setSaving(false);
  }, [shopId, saving, dk, staff, dailyMap, selectedDate]);

  // --- monthly stats computation ---
  const monthlyStats = useMemo(() => {
    const map: Record<string, { present: number; absent: number; half: number; leave: number; total: number }> = {};
    staff.forEach((s) => {
      map[s.id] = { present: 0, absent: 0, half: 0, leave: 0, total: 0 };
    });
    monthlyDocs.forEach((doc) => {
      const entry = map[doc.staffId];
      if (!entry) return;
      entry.total++;
      if (doc.status === 'present') entry.present++;
      else if (doc.status === 'absent') entry.absent++;
      else if (doc.status === 'half') entry.half++;
      else if (doc.status === 'leave') entry.leave++;
    });
    return map;
  }, [staff, monthlyDocs]);

  // --- render helpers ---
  const loading = loadingStaff || (tab === 'daily' ? loadingAtt : loadingMonthly);

  return (
    <View style={s.container}>
      {/* Safe area spacer — white to match header */}
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      {/* ---- Header ---- */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
          <MaterialIcons name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Staff Attendance</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ---- Segmented Control ---- */}
      <View style={s.tabsContainer}>
        <View style={s.segmentedControl}>
          <TouchableOpacity
            style={[s.tab, tab === 'daily' && s.tabActive]}
            onPress={() => { setTab('daily'); setSelectedDate(new Date()); }}
            activeOpacity={0.7}
          >
            <Text style={[s.tabText, tab === 'daily' && s.tabTextActive]}>Daily Log</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, tab === 'monthly' && s.tabActive]}
            onPress={() => setTab('monthly')}
            activeOpacity={0.7}
          >
            <Text style={[s.tabText, tab === 'monthly' && s.tabTextActive]}>Monthly Overview</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ---- Daily Log ---- */}
      {tab === 'daily' && (
        <>
          {/* Date selector */}
          <View style={s.dateSelector}>
            <TouchableOpacity style={s.iconBtn} onPress={() => navigateDate(-1)} activeOpacity={0.7}>
              <MaterialIcons name="chevron-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <View style={s.dateTextRow}>
              <MaterialIcons name="calendar-today" size={16} color={colors.primary} />
              <Text style={s.dateText}>{formatDisplay(selectedDate)}</Text>
            </View>
            <TouchableOpacity style={[s.iconBtn, isFutureDate && { opacity: 0.3 }]} onPress={() => navigateDate(1)} activeOpacity={0.7} disabled={isFutureDate}>
              <MaterialIcons name="chevron-right" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[s.scrollContent, { paddingBottom: 100 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
            ) : staff.length === 0 ? (
              <View style={s.emptyState}>
                <MaterialIcons name="groups" size={48} color={colors.textMuted} />
                <Text style={s.emptyTitle}>No staff added yet</Text>
              </View>
            ) : (
              staff.map((member) => {
                const currentStatus = dailyMap[member.id];
                return (
                  <View key={member.id} style={s.staffCard}>
                    {/* Staff header */}
                    <View style={s.staffHeader}>
                      <Avatar name={member.name || '?'} size={44} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.staffName}>{member.name}</Text>
                        {member.role ? <Text style={s.staffRole}>{member.role}</Text> : null}
                      </View>
                    </View>

                    {/* 4-column attendance grid */}
                    <View style={s.attGrid}>
                      {STATUS_KEYS.map((status) => {
                        const cfg = STATUS_CONFIG[status];
                        const isActive = currentStatus === status;
                        return (
                          <TouchableOpacity
                            key={status}
                            style={[
                              s.attBtn,
                              isActive && {
                                backgroundColor: cfg.bg,
                                borderColor: cfg.bg,
                              },
                            ]}
                            onPress={() => toggleStatus(member.id, status)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                s.attBtnShortcut,
                                isActive && { color: cfg.color },
                              ]}
                            >
                              {cfg.short}
                            </Text>
                            <Text
                              style={[
                                s.attBtnLabel,
                                isActive && { color: cfg.color },
                              ]}
                            >
                              {cfg.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Bottom bar save button */}
          {!loading && staff.length > 0 && (
            <View style={[s.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
              <TouchableOpacity
                style={s.btnPrimary}
                onPress={saveAttendance}
                activeOpacity={0.85}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.btnPrimaryText}>Save Today's Attendance</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* ---- Monthly Overview ---- */}
      {tab === 'monthly' && (
        <>
          {/* Month display with navigation */}
          <View style={s.dateSelector}>
            <TouchableOpacity style={s.navBtn} onPress={() => navigateMonth(-1)}>
              <MaterialIcons name="chevron-left" size={22} color={colors.primary} />
            </TouchableOpacity>
            <View style={s.dateTextRow}>
              <MaterialIcons name="calendar-today" size={16} color={colors.primary} />
              <Text style={s.dateText}>{monthLabel(selectedDate)}</Text>
            </View>
            <TouchableOpacity style={s.navBtn} onPress={() => navigateMonth(1)}>
              <MaterialIcons name="chevron-right" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[s.scrollContent, { paddingBottom: 30 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
            ) : staff.length === 0 ? (
              <View style={s.emptyState}>
                <MaterialIcons name="groups" size={48} color={colors.textMuted} />
                <Text style={s.emptyTitle}>No staff added yet</Text>
              </View>
            ) : (
              staff.map((member) => {
                const stats = monthlyStats[member.id] || {
                  present: 0,
                  absent: 0,
                  half: 0,
                  leave: 0,
                  total: 0,
                };
                const effectivePresent = stats.present + stats.half * 0.5;
                const rate =
                  stats.total > 0
                    ? Math.round((effectivePresent / stats.total) * 100)
                    : 100;
                const rateColor =
                  rate >= 85 ? colors.success : rate >= 60 ? colors.warning : colors.error;

                return (
                  <View key={member.id} style={s.staffCard}>
                    {/* Staff header with percentage */}
                    <View style={s.staffHeader}>
                      <Avatar name={member.name || '?'} size={44} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.staffName}>{member.name}</Text>
                        {member.role ? <Text style={s.staffRole}>{member.role}</Text> : null}
                      </View>
                      <Text style={[s.rateText, { color: rateColor }]}>{rate}%</Text>
                    </View>

                    {/* Stat pills row */}
                    <View style={s.statRow}>
                      {STATUS_KEYS.map((status) => {
                        const cfg = STATUS_CONFIG[status];
                        const count =
                          status === 'present'
                            ? stats.present
                            : status === 'absent'
                              ? stats.absent
                              : status === 'half'
                                ? stats.half
                                : stats.leave;
                        return (
                          <View key={status} style={s.statPill}>
                            <Text style={[s.statPillText, { color: cfg.color }]}>
                              {count} {cfg.label === 'Half Day' ? 'Half' : cfg.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* Header */
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 16,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
  },

  /* Segmented control */
  tabsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.button,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.text,
  },

  /* Date selector */
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.text,
  },

  /* Scroll content */
  scrollContent: {
    paddingHorizontal: 16,
  },

  /* Staff card */
  staffCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  staffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  staffName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  staffRole: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    marginTop: 2,
  },

  /* Attendance grid */
  attGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  attBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 4,
  },
  attBtnShortcut: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  attBtnLabel: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.8,
  },

  /* Monthly rate */
  rateText: {
    fontSize: 18,
    fontFamily: fonts.bold,
  },

  /* Stat row */
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statPillText: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },

  /* Bottom bar */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 4,
  },
  btnPrimary: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B61E5',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
