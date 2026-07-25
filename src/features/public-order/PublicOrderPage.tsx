/**
 * Public Ordering Page
 *
 * Customer-facing page to place orders without login.
 * URL: /order/:shopSlug
 *
 * Phase 2: Templates – 5 presets, hero with logo/name/address/phone/timing
 */

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usePublicShop } from "./hooks/use-public-shop";
import { useFranchiseBranches, type FranchiseBranch } from "./hooks/use-franchise-branches";
import { LCard } from "@/components/laundry";
import { PublicOrderContent } from "./components/PublicOrderContent";
import { FranchiseAreaGate } from "./components/FranchiseAreaGate";
import { AlertCircle, MapPin, Store } from "lucide-react";
import { PublicOrderHero } from "./components/PublicOrderHero";
import { getPublicTemplate } from "./config/templates";

export function PublicOrderPage() {
  const { shopSlug } = useParams<{ shopSlug?: string }>();
  const { shop, loading, error, notAvailable } = usePublicShop(shopSlug);
  const [compactHeader, setCompactHeader] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartHasItems, setCartHasItems] = useState(false);

  // ── Franchise area routing ────────────────────────────────────────────────
  // Multi-shop owners: the customer picks their area first; the chosen branch
  // then serves the whole session (menu, prices, slots, order destination).
  const { branches, loading: branchesLoading, gateNeeded } = useFranchiseBranches(shop);
  const [routed, setRouted] = useState<{ branch: FranchiseBranch; area: string } | null>(null);
  const ownerId = (shop as { ownerId?: string } | null)?.ownerId || "";
  const routeStorageKey = `lb_pub_area_${ownerId}`;

  // Restore a previous area choice for this franchise (per browser session).
  useEffect(() => {
    if (!gateNeeded || routed) return;
    try {
      const raw = sessionStorage.getItem(routeStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { shopId?: string; area?: string };
      const branch = branches.find((b) => b.shop.id === saved.shopId);
      if (branch && saved.area && branch.areas.includes(saved.area)) {
        setRouted({ branch, area: saved.area });
      }
    } catch {
      /* ignore bad storage */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateNeeded, branches]);

  const selectArea = (branch: FranchiseBranch, area: string) => {
    setRouted({ branch, area });
    try {
      sessionStorage.setItem(routeStorageKey, JSON.stringify({ shopId: branch.shop.id, area }));
    } catch {
      /* ignore */
    }
  };
  const changeArea = () => {
    setRouted(null);
    try {
      sessionStorage.removeItem(routeStorageKey);
    } catch {
      /* ignore */
    }
  };

  // Prettify the URL slug into a display name so the loading splash can greet by store
  // name before the shop doc has loaded (e.g. "dry-laun" → "Dry Laun", "ramesh" → "Ramesh").
  const storeName = (shopSlug || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-8 text-center">
        {/* Branded "Connecting to Store" splash — store badge with a soft pulsing halo.
            Pure-CSS (Tailwind animate-ping); no blur / framer-motion / injected keyframes. */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-20 animate-ping"
            style={{ background: "var(--c-primary, #1A4FD6)" }}
          />
          <span
            className="relative inline-flex items-center justify-center rounded-full"
            style={{ height: 72, width: 72, background: "var(--c-primary, #1A4FD6)", boxShadow: "0 12px 30px rgba(26,79,214,.35)" }}
          >
            <Store size={30} color="#fff" strokeWidth={2} />
          </span>
        </div>
        <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Connecting to store</p>
        <h1 className="mt-1.5 text-2xl font-bold text-foreground">{storeName || "Your store"}</h1>
        <p className="mt-3 max-w-xs text-sm text-muted-foreground">
          Securely fetching live rates and pickup availability…
        </p>
      </div>
    );
  }

  if (notAvailable || !shop) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <LCard variant="elevated" padding="lg" className="max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-destructive/10">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Online Ordering Not Available
          </h1>
          <p className="text-muted-foreground mb-6">
            {error
              ? error
              : "This shop hasn't enabled online ordering yet, or the link is invalid."}
          </p>
          {shop?.phone && (
            <p className="text-sm text-muted-foreground">
              Please call:{" "}
              <a
                href={`tel:${shop.phone}`}
                className="text-primary font-medium hover:underline"
              >
                {shop.phone}
              </a>
            </p>
          )}
        </LCard>
      </div>
    );
  }

  // The branch actually being booked — the routed one for franchises, else the
  // slug's shop. Hero, WhatsApp, menu, slots and order creation all follow it.
  const showGate = gateNeeded && !routed && !branchesLoading;
  const activeShop = routed?.branch.shop ?? shop;

  const template = getPublicTemplate(activeShop.publicOrdering?.template);

  const primaryNumber = activeShop.phone || activeShop.whatsappNumber;
  const whatsappDigits = primaryNumber?.replace(/\D/g, "").replace(/^91/, "") || "";
  const whatsappUrl = whatsappDigits
    ? `https://wa.me/91${whatsappDigits.length === 10 ? whatsappDigits : whatsappDigits}`
    : "";

  return (
    <div
      className={[
        "h-screen flex flex-col overflow-hidden",
        template.contentClasses,
      ].join(" ")}
      data-testid="public-order-page"
    >
      {/* Brand identity ALWAYS follows the link the customer opened (one
          franchise brand); only the functional bits below (menu, prices,
          slots, offers, order destination) follow the serving branch. */}
      <PublicOrderHero
        shop={shop}
        templateId={shop.publicOrdering?.template}
        compact={compactHeader}
      />

      {/* Franchise: routed-area pill — lets the customer change their area */}
      {gateNeeded && routed && (
        <button
          type="button"
          onClick={changeArea}
          className="mx-auto -mt-1 mb-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm"
        >
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Serving {routed.area}
          {routed.branch.shop.id !== shop.id && (
            <span className="text-muted-foreground">— {routed.branch.shop.name}</span>
          )}
          <span className="text-primary">· Change</span>
        </button>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {branchesLoading ? (
          // Franchise branch lookup in flight — brief; avoids flashing the wrong menu.
          <div className="flex flex-1 items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : showGate ? (
          <FranchiseAreaGate branches={branches} onSelect={selectArea} />
        ) : (
          <PublicOrderContent
            key={activeShop.id}
            shop={activeShop}
            brandShop={shop}
            initialArea={routed?.area}
            onOrderingActive={setCompactHeader}
            onCheckoutOpenChange={setCheckoutOpen}
            onCartHasItemsChange={setCartHasItems}
          />
        )}
      </div>

      {/* Floating WhatsApp – hidden when cart has items or checkout is open so it doesn’t overlap CTA */}
      {whatsappUrl && !checkoutOpen && !cartHasItems && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-4 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg hover:bg-[#20bd5a] active:scale-95 transition-all"
          aria-label="Order via WhatsApp"
        >
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      )}
    </div>
  );
}
