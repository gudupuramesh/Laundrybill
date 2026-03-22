import { Navigate, Outlet } from "react-router-dom";
import { useDriverAuth } from "@/features/driver-app/DriverAuthContext";
import { LSpinner } from "@/components/laundry";

interface PlantProtectedRouteProps {
    children?: React.ReactNode;
}

export const PlantProtectedRoute = ({ children }: PlantProtectedRouteProps) => {
    const { agent, loading } = useDriverAuth();

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background">
                <LSpinner size="lg" />
            </div>
        );
    }

    // Check if user is authenticated and has plant role
    if (!agent) {
        return <Navigate to="/plant/login" replace />;
    }

    // Strict role check for plant access
    if (agent.role !== "plant_operator" && agent.role !== "admin") {
        // Admin also gets access for testing/oversight
        // If logged in as driver but trying to access plant, redirect to driver home
        return <Navigate to="/agent/today" replace />;
    }

    return children ? <>{children}</> : <Outlet />;
};
