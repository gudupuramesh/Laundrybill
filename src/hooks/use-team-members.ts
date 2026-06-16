/**
 * Team Members Hook
 *
 * App logins (Staff App, Agent App, Plant) - separate from roster.
 * Plan limits (maxStaff, maxDeliveryAgents, maxPlantStaff) apply here.
 */

import { useState, useEffect } from "react";
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    doc,
    addDoc,
    updateDoc,
    getDoc,
    getDocs,
    where,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth";
import { useShop } from "@/hooks/use-shop";
import { generateRandomInviteCode } from "@/lib/invite-code";
import type { TeamMember, MemberType } from "@/types/staff";

export function useTeamMembers() {
    const { shopId } = useAuth();
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!shopId) {
            setLoading(false);
            return;
        }

        const ref = collection(db, "shops", shopId, "teamMembers");
        const q = query(ref, orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const list = snapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                })) as TeamMember[];
                setTeamMembers(list);
                setLoading(false);
            },
            (err) => {
                console.error("Team members fetch error:", err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [shopId]);

    const staffCount = teamMembers.filter((t) => t.memberType === "staff").length;
    const agentCount = teamMembers.filter((t) => t.memberType === "agent").length;
    const plantCount = teamMembers.filter((t) => t.memberType === "plant").length;

    return {
        teamMembers,
        staffCount,
        agentCount,
        plantCount,
        loading,
    };
}

export function useTeamMemberMutations() {
    const { shopId } = useAuth();
    const { shop } = useShop();

    const createTeamMember = async (
        data: {
            email: string;
            memberType: MemberType;
            /** Roster role — distinguishes a manager from plain staff (both memberType 'staff'). */
            role?: string;
            staffId?: string;
            name?: string;
            vehicle?: { type: string; number?: string };
            serviceAreas?: string[];
        }
    ): Promise<{ id: string; inviteCode: string }> => {
        if (!shopId) throw new Error("No shop ID");

        const emailLower = data.email.trim().toLowerCase();

        // Check if email already exists in teamMembers (same shop)
        const tmRef = collection(db, "shops", shopId, "teamMembers");
        const tmQuery = query(tmRef, where("email", "==", emailLower));
        const tmSnapshot = await getDocs(tmQuery);
        if (!tmSnapshot.empty) {
            throw new Error("EMAIL_ALREADY_USED");
        }

        // Check legacy staff collection for same email
        const staffRef = collection(db, "shops", shopId, "staff");
        const staffQuery = query(staffRef, where("email", "==", emailLower));
        const staffSnapshot = await getDocs(staffQuery);
        if (!staffSnapshot.empty) {
            throw new Error("EMAIL_ALREADY_USED");
        }

        const shopRef = doc(db, "shops", shopId);
        let shopCode = shop?.shopCode;
        if (!shopCode) {
            const shopDoc = await getDoc(shopRef);
            shopCode = shopDoc.data()?.shopCode;
        }
        if (!shopCode) {
            const { generateShopCode } = await import("@/lib/generateShopCode");
            shopCode = await generateShopCode(shop?.name || "Shop");
            const { updateDoc } = await import("firebase/firestore");
            await updateDoc(shopRef, { shopCode });
        }

        const inviteCode = generateRandomInviteCode(shopCode);

        const ref = collection(db, "shops", shopId, "teamMembers");
        const docRef = await addDoc(ref, {
            email: emailLower,
            inviteCode,
            memberType: data.memberType,
            role: data.role || (data.memberType === "plant" ? "plant_operator" : data.memberType === "agent" ? "agent" : "staff"),
            staffId: data.staffId || null,
            name: data.name || null,
            vehicle: data.vehicle || null,
            serviceAreas: data.serviceAreas || [],
            inviteStatus: "pending",
            // Agents enabled by default. Non-agent team members store isActive: false explicitly
            // to avoid undefined values, which Firestore does not allow.
            isActive: data.memberType === "agent",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        return { id: docRef.id, inviteCode };
    };

    const updateTeamMember = async (
        id: string,
        data: Partial<Pick<TeamMember, "vehicle" | "serviceAreas" | "name" | "staffId" | "isActive" | "isOnline" | "phone">>
    ) => {
        if (!shopId) return;
        const ref = doc(db, "shops", shopId, "teamMembers", id);
        await updateDoc(ref, {
            ...data,
            updatedAt: serverTimestamp(),
        });
    };

    return { createTeamMember, updateTeamMember };
}
