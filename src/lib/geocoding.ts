/**
 * Geocoding Utility
 *
 * Reverse geocode lat/lng to address.
 * Uses Google Geocoding API when available, falls back to OpenStreetMap Nominatim.
 */

export interface GeocodingResult {
    address: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    formattedAddress: string;
}

/** Reverse geocode using OpenStreetMap Nominatim (free, no API key) */
async function reverseGeocodeNominatim(
    lat: number,
    lng: number
): Promise<GeocodingResult | null> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        if (!data?.address) return null;

        const a = data.address;
        const address =
            [a.road, a.house_number, a.suburb, a.neighbourhood, a.village].filter(Boolean).join(", ") || a.display_name?.split(",")?.[0] || "";
        const city = a.city || a.town || a.village || a.county || "";
        const state = a.state || "";
        const pincode = a.postcode || "";

        return {
            address: address || data.display_name,
            city,
            state,
            pincode,
            country: a.country || "",
            formattedAddress: data.display_name || "",
        };
    } catch (e) {
        console.warn("Nominatim geocoding failed:", e);
        return null;
    }
}

export async function reverseGeocode(
    lat: number,
    lng: number
): Promise<GeocodingResult | null> {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        return reverseGeocodeNominatim(lat, lng);
    }

    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
        );

        const data = await response.json();

        if (data.status !== "OK" || !data.results || data.results.length === 0) {
            console.error("Geocoding failed:", data.status);
            return null;
        }

        // Parse address components
        const result = data.results[0];
        const components = result.address_components;

        let address = "";
        let city = "";
        let state = "";
        let pincode = "";
        let country = "";

        // Extract components
        for (const component of components) {
            const types = component.types;

            if (types.includes("street_number") || types.includes("route")) {
                address += address ? " " + component.long_name : component.long_name;
            } else if (types.includes("sublocality_level_1") || types.includes("sublocality")) {
                address += address ? ", " + component.long_name : component.long_name;
            } else if (types.includes("locality")) {
                city = component.long_name;
            } else if (types.includes("administrative_area_level_1")) {
                state = component.long_name;
            } else if (types.includes("postal_code")) {
                pincode = component.long_name;
            } else if (types.includes("country")) {
                country = component.long_name;
            }
        }

        // If no street address, use sublocality or neighborhood
        if (!address) {
            for (const component of components) {
                if (component.types.includes("neighborhood") ||
                    component.types.includes("sublocality_level_2")) {
                    address = component.long_name;
                    break;
                }
            }
        }

        return {
            address,
            city,
            state,
            pincode,
            country,
            formattedAddress: result.formatted_address,
        };
    } catch (error) {
        console.error("Reverse geocoding error:", error);
        return reverseGeocodeNominatim(lat, lng);
    }
}

/** Forward geocode: address string → lat, lng. Uses Nominatim (no API key). */
export async function forwardGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
    const trimmed = address.trim();
    if (!trimmed) return null;
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1`,
            { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        const first = Array.isArray(data) ? data[0] : null;
        if (!first?.lat || !first?.lon) return null;
        return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
    } catch (e) {
        console.warn("Forward geocoding failed:", e);
        return null;
    }
}
