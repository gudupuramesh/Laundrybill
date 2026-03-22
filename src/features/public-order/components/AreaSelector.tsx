/**
 * Area Selector – Modern 2025 Design
 * Compact, centered, with subtle glassmorphism and animation
 */

import { LSelect } from "@/components/laundry";
import { MapPin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AreaSelectorProps {
  areas: { id: string; value: string; isActive: boolean }[];
  value: string;
  onChange: (area: string) => void;
  disabled?: boolean;
  className?: string;
  /** Sidebar variant: left-aligned, compact for right column */
  variant?: "default" | "sidebar";
}

export function AreaSelector({
  areas,
  value,
  onChange,
  disabled,
  className,
  variant = "default",
}: AreaSelectorProps) {
  const activeAreas = areas.filter((a) => a.isActive);
  const options = activeAreas.map((a) => ({
    value: a.value,
    label: a.value,
  }));
  const isSidebar = variant === "sidebar";

  return (
    <div
      className={cn(
        "w-full flex flex-col",
        isSidebar ? "items-stretch text-left" : "items-center text-center",
        className
      )}
    >
      {/* Heading */}
      <div className={cn("flex gap-2 mb-3", isSidebar ? "items-center" : "items-center justify-center")}>
        <div className="p-2 rounded-full bg-primary/10 shrink-0">
          <MapPin className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Where should we pick up?
        </h2>
      </div>

      {/* Select */}
      <div className={cn("w-full", !isSidebar && "max-w-xs")}>
        <LSelect
          value={value}
          onChange={onChange}
          options={options}
          placeholder="Select your area"
          disabled={disabled}
        />
      </div>

      {/* Subtle hint */}
      {activeAreas.length > 0 && !value && (
        <p className={cn("mt-2 text-xs text-muted-foreground flex gap-1", isSidebar ? "items-center" : "items-center justify-center")}>
          <Sparkles className="h-3 w-3 shrink-0" />
          We currently serve {activeAreas.length} area{activeAreas.length > 1 ? "s" : ""}
        </p>
      )}

      {/* Confirmation when selected */}
      {value && (
        <p className={cn("mt-2 text-xs text-green-600 dark:text-green-400 flex gap-1", isSidebar ? "items-center" : "items-center justify-center")}>
          <MapPin className="h-3 w-3 shrink-0" />
          Great! We serve {value}
        </p>
      )}
    </div>
  );
}
