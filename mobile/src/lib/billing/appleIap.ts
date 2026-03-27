import { Platform } from "react-native";

type PurchaseLike = {
  id?: string;
  transactionId?: string;
  originalTransactionIdentifierIOS?: string;
  productId?: string;
  transactionReceipt?: string;
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

export function isAppleIapAvailable() {
  return Platform.OS === "ios" && !!getIap();
}

export async function initAppleIap() {
  if (!isAppleIapAvailable()) return false;
  await getIap()!.initConnection();
  return true;
}

export async function endAppleIap() {
  if (!isAppleIapAvailable()) return;
  await getIap()!.endConnection();
}

export function getIosProductId(planId: string, cycle: "monthly" | "yearly") {
  const key = `EXPO_PUBLIC_IOS_IAP_${String(planId).toUpperCase()}_${cycle.toUpperCase()}`;
  const envVal = (process.env as Record<string, string | undefined>)[key];
  return envVal || `in.laundrybill.${planId}.${cycle}`;
}

export async function getAppleSubscriptionDisplayPrice(productId: string): Promise<string | null> {
  if (!isAppleIapAvailable()) return null;
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

export async function requestAppleSubscription(productId: string): Promise<PurchaseLike> {
  if (!isAppleIapAvailable()) throw new Error("Apple IAP not available");
  const iap = getIap()!;

  await iap.fetchProducts({ skus: [productId], type: "subs" });

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

    const subOk = iap.purchaseUpdatedListener(async (purchase) => {
      if (settled) return;
      if (!matchesProduct(purchase as PurchaseLike, productId)) return;
      settled = true;
      cleanup();
      try {
        try {
          await iap.requestReceiptRefreshIOS();
        } catch (_) {
          /* ignore */
        }
        const receiptData = (await iap.getReceiptIOS()) || "";
        resolve({
          ...(purchase as PurchaseLike),
          transactionReceipt: receiptData,
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });

    function cleanup() {
      subErr.remove();
      subOk.remove();
    }

    iap
      .requestPurchase({
        type: "subs",
        request: {
          apple: { sku: productId },
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

export async function restoreAppleSubscriptions() {
  if (!isAppleIapAvailable()) throw new Error("Apple IAP not available");
  const iap = getIap()!;
  const purchases = await iap.getAvailablePurchases({
    onlyIncludeActiveItemsIOS: true,
  });
  let receiptData = "";
  try {
    await iap.requestReceiptRefreshIOS();
  } catch (_) {
    /* ignore */
  }
  try {
    receiptData = (await iap.getReceiptIOS()) || "";
  } catch (_) {
    /* ignore */
  }
  return purchases.map((p) => ({
    ...p,
    transactionReceipt: receiptData,
  }));
}

export function normalizeReceipt(purchase: PurchaseLike) {
  return {
    transactionId: purchase.transactionId || purchase.id || "",
    originalTransactionId: purchase.originalTransactionIdentifierIOS || "",
    productId: purchase.productId || "",
    receiptData: purchase.transactionReceipt || "",
  };
}
