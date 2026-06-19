/**
 * Orders Page — full-page list (design system "Order Management").
 * Selecting a row navigates to the full-page detail (/orders/:id), matching
 * the DS isList → isDetail flow. No master-detail side panel.
 */

import { useNavigate, useLocation } from "react-router-dom";
import { OrdersList } from "./OrdersList";

export function OrdersPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith("/staff") ? "/staff/orders" : "/orders";

    return (
        <div style={{ height: "100%", minHeight: 0 }}>
            <OrdersList onSelect={(id) => navigate(`${basePath}/${id}`)} />
        </div>
    );
}
