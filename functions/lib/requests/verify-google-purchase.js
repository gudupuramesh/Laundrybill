"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGooglePurchase = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const googleapis_1 = require("googleapis");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
const PRIMARY_PAID_PLAN_ID = process.env.PRIMARY_PAID_PLAN_ID || "pro";
function getPlanName(planId) {
    return planId === PRIMARY_PAID_PLAN_ID ? "Pro" : planId;
}
function getPackageName() {
    return process.env.GOOGLE_PLAY_PACKAGE_NAME || "in.laundrybill";
}
function getGoogleCredentials() {
    const credentials = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!credentials) {
        throw new https_1.HttpsError("failed-precondition", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured.");
    }
    try {
        return JSON.parse(credentials);
    }
    catch (_) {
        throw new https_1.HttpsError("failed-precondition", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is invalid JSON.");
    }
}
async function verifyGoogleSubscriptionToken(productId, purchaseToken) {
    var _a;
    const auth = new googleapis_1.google.auth.GoogleAuth({
        credentials: getGoogleCredentials(),
        scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const authClient = await auth.getClient();
    const androidpublisher = googleapis_1.google.androidpublisher({ version: "v3", auth: authClient });
    const packageName = getPackageName();
    const response = await androidpublisher.purchases.subscriptionsv2.get({
        packageName,
        token: purchaseToken,
    });
    const payload = response.data;
    const lineItem = (_a = payload === null || payload === void 0 ? void 0 : payload.lineItems) === null || _a === void 0 ? void 0 : _a[0];
    const expiryTime = lineItem === null || lineItem === void 0 ? void 0 : lineItem.expiryTime;
    const orderId = (lineItem === null || lineItem === void 0 ? void 0 : lineItem.latestSuccessfulOrderId) || null;
    const state = (payload === null || payload === void 0 ? void 0 : payload.subscriptionState) || "";
    const isActive = state === "SUBSCRIPTION_STATE_ACTIVE" || state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD";
    return {
        isActive,
        expiryTimeMillis: expiryTime ? Date.parse(expiryTime) : undefined,
        orderId,
        state,
    };
}
exports.verifyGooglePurchase = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be logged in.");
    }
    const data = request.data;
    const { shopId, planId, billingCycle, purchaseToken, productId, transactionId, isRestore } = data || {};
    if (!shopId || !planId || !billingCycle || !purchaseToken || !productId) {
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
        provider: "google_play",
        providerRef: purchaseToken,
        purchaseState: "pending_verify",
        status: "pending_verify",
        updatedAt: now,
        createdAt: now,
    }, { merge: true });
    let verification;
    try {
        verification = await verifyGoogleSubscriptionToken(productId, purchaseToken);
    }
    catch (error) {
        await subRef.set({
            purchaseState: "failed",
            status: "past_due",
            lastPurchaseError: (error === null || error === void 0 ? void 0 : error.message) || "Google purchase verification failed",
            updatedAt: now,
        }, { merge: true });
        throw new https_1.HttpsError("failed-precondition", (error === null || error === void 0 ? void 0 : error.message) || "Google purchase verification failed");
    }
    if (!verification.isActive) {
        await subRef.set({
            purchaseState: "failed",
            status: "past_due",
            lastPurchaseError: `Google subscription state is ${verification.state || "unknown"}`,
            updatedAt: now,
        }, { merge: true });
        throw new https_1.HttpsError("failed-precondition", "Google subscription is not active.");
    }
    const endDate = verification.expiryTimeMillis
        ? admin.firestore.Timestamp.fromMillis(verification.expiryTimeMillis)
        : admin.firestore.Timestamp.fromDate(new Date(Date.now() + (billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000));
    await subRef.set({
        shopId,
        planId,
        planName: getPlanName(planId),
        billingCycle,
        status: "active",
        provider: "google_play",
        providerRef: purchaseToken,
        providerOrderId: verification.orderId || transactionId || null,
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
        provider: "google_play",
        productId,
        transactionId: transactionId || null,
        purchaseToken,
        orderId: verification.orderId || null,
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
        method: "google_play",
        gatewayPaymentId: transactionId || null,
        gatewayOrderId: verification.orderId || null,
        invoiceNumber: `INV-GP-${Date.now()}-${shopId.slice(0, 6)}`,
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
//# sourceMappingURL=verify-google-purchase.js.map