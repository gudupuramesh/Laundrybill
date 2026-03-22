/**
 * Public Ordering Page
 *
 * Customer-facing page to place orders without login.
 * URL: /order/:shopSlug
 *
 * Phase 2: Templates – 5 presets, hero with logo/name/address/phone/timing
 */

import { useState } from "react";
import { useParams } from "react-router-dom";
import { usePublicShop } from "./hooks/use-public-shop";
import { LCard, LPageLoader } from "@/components/laundry";
import { PublicOrderContent } from "./components/PublicOrderContent";
import { AlertCircle } from "lucide-react";
import { PublicOrderHero } from "./components/PublicOrderHero";
import { getPublicTemplate } from "./config/templates";

export function PublicOrderPage() {
  const { shopSlug } = useParams<{ shopSlug?: string }>();
  const { shop, loading, error, notAvailable } = usePublicShop(shopSlug);
  const [compactHeader, setCompactHeader] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartHasItems, setCartHasItems] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <LPageLoader variant="machine" message="Loading..." />
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

  const template = getPublicTemplate(shop.publicOrdering?.template);

  const primaryNumber = shop.phone || shop.whatsappNumber;
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
      <PublicOrderHero
        shop={shop}
        templateId={shop.publicOrdering?.template}
        compact={compactHeader}
      />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <PublicOrderContent
          shop={shop}
          onOrderingActive={setCompactHeader}
          onCheckoutOpenChange={setCheckoutOpen}
          onCartHasItemsChange={setCartHasItems}
        />
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
