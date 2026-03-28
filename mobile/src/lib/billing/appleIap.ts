import { Platform } from "react-native";
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
  requestReceiptRefreshIOS,
  getReceiptIOS,
  ErrorCode,
} from "react-native-iap";

type PurchaseLike = {
  id?: string;
  transactionId?: string;
  originalTransactionIdentifierIOS?: string;
  productId?: string;
  transactionReceipt?: string;
};

export function isAppleIapAvailable() {
  if (Platform.OS !== "ios") return false;
  return (
    typeof initConnection === "function" &&
    typeof fetchProducts === "function" &&
    typeof requestPurchase === "function" &&
    typeof purchaseUpdatedListener === "function" &&
    typeof purchaseErrorListener === "function"
  );
}

export async function initAppleIap() {
  if (!isAppleIapAvailable()) return false;
  await initConnection();
  return true;
}

export async function endAppleIap() {
  if (!isAppleIapAvailable()) return;
  await endConnection();
}

export function getIosProductId(planId: string, cycle: "monthly" | "yearly") {
  const key = `EXPO_PUBLIC_IOS_IAP_${String(planId).toUpperCase()}_${cycle.toUpperCase()}`;
  const envVal = (process.env as Record<string, string | undefined>)[key];
  return envVal || `in.laundrybill.${planId}.${cycle}`;
}

export async function getAppleSubscriptionDisplayPrice(productId: string): Promise<string | null> {
  if (!isAppleIapAvailable()) return null;
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

export async function requestAppleSubscription(productId: string): Promise<PurchaseLike> {
  if (!isAppleIapAvailable()) throw new Error("Apple IAP not available");

  await fetchProducts({ skus: [productId], type: "subs" });

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

    const subOk = purchaseUpdatedListener(async (purchase) => {
      if (settled) return;
      if (!matchesProduct(purchase as PurchaseLike, productId)) return;
      settled = true;
      safeRemove(subErr);
      safeRemove(subOk);
      try {
        try {
          await requestReceiptRefreshIOS();
        } catch (_) {
          /* ignore */
        }
        const receiptData = (await getReceiptIOS()) || "";
        resolve({
          ...(purchase as PurchaseLike),
          transactionReceipt: receiptData,
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });

    requestPurchase({
      type: "subs",
      request: {
        apple: { sku: productId },
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

export async function restoreAppleSubscriptions() {
  if (!isAppleIapAvailable()) throw new Error("Apple IAP not available");
  const purchases = await getAvailablePurchases({
    onlyIncludeActiveItemsIOS: true,
  });
  let receiptData = "";
  try {
    await requestReceiptRefreshIOS();
  } catch (_) {
    /* ignore */
  }
  try {
    receiptData = (await getReceiptIOS()) || "";
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
