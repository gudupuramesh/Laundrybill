/**
 * Streams delivery agents for the shop so an order can be assigned to one.
 * Mirrors the web `useAvailableAgents` merge: teamMembers (memberType==='agent',
 * isActive !== false) + legacy staff (memberType==='agent', isActive truthy).
 */
import { useEffect, useMemo, useState } from 'react';
import { firestore } from './db';

export interface AgentOption {
  id: string;
  name: string;
  phone?: string;
  isOnline?: boolean;
  serviceAreas?: string[];
}

interface RawAgent extends AgentOption {
  memberType?: string;
  isActive?: boolean;
}

function mapDoc(d: any): RawAgent {
  const data = d.data?.() || {};
  return {
    id: d.id,
    name: data.name || data.email || 'Agent',
    phone: data.phone,
    isOnline: data.isOnline,
    serviceAreas: data.serviceAreas,
    memberType: data.memberType,
    isActive: data.isActive,
  };
}

export function useAgents(shopId: string | null | undefined): { agents: AgentOption[]; loading: boolean } {
  const [teamMembers, setTeamMembers] = useState<RawAgent[]>([]);
  const [staff, setStaff] = useState<RawAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubTm = firestore()
      .collection(`shops/${shopId}/teamMembers`)
      .where('memberType', '==', 'agent')
      .onSnapshot(
        (snap) => {
          setTeamMembers(snap.docs.map(mapDoc).filter((a) => a.isActive !== false));
          setLoading(false);
        },
        () => setLoading(false),
      );
    const unsubStaff = firestore()
      .collection(`shops/${shopId}/staff`)
      .where('memberType', '==', 'agent')
      .onSnapshot(
        (snap) => setStaff(snap.docs.map(mapDoc).filter((a) => !!a.isActive)),
        () => {},
      );
    return () => {
      unsubTm();
      unsubStaff();
    };
  }, [shopId]);

  const agents = useMemo(() => {
    const byId = new Map<string, AgentOption>();
    [...staff, ...teamMembers].forEach((a) =>
      byId.set(a.id, { id: a.id, name: a.name, phone: a.phone, isOnline: a.isOnline, serviceAreas: a.serviceAreas }),
    );
    return Array.from(byId.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [staff, teamMembers]);

  return { agents, loading };
}
