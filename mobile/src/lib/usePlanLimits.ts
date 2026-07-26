/**
 * Reads plan limits from Firestore `plans/{planId}` collection.
 * The super admin configures all limits — this hook has NO hardcoded overrides.
 * If the plan document doesn't exist in Firestore, all limits default to 0 (fully restricted).
 */
import { useEffect, useState } from 'react';
import { firestore } from './db';

export interface PlanLimits {
  maxOrders: number;
  maxCustomers: number;
  /**
   * TOTAL team logins allowed in ANY role mix (manager/staff/agent/plant).
   * This is the enforced cap; the per-role fields below are legacy.
   * -1 = unlimited, 0 = owner-only.
   */
  maxTeamLogins: number;
  /** Shops one owner subscription covers (Franchise). 1 = single shop. */
  maxShops: number;
  maxStaff: number;
  maxAgents: number;
  maxPlantStaff: number;
  storageGb: number;
}

// Fallback when plan document doesn't exist at all in Firestore.
// Zero = fully restricted, forces admin to configure plans properly.
// maxShops defaults to 1 — every plan runs at least the owner's own shop.
const EMPTY_LIMITS: PlanLimits = {
  maxOrders: 0,
  maxCustomers: 0,
  maxTeamLogins: 0,
  maxShops: 1,
  maxStaff: 0,
  maxAgents: 0,
  maxPlantStaff: 0,
  storageGb: 0,
};

/**
 * TOTAL login cap from a plan's limits map. Prefers the explicit maxTeamLogins;
 * older plan docs without it fall back to the sum of the legacy per-role caps
 * (any -1 → unlimited).
 */
export function teamLoginCapFromLimits(l: any): number {
  if (typeof l?.maxTeamLogins === 'number') return l.maxTeamLogins;
  const parts = [l?.maxStaff ?? 0, l?.maxAgents ?? l?.maxDeliveryAgents ?? 0, l?.maxPlantStaff ?? 0];
  if (parts.some((p: number) => p === -1)) return -1;
  return parts.reduce((a: number, b: number) => a + Math.max(0, b), 0);
}

/**
 * Hook to get the current plan's limits from Firestore.
 * Reads the planId from subscription, then fetches the plan document.
 * All values come from what the super admin set — no hardcoded overrides.
 */
// Session-lived cache of fetched limits per canonical tier. Plan limits are
// admin-config that changes rarely, so caching lets a screen remount show the
// real limit instantly instead of flashing the restricted 0 default (which made
// the usage badge blink "x/0" on every navigation).
const planLimitsCache = new Map<string, PlanLimits>();

function canonicalTier(subscriptionData: any): string {
  const planId = subscriptionData?.planId || subscriptionData?.planName || 'free';
  const normalized = String(planId).toLowerCase().replace(/[_\s-]/g, '');
  const isProPlus = normalized === 'proplus' || normalized === 'pro+';
  // Franchise (multi-shop owner plan) carries Business-level caps per shop.
  const isBusiness = !isProPlus && (normalized === 'business' || normalized === 'enterprise' || normalized === 'premium' || normalized === 'franchise' || normalized === 'multishop');
  const isPro = !isProPlus && !isBusiness && (normalized === 'pro' || normalized === 'starter');
  return isProPlus ? 'pro_plus' : isBusiness ? 'business' : isPro ? 'pro' : 'free';
}

