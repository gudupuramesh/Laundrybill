/**
 * Order Detail Panel
 * 
 * Used within master-detail layout on desktop
 * Displays full order details using the Green Card layout
 */

import { OrderDetailView } from "./OrderDetailView";

interface OrderDetailPanelProps {
    orderId: string;
    onClose?: () => void;
}

export function OrderDetailPanel({ orderId, onClose }: OrderDetailPanelProps) {
    return (
        <OrderDetailView
            orderId={orderId}
            onBack={onClose}
            isEmbedded={true}
        />
    );
}
