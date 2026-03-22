import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * AppManifestUpdater
 * 
 * Dynamically updates the PWA manifest link and meta tags based on the current route.
 * This is crucial for "Add to Home Screen" functionality on iOS/Android to ensure
 * the correct "App" is installed (User vs Staff vs Agent vs Plant).
 * 
 * Note: This works in tandem with the inline script in index.html which handles initial load.
 * This component handles client-side navigation updates.
 */
export function AppManifestUpdater() {
    const location = useLocation();

    useEffect(() => {
        const path = location.pathname;
        const manifestLink = document.getElementById('dynamic-manifest') as HTMLLinkElement;
        const themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
        const appTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement;
        const appNameMeta = document.querySelector('meta[name="application-name"]') as HTMLMetaElement;

        if (!manifestLink) return;

        // Helper to update meta content if element exists
        const setMeta = (element: HTMLMetaElement | null, content: string) => {
            if (element) element.content = content;
        };

        if (path.startsWith('/staff')) {
            // Staff App
            if (manifestLink.href.endsWith('/manifest-staff.json')) return; // Already set
            manifestLink.href = '/manifest-staff.json';
            setMeta(themeColorMeta, '#3B82F6'); // Blue
            setMeta(appTitleMeta, 'LB Staff');
            setMeta(appNameMeta, 'LaundryBill Staff');
            // Don't change document.title here as pages set it themselves

        } else if (path.startsWith('/agent')) {
            // Agent App
            if (manifestLink.href.endsWith('/manifest-agent.json')) return;
            manifestLink.href = '/manifest-agent.json';
            setMeta(themeColorMeta, '#22C55E'); // Green
            setMeta(appTitleMeta, 'LB Agent');
            setMeta(appNameMeta, 'LaundryBill Agent');

        } else if (path.startsWith('/plant')) {
            // Plant App
            if (manifestLink.href.endsWith('/manifest-plant.json')) return;
            manifestLink.href = '/manifest-plant.json';
            setMeta(themeColorMeta, '#A855F7'); // Purple
            setMeta(appTitleMeta, 'LB Plant');
            setMeta(appNameMeta, 'LaundryBill Plant');

        } else if (path.startsWith('/super-admin')) {
            // Super Admin App
            if (manifestLink.href.endsWith('/manifest-super-admin.json')) return;
            manifestLink.href = '/manifest-super-admin.json';
            setMeta(themeColorMeta, '#DC2626'); // Red
            setMeta(appTitleMeta, 'LB Super Admin');
            setMeta(appNameMeta, 'LaundryBill Super Admin');

        } else {
            // Main Admin App (Default)
            if (manifestLink.href.endsWith('/manifest.json')) return;
            manifestLink.href = '/manifest.json';
            setMeta(themeColorMeta, '#0D9488'); // Teal
            setMeta(appTitleMeta, 'LaundryBill');
            setMeta(appNameMeta, 'LaundryBill');
        }

    }, [location.pathname]);

    return null;
}
