/**
 * Testimonials Section – Modern 2025 Design
 * Compact carousel/grid with subtle animations
 */

import { Quote, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicTestimonial } from "@/types/shop";
import type { PublicTemplateId } from "../config/templates";
import { getPublicTemplate } from "../config/templates";

interface TestimonialsSectionProps {
  testimonials: PublicTestimonial[];
  templateId?: PublicTemplateId | string;
  /** Optional: total orders completed by shop */
  totalOrdersCompleted?: number;
  compact?: boolean;
}

export function TestimonialsSection({
  testimonials,
  templateId,
  totalOrdersCompleted,
  compact,
}: TestimonialsSectionProps) {
  if (!testimonials?.length && totalOrdersCompleted == null) return null;

  const t = getPublicTemplate(templateId);

  return (
    <section
      className={cn(
        "w-full px-4",
        compact ? "py-4" : "py-6"
      )}
      data-testid="public-testimonials"
    >
      <div className="max-w-3xl mx-auto">
        {/* Header with trust badge */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-current text-amber-500" />
            <span className="text-sm font-semibold text-foreground">
              Trusted by customers
            </span>
          </div>
          {totalOrdersCompleted != null && totalOrdersCompleted > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Users className="h-3 w-3" />
              {totalOrdersCompleted.toLocaleString()}+ orders
            </div>
          )}
        </div>

        {/* Testimonial cards - horizontal scroll on mobile, grid on desktop */}
        <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible snap-x snap-mandatory">
          {testimonials.slice(0, 4).map((item, i) => (
            <div
              key={item.id || i}
              className={cn(
                "flex-shrink-0 w-[280px] sm:w-auto snap-start",
                "p-4 rounded-xl",
                "bg-card border border-border",
                "shadow-sm hover:shadow-md transition-shadow"
              )}
            >
              <Quote className={cn("h-4 w-4 mb-2 text-muted-foreground/60", t.iconClasses)} />
              <p className="text-sm leading-relaxed mb-3 line-clamp-3 text-muted-foreground">
                {item.quote}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-xs shrink-0">
                  {item.author.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="font-medium text-foreground">
                    {item.author}
                  </span>
                  {item.location && (
                    <span className="ml-1 text-muted-foreground">
                      • {item.location}
                    </span>
                  )}
                </div>
                {item.ordersCount != null && item.ordersCount > 0 && (
                  <span className="ml-auto text-xs text-green-600 dark:text-green-400">
                    {item.ordersCount}+ orders
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
