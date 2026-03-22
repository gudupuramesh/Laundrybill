/**
 * Staff Protected Route
 * 
 * Redirects to login if not authenticated
 */

import { Navigate, useLocation } from "react-router-dom";
import { useStaffAuth } from "./StaffAuthContext";
import { LPageLoader } from "@/components/laundry";

interface StaffProtectedRouteProps {
    children: React.ReactNode;
}

export function StaffProtectedRoute({ children }: StaffProtectedRouteProps) {
    const { staff, loading } = useStaffAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <LPageLoader message="Loading..." />
            </div>
        );
    }

    if (!staff) {
        return <Navigate to="/staff/login" state={{ from: location }} replace />;
    }

    // Strict Check: Plant Operators and Agents cannot access Staff POS/CRM
    if (staff.memberType === 'plant') {
        return <Navigate to="/plant/dashboard" replace />;
    }

    if (staff.memberType === 'agent') {
        return <Navigate to="/agent/today" replace />;
    }

    return <>{children}</>;
}
