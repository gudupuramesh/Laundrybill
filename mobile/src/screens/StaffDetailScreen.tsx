import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, Pressable, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { colors, fonts, radii, shadows } from '../theme';
import { Avatar } from '../components/ui';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', staff: 'Staff', plant_operator: 'Plant Operator',
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  present: { label: 'Present', color: colors.success, bg: colors.successBg },
  absent: { label: 'Absent', color: colors.error, bg: colors.errorBg },
  half: { label: 'Half', color: colors.warning, bg: colors.warningBg },
  leave: { label: 'Leave', color: '#8B5CF6', bg: '#EDE9FE' },
};

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

export default function StaffDetailScreen({
  onBack,
  staffId,
}: {
  onBack: () => void;
  staffId: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const [staff, setStaff] = useState<any>(null);
  const [teamMember, setTeamMember] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('staff');
  const [editSalary, setEditSalary] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Load staff
  useEffect(() => {
    if (!shopId || !staffId) { setLoading(false); return; }
    const unsub = firestore().collection(`shops/${shopId}/staff`).doc(staffId)
      .onSnapshot((snap: any) => {
        if (snap.exists) setStaff({ id: snap.id, ...snap.data() });
        setLoading(false);
      }, () => setLoading(false));
    return unsub;
  }, [shopId, staffId]);

  // Load team member (login) by matching email or name
  useEffect(() => {
    if (!shopId || !staff?.email) return;
    const unsub = firestore().collection(`shops/${shopId}/teamMembers`)
      .where('email', '==', staff.email.toLowerCase())
      .limit(1)
      .onSnapshot((snap: any) => {
        if (!snap.empty) setTeamMember({ id: snap.docs[0].id, ...snap.docs[0].data() });
        else setTeamMember(null);
      }, () => {});
    return unsub;
  }, [shopId, staff?.email]);

  // Load this month's attendance
  useEffect(() => {
    if (!shopId || !staffId) return;
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-31`;
    // Query by staffId only (single-field equality, auto-indexed) and filter the
    // current month client-side. Combining `staffId ==` with a `date` range needs
    // a composite index — without it the query fails and the summary silently
    // shows 0. This avoids that dependency entirely.
    const unsub = firestore().collection(`shops/${shopId}/attendance`)
      .where('staffId', '==', staffId)
      .onSnapshot(
        (snap: any) => {
          const rows = snap.docs
            .map((d: any) => ({ id: d.id, ...d.data() }))
            .filter((r: any) => r.date >= monthStart && r.date <= monthEnd);
          setAttendance(rows);
        },
        (err: any) => console.warn('Attendance read failed:', err?.message || err),
      );
    return unsub;
  }, [shopId, staffId]);

  // Attendance summary
  const attSummary = useMemo(() => {
    let p = 0, a = 0, h = 0, l = 0;
    attendance.forEach(r => {
      if (r.status === 'present') p++;
      else if (r.status === 'absent') a++;
      else if (r.status === 'half') h++;
      else if (r.status === 'leave') l++;
    });
    return { present: p, absent: a, half: h, leave: l, daysWorked: p + h * 0.5 };
  }, [attendance]);

  const openEdit = () => {
    if (!staff) return;
    setEditName(staff.name || '');
    setEditPhone(staff.phone || '');
    setEditRole(staff.role || 'staff');
    setEditSalary(String(staff.baseSalary || ''));
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !shopId || editSaving) return;
    setEditSaving(true);
    try {
      await firestore().collection(`shops/${shopId}/staff`).doc(staffId).update({
        name: editName.trim(),
        phone: editPhone.trim(),
        role: editRole,
        baseSalary: parseFloat(editSalary) || 0,
        updatedAt: new Date(),
      });
      setShowEdit(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update');
    }
    setEditSaving(false);
  };

  const handleToggleActive = () => {
    const isActive = staff?.isActive !== false;
    Alert.alert(
      isActive ? 'Deactivate Staff' : 'Activate Staff',
      isActive ? `Deactivate ${staff?.name}? They won't appear in attendance.` : `Reactivate ${staff?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isActive ? 'Deactivate' : 'Activate',
          style: isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await firestore().collection(`shops/${shopId}/staff`).doc(staffId).update({
                isActive: !isActive, updatedAt: new Date(),
              });
            } catch (e: any) { Alert.alert('Error', e.message); }
          },
        },
      ],
    );
  };

  const handleDeleteStaff = () => {
    Alert.alert('Delete Staff', `Permanently delete ${staff?.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await firestore().collection(`shops/${shopId}/staff`).doc(staffId).delete();
            onBack();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleRevokeLogin = () => {
    if (!teamMember) return;
    Alert.alert('Revoke Login', `Remove app login access for ${staff?.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive',
        onPress: async () => {
          try {
            await firestore().collection(`shops/${shopId}/teamMembers`).doc(teamMember.id).delete();
            setTeamMember(null);
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleCall = () => {
    if (staff?.phone) Linking.openURL(`tel:${staff.phone.replace(/\D/g, '')}`).catch(() => {});
  };

  const handleWhatsApp = () => {
    if (staff?.phone) {
      const p = staff.phone.replace(/\D/g, '');
      Linking.openURL(`https://wa.me/${p}`).catch(() => {});
    }
  };

  if (loading) {
    return <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!staff) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.text }}>Staff not found</Text>
        <TouchableOpacity onPress={onBack} style={{ marginTop: 12 }}><Text style={{ fontFamily: fonts.bold, color: colors.primary }}>Go Back</Text></TouchableOpacity>
      </View>
    );
  }

  const isActive = staff.isActive !== false;
  const role = ROLE_LABELS[staff.role] || staff.role || 'Staff';

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={onBack}><MaterialIcons name="chevron-left" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <Text style={s.headerTitle}>Staff Profile</Text>
        <TouchableOpacity style={s.iconBtn} onPress={openEdit}><MaterialIcons name="edit" size={20} color={colors.textSecondary} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[s.scrollContent, { paddingBottom: 30 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {/* Profile Card — compact */}
        <View style={s.profileCard}>
          <View style={s.profileRow}>
            <Avatar name={staff.name || '?'} size={48} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.profileName}>{staff.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <View style={[s.roleBadge, { backgroundColor: isActive ? colors.primaryTint : colors.warningBg }]}>
                  <Text style={[s.roleText, { color: isActive ? colors.primary : colors.warning }]}>{role}</Text>
                </View>
                {staff.phone ? <Text style={s.profilePhone}>{staff.phone}</Text> : null}
              </View>
            </View>
          </View>
          {staff.phone ? (
            <View style={s.actionBtns}>
              <TouchableOpacity style={s.actionBtn} onPress={handleCall}>
                <MaterialIcons name="call" size={16} color={colors.textSecondary} />
                <Text style={s.actionBtnText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={handleWhatsApp}>
                <MaterialIcons name="chat" size={16} color="#25D366" />
                <Text style={s.actionBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Info Grid */}
        <View style={s.infoGrid}>
          <View style={s.infoCard}>
            <Text style={s.infoLabel}>PAY TYPE</Text>
            <Text style={s.infoValue}>{staff.payType === 'daily' ? 'Daily' : 'Monthly'}</Text>
          </View>
          <View style={s.infoCard}>
            <Text style={s.infoLabel}>BASE SALARY</Text>
            <Text style={s.infoValue}>₹{staff.baseSalary || 0}</Text>
          </View>
          <View style={s.infoCard}>
            <Text style={s.infoLabel}>STATUS</Text>
            <Text style={[s.infoValue, { color: isActive ? colors.success : colors.error }]}>{isActive ? 'Active' : 'Inactive'}</Text>
          </View>
          <View style={s.infoCard}>
            <Text style={s.infoLabel}>DAYS WORKED</Text>
            <Text style={s.infoValue}>{attSummary.daysWorked}</Text>
          </View>
        </View>

        {/* Attendance Summary */}
        <Text style={s.sectionLabel}>THIS MONTH ATTENDANCE</Text>
        <View style={s.attSummary}>
          {Object.entries(STATUS_MAP).map(([key, cfg]) => (
            <View key={key} style={[s.attPill, { backgroundColor: cfg.bg }]}>
              <Text style={[s.attPillValue, { color: cfg.color }]}>{(attSummary as any)[key]}</Text>
              <Text style={[s.attPillLabel, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          ))}
        </View>

        {/* Login Info */}
        {teamMember && (
          <>
            <Text style={s.sectionLabel}>APP LOGIN</Text>
            <View style={s.loginCard}>
              <View style={s.loginRow}>
                <Text style={s.loginLabel}>Email</Text>
                <Text style={s.loginValue}>{teamMember.email}</Text>
              </View>
              <View style={s.loginRow}>
                <Text style={s.loginLabel}>Invite Code</Text>
                <Text style={[s.loginValue, { color: colors.primary, fontFamily: fonts.bold, letterSpacing: 1 }]}>{teamMember.inviteCode}</Text>
              </View>
              <View style={s.loginRow}>
                <Text style={s.loginLabel}>Type</Text>
                <Text style={s.loginValue}>{teamMember.memberType === 'agent' ? 'Delivery Agent' : teamMember.memberType === 'plant' ? 'Plant Operator' : 'Staff App'}</Text>
              </View>
              <View style={s.loginRow}>
                <Text style={s.loginLabel}>Status</Text>
                <View style={[s.loginStatusBadge, { backgroundColor: teamMember.inviteStatus === 'accepted' ? colors.successBg : colors.warningBg }]}>
                  <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: teamMember.inviteStatus === 'accepted' ? colors.success : colors.warning }}>
                    {teamMember.inviteStatus === 'accepted' ? 'ACCEPTED' : 'PENDING'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={s.revokeBtn} onPress={handleRevokeLogin}>
                <MaterialIcons name="block" size={16} color={colors.error} />
                <Text style={s.revokeBtnText}>Revoke Login Access</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Actions */}
        <Text style={s.sectionLabel}>ACTIONS</Text>
        <View style={s.actionsCard}>
          <TouchableOpacity style={s.actionRow} onPress={handleToggleActive}>
            <MaterialIcons name={isActive ? 'person-off' : 'person'} size={20} color={isActive ? colors.warning : colors.success} />
            <Text style={[s.actionRowText, { color: isActive ? colors.warning : colors.success }]}>
              {isActive ? 'Deactivate Staff' : 'Reactivate Staff'}
            </Text>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionRow} onPress={handleDeleteStaff}>
            <MaterialIcons name="delete-forever" size={20} color={colors.error} />
            <Text style={[s.actionRowText, { color: colors.error }]}>Delete Staff Permanently</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={s.modalDismiss} onPress={() => setShowEdit(false)} />
          <View style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>Edit Staff</Text>

              <Text style={s.fieldLabel}>NAME *</Text>
              <TextInput style={s.modalInput} value={editName} onChangeText={setEditName} placeholder="Staff name" placeholderTextColor={colors.textMuted} />

              <Text style={s.fieldLabel}>PHONE</Text>
              <TextInput style={s.modalInput} value={editPhone} onChangeText={setEditPhone} placeholder="Phone" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />

              <Text style={s.fieldLabel}>ROLE</Text>
              <View style={s.chipRow}>
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <TouchableOpacity key={key} style={[s.chip, editRole === key && s.chipActive]} onPress={() => setEditRole(key)}>
                    <Text style={[s.chipText, editRole === key && s.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>BASE SALARY</Text>
              <TextInput style={s.modalInput} value={editSalary} onChangeText={setEditSalary} placeholder="Salary" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowEdit(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSaveEdit} disabled={editSaving}>
                  {editSaving ? <ActivityIndicator size="small" color={colors.surface} /> : <Text style={s.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, gap: 16 },

  // Profile — compact
  profileCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 16,
    gap: 12, ...shadows.card, ...shadows.cardBorder,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  profileName: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  roleText: { fontSize: 11, fontFamily: fonts.bold },
  profilePhone: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  actionBtns: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radii.button, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
  },
  actionBtnText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },

  // Info grid — compact
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoCard: {
    width: '47%' as any, flexGrow: 1, backgroundColor: colors.surface, borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border,
  },
  infoLabel: { fontSize: 8, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  infoValue: { fontSize: 16, fontFamily: fonts.bold, color: colors.text, marginTop: 1 },

  sectionLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' },

  // Attendance summary — compact
  attSummary: { flexDirection: 'row', gap: 6 },
  attPill: { flex: 1, borderRadius: 10, paddingVertical: 6, alignItems: 'center', gap: 1 },
  attPillValue: { fontSize: 15, fontFamily: fonts.bold },
  attPillLabel: { fontSize: 8, fontFamily: fonts.bold, textTransform: 'uppercase' },

  // Login card
  loginCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 14,
    ...shadows.card, ...shadows.cardBorder, gap: 8,
  },
  loginRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loginLabel: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textSecondary },
  loginValue: { fontSize: 12, fontFamily: fonts.semibold, color: colors.text },
  loginStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  revokeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, borderRadius: radii.button, backgroundColor: colors.errorBg,
    borderWidth: 1, borderColor: colors.error + '20', marginTop: 4,
  },
  revokeBtnText: { fontSize: 13, fontFamily: fonts.bold, color: colors.error },

  // Actions
  actionsCard: {
    backgroundColor: colors.surface, borderRadius: radii.card,
    ...shadows.card, ...shadows.cardBorder, overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  actionRowText: { fontSize: 14, fontFamily: fonts.bold },
  actionDivider: { height: 1, backgroundColor: colors.border },

  // Modal
  modalDismiss: { flex: 1, backgroundColor: 'rgba(26,29,46,0.4)' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '88%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  modalInput: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.medium, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.button, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  chipTextActive: { color: colors.surface },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },
  saveBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: radii.button, backgroundColor: colors.primary },
  saveBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.surface },
});
