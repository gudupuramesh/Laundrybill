/**
 * Delivery Agent Types
 * 
 * Types for the Delivery Agent App including tasks and agent-specific data
 */

import { Timestamp, GeoPoint } from "firebase/firestore";

// Task types
export type TaskType = "pickup" | "delivery";
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";
export type TaskPriority = "normal" | "express" | "urgent";
export type PaymentStatus = "paid" | "partial" | "unpaid";

/**
 * DeliveryTask - A pickup or delivery task assigned to an agent
 * Stored in: shops/{shopId}/delivery_tasks/{taskId}
 */
export interface DeliveryTask {
    id: string;
    type: TaskType;
    orderId: string;
    orderPublicId: string;          // e.g. "LB-0001" for display
    shopId: string;

    // Assignment
    assignedTo: string;              // Agent's staff ID
    assignedAt: Timestamp;
    assignedBy?: string;             // Who assigned the task (admin/auto)

    // Customer info (limited for privacy)
    customer: {
        name: string;
        phone: string;
        address: string;
        landmark?: string;
        location?: GeoPoint;
    };

    // Order info (limited for privacy - no item details)
    itemCount: number;               // Total items to pickup/deliver

    // Payment (for delivery only)
    amountToCollect?: number;        // Amount agent needs to collect
    paymentStatus?: PaymentStatus;   // Current payment status

    // Schedule
    scheduledDate: Timestamp;        // Date for pickup/delivery
    timeSlot?: {
        start: string;               // e.g. "10:00 AM"
        end: string;                 // e.g. "12:00 PM"
    };
    priority: TaskPriority;

    // Instructions
    instructions?: string;           // Special instructions for agent

    // Status
    status: TaskStatus;
    startedAt?: Timestamp;           // When agent started this task
    completedAt?: Timestamp;

    // Completion data
    completionPhoto?: string;        // URL to proof photo
    signature?: string;              // Base64 signature (for delivery)
    collectedAmount?: number;        // Actual amount collected
    collectedPaymentMethod?: "cash" | "upi" | "paid_already";
    notes?: string;                  // Agent's notes

    // Metadata
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

/**
 * DriverTaskView - Simplified view of task for driver display
 * Used to minimize data transfer and protect privacy
 */
export interface DriverTaskView {
    id: string;
    type: TaskType;
    orderPublicId: string;
    customer: {
        name: string;
        phone: string;
        address: string;
        landmark?: string;
    };
    itemCount: number;
    amountToCollect?: number;
    paymentStatus?: PaymentStatus;
    scheduledDate: Date;
    timeSlot?: {
        start: string;
        end: string;
    };
    priority: TaskPriority;
    status: TaskStatus;
    instructions?: string;

    // Completion data (if completed)
    completedAt?: Date;
    proofPhotos?: { id: string; url: string }[];
    collectedAmount?: number;
    notes?: string;
}

/**
 * DriverStats - Statistics for a delivery agent
 */
export interface DriverStats {
    period: "today" | "week" | "month";
    pickups: number;
    deliveries: number;
    collected: number;
    earnings: number;              // If commission-based
    earningsGrowth: number;        // Percentage growth
    avgTime: number;               // Average minutes per task
    completionRate: number;        // Percentage
    onTimeRate: number;            // Percentage on-time deliveries
    rating: number;                // Average customer rating (1-5)

    recentTrips?: {
        id: string;
        type: TaskType;
        orderPublicId: string;
        completedAt: Date;
        collected?: number;
    }[];
}

/**
 * CompletePickupData - Data submitted when completing a pickup
 */
export interface CompletePickupData {
    taskId: string;
    itemsCollected: number;
    photos: string[];              // Base64 or URLs
    notes?: string;
}

/**
 * CompleteDeliveryData - Data submitted when completing a delivery
 */
export interface CompleteDeliveryData {
    taskId: string;
    collectedAmount: number;
    paymentMethod: "cash" | "upi" | "paid_already";
    photos: string[];
    signature?: string;            // Base64
    notes?: string;
}
