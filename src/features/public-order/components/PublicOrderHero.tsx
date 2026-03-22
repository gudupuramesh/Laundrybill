/**
 * Public Order Hero – Modern 2025 Design
 * Compact header with logo, name, and quick contact bar
 * Responsive and beautiful
 */

import { Store, MapPin, Phone, Mail, Clock, Facebook, Instagram, Twitter, Youtube, Linkedin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Shop } from "@/types/shop";
import type { PublicTemplateId } from "../config/templates";
import { getPublicTemplate } from "../config/templates";
import { getShopOpenStatus } from "../lib/shop-hours";

interface PublicOrderHeroProps {
  shop: Shop;
  templateId?: PublicTemplateId | string;
  compact?: boolean;
}

const SOCIAL_ICONS: Record<string, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
  linkedin: Linkedin,
};

function SocialLinks({ links, iconClasses }: { links: Record<string, string | undefined>; iconClasses: string }) {
  const entries = Object.entries(links).filter(([, url]) => url?.trim());
  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {entries.map(([key, url]) => {
        if (!url?.trim()) return null;
        const href = url.startsWith("http") ? url : key === "whatsapp" ? `https://wa.me/${url.replace(/\D/g, "")}` : `https://${url}`;
        const Icon = SOCIAL_ICONS[key];
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors",
              iconClasses
            )}
            aria-label={key}
          >
            {key === "whatsapp" ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            ) : Icon ? (
              <Icon className="h-4 w-4" />
            ) : null}
          </a>
        );
      })}
    </div>
  );
}

export function PublicOrderHero({ shop, templateId, compact }: PublicOrderHeroProps) {
  const t = getPublicTemplate(templateId);
  const openStatus = getShopOpenStatus(shop);

  const address = shop.location?.address
    ? [shop.location.address, shop.location.city].filter(Boolean).join(", ")
    : null;

  const socialLinks = shop.publicOrdering?.socialLinks;
  const hasSocialLinks = socialLinks && Object.values(socialLinks).some(Boolean);

  const contactNumber = shop.phone || shop.whatsappNumber;

  // Compact header (when ordering)
  if (compact) {
    return (
      <header className={cn("w-full shrink-0 border-b border-border/50 bg-card/95 backdrop-blur-sm", t.heroClasses)}>
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {shop.logo ? (
              <img src={shop.logo} alt={shop.name} className="w-8 h-8 object-cover rounded-lg flex-shrink-0" />
            ) : (
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10", t.logoClasses)}>
                <Store className={cn("h-4 w-4", t.iconClasses)} />
              </div>
            )}
            <h1 className={cn("text-base font-semibold truncate", t.titleClasses)}>{shop.name}</h1>
          </div>
          {contactNumber && (
            <a
              href={`tel:${contactNumber}`}
              className={cn("text-sm flex items-center gap-1.5 shrink-0 hover:opacity-80", t.infoClasses)}
              aria-label="Call shop"
            >
              <Phone className="h-4 w-4" />
              <span>{contactNumber}</span>
            </a>
          )}
        </div>
      </header>
    );
  }

  // Full header
  return (
    <header className={cn("w-full shrink-0", t.heroClasses)}>
      <div className="max-w-6xl mx-auto px-4 py-5 md:py-6">
        {/* Main content: Logo + Name on left, Contact on right */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo + Name */}
          <div className="flex items-center gap-4">
            {shop.logo ? (
              <img
                src={shop.logo}
                alt={shop.name}
                className={cn("w-14 h-14 md:w-16 md:h-16 object-cover rounded-xl shadow-sm", t.logoClasses)}
              />
            ) : (
              <div
                className={cn(
                  "w-14 h-14 md:w-16 md:h-16 flex items-center justify-center rounded-xl shadow-sm bg-primary/10",
                  t.logoClasses
                )}
              >
                <Store className={cn("h-7 w-7 md:h-8 md:w-8", t.iconClasses)} />
              </div>
            )}
            <div>
              <h1 className={cn("text-xl md:text-2xl font-bold", t.titleClasses)}>{shop.name}</h1>
              {/* Timing badge */}
              <div className={cn("flex items-center gap-1.5 mt-1 text-sm", t.infoClasses)}>
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{openStatus.timingText}</span>
                {!openStatus.isOpen && (
                  <span className="text-amber-600 dark:text-amber-400 text-xs">(Closed)</span>
                )}
              </div>
            </div>
          </div>

          {/* Contact info bar – phone first so it's visible in top right */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {contactNumber && (
              <a
                href={`tel:${contactNumber}`}
                className={cn("flex items-center gap-1.5 hover:underline", t.infoClasses)}
                aria-label="Call shop"
              >
                <Phone className="h-4 w-4 shrink-0" />
                <span>{contactNumber}</span>
              </a>
            )}
            {shop.email && (
              <a
                href={`mailto:${shop.email}`}
                className={cn("flex items-center gap-1.5 hover:underline", t.infoClasses)}
              >
                <Mail className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline truncate max-w-[150px]">{shop.email}</span>
              </a>
            )}
            {address && (
              <span className={cn("flex items-center gap-1.5", t.infoClasses)}>
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate max-w-[180px]" title={address}>{address}</span>
              </span>
            )}
            {hasSocialLinks && (
              <div className="border-l border-border/50 pl-3 ml-1">
                <SocialLinks links={socialLinks as Record<string, string | undefined>} iconClasses={t.iconClasses} />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
