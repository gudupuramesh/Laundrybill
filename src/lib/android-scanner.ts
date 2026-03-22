/**
 * Android native scanner bridge.
 * When window.Android.startScanner exists, the app opens the device camera for barcode/QR scan
 * and returns the result via window.onScanResult(result).
 * Window.Android and Window.onScanResult are declared in receipt-print.ts (shared Android bridge).
 */

export function isAndroidScannerEnv(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.Android?.startScanner === "function";
}
