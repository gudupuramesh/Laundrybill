/**
 * Unseen online orders – badge count and mark-as-seen
 *
 * The Orders nav badge shows how many active online orders the shop owner
 * hasn’t viewed or acted on. When they open an order or update its status,
 * we mark it seen so the count goes down (or vanishes when it reaches 0).
 */

import { createContext, useCallback, useMemo, useState } from "react";

const STORAGE_KEY = "laundryboss_seen_online_orders";
const MAX_SEEN_IDS = 200;

function readSeenIds(): Set<string> {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
}

export interface SeenOnlineOrdersContextValue {
    unseenCount: number;
    markSeen: (id: string) => void;
}

export const SeenOnlineOrdersContext = createContext<SeenOnlineOrdersContextValue>({
    unseenCount: 0,
    markSeen: () => {},
});

export function useSeenOnlineOrders(onlineOrderIds: string[]) {
    const [seenIds, setSeenIds] = useState<Set<string>>(readSeenIds);

    const markSeen = useCallback((id: string) => {
        setSeenIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            let arr = [...next];
            if (arr.length > MAX_SEEN_IDS) {
                arr = arr.slice(-MAX_SEEN_IDS);
            }
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
            return new Set(arr);
        });
    }, []);

    const unseenCount = useMemo(
        () => onlineOrderIds.filter((id) => !seenIds.has(id)).length,
        [onlineOrderIds, seenIds]
    );

    return { unseenCount, markSeen };
}
