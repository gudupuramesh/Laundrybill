import { Platform } from "react-native";
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  getAvailablePurchases,
  ErrorCode,
} from "react-native-iap";

type PurchaseLike = {
  transactionIdAndroid?: string;
  transactionId?: string;
  purchaseToken?: string;
  productId?: string;
  dataAndroid?: string;
  signatureAndroid?: string;
};

export function isGoogleIapAvailable() {
  if (Platform.OS !== "android") return false;
  return (
    typeof initConnection === "function" &&
    typeof fetchProducts === "function" &&
    typeof requestPurchase === "function" &&
    typeof purchaseUpdatedListener === "function" &&
    typeof purchaseErrorListener === "function"
  );
}

export async function initGoogleIap() {
  if (!isGoogleIapAvailable()) return false;
  await initConnection();
  return true;
}

export async function endGoogleIap() {
  if (!isGoogleIapAvailable()) return;
  await endConnection();
}

export function getAndroidProductId(planId: string, cycle: "monthly" | "yearly") {
  const key = `EXPO_PUBLIC_ANDROID_IAP_${String(planId).toUpperCase()}_${cycle.toUpperCase()}`;
  const envVal = (process.env as Record<string, string | undefined>)[key];
  return envVal || `in.laundrybill.${planId}.${cycle}`;
}

export async function getGoogleSubscriptionDisplayPrice(productId: string): Promise<string | null> {
  if (!isGoogleIapAvailable()) return null;
  const subs = await fetchProducts({ skus: [productId], type: "subs" });
  const list = Array.isArray(subs) ? subs : [];
  const subscription = list.find((s: { id?: string }) => s.id === productId) ?? list[0];
  return typeof subscription?.displayPrice === "string" && subscription.displayPrice.length > 0
    ? subscription.displayPrice
    : null;
}

function matchesProduct(purchase: PurchaseLike, productId: string) {
  return purchase.productId === productId;
}

function safeRemove(sub: { remove?: () => void } | null | undefined) {
  try {
    sub?.remove?.();
  } catch (_) {
    /* ignore */
  }
}

/** Active subscription purchase token for upgrade/replace flows (same Play account). */
async function getExistingSubscriptionPurchaseToken(): Promise<string | undefined> {
  try {
    const existing = await getAvailablePurchases({});
    const list = Array.isArray(existing) ? existing : [];
    if (list.length === 0) return undefined;
    const sorted = [...list].sort(
      (a: { transactionDate?: number }, b: { transactionDate?: number }) =>
        (b.transactionDate ?? 0) - (a.transactionDate ?? 0),
    );
    const withToken = sorted.find((p) => p.purchaseToken);
    return withToken?.purchaseToken ?? undefined;
  } catch (_) {
    return undefined;
  }
}

export async function requestGoogleSubscription(productId: string): Promise<PurchaseLike> {
  if (!isGoogleIapAvailable()) throw new Error("Google IAP not available");

  const subs = await fetchProducts({ skus: [productId], type: "subs" });
  const list = Array.isArray(subs) ? subs : [];
  const subscription = list.find((s: { id?: string }) => s.id === productId) ?? list[0];
  if (!subscription) {
    throw new Error(`Subscription not found in Play Store: ${productId}`);
  }

  const offerDetails = (subscription as { subscriptionOfferDetailsAndroid?: Array<{ offerToken?: string }> })
    .subscriptionOfferDetailsAndroid;
  const subscriptionOffers =
    offerDetails
      ?.map((offer) => ({
        sku: productId,
        offerToken: offer.offerToken as string,
      }))
      .filter((o) => Boolean(o.offerToken)) ?? [];

  if (subscriptionOffers.length === 0) {
    throw new Error(
      "No subscription offers for this product. Check Play Console base plans and that the app matches the upload key.",
    );
  }

  const existingPurchaseToken = await getExistingSubscriptionPurchaseToken();

  return new Promise((resolve, reject) => {
    let settled = false;
    const subErr = purchaseErrorListener((error) => {
      if (settled) return;
      if (error.code === ErrorCode.UserCancelled) {
        settled = true;
        safeRemove(subErr);
        safeRemove(subOk);
        reject(new Error("Purchase cancelled"));
        return;
      }
      settled = true;
      safeRemove(subErr);
      safeRemove(subOk);
      reject(error);
    });

    const subOk = purchaseUpdatedListener((purchase) => {
      if (settled) return;
      if (!matchesProduct(purchase as PurchaseLike, productId)) return;
      settled = true;
      safeRemove(subErr);
      safeRemove(subOk);
      resolve(purchase as PurchaseLike);
    });

    const googleRequest: {
      skus: string[];
      subscriptionOffers: { sku: string; offerToken: string }[];
      purchaseToken?: string;
    } = {
      skus: [productId],
      subscriptionOffers,
    };
    if (existingPurchaseToken) {
      googleRequest.purchaseToken = existingPurchaseToken;
    }

    requestPurchase({
      type: "subs",
      request: {
        google: googleRequest,
      },
    }).catch((e: unknown) => {
      if (settled) return;
      settled = true;
      safeRemove(subErr);
      safeRemove(subOk);
      reject(e instanceof Error ? e : new Error(String(e)));
    });
  });
}

export async function restoreGoogleSubscriptions() {
  if (!isGoogleIapAvailable()) throw new Error("Google IAP not available");
  return getAvailablePurchases({});
}

export async function finishGoogleTransaction(purchase: PurchaseLike) {
  if (!isGoogleIapAvailable()) return;
  if (purchase && purchase.purchaseToken) {
    await finishTransaction({ purchase: purchase as never, isConsumable: false });
  }
}

export function normalizeGooglePurchase(purchase: PurchaseLike) {
  const tx =
    purchase.transactionIdAndroid ||
    purchase.transactionId ||
    "";
  return {
    transactionId: tx,
    purchaseToken: purchase.purchaseToken || "",
    productId: purchase.productId || "",
    rawData: purchase.dataAndroid || "",
    signature: purchase.signatureAndroid || "",
  };
}