export function usePlanLimits(subscriptionData: any): PlanLimits {
  const canonicalId = canonicalTier(subscriptionData);

  // Seed from cache so a known tier renders its real limits immediately.
  const [limits, setLimits] = useState<PlanLimits>(
    () => planLimitsCache.get(canonicalId) ?? EMPTY_LIMITS
  );

  useEffect(() => {
    // Always resolve limits for the current canonical tier — even before the
    // subscription doc loads (tier defaults to 'free'). Returning early here
    // when subscriptionData was null left the limit stuck at 0, because
    // canonicalId stays 'free' once the doc loads so the effect never re-ran.
    // Show cached limits right away (no 0 flash) while we refresh in the background.
    const cached = planLimitsCache.get(canonicalId);
    if (cached) setLimits(cached);

    const planId = subscriptionData?.planId || subscriptionData?.planName || canonicalId;
    const normalized = String(planId).toLowerCase().replace(/[_\s-]/g, '');
    const candidates = [planId, normalized, canonicalId].filter(
      (v, i, a) => a.indexOf(v) === i // dedupe
    );

    let cancelled = false;
    const tryFetch = async () => {
      try {
        for (const id of candidates) {
          const snap = await firestore().collection('plans').doc(id).get();
          if (snap.exists) {
            const data = snap.data();
            const l = data?.limits || {};
            const next: PlanLimits = {
              maxOrders: l.maxOrders ?? 0,
              maxCustomers: l.maxCustomers ?? 0,
              maxTeamLogins: teamLoginCapFromLimits(l),
              // Franchise/multi-shop: how many shops one subscription covers.
              maxShops: typeof l.maxShops === 'number' && l.maxShops > 0 ? l.maxShops : 1,
              maxStaff: l.maxStaff ?? 0,
              maxAgents: l.maxAgents ?? l.maxDeliveryAgents ?? 0,
              maxPlantStaff: l.maxPlantStaff ?? 0,
              storageGb: l.storageGb ?? l.storageGB ?? 0,
            };
            planLimitsCache.set(canonicalId, next);
            if (!cancelled) setLimits(next);
            return;
          }
        }
        // Plan document not found — only fall back to restricted if we have no
        // cached value (don't wipe correct limits on a transient miss).
        console.warn(`Plan document not found for planId="${planId}". Using restricted defaults.`);
        if (!cancelled && !planLimitsCache.has(canonicalId)) setLimits(EMPTY_LIMITS);
      } catch (e) {
        // Keep cached/last limits on a transient error — never flash 0.
        console.error('Failed to fetch plan limits:', e);
        if (!cancelled && !planLimitsCache.has(canonicalId)) setLimits(EMPTY_LIMITS);
      }
    };

    tryFetch();
    return () => { cancelled = true; };
  }, [canonicalId]);

  // Order-metered trial: keep the (Pro) plan's features/caps but show & enforce the trial
  // order cap (default 10). The server is authoritative — it flips trial→free at the cap.
  const isTrial = String(subscriptionData?.status || '').toLowerCase() === 'trial';
  if (isTrial) {
    const cap = Number(subscriptionData?.trialOrderLimit);
    return { ...limits, maxOrders: Number.isFinite(cap) && cap > 0 ? cap : 10 };
  }
  return limits;
}

// ─── Plan FEATURE flags (same Firestore plans/{id} docs; super-admin authoritative) ───
const planFeaturesCache = new Map<string, Record<string, boolean>>();

/** Feature flags (e.g. damagePhotos, itemTracking) for the current plan, read
 *  from Firestore `plans/{planId}.features`. Empty object until loaded / when
 *  the plan doc is missing — treat missing flags as feature OFF. */
export function usePlanFeatures(subscriptionData: any): Record<string, boolean> {
  const canonicalId = canonicalTier(subscriptionData);
  const [features, setFeatures] = useState<Record<string, boolean>>(
    () => planFeaturesCache.get(canonicalId) ?? {}
  );

  useEffect(() => {
    const cached = planFeaturesCache.get(canonicalId);
    if (cached) setFeatures(cached);

    const planId = subscriptionData?.planId || subscriptionData?.planName || canonicalId;
    const normalized = String(planId).toLowerCase().replace(/[_\s-]/g, '');
    const candidates = [planId, normalized, canonicalId].filter((v, i, a) => a.indexOf(v) === i);

    let cancelled = false;
    (async () => {
      try {
        for (const id of candidates) {
          const snap = await firestore().collection('plans').doc(id).get();
          if (snap.exists) {
            const f = (snap.data()?.features || {}) as Record<string, boolean>;
            planFeaturesCache.set(canonicalId, f);
            if (!cancelled) setFeatures(f);
            return;
          }
        }
        if (!cancelled && !planFeaturesCache.has(canonicalId)) setFeatures({});
      } catch {
        if (!cancelled && !planFeaturesCache.has(canonicalId)) setFeatures({});
      }
    })();
    return () => { cancelled = true; };
  }, [canonicalId]);

  return features;
}
