/**
 * Public Location Map – Leaflet/OpenStreetMap (no API key)
 * For customer address selection on public ordering page
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LButton } from "@/components/laundry";
import { Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER: [number, number] = [17.385, 78.4867]; // Hyderabad
const DEFAULT_ZOOM = 14;

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    return data?.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

function MapClickHandler({
  onLocationChange,
}: {
  onLocationChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onLocationChange(lat, lng);
    },
  });
  return null;
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export interface PublicLocationMapProps {
  lat?: number;
  lng?: number;
  onLocationChange: (lat: number, lng: number) => void;
  onAddressChange?: (address: string) => void;
  /** When true, tries to get current location once when the component mounts (e.g. when checkout opens). */
  autoGetLocationOnMount?: boolean;
  className?: string;
}

export function PublicLocationMap({
  lat,
  lng,
  onLocationChange,
  onAddressChange,
  autoGetLocationOnMount = false,
  className,
}: PublicLocationMapProps) {
  const [position, setPosition] = useState<[number, number] | null>(
    lat != null && lng != null ? [lat, lng] : null
  );
  const [gettingLocation, setGettingLocation] = useState(false);
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoGetTriedRef = useRef(false);

  useEffect(() => {
    if (lat != null && lng != null) {
      setPosition([lat, lng]);
    }
  }, [lat, lng]);

  // Auto-get current location once when checkout opens (if no position yet)
  useEffect(() => {
    if (!autoGetLocationOnMount || autoGetTriedRef.current) return;
    if (lat != null && lng != null) return;
    if (!navigator.geolocation) return;
    autoGetTriedRef.current = true;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        setPosition([newLat, newLng]);
        onLocationChange(newLat, newLng);
        if (onAddressChange) {
          reverseGeocode(newLat, newLng).then((addr) => onAddressChange(addr));
        }
        setGettingLocation(false);
      },
      () => setGettingLocation(false),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [autoGetLocationOnMount, lat, lng, onLocationChange, onAddressChange]);

  useEffect(() => () => {
    geocodeTimeoutRef.current && clearTimeout(geocodeTimeoutRef.current);
  }, []);

  const handleLocationChange = useCallback(
    async (newLat: number, newLng: number) => {
      setPosition([newLat, newLng]);
      onLocationChange(newLat, newLng);

      if (onAddressChange) {
        geocodeTimeoutRef.current && clearTimeout(geocodeTimeoutRef.current);
        geocodeTimeoutRef.current = setTimeout(async () => {
          const addr = await reverseGeocode(newLat, newLng);
          onAddressChange(addr);
        }, 300);
      }
    },
    [onLocationChange, onAddressChange]
  );

  const handleGetLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported");
      return;
    }
    setGettingLocation(true);
    
    try {
      // Request permission and get position with Promise wrapper for better handling
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      });
      
      const newLat = position.coords.latitude;
      const newLng = position.coords.longitude;
      
      // Update position state first
      setPosition([newLat, newLng]);
      
      // Then notify parent
      onLocationChange(newLat, newLng);
      
      // Then do reverse geocode
      if (onAddressChange) {
        const addr = await reverseGeocode(newLat, newLng);
        onAddressChange(addr);
      }
    } catch (err) {
      console.error("Geolocation error:", err);
    } finally {
      setGettingLocation(false);
    }
  }, [onLocationChange, onAddressChange]);

  const displayPosition = position ?? (lat != null && lng != null ? [lat, lng] : null);

  return (
    <div className={cn("space-y-2", className)}>
      <LButton
        variant="outline"
        size="sm"
        onClick={handleGetLocation}
        loading={gettingLocation}
        leftIcon={<Navigation className="h-4 w-4" />}
        className="w-full"
      >
        Use My Current Location
      </LButton>
      <div className="rounded-lg overflow-hidden border border-border h-[200px] md:h-[260px]">
        <MapContainer
          center={displayPosition ?? DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          className="h-full w-full"
          scrollWheelZoom
        >
          {displayPosition && <ChangeView center={displayPosition} />}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onLocationChange={(a, b) => handleLocationChange(a, b)} />
          {displayPosition && (
            <Marker
              position={displayPosition}
              draggable
              icon={defaultIcon}
              eventHandlers={{
                dragend: (e) => {
                  const { lat: newLat, lng: newLng } = e.target.getLatLng();
                  handleLocationChange(newLat, newLng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag pin to adjust your exact location
      </p>
    </div>
  );
}
