/**
 * "Get the app" promo. The device's own store comes first (Play on Android,
 * App Store on iOS) and it never shows inside the owner Android app's WebView.
 *
 * MOBILE: the layout renders this on EVERY screen and it never fully goes away
 * — closing the card collapses it to a small "Get the app" pill above the tab
 * bar, which reopens the card. A phone user is always one tap from the store.
 * DESKTOP: dashboard-only card that stays dismissed for 3 days.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { X, Smartphone, Play, Apple } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { GOOGLE_PLAY_URL, APP_STORE_URL, detectMobileOS, isInAppWebView } from "@/config/app-links";

const DISMISS_KEY = "lb_app_promo_dismissed_at";
const REMIND_AFTER_DAYS = 3;      // desktop snooze
const COLLAPSE_KEY = "lb_app_promo_collapsed";  // mobile: collapsed-to-pill flag

export function AppDownloadBanner() {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const [visible, setVisible] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const inApp = isInAppWebView();

    useEffect(() => {
        if (inApp) return; // already inside the app — nothing to sell
        // On mobile the promo always runs; on desktop it respects the snooze.
        if (!isMobile) {
            try {
                const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
                if (dismissedAt && Date.now() - dismissedAt < REMIND_AFTER_DAYS * 86400000) return;
            } catch { /* storage blocked — just show it */ }
        } else {
            // Closing it earlier only collapses it — start collapsed, never hidden.
            try { if (sessionStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true); } catch { /* ignore */ }
        }
        const id = window.setTimeout(() => setVisible(true), 700); // let the screen paint first
        return () => window.clearTimeout(id);
    }, [isMobile, inApp]);

    if (inApp || !visible) return null;

    const dismiss = () => {
        if (isMobile) {
            // Collapse to the pill — the promo stays reachable on every screen.
            try { sessionStorage.setItem(COLLAPSE_KEY, "1"); } catch { /* ignore */ }
            setCollapsed(true);
            return;
        }
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
        setVisible(false);
    };

    const expand = () => {
        try { sessionStorage.removeItem(COLLAPSE_KEY); } catch { /* ignore */ }
        setCollapsed(false);
    };

    const os = detectMobileOS();
    const stores = [
        { id: "play", label: "Google Play", icon: <Play size={15} fill="currentColor" />, url: GOOGLE_PLAY_URL },
        { id: "appstore", label: "App Store", icon: <Apple size={16} fill="currentColor" />, url: APP_STORE_URL },
    ];
    if (os === "ios") stores.reverse();

    const wrap: CSSProperties = isMobile
        ? {
            position: "fixed", left: 12, right: 12, zIndex: 45,
            // sit above the h-16 bottom tab bar (+ its safe-area padding)
            bottom: "calc(76px + env(safe-area-inset-bottom, 0px))",
        }
        : { position: "fixed", right: 24, bottom: 24, width: 400, zIndex: 45 };

    const storeBtn = (primary: boolean): CSSProperties => ({
        cursor: "pointer", flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: 7, font: "inherit", fontSize: 13, fontWeight: 600, padding: "9px 12px", borderRadius: 9,
        color: primary ? "#fff" : "var(--c-text)",
        background: primary ? "var(--c-primary)" : "var(--c-surface-2)",
        border: `1px solid ${primary ? "var(--c-primary)" : "var(--c-border-strong)"}`,
        boxShadow: primary ? "var(--sh-sm)" : "none", whiteSpace: "nowrap",
    });

    // Collapsed state (mobile only): a small always-there pill that reopens the card.
    if (collapsed) return (
        <button onClick={expand} aria-label={t("appPromo.title", "Get the Laundrybill app")}
            style={{
                position: "fixed", left: 12, zIndex: 45,
                bottom: "calc(76px + env(safe-area-inset-bottom, 0px))",
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7,
                font: "inherit", fontSize: 12.5, fontWeight: 700, padding: "9px 13px", borderRadius: 999,
                color: "#fff", background: "var(--c-primary)", border: 0,
                boxShadow: "0 6px 18px rgba(27,97,229,.35)",
            }}>
            <Smartphone size={15} />{t("appPromo.pill", "Get the app")}
        </button>
    );

    return (
        <div style={wrap}>
            <style>{`@keyframes lb-promo-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }`}</style>
            <div style={{
                animation: "lb-promo-in .35s cubic-bezier(.21,1.02,.55,1) both",
                background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 14,
                boxShadow: "var(--sh-lg, 0 12px 32px rgba(15,23,42,.16))", padding: 14,
            }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{
                        width: 42, height: 42, flex: "none", borderRadius: 11, display: "flex", alignItems: "center",
                        justifyContent: "center", background: "var(--c-primary-soft)", color: "var(--c-primary)",
                    }}><Smartphone size={21} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: "-.01em" }}>
                            {t("appPromo.title", "Get the Laundrybill app")}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--c-text-2)", marginTop: 2, lineHeight: 1.45 }}>
                            {t("appPromo.body", "Run your shop from your phone — orders, billing and instant notifications.")}
                        </div>
                    </div>
                    <button onClick={dismiss} aria-label={t("common.close", "Close")} style={{
                        cursor: "pointer", flex: "none", width: 28, height: 28, display: "flex", alignItems: "center",
                        justifyContent: "center", color: "var(--c-text-3)", background: "transparent", border: 0, borderRadius: 7,
                    }}><X size={16} /></button>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {stores.map((s, i) => (
                        <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" onClick={dismiss} style={storeBtn(i === 0)}>
                            {s.icon}{s.label}
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
