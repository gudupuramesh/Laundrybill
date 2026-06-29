import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, Switch, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { reconcileTeamMembersToRoster } from '../lib/reconcileRoster';
import { createTeamLogin, LoginMemberType } from '../lib/createTeamLogin';
import { colors, fonts, radii, shadows, spacing } from '../theme';
import { Avatar } from '../components/ui';
import { HelpButton } from '../components/HelpButton';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  staff: 'Staff',
  plant_operator: 'Plant',
  agent: 'Agent',
};

type LoginTypeKey = 'staff' | 'manager' | 'agent' | 'plant';
// A Manager login is a Staff-App login (memberType 'staff') tagged with the
// manager roster role — there's no separate manager app.
const LOGIN_TYPES: { key: LoginTypeKey; label: string; memberType: LoginMemberType; role: string }[] = [
  { key: 'staff', label: 'Staff App', memberType: 'staff', role: 'staff' },
  { key: 'manager', label: 'Manager', memberType: 'staff', role: 'manager' },
  { key: 'agent', label: 'Delivery Agent', memberType: 'agent', role: 'agent' },
  { key: 'plant', label: 'Plant', memberType: 'plant', role: 'plant_operator' },
];

export default function StaffListScreen({
  onBack,
  onViewStaff,
  onAddStaff,
  canCreateLogins = false,
}: {
  onBack: () => void;
  onViewStaff?: (id: string) => void;
  onAddStaff?: () => void;
  canCreateLogins?: boolean; // team logins are a Pro+/Business feature — hide the "create login" toggle otherwise
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Staff Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('staff');
  const [formPayType, setFormPayType] = useState('monthly');
  const [formSalary, setFormSalary] = useState('');
  const [formCreateLogin, setFormCreateLogin] = useState(false);
  const [formLoginType, setFormLoginType] = useState<LoginTypeKey>('staff');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormName(''); setFormPhone(''); setFormEmail(''); setFormRole('staff');
    setFormPayType('monthly'); setFormSalary('');
    setFormCreateLogin(false); setFormLoginType('staff');
  };

  const handleAddStaff = async () => {
    const name = formName.trim();
    if (!name) { Alert.alert('Required', 'Staff name is required'); return; }
    if (!shopId || saving) return;
    // App login needs an email.
    if (formCreateLogin && !formEmail.trim()) {
      Alert.alert('Email required', 'Enter an email to create an app login for this person.');
      return;
    }
    const loginMeta = LOGIN_TYPES.find((l) => l.key === formLoginType) || LOGIN_TYPES[0];
    setSaving(true);
    try {
      const ref = await firestore().collection(`shops/${shopId}/staff`).add({
        name,
        phone: formPhone.trim(),
        email: formEmail.trim().toLowerCase(),
        role: formCreateLogin ? loginMeta.role : formRole,
        payType: formPayType,
        baseSalary: parseFloat(formSalary) || 0,
        isActive: true,
        joiningDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Optionally create the app login and link it to the new roster row.
      if (formCreateLogin) {
        try {
          const { inviteCode } = await createTeamLogin({
            shopId,
            name,
            email: formEmail,
            phone: formPhone,
            memberType: loginMeta.memberType,
            role: loginMeta.role,
            linkedStaffId: ref.id,
          });
          resetForm();
          setShowAddModal(false);
          Alert.alert(
            'Login created',
            `Invite code for ${name}: ${inviteCode}`,
            [
              { text: 'Share', onPress: () => Share.share({ message: `Your Laundrybill login invite code is: ${inviteCode}\n\nDownload the app and use this code to sign up.` }).catch(() => {}) },
              { text: 'Done', style: 'cancel' },
            ],
          );
          return;
        } catch (e: any) {
          // Roster row is saved; surface why the login part failed.
          const msg = e?.message === 'EMAIL_ALREADY_USED'
            ? 'That email already has a login. The staff member was still added.'
            : 'Staff added, but the login could not be created.';
          resetForm();
          setShowAddModal(false);
          Alert.alert('Heads up', msg);
          return;
        }
      }

      resetForm();
      setShowAddModal(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add staff');
    } finally {
      setSaving(false);
    }
  };

  // Once per open: mirror any login (teamMembers) that has no roster row into
  // `staff`, so previously-created logins (incl. agents) appear here & in
  // Attendance. Idempotent — dedupes by email, so it never creates doubles.
  const reconciledRef = useRef(false);
  useEffect(() => {
    if (!shopId || reconciledRef.current) return;
    reconciledRef.current = true;
    void reconcileTeamMembersToRoster(shopId);
  }, [shopId]);

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    const unsub = firestore()
      .collection(`shops/${shopId}/staff`)
      .orderBy('name')
      .onSnapshot(
        (snap: any) => {
          setStaff(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false),
      );
    return unsub;
  }, [shopId]);

  const stats = useMemo(() => {
    const total = staff.length;
    const active = staff.filter(s => s.isActive !== false).length;
    return { total, active, inactive: total - active };
  }, [staff]);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={onBack} activeOpacity={0.7}>
          <MaterialIcons name="chevron-left" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('mobile.staffTitle', { defaultValue: 'Staff' })}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={s.iconBtn} onPress={() => { resetForm(); setShowAddModal(true); }} activeOpacity={0.7}>
            <MaterialIcons name="person-add" size={20} color={colors.primary} />
          </TouchableOpacity>
          <HelpButton pageId="mobile_staff" />
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.scrollContent, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {/* Stats Card */}
        <View style={s.statsCard}>
          <View style={s.statsRow}>
            <View style={s.statCol}>
              <Text style={s.statLabel}>TOTAL</Text>
              <Text style={s.statValue}>{stats.total}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCol}>
              <Text style={s.statLabel}>ACTIVE</Text>
              <Text style={s.statValue}>{stats.active}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCol}>
              <Text style={s.statLabel}>INACTIVE</Text>
              <Text style={s.statValue}>{stats.inactive}</Text>
            </View>
          </View>
        </View>

        {/* Staff List */}
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : staff.length === 0 ? (
          <View style={s.emptyState}>
            <MaterialIcons name="groups" size={48} color={colors.textMuted} />
            <Text style={s.emptyTitle}>{t('mobile.noStaffYet', { defaultValue: 'No staff added yet' })}</Text>
            <Text style={s.emptySubtitle}>{t('mobile.addStaffHint', { defaultValue: 'Tap + to add your first staff member' })}</Text>
          </View>
        ) : (
          <View style={s.listCard}>
            {staff.map((member, index) => {
              const isActive = member.isActive !== false;
              const role = ROLE_LABELS[member.role] || member.role || 'Staff';
              return (
                <TouchableOpacity
                  key={member.id}
                  style={[s.listRow, index < staff.length - 1 && s.listRowBorder]}
                  activeOpacity={0.7}
                  onPress={() => onViewStaff?.(member.id)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <Avatar name={member.name || '?'} size={44} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.staffName} numberOfLines={1}>{member.name || 'Unknown'}</Text>
                      <Text style={s.staffMeta} numberOfLines={1}>
                        {member.phone || ''} · {role}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[s.statusBadge, isActive ? s.activeBadge : s.inactiveBadge]}>
                      <Text style={[s.statusText, { color: isActive ? colors.success : colors.warning }]}>
                        {isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[s.fab, { bottom: 70 + insets.bottom }]} activeOpacity={0.85} onPress={() => { resetForm(); setShowAddModal(true); }}>
        <MaterialIcons name="add" size={28} color={colors.surface} />
      </TouchableOpacity>

      {/* Add Staff Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={s.modalDismiss} onPress={() => setShowAddModal(false)} />
          <View style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>Add Staff Member</Text>

              <Text style={s.fieldLabel}>NAME *</Text>
              <TextInput style={s.modalInput} placeholder="Staff name" placeholderTextColor={colors.textMuted} value={formName} onChangeText={setFormName} autoCapitalize="words" />

              <Text style={s.fieldLabel}>PHONE</Text>
              <TextInput style={s.modalInput} placeholder="Phone number" placeholderTextColor={colors.textMuted} value={formPhone} onChangeText={setFormPhone} keyboardType="phone-pad" />

              <Text style={s.fieldLabel}>EMAIL</Text>
              <TextInput style={s.modalInput} placeholder="Email (needed for app login)" placeholderTextColor={colors.textMuted} value={formEmail} onChangeText={setFormEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

              {/* App login toggle — only on plans that include team logins (Pro+/Business) */}
              {canCreateLogins && (
                <View style={s.loginToggleRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={s.loginToggleTitle}>Create app login?</Text>
                    <Text style={s.loginToggleSub}>Give them access to the Staff, Agent, or Plant app via an invite code.</Text>
                  </View>
                  <Switch
                    value={formCreateLogin}
                    onValueChange={setFormCreateLogin}
                    trackColor={{ true: colors.primary, false: colors.border }}
                    thumbColor="#fff"
                  />
                </View>
              )}

              {formCreateLogin ? (
                <>
                  <Text style={s.fieldLabel}>LOGIN TYPE</Text>
                  <View style={s.chipRow}>
                    {LOGIN_TYPES.map((lt) => (
                      <TouchableOpacity key={lt.key} style={[s.roleChip, formLoginType === lt.key && s.roleChipActive]} onPress={() => setFormLoginType(lt.key)}>
                        <Text style={[s.roleChipText, formLoginType === lt.key && s.roleChipTextActive]}>{lt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.fieldLabel}>ROLE</Text>
                  <View style={s.chipRow}>
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <TouchableOpacity key={key} style={[s.roleChip, formRole === key && s.roleChipActive]} onPress={() => setFormRole(key)}>
                        <Text style={[s.roleChipText, formRole === key && s.roleChipTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={s.fieldLabel}>PAY TYPE</Text>
              <View style={s.chipRow}>
                <TouchableOpacity style={[s.roleChip, formPayType === 'monthly' && s.roleChipActive]} onPress={() => setFormPayType('monthly')}>
                  <Text style={[s.roleChipText, formPayType === 'monthly' && s.roleChipTextActive]}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.roleChip, formPayType === 'daily' && s.roleChipActive]} onPress={() => setFormPayType('daily')}>
                  <Text style={[s.roleChipText, formPayType === 'daily' && s.roleChipTextActive]}>Daily</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.fieldLabel}>BASE SALARY</Text>
              <TextInput style={s.modalInput} placeholder="e.g. 15000" placeholderTextColor={colors.textMuted} value={formSalary} onChangeText={setFormSalary} keyboardType="numeric" />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowAddModal(false)}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, (!formName.trim()) && { opacity: 0.5 }]} onPress={handleAddStaff} disabled={saving || !formName.trim()}>
                  {saving ? <ActivityIndicator size="small" color={colors.surface} /> : <Text style={s.saveBtnText}>Add Staff</Text>}
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
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { padding: 16, gap: 12 },

  statsCard: {
    backgroundColor: colors.surface, borderRadius: radii.card,
    ...shadows.card, ...shadows.cardBorder,
    paddingVertical: 10, paddingHorizontal: 8,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, backgroundColor: colors.border, alignSelf: 'stretch', marginHorizontal: 4 },
  statLabel: { fontSize: 9, fontFamily: fonts.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  statValue: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },

  listCard: {
    backgroundColor: colors.surface, borderRadius: radii.card,
    borderWidth: 1, borderColor: colors.border, ...shadows.card, overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  staffName: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  staffMeta: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeBadge: { backgroundColor: colors.successBg },
  inactiveBadge: { backgroundColor: colors.warningBg },
  statusText: { fontSize: 10, fontFamily: fonts.bold },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textSecondary, marginTop: 8 },
  emptySubtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  fab: {
    position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    ...shadows.fab,
  },

  // Modal
  modalDismiss: { flex: 1, backgroundColor: 'rgba(26,29,46,0.4)' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '88%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  modalInput: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.medium, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  loginToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: colors.surfaceMuted, borderRadius: radii.input, borderWidth: 1, borderColor: colors.border,
  },
  loginToggleTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  loginToggleSub: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
  roleChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.button,
    backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
  },
  roleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleChipText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
  roleChipTextActive: { color: colors.surface },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', height: 48,
    borderRadius: radii.button, borderWidth: 1, borderColor: colors.border,
  },
  cancelBtnText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },
  saveBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', height: 48,
    borderRadius: radii.button, backgroundColor: colors.primary,
  },
  saveBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.surface },
});
