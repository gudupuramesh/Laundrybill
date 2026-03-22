/**
 * Read-only Leaflet/OSM map for Super Admin – delivery & pickup order pins.
 */

import { useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { OrderMapPin } from "../hooks/use-shop-orders-for-map";
import { DELIVERY_TYPE_LABELS } from "@/types/order";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER: [number, number] = [17.385, 78.4867];
const DEFAULT_ZOOM = 11;
const MAX_ZOOM = 16;

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function FitBounds({ pins }: { pins: OrderMapPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].deliveryLat, pins[0].deliveryLng], DEFAULT_ZOOM);
      return;
    }
    const bounds = L.latLngBounds(
      pins.map((p) => [p.deliveryLat, p.deliveryLng] as [number, number])
    );
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: MAX_ZOOM });
  }, [map, pins]);
  return null;
}

export interface DeliveryMapProps {
  pins: OrderMapPin[];
  className?: string;
}

export function DeliveryMap({ pins, className }: DeliveryMapProps) {
  const center = useMemo(() => {
    if (pins.length === 0) return DEFAULT_CENTER;
    const lat =
      pins.reduce((s, p) => s + p.deliveryLat, 0) / pins.length;
    const lng =
      pins.reduce((s, p) => s + p.deliveryLng, 0) / pins.length;
    return [lat, lng] as [number, number];
  }, [pins]);

  return (
    <div className={cn("rounded-lg overflow-hidden border border-border bg-muted/30", className)}>
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full min-h-[280px]"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.length > 0 && <FitBounds pins={pins} />}
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.deliveryLat, pin.deliveryLng]}
            icon={defaultIcon}
          >
            <Popup>
              <div className="text-sm min-w-[180px]">
                <p className="font-semibold text-foreground">{pin.orderNumber}</p>
                <p className="text-muted-foreground mt-0.5">
                  {DELIVERY_TYPE_LABELS[pin.deliveryType]}
                </p>
                <p className="mt-1.5 font-medium text-foreground">
                  Services:{" "}
                  <span className="font-normal text-muted-foreground">
                    {pin.categoryNames.length > 0
                      ? pin.categoryNames.join(", ")
                      : "—"}
                  </span>
                </p>
                {pin.deliveryAddress && (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    {pin.deliveryAddress}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
