/**
 * Reads plan limits from Firestore `plans/{planId}` collection.
 * Admin configures limits in Super Admin → Plans page.
 * The subscription doc tells us which planId the shop is on,
 * then we fetch the actual limits from the plans collection.
 */
import { useEffect, useState } from 'react';
import { firestore } from './db';

interface PlanLimits {
  maxOrders: number;
  maxCustomers: number;
  maxStaff: number;
  maxAgents: number;
  maxPlantStaff: number;
  storageGb: number;
}

const DEFAULT_FREE_LIMITS: PlanLimits = {
  maxOrders: 30,
  maxCustomers: 0,
  maxStaff: 0,
  maxAgents: 0,
  maxPlantStaff: 0,
  storageGb: 0.5,
};

const PRO_LIMITS: PlanLimits = {
  maxOrders: -1, // unlimited
  maxCustomers: -1,
  maxStaff: 5,
  maxAgents: 2,
  maxPlantStaff: 0,
  storageGb: 5,
};

/**
 * Hook to get the current plan's limits from Firestore.
 * Reads the planId from subscription, then fetches the plan document.
 */
export function usePlanLimits(subscriptionData: any): PlanLimits {
  const [limits, setLimits] = useState<PlanLimits>(DEFAULT_FREE_LIMITS);

  useEffect(() => {
    if (!subscriptionData) return;

    const planId = subscriptionData.planId || subscriptionData.planName || 'free';
    const normalizedPlanId = planId.toLowerCase().replace(/[_\s]/g, '');

    // Determine if pro plan
    const isPro = normalizedPlanId.includes('pro') || normalizedPlanId.includes('premium') || normalizedPlanId.includes('business');

    // Fetch from Firestore plans collection
    const tryFetch = async () => {
      try {
        // Try exact planId first, then normalized versions
        const candidates = [planId, normalizedPlanId, isPro ? 'pro' : 'free'];

        for (const id of candidates) {
          const snap = await firestore().collection('plans').doc(id).get();
          if (snap.exists) {
            const data = snap.data();
            const planLimits = data?.limits || {};
            setLimits({
              maxOrders: planLimits.maxOrders ?? (isPro ? -1 : DEFAULT_FREE_LIMITS.maxOrders),
              maxCustomers: planLimits.maxCustomers ?? (isPro ? -1 : 0),
              maxStaff: planLimits.maxStaff ?? (isPro ? 5 : 0),
              maxAgents: planLimits.maxAgents ?? (isPro ? 2 : 0),
              maxPlantStaff: planLimits.maxPlantStaff ?? 0,
              storageGb: planLimits.storageGb ?? (isPro ? 5 : 0.5),
            });
            return;
          }
        }

        // No plan found in Firestore — use defaults
        setLimits(isPro ? PRO_LIMITS : DEFAULT_FREE_LIMITS);
      } catch (e) {
        console.error('Failed to fetch plan limits:', e);
        setLimits(isPro ? PRO_LIMITS : DEFAULT_FREE_LIMITS);
      }
    };

    tryFetch();
  }, [subscriptionData?.planId, subscriptionData?.planName]);

  return limits;
}
