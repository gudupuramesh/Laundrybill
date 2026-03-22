/**
 * Shop Hook
 * 
 * Read and update shop data from Firestore
 */

import { useState, useEffect, useCallback } from "react";
import {
    doc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthContext";
import type { Shop, ShopLocation, ShopBankDetails, DeliverySettings } from "@/types/shop";
import { generateShopCode } from "@/lib/generateShopCode";

/** Delivery charge for home delivery / pickup_home: 0 if disabled or order >= min; otherwise fee amount */
export function getDeliveryCharge(
    delivery: DeliverySettings | undefined,
    subtotalAfterDiscount: number,
    deliveryType: "pickup_store" | "delivery_home" | "pickup_home"
): number {
    if (deliveryType === "pickup_store") return 0;
    if (!delivery) return 0;
    if (delivery.deliveryFeeEnabled === false) return 0;
    if (delivery.deliveryFeeEnabled === true) {
        const min = delivery.deliveryFeeMinOrder ?? 0;
        const fee = delivery.deliveryFeeAmount ?? delivery.defaultCharge ?? 0;
        return subtotalAfterDiscount >= min ? 0 : fee;
    }
    return delivery.defaultCharge ?? 0;
}

/** Remove undefined values recursively so Firestore updateDoc doesn't throw */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
    const out = { ...obj } as Record<string, unknown>;
    for (const key of Object.keys(out)) {
        const v = out[key];
        if (v === undefined) {
            delete out[key];
        } else if (v !== null && typeof v === "object" && !Array.isArray(v) && (v as object).constructor === Object) {
            out[key] = stripUndefined(v as Record<string, unknown>);
        }
    }
    return out as T;
}

export function useShop() {
    const { shopId } = useAuth();
    const [shop, setShop] = useState<Shop | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Subscribe to shop data
    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        const shopRef = doc(db, "shops", shopId);

        const unsubscribe = onSnapshot(
            shopRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setShop({
                        id: snapshot.id,
                        ...snapshot.data(),
                    } as Shop);
                } else {
                    setShop(null);
                    setError("Shop not found");
                }
                setLoading(false);
            },
            (err) => {
                console.error("Shop fetch error:", err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [shopId]);

    return { shop, loading, error };
}

/** Fetch shop by id (e.g. from DriverAuth or StaffAuth when not using main AuthContext) */
export function useShopByShopId(shopId: string | null) {
    const [shop, setShop] = useState<Shop | null>(null);
    const [loading, setLoading] = useState(!!shopId);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!shopId) {
            setShop(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        const shopRef = doc(db, "shops", shopId);
        const unsubscribe = onSnapshot(
            shopRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setShop({ id: snapshot.id, ...snapshot.data() } as Shop);
                } else {
                    setShop(null);
                    setError("Shop not found");
                }
                setLoading(false);
            },
            (err) => {
                setError(err.message);
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, [shopId]);

    return { shop, loading, error };
}

