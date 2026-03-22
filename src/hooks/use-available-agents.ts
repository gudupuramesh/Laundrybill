/**
 * Hook for fetching available delivery agents
 *
 * Returns agents from: teamMembers (memberType=agent) + legacy staff (memberType=agent)
 */

import { useMemo } from "react";
import { useStaff } from "./use-staff";
import { useTeamMembers } from "./use-team-members";
import type { Staff } from "@/types/staff";
import { Timestamp } from "firebase/firestore";

interface UseAvailableAgentsOptions {
    area?: string;
    onlineOnly?: boolean;
}

interface UseAvailableAgentsReturn {
    agents: Staff[];
    isLoading: boolean;
}

function toStaffLike(tm: { id: string; name?: string; email: string; serviceAreas?: string[]; isOnline?: boolean; vehicle?: any; phone?: string }): Staff {
    return {
        id: tm.id,
        name: tm.name || tm.email,
        phone: tm.phone || "",
        email: tm.email,
        role: "staff",
        memberType: "agent",
        payType: "monthly",
        baseSalary: 0,
        joiningDate: Timestamp.now(),
        isActive: true,
        serviceAreas: tm.serviceAreas,
        isOnline: tm.isOnline,
        vehicle: tm.vehicle,
    } as Staff;
}

export function useAvailableAgents(options: UseAvailableAgentsOptions = {}): UseAvailableAgentsReturn {
    const { area, onlineOnly = false } = options;
    const { staff, loading: staffLoading } = useStaff();
    const { teamMembers, loading: tmLoading } = useTeamMembers();

    const agents = useMemo(() => {
        const fromStaff = staff.filter((s) => s.memberType === "agent" && s.isActive);
        const fromTm = teamMembers
            .filter((t) => t.memberType === "agent" && t.isActive !== false)
            .map((t) => ({ ...toStaffLike(t), id: t.id }));

        let combined: Staff[] = [...fromStaff, ...fromTm];
        if (onlineOnly) combined = combined.filter((a) => a.isOnline === true);
        if (area) {
            const normalizedArea = area.toLowerCase().trim();
            combined = combined.filter((a) => {
                if (!a.serviceAreas || a.serviceAreas.length === 0) return true;
                return a.serviceAreas.some((sa) => {
                    const n = (typeof sa === "string" ? sa : "").toLowerCase().trim();
                    return n === normalizedArea || (n.length > 3 && normalizedArea.includes(n));
                });
            });
        }
        return combined.sort((a, b) => a.name.localeCompare(b.name));
    }, [staff, teamMembers, area, onlineOnly]);

    return {
        agents,
        isLoading: staffLoading || tmLoading,
    };
}

export function useAgent(agentId: string | undefined): { agent: Staff | undefined; isLoading: boolean } {
    const { staff, loading: staffLoading } = useStaff();
    const { teamMembers, loading: tmLoading } = useTeamMembers();

    const agent = useMemo(() => {
        if (!agentId) return undefined;
        const fromStaff = staff.find((s) => s.id === agentId && s.memberType === "agent");
        if (fromStaff) return fromStaff;
        const tm = teamMembers.find((t) => t.id === agentId && t.memberType === "agent");
        return tm ? toStaffLike(tm) : undefined;
    }, [staff, teamMembers, agentId]);

    return { agent, isLoading: staffLoading || tmLoading };
}
