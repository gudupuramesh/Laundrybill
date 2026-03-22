/**
 * Shop business hours – used on public ordering page to show "open" / "closed".
 * Times in HH:mm (24h) in shop timezone.
 */

import type { Shop } from "@/types/shop";

export interface ShopOpenStatus {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  /** Display text e.g. "8 AM – 9 PM" */
  timingText: string;
}

const DEFAULT_TIMING_TEXT = "8 AM – 9 PM";

function parseHHmm(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return Math.min(24 * 60 - 1, Math.max(0, h * 60 + min));
}

function formatHHmmToDisplay(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h} ${ampm}${min !== "00" ? `:${min}` : ""}`;
}

/** Get current time (minutes since midnight) in the given IANA timezone. */
function getMinutesInTimezone(timezone: string): number {
  const now = new Date();
  const str = now.toLocaleTimeString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = str.split(":").map((x) => parseInt(x, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Returns whether the shop is currently open and display timing.
 * If businessHours not set, returns isOpen: true and default timing text.
 */
export function getShopOpenStatus(shop: Shop, _now?: Date): ShopOpenStatus {
  const tz = shop.settings?.timezone || "Asia/Kolkata";
  const hours = shop.businessHours;

  if (!hours?.openTime || !hours?.closeTime) {
    return {
      isOpen: true,
      openTime: "08:00",
      closeTime: "21:00",
      timingText: DEFAULT_TIMING_TEXT,
    };
  }

  const openMins = parseHHmm(hours.openTime);
  const closeMins = parseHHmm(hours.closeTime);
  const currentMins = getMinutesInTimezone(tz);

  let isOpen: boolean;
  if (closeMins > openMins) {
    isOpen = currentMins >= openMins && currentMins < closeMins;
  } else {
    isOpen = currentMins >= openMins || currentMins < closeMins;
  }

  const openDisplay = formatHHmmToDisplay(hours.openTime);
  const closeDisplay = formatHHmmToDisplay(hours.closeTime);
  const timingText = `${openDisplay} – ${closeDisplay}`;

  return {
    isOpen,
    openTime: hours.openTime,
    closeTime: hours.closeTime,
    timingText,
  };
}
