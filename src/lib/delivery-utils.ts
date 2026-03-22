/**
 * Delivery Date Utilities
 * 
 * Functions for calculating expected delivery dates based on service turnaround times
 */

import { addDays, max } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

// ============================================
// TYPES
// ============================================

export interface DeliveryCartItem {
    serviceId: string;
    serviceName: string;
    categoryName?: string;
    turnaroundDays: number;
    express: boolean;
}

export interface ExpectedDateResult {
    serviceId: string;
    serviceName: string;
    categoryName?: string;
    date: Date;
    turnaroundDays: number;
    isExpress: boolean;
}

// ============================================
// DATE CALCULATIONS
// ============================================

/**
 * Calculate expected dates for each service based on turnaround time
 * Express items get half the turnaround time (rounded up)
 */
export function calculateItemWiseDates(items: DeliveryCartItem[]): ExpectedDateResult[] {
    const today = new Date();

    return items.map((item) => {
        const days = item.express
            ? Math.ceil(item.turnaroundDays / 2)
            : item.turnaroundDays;

        return {
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            categoryName: item.categoryName,
            date: addDays(today, days),
            turnaroundDays: days,
            isExpress: item.express,
        };
    });
}

/**
 * Calculate final delivery date (latest of all item dates)
 * This is when all items will be ready
 */
export function calculateFinalDate(items: DeliveryCartItem[]): Date {
    const itemDates = calculateItemWiseDates(items);

    if (itemDates.length === 0) {
        return addDays(new Date(), 2); // Default 2 days
    }

    return max(itemDates.map((d) => d.date));
}

/**
 * Calculate final date for pickup_home delivery type
 * Processing starts AFTER pickup, so add turnaround to pickup date
 */
export function calculatePickupHomeDate(items: DeliveryCartItem[], pickupDate: Date): Date {
    if (items.length === 0) {
        return addDays(pickupDate, 2); // Default 2 days after pickup
    }

    const processingDates = items.map((item) => {
        const days = item.express
            ? Math.ceil(item.turnaroundDays / 2)
            : item.turnaroundDays;

        return addDays(pickupDate, days);
    });

    return max(processingDates);
}

/**
 * Get maximum turnaround days from cart items
 * Useful for displaying "Ready in X days" in cart
 */
export function getMaxTurnaroundDays(items: DeliveryCartItem[]): number {
    if (items.length === 0) return 2; // Default

    return Math.max(
        ...items.map((item) =>
            item.express
                ? Math.ceil(item.turnaroundDays / 2)
                : item.turnaroundDays
        )
    );
}

// ============================================
// GROUPING UTILITIES
// ============================================

/**
 * Group items by category for display
 */
export function groupItemsByCategory<T extends { categoryName?: string }>(items: T[]): Record<string, T[]> {
    return items.reduce((acc, item) => {
        const category = item.categoryName || 'Other';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {} as Record<string, T[]>);
}

/**
 * Group expected dates by unique service+category combinations
 * Removes duplicates for cleaner display
 */
export function getUniqueExpectedDates(items: DeliveryCartItem[]): ExpectedDateResult[] {
    const allDates = calculateItemWiseDates(items);

    // Deduplicate by serviceName+categoryName
    const seen = new Set<string>();
    return allDates.filter((item) => {
        const key = `${item.serviceName}|${item.categoryName || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ============================================
// TIMESTAMP CONVERSION
// ============================================

/**
 * Convert ExpectedDateResult to Firestore-ready format
 */
export function toItemWiseDeliveryDates(items: DeliveryCartItem[]): {
    serviceId: string;
    serviceName: string;
    categoryName?: string;
    expectedDate: Timestamp;
}[] {
    const results = calculateItemWiseDates(items);

    return results.map((r) => ({
        serviceId: r.serviceId,
        serviceName: r.serviceName,
        categoryName: r.categoryName,
        expectedDate: Timestamp.fromDate(r.date),
    }));
}
