import { useState, useEffect } from "react";
import { collection, doc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PLANS } from "@/config/plans";
import type { Plan } from "@/types/plans";

export function usePlans() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "plans"));

            if (querySnapshot.empty) {
                // Determine if we should seed default plans locally or just return empty
                // For now, let's return defaults from config if DB is empty
                setPlans(Object.values(PLANS));
            } else {
                const fetchedPlans = querySnapshot.docs.map(doc => doc.data() as Plan);
                // Sort by price roughly to keep order: Free -> Pro -> Business
                fetchedPlans.sort((a, b) => a.prices.monthly - b.prices.monthly);
                setPlans(fetchedPlans);
            }
            setError(null);
        } catch (err) {
            console.error("Error fetching plans:", err);
            setError("Failed to load plans");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    const updatePlan = async (plan: Plan) => {
        try {
            const planRef = doc(db, "plans", plan.id);
            await setDoc(planRef, {
                ...plan,
                updatedAt: serverTimestamp()
            }, { merge: true });

            await fetchPlans(); // Refresh
            return true;
        } catch (err) {
            console.error("Error updating plan:", err);
            throw err;
        }
    };

    const resetPlans = async () => {
        try {
            const batchPromises = Object.values(PLANS).map(plan =>
                setDoc(doc(db, "plans", plan.id), {
                    ...plan,
                    updatedAt: serverTimestamp(),
                    createdAt: serverTimestamp()
                })
            );
            await Promise.all(batchPromises);
            await fetchPlans();
        } catch (err) {
            console.error("Error resetting plans:", err);
            throw err;
        }
    };

    return {
        plans,
        loading,
        error,
        updatePlan,
        resetPlans,
        refetch: fetchPlans
    };
}
