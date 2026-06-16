/**
 * Backfills the staff roster from team-member logins so EVERY created login
 * (Staff / Agent / Plant — past or present, app- or web-created) shows up in
 * Manage Staff and Attendance. Idempotent: a login is only added to the roster
 * when no staff row already shares its email, so repeated runs never duplicate.
 *
 * This implements the "merge logins into roster" model: logins live in
 * `teamMembers`, but each one is mirrored into `staff` so the roster-based
 * screens (list, attendance, detail) can show and track them uniformly.
 */
import { firestore } from './db';

function memberTypeToRole(mt?: string): string {
  if (mt === 'plant') return 'plant_operator';
  if (mt === 'agent') return 'agent';
  return 'staff';
}

export async function reconcileTeamMembersToRoster(
  shopId: string | null | undefined,
): Promise<number> {
  if (!shopId) return 0;
  try {
    const [tmSnap, staffSnap] = await Promise.all([
      firestore().collection(`shops/${shopId}/teamMembers`).get(),
      firestore().collection(`shops/${shopId}/staff`).get(),
    ]);

    // Existing roster emails — the dedupe key.
    const staffEmails = new Set<string>();
    staffSnap.docs.forEach((d: any) => {
      const e = (d.data()?.email || '').toLowerCase().trim();
      if (e) staffEmails.add(e);
    });

    const missing = tmSnap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }))
      .filter((tm: any) => {
        const e = (tm.email || '').toLowerCase().trim();
        return e && !staffEmails.has(e);
      });

    if (missing.length === 0) return 0;

    await Promise.all(
      missing.map((tm: any) =>
        firestore().collection(`shops/${shopId}/staff`).add({
          name: tm.name || tm.email || 'Member',
          phone: tm.phone || '',
          email: (tm.email || '').toLowerCase().trim(),
          role: memberTypeToRole(tm.memberType),
          payType: 'monthly',
          baseSalary: 0,
          isActive: tm.isActive !== false,
          joiningDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
    );
    return missing.length;
  } catch (e) {
    console.warn('reconcileTeamMembersToRoster failed:', e);
    return 0;
  }
}
