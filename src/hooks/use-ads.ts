/**
 * Ads Hook
 * 
 * Fetch ads from Super Admin (currently returns null for self-promo fallback)
 */

import { useState, useEffect, useCallback } from 'react';
import type { Ad } from '@/types/ads';

interface UseAdsReturn {
    ad: Ad | null;
    isEnabled: boolean;
    loading: boolean;
    trackImpression: (adId: string, position?: string) => void;
    trackClick: (adId: string, position?: string) => void;
}

export function useAds(position?: string): UseAdsReturn {
    const [ad, setAd] = useState<Ad | null>(null);
    const [isEnabled, setIsEnabled] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // TODO: Fetch from Super Admin when implemented
        // For now, return null (will show self-promo)

        async function fetchAd() {
            try {
                // Placeholder: Will fetch from Firestore later
                // const adDoc = await getActiveAd(position);
                // setAd(adDoc);
                // setIsEnabled(shopSettings.adsEnabled);

                setAd(null);
                setIsEnabled(true);
            } catch (error) {
                console.error('Failed to fetch ad:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchAd();
    }, [position]);

    const trackImpression = useCallback((adId: string, pos?: string) => {
        // TODO: Track impression in analytics
        console.log('Ad impression:', adId, pos);
    }, []);

    const trackClick = useCallback((adId: string, pos?: string) => {
        // TODO: Track click in analytics
        console.log('Ad click:', adId, pos);
    }, []);

    return {
        ad,
        isEnabled,
        loading,
        trackImpression,
        trackClick,
    };
}
