import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { google } from "googleapis";

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();
const PRIMARY_PAID_PLAN_ID = process.env.PRIMARY_PAID_PLAN_ID || "pro";

type VerifyGooglePayload = {
    shopId: string;
    planId: string;
    billingCycle: "monthly" | "yearly";
    purchaseToken: string;
    productId: string;
    transactionId?: string;
    rawData?: string;
    signature?: string;
    isRestore?: boolean;
};

function getPlanName(planId: string) {
    return planId === PRIMARY_PAID_PLAN_ID ? "Pro" : planId;
}

function getPackageName() {
    return process.env.GOOGLE_PLAY_PACKAGE_NAME || "in.laundrybill";
}

function getGoogleCredentials() {
    const credentials = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!credentials) {
        throw new HttpsError("failed-precondition", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured.");
    }
    try {
        return JSON.parse(credentials);
    } catch (_) {
        throw new HttpsError("failed-precondition", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is invalid JSON.");
    }
}

async function verifyGoogleSubscriptionToken(productId: string, purchaseToken: string) {
    const auth = new google.auth.GoogleAuth({
        credentials: getGoogleCredentials(),
        scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const authClient = await auth.getClient();
    const androidpublisher = google.androidpublisher({ version: "v3", auth: authClient as any });
    const packageName = getPackageName();

    const response = await androidpublisher.purchases.subscriptionsv2.get({
        packageName,
        token: purchaseToken,
    });
    const payload = response.data;
    const lineItem = payload?.lineItems?.[0];
    const expiryTime = lineItem?.expiryTime;
    const orderId = lineItem?.latestSuccessfulOrderId || null;
    const state = payload?.subscriptionState || "";
    const isActive = state === "SUBSCRIPTION_STATE_ACTIVE" || state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD";

    return {
        isActive,
        expiryTimeMillis: expiryTime ? Date.parse(expiryTime) : undefined,
        orderId,
        state,
    };
}

export const verifyGooglePurchase = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const data = request.data as VerifyGooglePayload;
    const { shopId, planId, billingCycle, purchaseToken, productId, transactionId, isRestore } = data || {};
    if (!shopId || !planId || !billingCycle || !purchaseToken || !productId) {
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
        provider: "google_play",
        providerRef: purchaseToken,
        purchaseState: "pending_verify",
        status: "pending_verify",
        updatedAt: now,
        createdAt: now,
    }, { merge: true });

    let verification: Awaited<ReturnType<typeof verifyGoogleSubscriptionToken>>;
    try {
        verification = await verifyGoogleSubscriptionToken(productId, purchaseToken);
    } catch (error: any) {
        await subRef.set({
            purchaseState: "failed",
            status: "past_due",
            lastPurchaseError: error?.message || "Google purchase verification failed",
            updatedAt: now,
        }, { merge: true });
        throw new HttpsError("failed-precondition", error?.message || "Google purchase verification failed");
    }

    if (!verification.isActive) {
        await subRef.set({
            purchaseState: "failed",
            status: "past_due",
            lastPurchaseError: `Google subscription state is ${verification.state || "unknown"}`,
            updatedAt: now,
        }, { merge: true });
        throw new HttpsError("failed-precondition", "Google subscription is not active.");
    }

    const endDate = verification.expiryTimeMillis
        ? admin.firestore.Timestamp.fromMillis(verification.expiryTimeMillis)
        : admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + (billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000)
        );

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

