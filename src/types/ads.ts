/**
 * Ad Types
 * 
 * Interfaces for ads system controlled by Super Admin
 */

import { Timestamp } from 'firebase/firestore';

export interface Ad {
    id: string;
    imageUrl: string;
    targetUrl?: string;
    title?: string;
    description?: string;
    isActive: boolean;
    placement: 'sidebar' | 'card' | 'banner' | 'all';
    startDate?: Timestamp;
    endDate?: Timestamp;
    impressions: number;
    clicks: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface ShopAdSettings {
    adsEnabled: boolean;      // Show external ads
    showSelfPromo: boolean;   // Show LaundryBoss promos when no ads
}

export interface AdAnalytics {
    adId: string;
    date: string;            // YYYY-MM-DD
    impressions: number;
    clicks: number;
    ctr: number;             // Click-through rate
}

export interface SelfPromo {
    id: string;
    icon: string;
    title: string;
    description: string;
    action: string;
    route?: string;
    onClick?: string;
}
