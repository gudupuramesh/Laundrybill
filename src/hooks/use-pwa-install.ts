/**
 * PWA Install Prompt Hook
 * 
 * Handles the PWA install prompt for Android/Desktop and iOS instructions
 */

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: "accepted" | "dismissed";
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export function usePWAInstall() {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if already installed
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
        const isIOSStandalone = (window.navigator as any).standalone === true;
        setIsInstalled(isStandalone || isIOSStandalone);

        // Check if iOS
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setIsIOS(isIOSDevice);

        // Listen for install prompt
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e as BeforeInstallPromptEvent);
        };

        // Listen for successful install
        const handleAppInstalled = () => {
            setIsInstalled(true);
            setInstallPrompt(null);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstall);
        window.addEventListener("appinstalled", handleAppInstalled);

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
            window.removeEventListener("appinstalled", handleAppInstalled);
        };
    }, []);

    const promptInstall = async () => {
        if (!installPrompt) return false;

        await installPrompt.prompt();
        const result = await installPrompt.userChoice;

        if (result.outcome === "accepted") {
            setIsInstalled(true);
        }

        setInstallPrompt(null);
        return result.outcome === "accepted";
    };

    return {
        canInstall: !!installPrompt,
        isInstalled,
        isIOS,
        promptInstall,
    };
}
