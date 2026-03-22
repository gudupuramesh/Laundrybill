/**
 * LLocationMap
 *
 * Interactive Google Map for selecting shop location (shop registration only).
 * - "Get Location" fetches current position and shows on map
 * - Draggable marker: move to fine-tune; address updates via reverse geocode
 * - Shows nearest places and businesses accurately
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useJsApiLoader, GoogleMap, Marker } from "@react-google-maps/api";
import { LButton } from "./LButton";
import { Navigation } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER = { lat: 17.385, lng: 78.4867 }; // Hyderabad
const DEFAULT_ZOOM = 14;
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%", minHeight: 200 };

export interface LocationMapProps {
    latitude?: number;
    longitude?: number;
    onLocationChange: (lat: number, lng: number) => void;
    onGetLocation?: () => void;
    gettingLocation?: boolean;
    className?: string;
}

export function LLocationMap({
    latitude,
    longitude,
    onLocationChange,
    onGetLocation,
    gettingLocation = false,
    className,
}: LocationMapProps) {
    const { t } = useTranslation();
    const mapRef = useRef<google.maps.Map | null>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
        latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null
    );

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const { isLoaded, loadError } = useJsApiLoader({
        id: "google-map-shop-location",
        googleMapsApiKey: apiKey || "",
    });

    // Sync position when parent updates (e.g. from Get Location)
    useEffect(() => {
        if (latitude != null && longitude != null) {
            setPosition({ lat: latitude, lng: longitude });
        }
    }, [latitude, longitude]);

    const center = useMemo(() => {
        if (position) return position;
        if (latitude != null && longitude != null) return { lat: latitude, lng: longitude };
        return DEFAULT_CENTER;
    }, [position, latitude, longitude]);

    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
    }, []);

    const onMapUnmount = useCallback(() => {
        mapRef.current = null;
    }, []);

    const onMapClick = useCallback(
        (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            setPosition({ lat, lng });
            onLocationChange(lat, lng);
        },
        [onLocationChange]
    );

    const onMarkerDragEnd = useCallback(() => {
        const marker = markerRef.current;
        if (!marker) return;
        const pos = marker.getPosition();
        if (!pos) return;
        const lat = pos.lat();
        const lng = pos.lng();
        setPosition({ lat, lng });
        onLocationChange(lat, lng);
    }, [onLocationChange]);

    // Pan map to new center when position changes (e.g. from Get Location)
    useEffect(() => {
        if (mapRef.current && position) {
            mapRef.current.panTo(position);
        }
    }, [position?.lat, position?.lng]);

    if (loadError) {
        return (
            <div
                className={cn(
                    "rounded-lg border border-destructive/30 bg-destructive/5 p-4",
                    className
                )}
            >
                <p className="text-sm text-destructive">
                    {t("shop.mapLoadError", "Failed to load map. Please check your connection.")}
                </p>
            </div>
        );
    }

    if (!apiKey) {
        return (
            <div
                className={cn(
                    "rounded-lg border border-border bg-muted/30 p-4",
                    className
                )}
            >
                <p className="text-sm text-muted-foreground">
                    {t("shop.mapApiKeyRequired", "Google Maps API key is required for the location map.")}
                </p>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div
                className={cn(
                    "rounded-lg border border-border bg-muted/30 flex items-center justify-center h-[200px] md:h-[280px]",
                    className
                )}
            >
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className={cn("relative rounded-lg overflow-hidden border border-border", className)}>
            <div className="absolute bottom-2 right-2 z-[1000]">
                <LButton
                    variant="primary"
                    size="sm"
                    onClick={onGetLocation}
                    loading={gettingLocation}
                    leftIcon={<Navigation className="h-4 w-4" />}
                    className="shadow-lg"
                >
                    {t("shop.getLocation")}
                </LButton>
            </div>
            <div className="w-full h-[200px] md:h-[280px]">
                <GoogleMap
                    mapContainerStyle={MAP_CONTAINER_STYLE}
                    center={center}
                    zoom={DEFAULT_ZOOM}
                    onClick={onMapClick}
                    onLoad={onMapLoad}
                    onUnmount={onMapUnmount}
                    options={{
                        zoomControl: true,
                        zoomControlOptions: { position: google.maps.ControlPosition.TOP_LEFT },
                        mapTypeControl: true,
                        mapTypeControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
                        streetViewControl: false,
                        fullscreenControl: false,
                    }}
                >
                    {(position || (latitude != null && longitude != null)) && (
                        <Marker
                            position={position ?? { lat: latitude!, lng: longitude! }}
                            draggable
                            onDragEnd={onMarkerDragEnd}
                            onLoad={(m) => { markerRef.current = m; }}
                            onUnmount={() => { markerRef.current = null; }}
                        />
                    )}
                </GoogleMap>
            </div>
            <p className="text-xs text-muted-foreground px-3 py-2 bg-muted/30 border-t border-border">
                {t("shop.mapHint", "Tap 'Get Location' or drag the marker to set your shop address.")}
            </p>
        </div>
    );
}
