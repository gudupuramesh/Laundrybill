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
  maxStaff: number;
  maxAgents: number;
  maxPlantStaff: number;
  storageGb: number;
}

// Fallback when plan document doesn't exist at all in Firestore.
// Zero = fully restricted, forces admin to configure plans properly.
const EMPTY_LIMITS: PlanLimits = {
  maxOrders: 0,
  maxCustomers: 0,
  maxStaff: 0,
  maxAgents: 0,
  maxPlantStaff: 0,
  storageGb: 0,
};

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
  const isBusiness = normalized === 'business' || normalized === 'enterprise' || normalized === 'proplus' || normalized === 'premium';
  const isPro = !isBusiness && (normalized === 'pro' || normalized === 'starter');
  return isBusiness ? 'business' : isPro ? 'pro' : 'free';
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

  return limits;
}
