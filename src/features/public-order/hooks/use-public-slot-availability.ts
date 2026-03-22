/**
 * Fetch slot availability (capacity + booked) for public ordering page.
 * Calls getPublicOrderSlotAvailability Cloud Function.
 */

import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export interface SlotAvailabilityEntry {
  capacity: number;
  booked: number;
}

export type SlotAvailabilityMap = Record<string, SlotAvailabilityEntry>;

export function usePublicSlotAvailability(
  shopSlug: string | undefined,
  date: string | undefined
): { data: SlotAvailabilityMap | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<SlotAvailabilityMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopSlug || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fn = httpsCallable<
      { shopSlug: string; date: string },
      Record<string, SlotAvailabilityEntry>
    >(functions, "getPublicOrderSlotAvailability");

    fn({ shopSlug, date })
      .then((res) => {
        if (cancelled) return;
        setData((res.data as Record<string, SlotAvailabilityEntry>) || {});
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setError(err?.message || "Failed to load slot availability");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shopSlug, date]);

  return { data, loading, error };
}

/** Returns true if slot is full (capacity > 0 and booked >= capacity). */
export function isSlotFull(
  slotValue: string,
  availability: SlotAvailabilityMap | null
): boolean {
  if (!availability || !slotValue) return false;
  const entry = availability[slotValue];
  if (!entry) return false;
  if (entry.capacity <= 0) return false;
  return entry.booked >= entry.capacity;
}
