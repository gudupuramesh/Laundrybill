import { useState, useEffect } from "react";
import { collection, doc, deleteDoc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PLANS } from "@/config/plans";
import type { Plan, PlanType } from "@/types/plans";

/** Plans offered for new upgrades (Super Admin can hide tiers without deleting history). */
export function filterActivePlans(plans: Plan[]): Plan[] {
    return plans.filter((p) => p.isActive !== false);
}

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
                setPlans(Object.values(PLANS).map((p) => ({ ...p, isActive: p.isActive !== false })));
            } else {
                const fetchedPlans = querySnapshot.docs.map((d) => {
                    const data = d.data() as Plan;
                    return { ...data, isActive: data.isActive !== false };
                });
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

    const deletePlan = async (planId: PlanType) => {
        if (planId === "free") {
            throw new Error("The Free plan cannot be deleted.");
        }
        await deleteDoc(doc(db, "plans", planId));
        await fetchPlans();
    };

    return {
        plans,
        loading,
        error,
        updatePlan,
        deletePlan,
        refetch: fetchPlans
    };
}
