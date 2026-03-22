/**
 * Feature Guard
 * 
 * Protects routes requiring specific plan features.
 * Redirects to dashboard if feature is not available.
 */

import { Navigate, Outlet } from "react-router-dom";
import { useShopLimits } from "@/hooks/use-shop-limits";
import type { PlanFeatures } from "@/types/plans";

interface FeatureGuardProps {
    feature: keyof PlanFeatures;
    redirect?: string;
    children?: React.ReactNode;
}

export function FeatureGuard({ feature, redirect = "/dashboard", children }: FeatureGuardProps) {
    const { hasFeature, plan, loading } = useShopLimits();

    // Do NOT redirect while loading the plan status
    if (loading) {
        return null; // or a loading spinner
    }

    if (!hasFeature(feature)) {
        console.warn(`FeatureGuard: Blocking access to ${feature}. Plan: ${plan?.id}, Redirecting to ${redirect}`);
        return <Navigate to={redirect} replace />;
    }

    return children ? <>{children}</> : <Outlet />;
}
