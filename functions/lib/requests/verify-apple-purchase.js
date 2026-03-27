"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyApplePurchase = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
const PRIMARY_PAID_PLAN_ID = process.env.PRIMARY_PAID_PLAN_ID || "pro";
async function verifyAppleReceipt(receiptData) {
    var _a, _b, _c;
    const sharedSecret = process.env.APPLE_SHARED_SECRET;
    if (!sharedSecret) {
        throw new https_1.HttpsError("failed-precondition", "APPLE_SHARED_SECRET is not configured.");
    }
    const payload = {
        "receipt-data": receiptData,
        password: sharedSecret,
        "exclude-old-transactions": true,
    };
    const callEndpoint = async (url) => {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        return res.json();
    };
    let result = await callEndpoint("https://buy.itunes.apple.com/verifyReceipt");
    if ((result === null || result === void 0 ? void 0 : result.status) === 21007) {
        result = await callEndpoint("https://sandbox.itunes.apple.com/verifyReceipt");
    }
    if ((result === null || result === void 0 ? void 0 : result.status) !== 0) {
        return { ok: false };
    }
    const latest = (_a = result === null || result === void 0 ? void 0 : result.latest_receipt_info) === null || _a === void 0 ? void 0 : _a[result.latest_receipt_info.length - 1];
    const receiptInApp = (_c = (_b = result === null || result === void 0 ? void 0 : result.receipt) === null || _b === void 0 ? void 0 : _b.in_app) === null || _c === void 0 ? void 0 : _c[result.receipt.in_app.length - 1];
    const source = latest || receiptInApp || {};
    const expiresDateMs = (source === null || source === void 0 ? void 0 : source.expires_date_ms) ? Number(source.expires_date_ms) : undefined;
    return {
        ok: true,
        expiresDateMs,
        originalTransactionId: source === null || source === void 0 ? void 0 : source.original_transaction_id,
    };
}
exports.verifyApplePurchase = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be logged in.");
    }
    const data = request.data;
    const { shopId, planId, billingCycle, receiptData, transactionId, originalTransactionId, productId, isRestore } = data || {};
    if (!shopId || !planId || !billingCycle || !receiptData) {
        throw new https_1.HttpsError("invalid-argument", "Missing required fields.");
    }
    if (planId !== PRIMARY_PAID_PLAN_ID) {
        throw new https_1.HttpsError("invalid-argument", "Only the primary paid plan is allowed.");
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
        throw new https_1.HttpsError("failed-precondition", "Apple receipt verification failed.");
    }
    const endDate = verification.expiresDateMs
        ? admin.firestore.Timestamp.fromMillis(verification.expiresDateMs)
        : admin.firestore.Timestamp.fromDate(new Date(Date.now() + (billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000));
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
//# sourceMappingURL=verify-apple-purchase.js.map