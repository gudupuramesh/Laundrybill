/**
 * Hook for minimum loading duration
 * 
 * Ensures loading states are shown for at least a minimum duration
 * to prevent flickering and show smooth animations
 */

import { useState, useEffect, useRef } from "react";

interface UseMinLoadingOptions {
  /** Minimum duration in milliseconds */
  minDuration?: number;
  /** Whether to start the timer immediately */
  startOnMount?: boolean;
}

/**
 * Ensures a loading state is shown for at least a minimum duration
 * This prevents flickering when data loads too quickly
 * 
 * @param isDataLoading - Whether the actual data is still loading
 * @param options - Configuration options
 * @returns boolean - Whether to show the loading state
 */
export function useMinLoading(
  isDataLoading: boolean,
  options: UseMinLoadingOptions = {}
): boolean {
  const { minDuration = 600, startOnMount = true } = options;
  const [minTimeElapsed, setMinTimeElapsed] = useState(!startOnMount);
  const startTime = useRef<number>(Date.now());

  useEffect(() => {
    if (!startOnMount) return;
    
    startTime.current = Date.now();
    setMinTimeElapsed(false);

    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration, startOnMount]);

  // Show loading if either:
  // 1. Minimum time hasn't elapsed yet, OR
  // 2. Data is still loading
  return !minTimeElapsed || isDataLoading;
}

/**
 * Hook for button loading state with minimum duration
 * 
 * @param minDuration - Minimum duration to show loading
 * @returns [isLoading, startLoading, stopLoading]
 */
export function useButtonLoading(minDuration = 500): [
  boolean,
  () => void,
  () => void
] {
  const [isLoading, setIsLoading] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const pendingStopRef = useRef(false);

  const startLoading = () => {
    startTimeRef.current = Date.now();
    pendingStopRef.current = false;
    setIsLoading(true);
  };

  const stopLoading = () => {
    if (!startTimeRef.current) {
      setIsLoading(false);
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    const remaining = minDuration - elapsed;

    if (remaining > 0) {
      pendingStopRef.current = true;
      setTimeout(() => {
        if (pendingStopRef.current) {
          setIsLoading(false);
          startTimeRef.current = null;
        }
      }, remaining);
    } else {
      setIsLoading(false);
      startTimeRef.current = null;
    }
  };

  return [isLoading, startLoading, stopLoading];
}

export default useMinLoading;
