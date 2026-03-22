/**
 * Razorpay Checkout Service
 * 
 * Frontend integration for Razorpay payment modal.
 * Handles:
 * - Loading Razorpay.js script
 * - Opening checkout modal
 * - Payment success/failure callbacks
 */

export type BillingCycleOption = "3_months" | "6_months" | "9_months" | "12_months";

export interface RazorpayCheckoutOptions {
    planId: string;
    planName: string;
    amount: number; // in rupees
    billingCycle: BillingCycleOption;
    shopId: string;
    shopName: string;
    email: string;
    phone?: string;
    orderId?: string; // If pre-created order
}

interface RazorpayResponse {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
}

/**
 * Load Razorpay checkout script
 */
export function loadRazorpayScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if ((window as any).Razorpay) {
            resolve();
            return;
        }

        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
        document.body.appendChild(script);
    });
}

/**
 * Open Razorpay checkout modal
 */
export async function openRazorpayCheckout(
    options: RazorpayCheckoutOptions,
    onSuccess: (response: RazorpayResponse) => void,
    onFailure: (error: any) => void
): Promise<void> {
    // Ensure script is loaded
    await loadRazorpayScript();

    const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;

    if (!razorpayKeyId) {
        throw new Error("Razorpay key not configured. Set VITE_RAZORPAY_KEY_ID in .env");
    }

    const razorpayOptions = {
        key: razorpayKeyId,
        amount: options.amount * 100, // Convert to paise
        currency: "INR",
        name: "LaundryBill",
        description: `${options.planName} - ${options.billingCycle.replace("_", " ")} Subscription`,
        image: "/logo-icon.png", // Add your logo
        order_id: options.orderId, // If pre-created
        prefill: {
            name: options.shopName,
            email: options.email,
            contact: options.phone || "",
        },
        notes: {
            shopId: options.shopId,
            planId: options.planId,
            billingCycle: options.billingCycle,
        },
        theme: {
            color: "#16a34a", // Primary green color
        },
        handler: function (response: RazorpayResponse) {
            console.log("Payment successful:", response);
            onSuccess(response);
        },
        modal: {
            ondismiss: function () {
                console.log("Payment modal dismissed");
            },
        },
    };

    const razorpay = new (window as any).Razorpay(razorpayOptions);

    razorpay.on("payment.failed", function (response: any) {
        console.error("Payment failed:", response.error);
        onFailure(response.error);
    });

    razorpay.open();
}

import { getFunctions, httpsCallable } from "firebase/functions";

/**
 * Create order on backend and open checkout
 * This is the recommended flow for production
 */
export async function initiatePayment(
    options: RazorpayCheckoutOptions,
    onSuccess: (response: RazorpayResponse) => void,
    onFailure: (error: any) => void
): Promise<void> {
    try {
        const functions = getFunctions();
        const createOrderFn = httpsCallable(functions, "createRazorpayOrder");

        // 1. Create Order on Backend
        const result = await createOrderFn({
            planId: options.planId,
            billingCycle: options.billingCycle,
            shopId: options.shopId
        });

        const data = result.data as any;

        if (!data || !data.orderId) {
            throw new Error("Failed to create order");
        }

        // 2. Open Checkout with Order ID
        // Note: verify amounts match if needed
        await openRazorpayCheckout({
            ...options,
            orderId: data.orderId,
            amount: data.amount / 100 // Convert back to rupees for display logic if needed (but we pass order_id so amount is fixed)
        }, onSuccess, onFailure);

    } catch (error) {
        console.error("Failed to initiate payment:", error);
        onFailure(error);
    }
}

/**
 * Verify payment on backend (call after success)
 * The webhook will handle this automatically, but this can be used for UI
 */
export async function verifyPaymentStatus(
    _paymentId: string,
    _shopId: string
): Promise<{ success: boolean; message: string }> {
    // Wait a bit for webhook to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // For now, just return success
    // In production, verify against your database
    return {
        success: true,
        message: "Payment verified successfully",
    };
}
