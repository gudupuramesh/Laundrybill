import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Initialize i18n before app renders
import "./lib/i18n";
import { registerSW } from 'virtual:pwa-register';
import App from "./App";

// Register Service Worker for PWA
// Auto-update silently to avoid blocking confirm() dialogs on mobile
const updateSW = registerSW({
  onNeedRefresh() {
    // Apply the new service worker at most ONCE per tab session. Auto-reloading on
    // every "need refresh" loops forever with skipWaiting + clientsClaim, because the
    // freshly-loaded page re-detects the active SW as "new" and reloads again (~5s loop).
    // The sessionStorage guard survives reloads within the tab, so we reload only once.
    try {
      if (sessionStorage.getItem("sw-auto-reloaded") === "1") {
        console.log("SW update available — skipping auto-reload (already applied this session)");
        return;
      }
      sessionStorage.setItem("sw-auto-reloaded", "1");
    } catch {
      /* sessionStorage unavailable (private mode) — fall through to a single reload */
    }
    console.log("New content available, updating service worker...");
    updateSW(true);
  },
  onOfflineReady() {
    console.log("App ready to work offline");
  },
  onRegisteredSW(_swUrl, r) {
    if (!r) return;
    // Pick up a new deploy promptly so a long-open tab doesn't keep running stale
    // code: check hourly AND whenever the tab regains focus (throttled to 1/min).
    let lastCheck = Date.now();
    const check = () => { lastCheck = Date.now(); r.update(); };
    setInterval(check, 60 * 60 * 1000); // 1 hour
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && Date.now() - lastCheck > 60 * 1000) check();
    });
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
