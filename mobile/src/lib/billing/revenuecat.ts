import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

/**
 * Platform-specific RevenueCat API keys.
 * Android (Google Play) key is live with real paying users.
 * iOS (App Store) key — add your Apple API key from RevenueCat dashboard here.
 */
const GOOGLE_API_KEY = "goog_EpIUjfFfLhTOWhqUuuGJQcLANxw";
const APPLE_API_KEY = ""; // TODO: Add your Apple RevenueCat API key (appl_XXXX)

const ENTITLEMENT_ID = "Laundrybill Pro";

let configured = false;

/**
 * Configure RevenueCat SDK. Safe to call multiple times — only runs once.
 * Must be called early (App.tsx mount) before any purchase/offering calls.
 * Uses the correct API key per platform (Google Play vs App Store).
 */
export async function configureRevenueCat(appUserID?: string): Promise<void> {
  if (configured) return;
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;

  const apiKey = Platform.OS === "ios" ? APPLE_API_KEY : GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn(`[RevenueCat] No API key configured for ${Platform.OS}. Purchases will be unavailable.`);
    return;
  }

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey, appUserID: appUserID || undefined });
  configured = true;
}

/** Whether RevenueCat has been configured for the current platform. */
export function isRevenueCatConfigured(): boolean {
  return configured;
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

/** Fetch latest CustomerInfo from RevenueCat. Guards against unconfigured SDK. */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  if (!configured) throw new Error("RevenueCat not configured");
  return Purchases.getCustomerInfo();
}

/** Listen for real-time entitlement changes (e.g. renewal, expiry). Guards against unconfigured SDK. */
export function addCustomerInfoListener(
  cb: (info: CustomerInfo) => void,
): () => void {
  if (!configured) return () => {};
  const remove = Purchases.addCustomerInfoUpdateListener(cb);
  return typeof remove === "function" ? remove : () => {};
}

export type { PurchasesOffering, PurchasesPackage };

/** Get the current (default) offering configured in the RC dashboard. Guards against unconfigured SDK. */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
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
  if (!configured) throw new Error("RevenueCat not configured for this platform");
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

/** Restore purchases (re-links prior App Store / Play Store transactions). Guards against unconfigured SDK. */
export async function restorePurchases(): Promise<CustomerInfo> {
  if (!configured) throw new Error("RevenueCat not configured for this platform");
  return Purchases.restorePurchases();
}

export { ENTITLEMENT_ID };
