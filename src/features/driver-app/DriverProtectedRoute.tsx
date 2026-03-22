/**
 * Driver Protected Route
 * 
 * Protects routes that require driver authentication
 * Redirects to /agent/login if not authenticated
 */

import { Navigate, useLocation } from "react-router-dom";
import { useDriverAuth } from "./DriverAuthContext";
import { LSpinner } from "@/components/laundry";

interface DriverProtectedRouteProps {
    children: React.ReactNode;
}

export function DriverProtectedRoute({ children }: DriverProtectedRouteProps) {
    const { agent, loading } = useDriverAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <LSpinner size="lg" />
            </div>
        );
    }

    if (!agent) {
        // Redirect to login, but save the intended destination
        return <Navigate to="/agent/login" state={{ from: location }} replace />;
    }

    // Strict role check: Plant Operators should stay in Plant Portal
    if (agent.role === 'plant_operator') {
        return <Navigate to="/plant/dashboard" replace />;
    }

    return <>{children}</>;
}