// Shop mutations hook
export function useShopMutations() {
    const { shopId } = useAuth();

    const updateShop = useCallback(
        async (data: Partial<Omit<Shop, "id" | "createdAt" | "updatedAt">>) => {
            if (!shopId) throw new Error("No shop ID");

            const shopRef = doc(db, "shops", shopId);
            const cleaned = stripUndefined({ ...data } as Record<string, unknown>) as Partial<Omit<Shop, "id" | "createdAt" | "updatedAt">>;
            await updateDoc(shopRef, {
                ...cleaned,
                updatedAt: serverTimestamp(),
            });
        },
        [shopId]
    );

    const updateLogo = useCallback(
        async (logoUrl: string, logoKey?: string) => {
            if (!shopId) throw new Error("No shop ID");

            const shopRef = doc(db, "shops", shopId);
            await updateDoc(shopRef, {
                logo: logoUrl,
                logoKey: logoKey || null,
                updatedAt: serverTimestamp(),
            });
        },
        [shopId]
    );

    const updateLocation = useCallback(
        async (location: ShopLocation) => {
            if (!shopId) throw new Error("No shop ID");

            const shopRef = doc(db, "shops", shopId);
            await updateDoc(shopRef, {
                location,
                updatedAt: serverTimestamp(),
            });
        },
        [shopId]
    );

    const updateBankDetails = useCallback(
        async (bankDetails: ShopBankDetails) => {
            if (!shopId) throw new Error("No shop ID");

            const shopRef = doc(db, "shops", shopId);
            await updateDoc(shopRef, {
                bankDetails,
                updatedAt: serverTimestamp(),
            });
        },
        [shopId]
    );

    const updateGST = useCallback(
        async (gstNumber: string, panNumber?: string) => {
            if (!shopId) throw new Error("No shop ID");

            const shopRef = doc(db, "shops", shopId);
            await updateDoc(shopRef, {
                gstNumber,
                ...(panNumber && { panNumber }),
                updatedAt: serverTimestamp(),
            });
        },
        [shopId]
    );

    const updateTaxSettings = useCallback(
        async (enabled: boolean, name: string, rate: number) => {
            if (!shopId) throw new Error("No shop ID");

            const shopRef = doc(db, "shops", shopId);
            await updateDoc(shopRef, {
                "settings.tax": {
                    enabled,
                    name,
                    rate
                },
                updatedAt: serverTimestamp(),
            });
        },
        [shopId]
    );

    const updateDeliverySettings = useCallback(
        async (updates: Partial<DeliverySettings>) => {
            if (!shopId) throw new Error("No shop ID");

            const shopRef = doc(db, "shops", shopId);
            const flat: Record<string, unknown> = { updatedAt: serverTimestamp() };
            if (updates.defaultCharge !== undefined) flat["settings.delivery.defaultCharge"] = updates.defaultCharge;
            if (updates.deliveryFeeEnabled !== undefined) flat["settings.delivery.deliveryFeeEnabled"] = updates.deliveryFeeEnabled;
            if (updates.deliveryFeeMinOrder !== undefined) flat["settings.delivery.deliveryFeeMinOrder"] = updates.deliveryFeeMinOrder;
            if (updates.deliveryFeeAmount !== undefined) flat["settings.delivery.deliveryFeeAmount"] = updates.deliveryFeeAmount;
            await updateDoc(shopRef, flat);
        },
        [shopId]
    );

    /** Update country and currency settings (from Settings page country picker) */
    const updateCountrySettings = useCallback(
        async (settings: {
            countryCode: string;
            currency: string;
            currencySymbol: string;
            phoneCountryCode: string;
            locale: string;
            timezone: string;
            taxName?: string;
        }) => {
            if (!shopId) throw new Error("No shop ID");

            const shopRef = doc(db, "shops", shopId);
            const flat: Record<string, unknown> = {
                "settings.countryCode": settings.countryCode,
                "settings.currency": settings.currency,
                "settings.currencySymbol": settings.currencySymbol,
                "settings.phoneCountryCode": settings.phoneCountryCode,
                "settings.locale": settings.locale,
                "settings.timezone": settings.timezone,
                updatedAt: serverTimestamp(),
            };
            if (settings.taxName) {
                flat["settings.tax.name"] = settings.taxName;
            }
            await updateDoc(shopRef, flat);
        },
        [shopId]
    );

    // Ensure shop has a unique shop code (generate if missing)
    const ensureShopCode = useCallback(
        async (shopName: string): Promise<string> => {
            if (!shopId) throw new Error("No shop ID");

            // First check if shop already has a code
            const shopRef = doc(db, "shops", shopId);

            // Generate new code
            const newCode = await generateShopCode(shopName);

            // Save to shop document
            await updateDoc(shopRef, {
                shopCode: newCode,
                updatedAt: serverTimestamp(),
            });

            return newCode;
        },
        [shopId]
    );

    const markWelcomeSeen = useCallback(async () => {
        if (!shopId) return;
        const shopRef = doc(db, "shops", shopId);
        await updateDoc(shopRef, {
            welcomeModalSeenAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    }, [shopId]);

    return {
        updateShop,
        updateLogo,
        updateLocation,
        updateBankDetails,
        updateGST,
        updateTaxSettings,
        updateDeliverySettings,
        updateCountrySettings,
        ensureShopCode,
        markWelcomeSeen,
    };
}
