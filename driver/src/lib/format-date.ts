/** Lightweight Firestore-Timestamp formatters (no date-fns dependency). */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** e.g. "16 Jun, 06:30 PM" */
export function formatDateTime(ts: any): string {
  const ms = toMillis(ts);
  if (!ms) return 'N/A';
  const d = new Date(ms);
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}, ${pad(h)}:${pad(d.getMinutes())} ${ampm}`;
}

/** e.g. "16 Jun 2026" */
export function formatDate(ts: any): string {
  const ms = toMillis(ts);
  if (!ms) return 'N/A';
  const d = new Date(ms);
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function tsToMillis(ts: any): number {
  return toMillis(ts);
}
