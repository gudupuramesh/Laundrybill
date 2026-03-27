import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();
const PRIMARY_PAID_PLAN_ID = process.env.PRIMARY_PAID_PLAN_ID || "pro";

type VerifyApplePayload = {
    shopId: string;
    planId: string;
    billingCycle: "monthly" | "yearly";
    receiptData: string;
    transactionId?: string;
    originalTransactionId?: string;
    productId?: string;
    isRestore?: boolean;
};

async function verifyAppleReceipt(receiptData: string): Promise<{
    ok: boolean;
    expiresDateMs?: number;
    originalTransactionId?: string;
}> {
    const sharedSecret = process.env.APPLE_SHARED_SECRET;
    if (!sharedSecret) {
        throw new HttpsError("failed-precondition", "APPLE_SHARED_SECRET is not configured.");
    }

    const payload = {
        "receipt-data": receiptData,
        password: sharedSecret,
        "exclude-old-transactions": true,
    };

    const callEndpoint = async (url: string) => {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        return res.json() as Promise<any>;
    };

    let result = await callEndpoint("https://buy.itunes.apple.com/verifyReceipt");
    if (result?.status === 21007) {
        result = await callEndpoint("https://sandbox.itunes.apple.com/verifyReceipt");
    }

    if (result?.status !== 0) {
        return { ok: false };
    }

    const latest = result?.latest_receipt_info?.[result.latest_receipt_info.length - 1];
    const receiptInApp = result?.receipt?.in_app?.[result.receipt.in_app.length - 1];
    const source = latest || receiptInApp || {};
    const expiresDateMs = source?.expires_date_ms ? Number(source.expires_date_ms) : undefined;

    return {
        ok: true,
        expiresDateMs,
        originalTransactionId: source?.original_transaction_id,
    };
}

export const verifyApplePurchase = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const data = request.data as VerifyApplePayload;
    const { shopId, planId, billingCycle, receiptData, transactionId, originalTransactionId, productId, isRestore } = data || {};
    if (!shopId || !planId || !billingCycle || !receiptData) {
        throw new HttpsError("invalid-argument", "Missing required fields.");
    }
    if (planId !== PRIMARY_PAID_PLAN_ID) {
        throw new HttpsError("invalid-argument", "Only the primary paid plan is allowed.");
    }

    const now = admin.firestore.Timestamp.now();
    const subRef = db.collection("subscriptions").doc(shopId);

    await subRef.set({
        shopId,
        planId,
        billingCycle,
        provider: "apple_iap",
        providerRef: originalTransactionId || transactionId || null,
        purchaseState: "pending_verify",
        status: "pending_verify",
        updatedAt: now,
        createdAt: now,
    }, { merge: true });

    const verification = await verifyAppleReceipt(receiptData);
    if (!verification.ok) {
        await subRef.set({
            purchaseState: "failed",
            status: "past_due",
            lastPurchaseError: "Apple receipt verification failed",
            updatedAt: now,
        }, { merge: true });
        throw new HttpsError("failed-precondition", "Apple receipt verification failed.");
    }

    const endDate = verification.expiresDateMs
        ? admin.firestore.Timestamp.fromMillis(verification.expiresDateMs)
        : admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + (billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000)
        );

    await subRef.set({
        shopId,
        planId,
        planName: planId === PRIMARY_PAID_PLAN_ID ? "Pro" : planId,
        billingCycle,
        status: "active",
        provider: "apple_iap",
        providerRef: verification.originalTransactionId || originalTransactionId || transactionId || null,
        providerOrderId: transactionId || null,
        isAutoRenew: true,
        purchaseState: "active",
        currentPeriodStart: now,
        currentPeriodEnd: endDate,
        endDate,
        updatedAt: now,
        createdAt: now,
        lastPaymentDate: now,
        lastPaymentAmount: null,
        lastPurchaseError: null,
    }, { merge: true });

    await subRef.collection("payments").add({
        type: isRestore ? "restore" : "subscription",
        provider: "apple_iap",
        productId: productId || null,
        transactionId: transactionId || null,
        originalTransactionId: verification.originalTransactionId || originalTransactionId || null,
        status: "success",
        date: now,
    });

    await db.collection("payments").add({
        shopId,
        shopName: "",
        subscriptionId: shopId,
        amount: 0,
        currency: "INR",
        status: "success",
        planId,
        billingCycle,
        method: "apple_iap",
        gatewayPaymentId: transactionId || null,
        gatewayOrderId: verification.originalTransactionId || originalTransactionId || null,
        invoiceNumber: `INV-IAP-${Date.now()}-${shopId.slice(0, 6)}`,
        gstAmount: 0,
        periodStart: now,
        periodEnd: endDate,
        createdAt: now,
        updatedAt: now,
    });

    return {
        success: true,
        status: "active",
        currentPeriodEnd: endDate.toDate().toISOString(),
    };
});

