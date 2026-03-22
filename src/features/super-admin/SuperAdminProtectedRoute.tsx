/**
 * Super Admin Protected Route
 * 
 * Guards routes that require super admin authentication
 */

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSuperAdmin } from "./SuperAdminAuthContext";
import { LPageLoader } from "@/components/laundry";

interface SuperAdminProtectedRouteProps {
    children: React.ReactNode;
    requiredPermission?: keyof SuperAdminPermissions;
}

type SuperAdminPermissions = {
    manageShops: boolean;
    manageSubscriptions: boolean;
    managePayments: boolean;
    manageAds: boolean;
    viewAnalytics: boolean;
    manageAdmins: boolean;
};

export function SuperAdminProtectedRoute({
    children,
    requiredPermission,
}: SuperAdminProtectedRouteProps) {
    const { superAdmin, loading, isSuperAdmin } = useSuperAdmin();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!loading && !isSuperAdmin) {
            // Redirect to login with return path
            navigate("/super-admin/login", {
                state: { from: location.pathname },
                replace: true,
            });
        }
    }, [loading, isSuperAdmin, navigate, location.pathname]);

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <LPageLoader message="Authenticating..." />
            </div>
        );
    }

    // Not authenticated
    if (!isSuperAdmin) {
        return null;
    }

    // Check permission if required
    if (requiredPermission && superAdmin) {
        const hasPermission = superAdmin.permissions[requiredPermission];
        if (!hasPermission) {
            return (
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-destructive mb-2">
                            Access Denied
                        </h1>
                        <p className="text-muted-foreground">
                            You don't have permission to access this page.
                        </p>
                    </div>
                </div>
            );
        }
    }

    return <>{children}</>;
}
