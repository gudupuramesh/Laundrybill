import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
    // Check synchronously on initial render to avoid hydration mismatch
    const [isMobile, setIsMobile] = React.useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < MOBILE_BREAKPOINT;
        }
        return true; // Default to mobile for SSR (mobile-first)
    });

    React.useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        const onChange = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };
        mql.addEventListener("change", onChange);
        // Sync state in case of mismatch
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        return () => mql.removeEventListener("change", onChange);
    }, []);

    return isMobile;
}

