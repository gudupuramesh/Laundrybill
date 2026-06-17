/**
 * Customer Types
 */

import { Timestamp } from "firebase/firestore";

export interface CustomerAddress {
    id: string;
    label?: string;  // "Home", "Office", etc.
    address: string;
    isDefault: boolean;
}

export interface Customer {
    id: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;              // Keep for backward compatibility
    addresses?: CustomerAddress[]; // New: array of addresses
    area?: string;                 // Service area / locality (from settings.serviceAreas)
    notes?: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderAt?: Timestamp;
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
