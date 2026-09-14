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
    receiptKey?: string;
    vendor?: string;
    /** How it was paid (added with the reference Expenses page; older entries have none). */
    paymentMode?: "cash" | "upi" | "bank";
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
