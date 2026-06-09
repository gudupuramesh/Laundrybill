import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { getShopId } from '../lib/auth';
import { colors, fonts, radii, shadows } from '../theme';

type MemberType = 'staff' | 'agent' | 'plant';

const MEMBER_TYPES: { key: MemberType; label: string; desc: string; icon: string; color: string; bg: string }[] = [
  { key: 'staff', label: 'Staff App', desc: 'Order management & basic access', icon: 'badge', color: colors.primary, bg: colors.primaryTint },
  { key: 'agent', label: 'Delivery Agent', desc: 'Pickup & delivery tracking', icon: 'delivery-dining', color: colors.success, bg: colors.successBg },
  { key: 'plant', label: 'Plant Operator', desc: 'Processing & plant management', icon: 'precision-manufacturing', color: colors.warning, bg: colors.warningBg },
];

function generateRandomInviteCode(shopCode: string): string {
  const code = (shopCode || 'SHOP').toUpperCase().slice(0, 4);
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${code}-${randomNum}`;
}

export default function CreateStaffLoginScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shopId = getShopId();

  const [memberType, setMemberType] = useState<MemberType>('staff');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Success state
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState('');

  const handleCreate = async () => {
    const trimName = name.trim();
    const trimEmail = email.trim().toLowerCase();
    if (!trimName) { Alert.alert('Required', 'Name is required'); return; }
    if (!trimEmail) { Alert.alert('Required', 'Email is required for app login'); return; }
    if (!shopId || saving) return;

    setSaving(true);
    try {
      // Check if email already exists
      const existing = await firestore()
        .collection(`shops/${shopId}/teamMembers`)
        .where('email', '==', trimEmail)
        .limit(1)
        .get();

      if (!existing.empty) {
        Alert.alert('Already Exists', 'A team member with this email already exists');
        setSaving(false);
        return;
      }

      // Get shop code
      const shopDoc = await firestore().collection('shops').doc(shopId).get();
      const shopData = shopDoc.data() as any;
      let shopCode = shopData?.shopCode;
      if (!shopCode) {
        // Generate from shop name
        const shopName = shopData?.name || 'Shop';
        const clean = shopName.toUpperCase().replace(/[^A-Z]/g, '');
        shopCode = clean.length >= 2 ? clean.slice(0, 2) : clean.padEnd(2, 'X');
        shopCode += String.fromCharCode(65 + Math.floor(Math.random() * 26));
        shopCode += String.fromCharCode(65 + Math.floor(Math.random() * 26));
        await firestore().collection('shops').doc(shopId).update({ shopCode });
      }

      const inviteCode = generateRandomInviteCode(shopCode);

      // Create team member document
      await firestore().collection(`shops/${shopId}/teamMembers`).add({
        email: trimEmail,
        inviteCode,
        memberType,
        name: trimName,
        phone: phone.trim() || null,
        vehicle: null,
        serviceAreas: [],
        inviteStatus: 'pending',
        isActive: memberType === 'agent',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Also create/update staff roster entry if not agent
      if (memberType !== 'agent') {
        await firestore().collection(`shops/${shopId}/staff`).add({
          name: trimName,
          phone: phone.trim() || '',
          email: trimEmail,
          role: memberType === 'plant' ? 'plant_operator' : 'staff',
          payType: 'monthly',
          baseSalary: 0,
          isActive: true,
          joiningDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      setCreatedInviteCode(inviteCode);
      setCreatedName(trimName);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create login');
    }
    setSaving(false);
  };

  const handleCopyCode = () => {
    if (!createdInviteCode) return;
    // Share as copy fallback since expo-clipboard may not be installed
    Share.share({ message: createdInviteCode }).catch(() => {
      Alert.alert('Invite Code', createdInviteCode);
    });
  };

  const handleShareCode = async () => {
    if (!createdInviteCode) return;
    const typeLabel = MEMBER_TYPES.find(m => m.key === memberType)?.label || 'Staff';
    await Share.share({
      message: `Hi ${createdName}, your Laundrybill ${typeLabel} login invite code is: ${createdInviteCode}\n\nDownload the app and use this code to login.`,
    });
  };

  // Success screen
  if (createdInviteCode) {
    const typeInfo = MEMBER_TYPES.find(m => m.key === memberType)!;
    return (
      <View style={s.container}>
        <View style={s.header}>
          <View style={{ width: 40 }} />
          <Text style={s.headerTitle}>Login Created</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.successContainer}>
          <View style={[s.successIcon, { backgroundColor: typeInfo.bg }]}>
            <MaterialIcons name="check-circle" size={48} color={typeInfo.color} />
          </View>
          <Text style={s.successTitle}>{createdName}</Text>
          <Text style={s.successSubtitle}>{typeInfo.label} login created</Text>

          <View style={s.codeCard}>
            <Text style={s.codeLabel}>INVITE CODE</Text>
            <Text style={s.codeValue}>{createdInviteCode}</Text>
            <Text style={s.codeHint}>Share this code with the staff member to login</Text>
          </View>

          <View style={s.successActions}>
            <TouchableOpacity style={s.copyBtn} onPress={handleCopyCode}>
              <MaterialIcons name="content-copy" size={18} color={colors.primary} />
              <Text style={s.copyBtnText}>Copy Code</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.shareBtn} onPress={handleShareCode}>
              <MaterialIcons name="share" size={18} color={colors.surface} />
              <Text style={s.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.doneBtn} onPress={onBack}>
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={onBack} activeOpacity={0.7}>
          <MaterialIcons name="chevron-left" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Create Staff Login</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[s.scrollContent, { paddingBottom: 30 + insets.bottom }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Member Type Selector */}
          <Text style={s.sectionLabel}>SELECT MEMBER TYPE</Text>
          <View style={s.typeCards}>
            {MEMBER_TYPES.map((mt) => (
              <TouchableOpacity
                key={mt.key}
                style={[s.typeCard, memberType === mt.key && { borderColor: mt.color, borderWidth: 2 }]}
                onPress={() => setMemberType(mt.key)}
                activeOpacity={0.7}
              >
                <View style={[s.typeIcon, { backgroundColor: mt.bg }]}>
                  <MaterialIcons name={mt.icon as any} size={22} color={mt.color} />
                </View>
                <Text style={s.typeLabel}>{mt.label}</Text>
                <Text style={s.typeDesc}>{mt.desc}</Text>
                {memberType === mt.key && (
                  <View style={[s.typeCheck, { backgroundColor: mt.color }]}>
                    <MaterialIcons name="check" size={14} color={colors.surface} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Form */}
          <Text style={s.sectionLabel}>MEMBER DETAILS</Text>
          <View style={s.formCard}>
            <Text style={s.fieldLabel}>NAME *</Text>
            <TextInput style={s.input} placeholder="Full name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} autoCapitalize="words" />

            <Text style={s.fieldLabel}>EMAIL *</Text>
            <TextInput style={s.input} placeholder="Email for app login" placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

            <Text style={s.fieldLabel}>PHONE</Text>
            <TextInput style={s.input} placeholder="Phone number (optional)" placeholderTextColor={colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[s.createBtn, (!name.trim() || !email.trim()) && { opacity: 0.5 }]}
            onPress={handleCreate}
            disabled={saving || !name.trim() || !email.trim()}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <>
                <MaterialIcons name="vpn-key" size={20} color={colors.surface} />
                <Text style={s.createBtnText}>Generate Invite Code</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: { padding: 16, gap: 16 },

  sectionLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.8, marginBottom: 4 },

  // Type Cards
  typeCards: { flexDirection: 'row', gap: 10 },
  typeCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.card, padding: 14,
    alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border,
    ...shadows.card, position: 'relative',
  },
  typeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  typeDesc: { fontSize: 10, fontFamily: fonts.medium, color: colors.textMuted, textAlign: 'center', lineHeight: 14 },
  typeCheck: {
    position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },

  // Form
  formCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 16,
    ...shadows.card, ...shadows.cardBorder,
  },
  fieldLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary, letterSpacing: 0.5, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: colors.surfaceMuted, borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.medium, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: radii.input, paddingVertical: 16,
    ...shadows.fab,
  },
  createBtnText: { fontSize: 16, fontFamily: fonts.bold, color: colors.surface },

  // Success
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  successSubtitle: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 4 },
  codeCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: 24,
    alignItems: 'center', marginTop: 24, width: '100%',
    ...shadows.card, ...shadows.cardBorder,
  },
  codeLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 1 },
  codeValue: { fontSize: 32, fontFamily: fonts.bold, color: colors.primary, marginTop: 8, letterSpacing: 2 },
  codeHint: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted, marginTop: 8, textAlign: 'center' },
  successActions: { flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' },
  copyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: radii.input,
    backgroundColor: colors.primaryTint,
  },
  copyBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.primary },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: radii.input,
    backgroundColor: colors.primary,
  },
  shareBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.surface },
  doneBtn: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 32 },
  doneBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
});
