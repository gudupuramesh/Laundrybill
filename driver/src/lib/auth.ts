/**
 * Driver auth helpers — JS Firebase SDK via the compatibility facade in `./firebase`.
 *
 * Delivery agents sign in with email + password (after invite-code signup).
 * No Google/Apple sign-in here — that's the owner app. The resolved shopId/agentId
 * are set by DriverAuthContext after the agent record is matched, and read by the
 * push hook and screens.
 */
import { auth } from './firebase';

export async function signInWithEmailPassword(email: string, password: string) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return auth().signInWithEmailAndPassword(normalizedEmail, password);
}

export async function registerWithEmailPassword(email: string, password: string) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return auth().createUserWithEmailAndPassword(normalizedEmail, password);
}

export async function sendPasswordReset(email: string) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return auth().sendPasswordResetEmail(normalizedEmail);
}

// Resolved by DriverAuthContext once the agent's shop + record are known.
let _resolvedShopId: string | null = null;
let _resolvedAgentId: string | null = null;
let _resolvedAgentName: string | null = null;

export function setResolvedShopId(id: string | null) {
  _resolvedShopId = id;
}
export function getShopId(): string {
  return _resolvedShopId || '';
}

export function setResolvedAgentId(id: string | null) {
  _resolvedAgentId = id;
}
export function getAgentId(): string {
  return _resolvedAgentId || '';
}

/** The signed-in team member's display name — stamped as staffName on writes. */
export function setResolvedAgentName(name: string | null) {
  _resolvedAgentName = name;
}
export function getAgentName(): string {
  return _resolvedAgentName || '';
}

export { auth };
