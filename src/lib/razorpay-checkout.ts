/**
 * Razorpay subscription checkout (web).
 *
 * Flow: createRazorpaySubscription (callable) → open Razorpay Checkout with the
 * subscription_id → on success, verifyRazorpayPayment (callable) activates the plan.
 * The razorpayWebhook keeps it in sync on every monthly charge.
 *
 * Used for Pro+ and Business only. Pro stays on the app stores.
 */

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpayInstance {
    open: () => void;
}
interface RazorpayCtor {
    new (options: Record<string, unknown>): RazorpayInstance;
}
declare global {
    interface Window {
        Razorpay?: RazorpayCtor;
    }
}

let loadPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
    if (window.Razorpay) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
        if (existing) {
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay checkout")));
            if (window.Razorpay) resolve();
            return;
        }
        const s = document.createElement("script");
        s.src = CHECKOUT_SRC;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => {
            loadPromise = null;
            reject(new Error("Failed to load Razorpay checkout"));
        };
        document.body.appendChild(s);
    });
    return loadPromise;
}

export type RazorpayResult =
    | { ok: true; planId: string }
    | { ok: false; error: string; dismissed?: boolean };

/**
 * Start a recurring Razorpay subscription and complete verification.
 * Resolves ok:true once the payment is verified and the plan activated.
 */
export async function startRazorpaySubscription(opts: {
    shopId: string;
    planId: "pro_plus" | "business";
    planName: string;
    email?: string;
    contact?: string;
}): Promise<RazorpayResult> {
    await loadCheckoutScript();
    if (!window.Razorpay) return { ok: false, error: "Razorpay checkout unavailable." };

    const createFn = httpsCallable<
        { shopId: string; planId: string },
        { subscriptionId: string; keyId: string; shortUrl: string | null; status: string }
    >(functions, "createRazorpaySubscription");

    const verifyFn = httpsCallable<
        {
            shopId: string;
            razorpay_payment_id: string;
            razorpay_subscription_id: string;
            razorpay_signature: string;
        },
        { success: boolean; planId: string }
    >(functions, "verifyRazorpayPayment");

    let subscriptionId: string;
    let keyId: string;
    try {
        const res = await createFn({ shopId: opts.shopId, planId: opts.planId });
        subscriptionId = res.data.subscriptionId;
        keyId = res.data.keyId;
    } catch (e) {
        return { ok: false, error: (e as Error)?.message || "Could not start the subscription." };
    }
    if (!subscriptionId || !keyId) {
        return { ok: false, error: "Could not start the subscription." };
    }

    return new Promise<RazorpayResult>((resolve) => {
        const Ctor = window.Razorpay as RazorpayCtor;
        const rzp = new Ctor({
            key: keyId,
            subscription_id: subscriptionId,
            name: "LaundryBill",
            description: `${opts.planName} — Monthly`,
            prefill: { email: opts.email || "", contact: opts.contact || "" },
            theme: { color: "#1A4FD6" },
            handler: async (response: {
                razorpay_payment_id: string;
                razorpay_subscription_id: string;
                razorpay_signature: string;
            }) => {
                try {
                    const v = await verifyFn({
                        shopId: opts.shopId,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_subscription_id: response.razorpay_subscription_id,
                        razorpay_signature: response.razorpay_signature,
                    });
                    resolve({ ok: true, planId: v.data.planId });
                } catch (e) {
                    resolve({ ok: false, error: (e as Error)?.message || "Payment verification failed." });
                }
            },
            modal: {
                ondismiss: () => resolve({ ok: false, error: "Checkout closed.", dismissed: true }),
            },
        });
        rzp.open();
    });
}
