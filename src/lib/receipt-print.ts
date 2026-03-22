/**
 * Receipt print helpers for Android WebView native print.
 * When window.Android exists, the app overrides window.print() to open the native print dialog.
 */

declare global {
    interface Window {
        Android?: { print?: () => void; startScanner?: () => void };
        onScanResult?: (result: string) => void;
    }
}

export function isAndroidPrintEnv(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as Window;
    return !!(w.Android && (w.Android.print != null || true));
}
