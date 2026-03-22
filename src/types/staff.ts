import { Timestamp } from "firebase/firestore";

export type PayType = "monthly" | "daily";
export type StaffRole = "admin" | "manager" | "staff" | "plant_operator";
export type MemberType = "staff" | "agent" | "plant";  // staff = Staff App, agent = Delivery Agent App, plant = Plant Portal
export type VehicleType = "bike" | "scooter" | "car" | "van";

/** App login (Staff/Agent/Plant) - separate from roster. Plan limits apply. */
export interface TeamMember {
    id: string;
    email: string;
    inviteCode: string;
    memberType: MemberType;
    /** Optional link to roster staff (when same person) */
    staffId?: string;
    inviteStatus: "pending" | "accepted";
    authUid?: string;
    lastLoginAt?: Timestamp;
    /** Admin can enable/disable - disabled agents won't appear in New Order dropdown */
    isActive?: boolean;
    /** Agent-specific */
    vehicle?: { type: VehicleType; number?: string };
    serviceAreas?: string[];
    isOnline?: boolean;
    name?: string;  // Display name
    /** Contact number – shown on order tracking and order details so customer can call/WhatsApp agent */
    phone?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export type AttendanceStatus = "present" | "absent" | "half" | "leave" | "holiday";

export interface Staff {
    id: string;
    name: string;
    phone: string;
    email?: string;
    role: StaffRole;
    payType: PayType;
    baseSalary: number;
    overtimeRate?: number; // Per hour overtime rate (defaults to 1.5x hourly rate if not set)
    bankDetails?: {
        accountNumber: string;
        ifscCode: string;
        bankName: string;
    };
    joiningDate: Timestamp;
    isActive: boolean;

    // Delivery Agent specific fields
    vehicle?: {
        type: VehicleType;
        number?: string;
    };
    isOnline?: boolean;  // For agents: online/offline status
    serviceAreas?: string[];  // Localities/areas the agent serves
    stats?: {
        totalDeliveries: number;
        totalPickups: number;
        totalCollected: number;
    };

    // App login (optional - roster-only staff have none; legacy app users have these)
    inviteCode?: string;
    authUid?: string;
    inviteStatus?: 'pending' | 'accepted';
    lastLoginAt?: Timestamp;
    memberType?: MemberType;  // When set, has app access; when absent, roster-only

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Attendance {
    id: string;
    staffId: string;
    date: string; // YYYY-MM-DD
    status: AttendanceStatus;
    checkIn?: Timestamp;
    checkOut?: Timestamp;
    overtime?: number; // Hours
    notes?: string;
    markedBy: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export type PayrollStatus = "draft" | "partial" | "paid" | "settlement";
export type PaymentMode = "cash" | "bank" | "upi";

export interface PayrollPayment {
    id: string;
    amount: number;
    date: Timestamp;
    mode: PaymentMode;
    note?: string;
    paidBy: string;
    /** When payment exceeds current earned amount (advance against salary) */
    type?: "advance" | "regular";
}

export interface PayrollEntry {
    id: string;
    staffId: string;
    staffName?: string;
    month: string; // YYYY-MM

    // Attendance summary
    daysPresent?: number;
    daysAbsent?: number;
    daysHalf?: number;
    daysLeave?: number;
    daysWorked?: number; // Effective days (present + half*0.5)

    // Earnings
    baseSalary: number;
    overtimeHours: number;
    overtimeAmount: number;
    bonus: number;
    totalEarnings: number;

    // Deductions
    deductions: number;
    advances: number;
    totalDeductions: number;

    // Final
    netSalary: number;

    // Payment tracking
    payments?: PayrollPayment[];
    totalPaid: number;
    remainingAmount: number;

    // Status
    status: PayrollStatus;

    // Settlement (for terminated staff)
    isSettlement?: boolean;
    settlementDate?: Timestamp;
    settlementNote?: string;
    noticePeriodDays?: number;
    noticePeriodAmount?: number;
    leaveEncashmentDays?: number;
    leaveEncashmentAmount?: number;
    gratuity?: number;

    // Legacy fields (backward compatibility)
    paidAt?: Timestamp;
    paidBy?: string;
    paidDate?: Timestamp;

    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface AttendanceSummary {
    present: number;
    absent: number;
    half: number;
    leave: number;
    holiday?: number;
    totalOvertime?: number;
}
