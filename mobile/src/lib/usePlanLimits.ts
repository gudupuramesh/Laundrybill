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
export function usePlanLimits(subscriptionData: any): PlanLimits {
  const [limits, setLimits] = useState<PlanLimits>(EMPTY_LIMITS);

  useEffect(() => {
    if (!subscriptionData) return;

    const planId = subscriptionData.planId || subscriptionData.planName || 'free';
    const normalized = String(planId).toLowerCase().replace(/[_\s-]/g, '');

    // Normalize legacy plan ids to canonical tiers: free / pro / business
    const isBusiness = normalized === 'business' || normalized === 'enterprise' || normalized === 'proplus' || normalized === 'premium';
    const isPro = !isBusiness && (normalized === 'pro' || normalized === 'starter');
    const canonicalId = isBusiness ? 'business' : isPro ? 'pro' : 'free';
    const candidates = [planId, normalized, canonicalId].filter(
      (v, i, a) => a.indexOf(v) === i // dedupe
    );

    const tryFetch = async () => {
      try {
        for (const id of candidates) {
          const snap = await firestore().collection('plans').doc(id).get();
          if (snap.exists) {
            const data = snap.data();
            const l = data?.limits || {};
            setLimits({
              maxOrders: l.maxOrders ?? 0,
              maxCustomers: l.maxCustomers ?? 0,
              maxStaff: l.maxStaff ?? 0,
              maxAgents: l.maxAgents ?? l.maxDeliveryAgents ?? 0,
              maxPlantStaff: l.maxPlantStaff ?? 0,
              storageGb: l.storageGb ?? l.storageGB ?? 0,
            });
            return;
          }
        }
        // Plan document not found — use empty (fully restricted)
        console.warn(`Plan document not found for planId="${planId}". Using restricted defaults.`);
        setLimits(EMPTY_LIMITS);
      } catch (e) {
        console.error('Failed to fetch plan limits:', e);
        setLimits(EMPTY_LIMITS);
      }
    };

    tryFetch();
  }, [subscriptionData?.planId, subscriptionData?.planName]);

  return limits;
}
