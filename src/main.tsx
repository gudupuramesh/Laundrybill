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
    // Auto-update without prompting - prevents refresh loops on mobile
    // The new version will be applied on next navigation
    console.log("New content available, updating service worker...");
    updateSW(true);
  },
  onOfflineReady() {
    console.log("App ready to work offline");
  },
  onRegisteredSW(_swUrl, r) {
    // Check for updates every hour (instead of on every page load)
    if (r) {
      setInterval(() => {
        r.update();
      }, 60 * 60 * 1000); // 1 hour
    }
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
