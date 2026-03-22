/**
 * Super Admin – Shops map
 * Google Map with all registered shops that have location.
 * Filter by state via dropdown or by clicking on the map (reverse-geocode to state).
 */

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import { useAllShopsForMap } from "../hooks/use-all-shops-for-map";
import { reverseGeocode } from "@/lib/geocoding";
import { LCard, LButton, LSpinner, LSelect, useLToast } from "@/components/laundry";
import { MapPin, ExternalLink, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%", minHeight: 400 };
const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const INDIA_ZOOM = 5;

export function ShopsMapPage() {
  const navigate = useNavigate();
  const { addToast } = useLToast();
  const mapRef = useRef<google.maps.Map | null>(null);
  const { pins, loading, error, refresh } = useAllShopsForMap();
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clickGeocoding, setClickGeocoding] = useState(false);

  const stateOptions = useMemo(() => {
    const set = new Set<string>();
    pins.forEach((p) => p.state && set.add(p.state.trim()));
    return [
      { value: "all", label: "All states / regions" },
      ...Array.from(set).sort().map((s) => ({ value: s, label: s })),
    ];
  }, [pins]);

  const filteredPins = useMemo(() => {
    if (stateFilter === "all") return pins;
    return pins.filter((p) => (p.state || "").trim() === stateFilter);
  }, [pins, stateFilter]);

  const bounds = useMemo(() => {
    if (filteredPins.length === 0) return null;
    const b = new google.maps.LatLngBounds();
    filteredPins.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
    return b;
  }, [filteredPins]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const onMapClick = useCallback(
    async (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setClickGeocoding(true);
      try {
        const result = await reverseGeocode(lat, lng);
        if (!result) {
          addToast({ type: "info", title: "Could not detect region" });
          return;
        }
        const stateName = (result.state || "").trim();
        const countryName = (result.country || "").trim();
        if (stateName && stateOptions.some((o) => o.value === stateName)) {
          setStateFilter(stateName);
          addToast({ type: "success", title: `Showing shops in ${stateName}` });
        } else if (stateName || countryName) {
          const label = stateName || countryName;
          addToast({
            type: "info",
            title: `No shops in ${label}`,
            description: "Try another area or use the dropdown.",
          });
        } else {
          addToast({ type: "info", title: "Could not detect state/region" });
        }
      } catch {
        addToast({ type: "error", title: "Could not detect region" });
      } finally {
        setClickGeocoding(false);
      }
    },
    [stateOptions, addToast]
  );

  useEffect(() => {
    if (mapRef.current && bounds) {
      mapRef.current.fitBounds(bounds, { top: 48, right: 24, bottom: 24, left: 24 });
    }
  }, [bounds, stateFilter]);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-shops-view",
    googleMapsApiKey: apiKey || "",
  });

  if (loadError) {
    return (
      <div className="p-4 md:p-6">
        <LCard variant="outlined" className="p-6">
          <p className="text-sm text-destructive">Failed to load map. Please check your connection.</p>
        </LCard>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="p-4 md:p-6">
        <LCard variant="outlined" className="p-6">
          <p className="text-sm text-muted-foreground">Google Maps API key is required for the shops map.</p>
        </LCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 md:p-6 space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Shops map
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              All registered shops with saved location. Use the dropdown or click on the map to filter by state/region.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {stateFilter !== "all" && (
              <LButton
                variant="outline"
                size="sm"
                onClick={() => setStateFilter("all")}
              >
                Show all
              </LButton>
            )}
            <LButton variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
              Refresh
            </LButton>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <LSelect
            label="State / region"
            value={stateFilter}
            onChange={setStateFilter}
            options={stateOptions}
            className="w-full sm:w-[220px]"
          />
          <p className="text-sm text-muted-foreground">
            {filteredPins.length} shop{filteredPins.length !== 1 ? "s" : ""} with location
          </p>
          {clickGeocoding && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="animate-pulse">Detecting region…</span>
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MousePointer2 className="h-3.5 w-3.5" />
          Click on the map to filter by that state/region
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex-1 min-h-[400px] px-4 md:px-6 pb-4 md:pb-6">
        {loading ? (
          <LCard variant="outlined" className="flex items-center justify-center min-h-[400px]">
            <LSpinner className="h-8 w-8" />
          </LCard>
        ) : !isLoaded ? (
          <LCard variant="outlined" className="flex items-center justify-center min-h-[400px]">
            <LSpinner className="h-8 w-8" />
          </LCard>
        ) : (
          <div className={cn("rounded-lg overflow-hidden border border-border", "h-[min(70vh,600px)]")}>
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={INDIA_CENTER}
              zoom={INDIA_ZOOM}
              onLoad={onMapLoad}
              onUnmount={onMapUnmount}
              onClick={onMapClick}
              options={{
                zoomControl: true,
                zoomControlOptions: { position: google.maps.ControlPosition.TOP_LEFT },
                mapTypeControl: true,
                mapTypeControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
                streetViewControl: false,
                fullscreenControl: true,
              }}
            >
              {filteredPins.map((pin) => (
                <Marker
                  key={pin.id}
                  position={{ lat: pin.lat, lng: pin.lng }}
                  onClick={() => setSelectedId(pin.id)}
                  title={pin.name}
                />
              ))}
              {selectedId && (() => {
                const pin = filteredPins.find((p) => p.id === selectedId);
                if (!pin) return null;
                return (
                  <InfoWindow
                    position={{ lat: pin.lat, lng: pin.lng }}
                    onCloseClick={() => setSelectedId(null)}
                  >
                    <div className="min-w-[180px] text-sm p-1">
                      <p className="font-semibold text-foreground">{pin.name}</p>
                      {(pin.city || pin.state) && (
                        <p className="text-muted-foreground mt-0.5">
                          {[pin.city, pin.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                      {pin.address && (
                        <p className="text-muted-foreground mt-0.5 line-clamp-2">{pin.address}</p>
                      )}
                      <a
                        href={`/super-admin/shops/${pin.id}`}
                        className="inline-flex items-center justify-center gap-1.5 mt-2 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/super-admin/shops/${pin.id}`);
                        }}
                      >
                        View shop <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </InfoWindow>
                );
              })()}
            </GoogleMap>
          </div>
        )}
        {!loading && pins.length === 0 && (
          <p className="text-sm text-muted-foreground mt-3">
            No shops have a saved location yet. Locations are set when owners register or update shop settings.
          </p>
        )}
      </div>
    </div>
  );
}
