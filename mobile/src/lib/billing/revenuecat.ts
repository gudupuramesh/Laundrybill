import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

const API_KEY = "goog_EpIUjfFfLhTOWhqUuuGJQcLANxw";
const ENTITLEMENT_ID = "Laundrybill Pro";

let configured = false;

/**
 * Configure RevenueCat SDK. Safe to call multiple times — only runs once.
 * Must be called early (App.tsx mount) before any purchase/offering calls.
 */
export async function configureRevenueCat(appUserID?: string): Promise<void> {
  if (configured) return;
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  if (!API_KEY) return;

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey: API_KEY, appUserID: appUserID || undefined });
  configured = true;
}

/** Log in / identify a Firebase user so RC ties purchases to their account. */
export async function loginRevenueCat(firebaseUid: string): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.logIn(firebaseUid);
  return customerInfo;
}

/** Log out (anonymous mode) when the Firebase user signs out. */
export async function logoutRevenueCat(): Promise<void> {
  if (await Purchases.isAnonymous()) return;
  await Purchases.logOut();
}

/** Check whether the user currently has the "Laundrybill Pro" entitlement. */
export function hasProEntitlement(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[ENTITLEMENT_ID] !== "undefined";
}

/** Fetch latest CustomerInfo from RevenueCat. */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

/** Listen for real-time entitlement changes (e.g. renewal, expiry). */
export function addCustomerInfoListener(
  cb: (info: CustomerInfo) => void,
): () => void {
  const remove = Purchases.addCustomerInfoUpdateListener(cb);
  return typeof remove === "function" ? remove : () => {};
}

export type { PurchasesOffering, PurchasesPackage };

/** Get the current (default) offering configured in the RC dashboard. */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

/**
 * Purchase a specific package from an offering.
 * Returns CustomerInfo so the caller can check entitlements immediately.
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<{ customerInfo: CustomerInfo; cancelled: boolean }> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { customerInfo, cancelled: false };
  } catch (e: any) {
    if (e.userCancelled) {
      return { customerInfo: await Purchases.getCustomerInfo(), cancelled: true };
    }
    throw e;
  }
}

/** Restore purchases (re-links prior App Store / Play Store transactions). */
export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export { ENTITLEMENT_ID };
