/**
 * Protected Route Component
 * 
 * Ensures user is authenticated before accessing routes
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: "admin" | "staff";
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
    const { user, shopId, role, loading, isNewUser } = useAuth();
    const location = useLocation();

    // Still loading auth state
    if (loading) {
        return null; // LLoadingOverlay is shown by AuthContext
    }

    // Not authenticated
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Staff users should use /staff/* routes with StaffProtectedRoute
    // Don't redirect them from here - they're handled separately
    // STRICT ROLE CHECKS - PREVENT CROSS-DASHBOARD ACCESS
    if (role === 'staff') {
        return <Navigate to="/staff" replace />;
    }
    if (role === 'plant_operator') {
        return <Navigate to="/plant/dashboard" replace />;
    }
    if (role === 'agent') {
        return <Navigate to="/agent/today" replace />;
    }

    // New user needs to complete signup (handled by LoginPage)
    if (isNewUser) {
        return <Navigate to="/login" replace />;
    }

    // User authenticated but no shop setup
    if (!shopId) {
        return <Navigate to="/login" replace />;
    }

    // If we are here, role must be 'admin' (or we fall through to requiredRole check)
    // Double check to be safe - if role is not admin, kick them out
    if (role !== 'admin' && role !== 'plant_operator' && role !== 'agent') {
        return <Navigate to="/login" replace />;
    }

    // Check role if required
    if (requiredRole && role !== requiredRole && role !== "admin") {
        // Staff trying to access admin-only route
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
