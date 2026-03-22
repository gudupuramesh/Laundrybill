/**
 * Process Steps – Modern 2025 Design
 * Horizontal on desktop, vertical timeline on mobile
 * Compact with subtle animations
 */

import { Package, Truck, Sparkles, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicTemplateId } from "../config/templates";
import { getPublicTemplate } from "../config/templates";

interface ProcessStepsSectionProps {
  templateId?: PublicTemplateId | string;
  compact?: boolean;
}

const STEPS = [
  {
    icon: Package,
    title: "Order",
    shortDesc: "Place your order online",
  },
  {
    icon: Truck,
    title: "Pickup",
    shortDesc: "We collect from your door",
  },
  {
    icon: Sparkles,
    title: "Clean",
    shortDesc: "Expert care for your clothes",
  },
  {
    icon: CheckCircle,
    title: "Deliver",
    shortDesc: "Fresh laundry returned",
  },
];

export function ProcessStepsSection({ templateId, compact }: ProcessStepsSectionProps) {
  const t = getPublicTemplate(templateId);

  return (
    <section
      className={cn(
        "w-full px-4",
        compact ? "py-4" : "py-6 md:py-8"
      )}
      data-testid="public-process-steps"
    >
      <div className="max-w-2xl mx-auto">
        {/* Desktop: Horizontal flow with connecting line */}
        <div className="hidden sm:block">
          <div className="flex items-center justify-between relative">
            {/* Connecting line */}
            <div className="absolute top-6 left-8 right-8 h-0.5 bg-border" />
            <div className="absolute top-6 left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-80" />
            
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className="flex flex-col items-center relative z-10"
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center mb-2",
                      "bg-card border-2 border-border shadow-sm",
                      "transition-transform hover:scale-105 hover:shadow-md",
                      "ring-2 ring-primary/10"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", t.iconClasses)} />
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {step.title}
                  </span>
                  <span className="text-xs text-center max-w-[100px] text-muted-foreground">
                    {step.shortDesc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: Compact horizontal scroll or grid */}
        <div className="sm:hidden">
          <div className="flex justify-between gap-2">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className="flex flex-col items-center flex-1 min-w-0"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center mb-1.5",
                      "bg-primary/10 border border-primary/20"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", t.iconClasses)} />
                  </div>
                  <span className="text-xs font-medium text-center text-foreground">
                    {step.title}
                  </span>
                  <span className="text-[10px] text-center text-muted-foreground line-clamp-2 mt-0.5 px-0.5">
                    {step.shortDesc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
