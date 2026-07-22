/**
 * Shared profile cards for every Team-app role (staff, manager, agent, plant).
 *
 * - MemberCard: the logged-in member's own details (name, role, phone, member
 *   since, login type, invite code, status, email).
 * - ShopCard: the company/shop they work for (logo, name, address, phone,
 *   email, shop code).
 *
 * Visual idioms copied from StaffDetailScreen (profileRow / infoGrid / loginRow).
 * Both cards are null-safe so a cold cache (no shop / partial agent) never crashes.
 */
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../theme';
import { Avatar } from './ui';
import type { Staff } from '../types/staff';
import type { ShopInfo } from '../lib/DriverAuthContext';

export const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  staff: 'Staff',
  plant_operator: 'Plant Operator',
  agent: 'Delivery Agent',
};

const MEMBER_TYPE_LABELS: Record<string, string> = {
  agent: 'Delivery Agent',
  plant: 'Plant Operator',
  staff: 'Staff App',
};

/** Firestore Timestamp | cached {seconds} | Date | undefined → a readable date. */
function formatDate(value: any): string | null {
  if (!value) return null;
  try {
    if (typeof value?.toDate === 'function') return value.toDate().toLocaleDateString();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toLocaleDateString();
    if (value instanceof Date) return value.toLocaleDateString();
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString();
  } catch {
    return null;
  }
}

export function MemberCard({ agent }: { agent: Staff | null }) {
  if (!agent) return null;
  const role = ROLE_LABELS[agent.role] || agent.role || 'Staff';
  const memberSince = formatDate((agent as any).joiningDate || agent.createdAt);
  const loginType = MEMBER_TYPE_LABELS[(agent as any).memberType] || 'Staff App';
  const accepted = agent.inviteStatus === 'accepted';

  return (
    <View style={s.card}>
      <View style={s.profileRow}>
        <Avatar name={agent.name || '?'} size={52} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.name}>{agent.name || 'Team member'}</Text>
          <View style={s.badgeRow}>
            <View style={s.roleBadge}>
              <Text style={s.roleText}>{role}</Text>
            </View>
            {agent.phone ? <Text style={s.phone}>{agent.phone}</Text> : null}
          </View>
        </View>
      </View>

      <View style={s.infoGrid}>
        {memberSince ? (
          <View style={s.infoCard}>
            <Text style={s.infoLabel}>MEMBER SINCE</Text>
            <Text style={s.infoValue}>{memberSince}</Text>
          </View>
        ) : null}
        <View style={s.infoCard}>
          <Text style={s.infoLabel}>LOGIN TYPE</Text>
          <Text style={s.infoValue}>{loginType}</Text>
        </View>
        {agent.inviteCode ? (
          <View style={s.infoCard}>
            <Text style={s.infoLabel}>INVITE CODE</Text>
            <Text style={[s.infoValue, { color: colors.primary, letterSpacing: 1 }]}>{agent.inviteCode}</Text>
          </View>
        ) : null}
        <View style={s.infoCard}>
          <Text style={s.infoLabel}>STATUS</Text>
          <Text style={[s.infoValue, { color: accepted ? colors.success : colors.warning }]}>
            {accepted ? 'Active' : 'Pending'}
          </Text>
        </View>
      </View>

      {agent.email ? (
        <View style={s.emailRow}>
          <Text style={s.emailLabel}>Email</Text>
          <Text style={s.emailValue} numberOfLines={1}>{agent.email}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function ShopCard({ shop, shopName }: { shop: ShopInfo | null; shopName?: string | null }) {
  const name = shop?.name || shopName || 'Shop';
  const logo = shop?.logoUrl || shop?.logo || null;
  const loc = shop?.location;
  const addressParts = [loc?.address, loc?.city, loc?.state].filter(Boolean);
  const address = addressParts.length ? addressParts.join(', ') : null;

  return (
    <>
      <Text style={s.sectionLabel}>YOUR SHOP</Text>
      <View style={s.card}>
        <View style={s.shopHead}>
          {logo ? (
            <Image source={{ uri: logo }} style={s.shopLogo} />
          ) : (
            <View style={s.shopLogoFallback}>
              <Text style={s.shopLogoText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.shopName} numberOfLines={2}>{name}</Text>
            {shop?.shopCode ? <Text style={s.shopCode}>Code: {shop.shopCode}</Text> : null}
          </View>
        </View>

        <View style={{ marginTop: 4 }}>
          {address ? <ShopRow icon="place" label="Address" value={address} /> : null}
          {shop?.phone ? <ShopRow icon="call" label="Phone" value={shop.phone} /> : null}
          {shop?.email ? <ShopRow icon="mail" label="Email" value={shop.email} /> : null}
          {!address && !shop?.phone && !shop?.email && !shop?.shopCode ? (
            <Text style={s.shopEmpty}>No company contact details added yet.</Text>
          ) : null}
        </View>
      </View>
    </>
  );
}

function ShopRow({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) {
  return (
    <View style={s.shopRow}>
      <MaterialIcons name={icon} size={16} color={colors.textMuted} style={{ width: 22 }} />
      <Text style={s.shopRowLabel}>{label}</Text>
      <Text style={s.shopRowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  roleBadge: { backgroundColor: colors.primaryTint, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  roleText: { fontSize: 11, fontFamily: fonts.bold, color: colors.primary },
  phone: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  infoCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoLabel: { fontSize: 8, fontFamily: fonts.bold, color: colors.textMuted, letterSpacing: 0.5 },
  infoValue: { fontSize: 15, fontFamily: fonts.bold, color: colors.text, marginTop: 2 },

  emailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  emailLabel: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textSecondary },
  emailValue: { flex: 1, textAlign: 'right', marginLeft: 12, fontSize: 12, fontFamily: fonts.semibold, color: colors.text },

  sectionLabel: {
    fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 2,
  },
  shopHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  shopLogo: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  shopLogoFallback: {
    width: 52, height: 52, borderRadius: 12, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center',
  },
  shopLogoText: { fontSize: 22, fontFamily: fonts.bold, color: colors.primary },
  shopName: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  shopCode: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted, marginTop: 2 },
  shopRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  shopRowLabel: { width: 68, fontSize: 12, fontFamily: fonts.semibold, color: colors.textSecondary },
  shopRowValue: { flex: 1, fontSize: 12, fontFamily: fonts.semibold, color: colors.text },
  shopEmpty: { fontSize: 12, fontFamily: fonts.medium, color: colors.textMuted, fontStyle: 'italic', paddingVertical: 4 },
});
