/**
 * Slot Selector – Pickup date and time slot selection
 */

import { useMemo, useState } from "react";
import { LCard } from "@/components/laundry";
import { Clock, Calendar, CalendarDays } from "lucide-react";
import { addDays, format, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface SlotOption {
  id: string;
  value: string;
  isActive: boolean;
  capacity?: number;
}

/** Per-slot capacity and booked count from getPublicOrderSlotAvailability */
export type SlotAvailabilityMap = Record<string, { capacity: number; booked: number }>;

interface SlotSelectorProps {
  slots: SlotOption[];
  selectedDate: string; // ISO date YYYY-MM-DD
  selectedSlot: string;
  onDateChange: (date: string) => void;
  onSlotChange: (slot: string) => void;
  /** If true, use pickup slots; else delivery slots shape is same */
  enableSlots: boolean;
  /** When provided, slots at capacity are shown as Full and disabled */
  slotAvailability?: SlotAvailabilityMap | null;
  /** Min minutes before slot start to allow booking (e.g. 30 = cannot book 9–10 after 8:30). Only applies to today. */
  bufferMinutes?: number;
}

export function SlotSelector({
  slots,
  selectedDate,
  selectedSlot,
  onDateChange,
  onSlotChange,
  enableSlots,
  slotAvailability,
  bufferMinutes = 0,
}: SlotSelectorProps) {
  const today = startOfDay(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const activeSlots = slots.filter((s) => s.isActive);

  // Recompute when calendar day changes so "Today"/"Tomorrow" stay correct
  const todayKey = format(today, "yyyy-MM-dd");
  const dateOptions = useMemo(() => {
    return [
      { date: today, label: "Today", value: format(today, "yyyy-MM-dd") },
      { date: addDays(today, 1), label: "Tomorrow", value: format(addDays(today, 1), "yyyy-MM-dd") },
    ];
  }, [todayKey]);

  const isQuickDate = dateOptions.some((o) => o.value === selectedDate);
  /** Parse YYYY-MM-DD as local date (avoid UTC midnight shifting day in some timezones) */
  const selectedDateObj = useMemo(() => {
    if (!selectedDate) return today;
    const quick = dateOptions.find((o) => o.value === selectedDate);
    if (quick) return quick.date;
    const [y, m, d] = selectedDate.split("-").map(Number);
    if (!y || !m || !d) return today;
    const local = new Date(y, m - 1, d);
    return isNaN(local.getTime()) ? today : local;
  }, [selectedDate, dateOptions, today]);

  /** Parse slot start hour (0–23) from strings like "9:00 AM - 11:00 AM" or "9 AM - 11 AM". Returns null if unparseable. */
  const parseSlotStartHour = (slotValue: string): number | null => {
    const parts = slotValue.split(/\s*[-–]\s*/).map((s) => s.trim());
    const startStr = parts[0] || "";
    // Match hour at start only: "9:00 AM" or "9 AM", not ":00 PM" in the middle
    const match = startStr.match(/^(\d{1,2})(?::\d{2})?\s*(AM|PM)/i);
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    if (match[2].toUpperCase() === "PM" && hour < 12) hour += 12;
    if (match[2].toUpperCase() === "AM" && hour === 12) hour = 0;
    return hour;
  };

  /** Slot already started (past) */
  const isSlotPast = (slotValue: string, slotDate: Date): boolean => {
    const slotDay = startOfDay(slotDate);
    if (slotDay > today) return false;
    if (slotDay < today) return true;
    const hour = parseSlotStartHour(slotValue);
    if (hour === null) return false;
    const now = new Date();
    const slotStart = new Date(now);
    slotStart.setHours(hour, 0, 0, 0);
    return !isBefore(now, slotStart);
  };

  /** Within buffer: not enough minutes before slot start (only for today) */
  const isSlotWithinBuffer = (slotValue: string, slotDate: Date): boolean => {
    if (bufferMinutes <= 0) return false;
    const slotDay = startOfDay(slotDate);
    if (slotDay.getTime() !== today.getTime()) return false;
    const hour = parseSlotStartHour(slotValue);
    if (hour === null) return false;
    const now = new Date();
    const slotStart = new Date(now);
    slotStart.setHours(hour, 0, 0, 0);
    if (now.getTime() >= slotStart.getTime()) return false;
    const minutesUntilStart = (slotStart.getTime() - now.getTime()) / 60000;
    return minutesUntilStart < bufferMinutes;
  };

  const isSlotFull = (slotValue: string): boolean => {
    if (!slotAvailability || !slotValue) return false;
    const entry = slotAvailability[slotValue];
    if (!entry) return false;
    if (entry.capacity <= 0) return false;
    return entry.booked >= entry.capacity;
  };

  /** True when selected date is today and no slot is available (all past or full) */
  const isTodayWithNoSlotsAvailable = useMemo(() => {
    const todayStr = format(today, "yyyy-MM-dd");
    if (selectedDate !== todayStr) return false;
    return activeSlots.every((slot) => {
      const past = isSlotPast(slot.value, selectedDateObj);
      const withinBuffer = isSlotWithinBuffer(slot.value, selectedDateObj);
      const full = isSlotFull(slot.value);
      return past || withinBuffer || full;
    });
  }, [selectedDate, selectedDateObj, today, activeSlots, slotAvailability]);

  if (!enableSlots || activeSlots.length === 0) {
    return (
      <LCard variant="outlined" padding="md">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm">
            No time slots configured. Shop will contact you for pickup timing.
          </span>
        </div>
      </LCard>
    );
  }

  return (
    <div className="space-y-4">
      <LCard variant="outlined" padding="md" className="space-y-4">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Calendar className="h-4 w-4 text-primary" />
          Select Pickup Date
        </div>
        <div className="flex flex-wrap gap-2">
          {dateOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDateChange(opt.value);
                setShowCalendar(false);
              }}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                selectedDate === opt.value && !showCalendar
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowCalendar(!showCalendar);
            }}
            className={cn(
              "px-4 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2",
              showCalendar || !isQuickDate
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            )}
          >
            <CalendarDays className="h-4 w-4" />
            Pick date
          </button>
        </div>
        {/* Native date input – always opens calendar on click (max compatibility) */}
        <label className="block text-sm font-medium text-foreground mb-1">Pick a date</label>
        <input
          type="date"
          value={selectedDate}
          min={format(today, "yyyy-MM-dd")}
          max={format(addDays(today, 30), "yyyy-MM-dd")}
          onChange={(e) => {
            const v = e.target.value;
            if (v) onDateChange(v);
          }}
          className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </LCard>

      <LCard variant="outlined" padding="md" className="space-y-4">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Clock className="h-4 w-4 text-primary" />
          Select Pickup Slot
        </div>
        {isTodayWithNoSlotsAvailable && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              No slots available for today. Book for tomorrow?
            </p>
            <button
              type="button"
              onClick={() => onDateChange(format(addDays(today, 1), "yyyy-MM-dd"))}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                "border border-primary bg-primary text-primary-foreground hover:opacity-90"
              )}
            >
              Book for tomorrow
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {activeSlots.map((slot) => {
            const past = isSlotPast(slot.value, selectedDateObj);
            const withinBuffer = isSlotWithinBuffer(slot.value, selectedDateObj);
            const full = isSlotFull(slot.value);
            const disabled = past || withinBuffer || full;
            return (
              <button
                key={slot.id}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onSlotChange(slot.value)}
                className={cn(
                  "px-3 py-2 rounded-lg border text-sm font-medium transition-colors min-w-0",
                  disabled && "opacity-50 cursor-not-allowed",
                  selectedSlot === slot.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : !disabled && "border-border bg-background hover:bg-muted"
                )}
              >
                <span className="truncate block">{slot.value}</span>
                {past && (
                  <span className="text-xs opacity-80 block truncate">(Past)</span>
                )}
                {!past && withinBuffer && (
                  <span className="text-xs opacity-80 block truncate">(Too late to book)</span>
                )}
                {!past && !withinBuffer && full && (
                  <span className="text-xs opacity-80 block truncate">(Full)</span>
                )}
              </button>
            );
          })}
        </div>
      </LCard>
    </div>
  );
}
