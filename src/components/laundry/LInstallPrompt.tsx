/**
 * PWA Install Prompt Component
 * 
 * Shows install prompt for Android/Desktop or iOS instructions
 */

import { usePWAInstall } from "@/hooks/use-pwa-install";
import { LCard, LButton, LSpacer } from "@/components/laundry";
import { Download, Share, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LInstallPromptProps {
    onDismiss?: () => void;
}

export function LInstallPrompt({ onDismiss }: LInstallPromptProps) {
    const { t } = useTranslation();
    const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();

    // Don't show if already installed
    if (isInstalled) return null;

    // iOS instructions
    if (isIOS) {
        return (
            <LCard variant="elevated" padding="md" className="m-4 relative">
                <button
                    onClick={onDismiss}
                    className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-muted flex items-center justify-center flex-shrink-0">
                        <Download className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">{t('pwa.installTitle')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('pwa.iosInstructions')}
                        </p>
                        <ol className="text-sm text-muted-foreground mt-2 space-y-1">
                            <li className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">1</span>
                                {t('pwa.tapShare')} <Share className="h-4 w-4 inline" />
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">2</span>
                                {t('pwa.tapAdd')} <Plus className="h-4 w-4 inline" />
                            </li>
                        </ol>
                    </div>
                </div>
            </LCard>
        );
    }

    // Android/Desktop install prompt
    if (!canInstall) return null;

    return (
        <LCard variant="elevated" padding="md" className="m-4 relative">
            <button
                onClick={onDismiss}
                className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
            >
                <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-muted flex items-center justify-center flex-shrink-0">
                    <Download className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{t('pwa.installTitle')}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t('pwa.installDescription')}
                    </p>
                    <LSpacer size="sm" />
                    <div className="flex gap-2">
                        <LButton variant="primary" size="sm" onClick={promptInstall}>
                            {t('pwa.install')}
                        </LButton>
                        <LButton variant="ghost" size="sm" onClick={onDismiss}>
                            {t('pwa.notNow')}
                        </LButton>
                    </div>
                </div>
            </div>
        </LCard>
    );
}
