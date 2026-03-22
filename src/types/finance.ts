// Finance Types for LaundryBoss
import type { Timestamp } from "firebase/firestore";

export type ExpenseCategory =
    // Utilities
    | "rent"
    | "electricity"
    | "water"
    // Laundry Supplies
    | "detergents"
    | "fabric_softener"
    | "stain_remover"
    | "bleach"
    | "hangers"
    | "plastic_covers"
    | "tags_ribbons"
    | "iron_spray"
    // Equipment & Maintenance
    | "equipment"
    | "maintenance"
    | "washing_machine"
    | "dryer"
    | "pressing_equipment"
    // Operations
    | "transport"
    | "delivery"
    | "packaging"
    // Business
    | "marketing"
    | "advertising"
    | "salary"
    | "insurance"
    | "licenses"
    // Other
    | "miscellaneous";

export interface Expense {
    id: string;
    category: ExpenseCategory;
    description: string;
    amount: number;

    date: Timestamp;
    month: string; // YYYY-MM

    receiptUrl?: string;
    vendor?: string;
    customCategoryName?: string; // For "other" category

    isRecurring: boolean;
    recurringTemplateId?: string;

    createdBy: string;
    createdAt: Timestamp;
}

export interface DailyStats {
    date: string;
    ordersCreated: number;
    ordersDelivered: number;
    revenue: number;
    collected: number;
    expenses: number;
}
