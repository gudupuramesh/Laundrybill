/**
 * Runtime plan gate for existing team logins.
 *
 * Team logins are a Pro+/Business entitlement. When the shop's plan expires
 * (→ free) or is downgraded, previously created logins must stop working:
 *  - 'expired'  → the plan no longer includes this member's app at all
 *                 (free/Pro, lapsed subscription) → block every team login.
 *  - 'over_cap' → the plan still includes team logins but the shop has more
 *                 logins than the plan's TOTAL cap (e.g. Business 15 → Pro+ 4).
 *                 Deterministic policy: the OLDEST `cap` logins (by createdAt)
 *                 keep working; newer ones are blocked until the owner upgrades
 *                 or deletes extra logins.
 *
 * Fail-open on read errors: a flaky network must never lock working staff out.
 * (Signup/creation is separately enforced by Firestore rules + createTeamLogin.)
 */
import { firestore } from './firebase';
import { teamLoginCapFromLimits } from './usePlanLimits';

export type TeamAccess =
  | { state: 'ok' }
  | { state: 'expired' }
  | { state: 'over_cap'; cap: number };

/** Paid = statuses that keep plan entitlements (mirrors web use-shop-limits). */
function isPaidStatus(sub: any): boolean {
  const status = String(sub?.status || '').toLowerCase();
  if (status === 'active' || status === 'trial' || status === 'grace_period') return true;
  if (status === 'cancelled') {
    const until = sub?.activeUntil?.toDate?.() ?? (sub?.activeUntil?.seconds ? new Date(sub.activeUntil.seconds * 1000) : null);
    return !!until && until > new Date();
  }
  return false;
}

function canonicalPlanId(planId: string): 'free' | 'pro' | 'pro_plus' | 'business' {
  const n = String(planId || '').toLowerCase().replace(/[_\s-]/g, '');
  if (n === 'proplus' || n === 'pro+') return 'pro_plus';
  if (n === 'business' || n === 'enterprise' || n === 'premium') return 'business';
  if (n === 'pro' || n === 'starter') return 'pro';
  return 'free';
}

const FEATURE_BY_MEMBER_TYPE: Record<string, string> = {
  agent: 'driverApp',
  plant: 'plantApp',
  staff: 'staffApp',
};

/**
 * Evaluate whether this member's login is still covered by the shop's plan.
 * memberId is the teamMembers doc id (used for the over-cap rank check).
 */
export async function evaluateTeamAccess(
  shopId: string,
  memberId: string,
  memberType: string | undefined,
): Promise<TeamAccess> {
  try {
    const subSnap = await firestore().collection('subscriptions').doc(shopId).get();
    const sub = (subSnap.data() as any) || {};
    const planId = isPaidStatus(sub) ? sub.planId || sub.planName || 'free' : 'free';
    const canonical = canonicalPlanId(String(planId));

    // Resolve the plan doc (raw id first, then canonical), like usePlanLimits.
    const candidates = [String(planId), canonical].filter((v, i, a) => a.indexOf(v) === i);
    let planData: any = null;
    for (const id of candidates) {
      const snap = await firestore().collection('plans').doc(id).get();
      if (snap.exists) { planData = snap.data(); break; }
    }
    // Free plan (or unresolvable while signed out of entitlements): no doc means
    // no team features — but stay fail-open only for network errors, which throw.
    const features = (planData?.features || {}) as Record<string, boolean>;
    const featureKey = FEATURE_BY_MEMBER_TYPE[memberType || 'staff'] || 'staffApp';
    if (features[featureKey] !== true) return { state: 'expired' };

    // Over-cap: rank this login by creation time among all logins.
    const cap = teamLoginCapFromLimits(planData?.limits || {});
    if (cap >= 0) {
      const all = await firestore().collection(`shops/${shopId}/teamMembers`).get();
      const ranked = all.docs
        .map((d: any) => {
          const data = d.data() || {};
          const at = data.createdAt?.toMillis?.() ?? (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);
          return { id: d.id, at };
        })
        .sort((a: any, b: any) => a.at - b.at);
      const index = ranked.findIndex((r: any) => r.id === memberId);
      if (index >= cap) return { state: 'over_cap', cap };
    }

    return { state: 'ok' };
  } catch {
    // Network/permission hiccup — never lock out working staff on an error.
    return { state: 'ok' };
  }
}
