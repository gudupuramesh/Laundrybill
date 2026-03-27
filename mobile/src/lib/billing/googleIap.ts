import { Platform } from "react-native";

type PurchaseLike = {
  transactionIdAndroid?: string;
  transactionId?: string;
  purchaseToken?: string;
  productId?: string;
  dataAndroid?: string;
  signatureAndroid?: string;
};

let iapModule: typeof import("react-native-iap") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  iapModule = require("react-native-iap");
} catch (_) {
  iapModule = null;
}

function getIap() {
  return iapModule;
}

export function isGoogleIapAvailable() {
  return Platform.OS === "android" && !!getIap();
}

export async function initGoogleIap() {
  if (!isGoogleIapAvailable()) return false;
  await getIap()!.initConnection();
  return true;
}

export async function endGoogleIap() {
  if (!isGoogleIapAvailable()) return;
  await getIap()!.endConnection();
}

export function getAndroidProductId(planId: string, cycle: "monthly" | "yearly") {
  const key = `EXPO_PUBLIC_ANDROID_IAP_${String(planId).toUpperCase()}_${cycle.toUpperCase()}`;
  const envVal = (process.env as Record<string, string | undefined>)[key];
  return envVal || `in.laundrybill.${planId}.${cycle}`;
}

export async function getGoogleSubscriptionDisplayPrice(productId: string): Promise<string | null> {
  if (!isGoogleIapAvailable()) return null;
  const iap = getIap()!;
  const subs = await iap.fetchProducts({ skus: [productId], type: "subs" });
  const list = Array.isArray(subs) ? subs : [];
  const subscription = list.find((s: { id?: string }) => s.id === productId) ?? list[0];
  return typeof subscription?.displayPrice === "string" && subscription.displayPrice.length > 0
    ? subscription.displayPrice
    : null;
}

function matchesProduct(purchase: PurchaseLike, productId: string) {
  return purchase.productId === productId;
}

export async function requestGoogleSubscription(productId: string): Promise<PurchaseLike> {
  if (!isGoogleIapAvailable()) throw new Error("Google IAP not available");
  const iap = getIap()!;

  const subs = await iap.fetchProducts({ skus: [productId], type: "subs" });
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
      "No subscription offers for this product. Check Play Console base plans and that the app matches the upload key."
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const subErr = iap.purchaseErrorListener((error) => {
      if (settled) return;
      if (error.code === iap.ErrorCode.UserCancelled) {
        settled = true;
        cleanup();
        reject(new Error("Purchase cancelled"));
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    });

    const subOk = iap.purchaseUpdatedListener((purchase) => {
      if (settled) return;
      if (!matchesProduct(purchase as PurchaseLike, productId)) return;
      settled = true;
      cleanup();
      resolve(purchase as PurchaseLike);
    });

    function cleanup() {
      subErr.remove();
      subOk.remove();
    }

    iap
      .requestPurchase({
        type: "subs",
        request: {
          google: {
            skus: [productId],
            subscriptionOffers,
          },
        },
      })
      .catch((e: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(e instanceof Error ? e : new Error(String(e)));
      });
  });
}

export async function restoreGoogleSubscriptions() {
  if (!isGoogleIapAvailable()) throw new Error("Google IAP not available");
  return getIap()!.getAvailablePurchases();
}

export async function finishGoogleTransaction(purchase: PurchaseLike) {
  if (!isGoogleIapAvailable()) return;
  if (purchase && purchase.purchaseToken) {
    await getIap()!.finishTransaction({ purchase: purchase as never, isConsumable: false });
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
