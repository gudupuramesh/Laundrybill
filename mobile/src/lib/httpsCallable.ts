import { getApp } from "@react-native-firebase/app";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";

type Jsonish = string | number | boolean | null | Jsonish[] | { [k: string]: Jsonish };

/**
 * Firebase callable + RN native bridge reject `undefined` in payload values.
 * Build a plain JSON-safe object with no undefined (omit those keys).
 */
export function callableData(data: Record<string, unknown>): Record<string, Jsonish> {
  const out: Record<string, Jsonish> = {};
  for (const key of Object.keys(data)) {
    const v = data[key];
    if (v === undefined) continue;
    if (v === null) {
      out[key] = null;
      continue;
    }
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") {
      out[key] = v as string | number | boolean;
      continue;
    }
    if (Array.isArray(v)) {
      out[key] = JSON.parse(JSON.stringify(v)) as Jsonish[];
      continue;
    }
    if (t === "object") {
      out[key] = JSON.parse(JSON.stringify(v)) as { [k: string]: Jsonish };
    }
  }
  return out;
}

const region =
  typeof process !== "undefined" && process.env?.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION
    ? process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION
    : undefined;

/**
 * Named HTTPS callable with correct Functions instance (region) and safe payload encoding.
 */
export function createNamedHttpsCallable(name: string) {
  const app = getApp();
  const instance = region ? getFunctions(app, region) : getFunctions(app);
  const mod = instance as { httpsCallable?: (n: string, o?: object) => (d: unknown) => Promise<unknown> };
  if (typeof mod.httpsCallable !== "function") {
    throw new Error(
      "Cloud Functions native module is missing httpsCallable. Rebuild the Android/iOS app with @react-native-firebase/functions linked.",
    );
  }
  const call = httpsCallable(instance, name);
  return (data: Record<string, unknown>) => call(callableData(data));
}
