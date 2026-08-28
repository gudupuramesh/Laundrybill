/**
 * Creates an app-login (teamMembers doc) for a Staff / Agent / Plant member and
 * returns the invite code. Mirrors the web `createTeamMember` mutation and the
 * CreateStaffLoginScreen logic: dedupes by email, ensures a shop code, generates
 * an invite code. The roster (`staff`) row is created separately by the caller.
 */
import { firestore } from './db';
import { teamLoginCapFromLimits } from './usePlanLimits';
import { createNamedHttpsCallable, callableData } from './httpsCallable';

export type LoginMemberType = 'staff' | 'agent' | 'plant';

/**
 * Resolve the shop's TOTAL team-login cap (any role mix) from its subscription
 * plan. -1 = unlimited. Returns null when the plan can't be resolved (fail-open:
 * Firestore rules still gate login creation by plan feature flags).
 */
async function resolveTeamLoginCap(shopId: string): Promise<number | null> {
  try {
    const subSnap = await firestore().collection('subscriptions').doc(shopId).get();
    const sub = (subSnap.data() as any) || {};
    const planId = sub.planId || sub.planName || 'free';
    const normalized = String(planId).toLowerCase().replace(/[_\s-]/g, '');
    const isProPlus = normalized === 'proplus' || normalized === 'pro+';
    // Franchise (multi-shop owner plan) carries Business-level caps per shop.
    const isBusiness = !isProPlus && (normalized === 'business' || normalized === 'enterprise' || normalized === 'premium' || normalized === 'franchise' || normalized === 'multishop');
    const isPro = !isProPlus && !isBusiness && (normalized === 'pro' || normalized === 'starter');
    const canonical = isProPlus ? 'pro_plus' : isBusiness ? 'business' : isPro ? 'pro' : 'free';
    const candidates = [planId, normalized, canonical].filter((v, i, a) => a.indexOf(v) === i);
    for (const id of candidates) {
      const snap = await firestore().collection('plans').doc(String(id)).get();
      if (snap.exists) return teamLoginCapFromLimits((snap.data() as any)?.limits || {});
    }
  } catch {
    // Network/permission hiccup — don't block the owner; rules still apply.
  }
  return null;
}

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

  // The Team app's sign-up CREATES a Firebase Auth account — an email that
  // already has one (an owner signup, or a team login on any shop) can never
  // complete sign-up. Catch it now instead of frustrating the member later.
  // Fail-open on network/function errors: sign-up still errors clearly there.
  try {
    const res = await createNamedHttpsCallable('checkTeamEmail')(callableData({ email: emailLower }));
    if ((res?.data as { inUse?: boolean })?.inUse) throw new Error('EMAIL_HAS_ACCOUNT');
  } catch (e: any) {
    if (e?.message === 'EMAIL_HAS_ACCOUNT') throw e;
    // check unavailable — proceed
  }

  // Enforce the plan's TOTAL login cap — logins are capped in number, not by
  // role, so the owner can use their slots in any mix (e.g. 4 managers).
  const cap = await resolveTeamLoginCap(shopId);
  if (cap !== null && cap >= 0) {
    const all = await firestore().collection(`shops/${shopId}/teamMembers`).get();
    if (all.size >= cap) {
      throw new Error(
        cap === 0
          ? 'Creating team logins requires the Pro+ or Business plan. Upgrade to add staff, agent or plant logins.'
          : `Login limit reached — your plan allows ${cap} total logins (any role mix) and you already have ${all.size}. Delete an unused login or upgrade your plan.`
      );
    }
  }

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
