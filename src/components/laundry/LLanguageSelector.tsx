/**
 * LLanguageSelector Component
 * 
 * A component for selecting the application language.
 * Available in two variants:
 * - dropdown: Compact dropdown for headers/settings
 * - list: Full list view for settings pages
 * 
 * Language is saved to Firebase when user is logged in for cross-device sync.
 */

import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Globe, Languages } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { SUPPORTED_LANGUAGES, changeLanguageWithSync, type LanguageCode } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';

interface LLanguageSelectorProps {
    /** Variant of the selector */
    variant?: 'dropdown' | 'list';
    /** Additional class names */
    className?: string;
    /** Show the language icon */
    showIcon?: boolean;
    /** Show the current language name */
    showLabel?: boolean;
    /** Callback when language changes */
    onLanguageChange?: (code: LanguageCode) => void;
}

export function LLanguageSelector({
    variant = 'dropdown',
    className,
    showIcon = true,
    showLabel = true,
    onLanguageChange,
}: LLanguageSelectorProps) {
    const { i18n, t } = useTranslation();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentLanguage = SUPPORTED_LANGUAGES.find(
        lang => lang.code === i18n.language
    ) || SUPPORTED_LANGUAGES[0];

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLanguageSelect = async (code: LanguageCode) => {
        // Use sync function that also saves to Firebase if user is logged in
        await changeLanguageWithSync(code, user?.uid);
        setIsOpen(false);
        onLanguageChange?.(code);
    };

    if (variant === 'list') {
        return (
            <div className={cn("space-y-2", className)}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {t('settings.selectLanguage')}
                </h3>
                <div className="space-y-1">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleLanguageSelect(lang.code)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                                "hover:bg-accent",
                                i18n.language === lang.code && "bg-primary/10 text-primary"
                            )}
                        >
                            <span className="text-lg">{lang.flag}</span>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-medium">{lang.nativeName}</p>
                                <p className="text-xs text-muted-foreground">{lang.name}</p>
                            </div>
                            {i18n.language === lang.code && (
                                <Check className="w-4 h-4 text-primary" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Dropdown variant
    return (
        <div ref={dropdownRef} className={cn("relative", className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                    "hover:bg-accent text-sm font-medium",
                    isOpen && "bg-accent"
                )}
            >
                {showIcon && <Globe className="w-4 h-4" />}
                {showLabel && (
                    <span className="hidden sm:inline">{currentLanguage.nativeName}</span>
                )}
                <span className="sm:hidden">{currentLanguage.flag}</span>
                <ChevronDown className={cn(
                    "w-4 h-4 transition-transform",
                    isOpen && "rotate-180"
                )} />
            </button>

            {isOpen && (
                <div className={cn(
                    "absolute right-0 top-full mt-2 z-50",
                    "min-w-[200px] bg-popover border rounded-lg shadow-lg",
                    "animate-in fade-in-0 zoom-in-95"
                )}>
                    <div className="p-1">
                        {SUPPORTED_LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleLanguageSelect(lang.code)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                                    "hover:bg-accent text-sm",
                                    i18n.language === lang.code && "bg-primary/10 text-primary"
                                )}
                            >
                                <span>{lang.flag}</span>
                                <div className="flex-1 text-left">
                                    <span className="font-medium">{lang.nativeName}</span>
                                    <span className="text-muted-foreground ml-2">({lang.name})</span>
                                </div>
                                {i18n.language === lang.code && (
                                    <Check className="w-4 h-4 text-primary" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Compact language toggle button for mobile headers
 */
export function LLanguageToggle({ className }: { className?: string }) {
    const { i18n } = useTranslation();
    const { user } = useAuth();
    const currentIndex = SUPPORTED_LANGUAGES.findIndex(lang => lang.code === i18n.language);
    
    const handleToggle = () => {
        const nextIndex = (currentIndex + 1) % SUPPORTED_LANGUAGES.length;
        changeLanguageWithSync(SUPPORTED_LANGUAGES[nextIndex].code, user?.uid);
    };

    const currentLanguage = SUPPORTED_LANGUAGES[currentIndex] || SUPPORTED_LANGUAGES[0];

    return (
        <button
            onClick={handleToggle}
            className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg",
                "hover:bg-accent transition-colors",
                className
            )}
            title={currentLanguage.name}
        >
            <Languages className="w-5 h-5" />
        </button>
    );
}
