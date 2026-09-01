/**
 * Team-app onboarding message shared by EVERY place that hands a login to a
 * member (create-login success screen, staff list, share buttons).
 *
 * It always carries the Play Store link — a member who only gets an invite code
 * has no idea which app to install, which is exactly how shop owners got stuck.
 */
export const TEAM_APP_PLAY_URL = 'https://play.google.com/store/apps/details?id=in.laundrybill.driver';

export function buildTeamInviteMessage(opts: {
  name?: string;
  email: string;
  inviteCode: string;
  /** e.g. "Staff", "Manager", "Delivery Agent" — omitted when unknown. */
  roleLabel?: string;
}): string {
  const who = opts.name?.trim() || 'there';
  const asRole = opts.roleLabel ? ` as ${opts.roleLabel}` : '';
  return [
    `Hi ${who}! You've been added${asRole} on Laundrybill Team.`,
    '',
    `1. Install the Laundrybill Team app: ${TEAM_APP_PLAY_URL}`,
    '2. Open it and tap "Sign Up"',
    `3. Email: ${opts.email.trim().toLowerCase()} (use exactly this email)`,
    '4. Create your own password',
    `5. Invite code: ${opts.inviteCode}`,
    '',
    'Note: sign UP (not sign in) the first time. If it says the email is already registered, tell your shop owner — that email may already have a Laundrybill account.',
  ].join('\n');
}
