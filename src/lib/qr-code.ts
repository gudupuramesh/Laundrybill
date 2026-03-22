// Utility to generate tracking URL for QR codes
export function getTrackingUrl(trackingId: string): string {
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    return `${baseUrl}/track/${trackingId}`;
}

// Generate QR code URL using external API
export function getQRCodeUrl(trackingId: string, size: number = 200): string {
    const trackingUrl = getTrackingUrl(trackingId);
    const encodedUrl = encodeURIComponent(trackingUrl);
    // Using QR Server API (free, no API key needed)
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedUrl}`;
}

// For receipts: Generate QR code with tracking info
export function getReceiptQRUrl(order: { trackingId: string }): string {
    return getQRCodeUrl(order.trackingId, 150);
}
