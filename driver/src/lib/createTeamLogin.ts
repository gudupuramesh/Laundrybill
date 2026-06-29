/**
 * Creates an app-login (teamMembers doc) for a Staff / Agent / Plant member and
 * returns the invite code. Mirrors the web `createTeamMember` mutation and the
 * CreateStaffLoginScreen logic: dedupes by email, ensures a shop code, generates
 * an invite code. The roster (`staff`) row is created separately by the caller.
 */
import { firestore } from './db';

export type LoginMemberType = 'staff' | 'agent' | 'plant';

function generateRandomInviteCode(shopCode: string): string {
  const code = (shopCode || 'SHOP').toUpperCase().slice(0, 4);
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${code}-${randomNum}`;
}

export async function createTeamLogin(params: {
  shopId: string;
  name: string;
  email: string;
  phone?: string;
  memberType: LoginMemberType;
  /** Roster role — distinguishes a manager from plain staff (both memberType 'staff'). */
  role?: string;
  /** Roster row this login belongs to, when created alongside one. */
  linkedStaffId?: string;
}): Promise<{ inviteCode: string }> {
  const { shopId, name, email, phone, memberType, role, linkedStaffId } = params;
  const emailLower = email.trim().toLowerCase();
  if (!emailLower) throw new Error('EMAIL_REQUIRED');

  // Dedupe: one login per email per shop.
  const existing = await firestore()
    .collection(`shops/${shopId}/teamMembers`)
    .where('email', '==', emailLower)
    .limit(1)
    .get();
  if (!existing.empty) throw new Error('EMAIL_ALREADY_USED');

  // Ensure the shop has a short code (used as the invite-code prefix).
  const shopDoc = await firestore().collection('shops').doc(shopId).get();
  const shopData = (shopDoc.data() as any) || {};
  let shopCode = shopData?.shopCode;
  if (!shopCode) {
    const shopName = shopData?.name || 'Shop';
    const clean = shopName.toUpperCase().replace(/[^A-Z]/g, '');
    shopCode = clean.length >= 2 ? clean.slice(0, 2) : clean.padEnd(2, 'X');
    shopCode += String.fromCharCode(65 + Math.floor(Math.random() * 26));
    shopCode += String.fromCharCode(65 + Math.floor(Math.random() * 26));
    await firestore().collection('shops').doc(shopId).update({ shopCode });
  }

  const inviteCode = generateRandomInviteCode(shopCode);

  try {
    await firestore().collection(`shops/${shopId}/teamMembers`).add({
      email: emailLower,
      inviteCode,
      memberType,
      role: role || (memberType === 'plant' ? 'plant_operator' : memberType === 'agent' ? 'agent' : 'staff'),
      staffId: linkedStaffId || null,
      name: name.trim(),
      phone: phone?.trim() || null,
      vehicle: null,
      serviceAreas: [],
      inviteStatus: 'pending',
      isActive: memberType === 'agent',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (e: any) {
    // Firestore rules block login creation when the plan lacks the login type.
    if (e?.code === 'permission-denied' || /permission/i.test(String(e?.message || ''))) {
      throw new Error('Creating team logins requires the Pro+ or Business plan. Upgrade to add staff, agent or plant logins.');
    }
    throw e;
  }

  return { inviteCode };
}
