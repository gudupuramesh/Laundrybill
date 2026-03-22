/**
 * Offline Indicator Component
 * 
 * Shows a banner when the app is offline
 */

import { useOnlineStatus } from "@/hooks/use-online-status";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

export function LOfflineIndicator() {
    const { t } = useTranslation();
    const isOnline = useOnlineStatus();

    return (
        <AnimatePresence>
            {!isOnline && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-50 bg-warning text-warning-foreground px-4 py-2 flex items-center justify-center gap-2 safe-top"
                >
                    <WifiOff className="h-4 w-4" />
                    <span className="text-sm font-medium">{t('pwa.offline')}</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
