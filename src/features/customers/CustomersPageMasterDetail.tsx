/**
 * Customers Page — full-page list (design system "Customers").
 * Selecting a row navigates to the full-page detail (/customers/:id), matching
 * the DS isList → isDetail flow. No master-detail side panel.
 */

import { useNavigate, useLocation } from "react-router-dom";
import { CustomersList } from "./CustomersList";

export function CustomersPageMasterDetail() {
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith("/staff") ? "/staff/customers" : "/customers";

    return (
        <div style={{ height: "100%", minHeight: 0 }}>
            <CustomersList onSelect={(id) => navigate(`${basePath}/${id}`)} />
        </div>
    );
}
