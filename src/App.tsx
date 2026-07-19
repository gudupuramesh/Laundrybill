import { lazy, Suspense, type ComponentType } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, ProtectedRoute, OwnerRoute } from "@/features/auth";
import { ReceiptPrintProvider } from "@/context/ReceiptPrintContext";
import { LToastProvider, LSpinner } from "@/components/laundry";
import { AppManifestUpdater } from "@/components/AppManifestUpdater";
import { FeatureGuard } from "@/components/FeatureGuard";
import "./index.css";

/**
 * Route-level code splitting. Every page/layout/role-provider below is lazy, so a
 * visitor downloads only the chunk for the route they open. Public pages
 * (booking / tracking / receipt) no longer pull in the owner dashboard, super-admin,
 * or the staff/agent/plant apps — the first-load bundle drops from one ~3 MB blob to
 * a small shell. Firebase + vendor remain shared chunks. Only the router primitives,
 * top-level providers, and the auth gate stay eager (needed on first paint).
 */
const named = <T,>(p: Promise<T>, key: keyof T) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  p.then((m) => ({ default: m[key] as unknown as ComponentType<any> }));

// Public + auth
const LoginPage = lazy(() => named(import("@/features/auth"), "LoginPage"));
const PublicOrderPage = lazy(() => named(import("@/features/public-order"), "PublicOrderPage"));
const PublicTrackingPage = lazy(() => named(import("@/features/tracking"), "PublicTrackingPage"));
const PublicReceiptPage = lazy(() => named(import("@/features/tracking/PublicReceiptPage"), "PublicReceiptPage"));
const TeamLoginPage = lazy(() => named(import("@/features/team-auth"), "TeamLoginPage"));
const TeamSignupPage = lazy(() => named(import("@/features/team-auth"), "TeamSignupPage"));

// Owner app
const AppLayout = lazy(() => named(import("@/layouts/AppLayout"), "AppLayout"));
const DashboardPage = lazy(() => named(import("@/features/dashboard"), "DashboardPage"));
const AdminScanPage = lazy(() => named(import("@/features/dashboard/AdminScanPage"), "AdminScanPage"));
const NewOrderPage = lazy(() => named(import("@/features/pos"), "NewOrderPage"));
const OrdersPage = lazy(() => named(import("@/features/orders"), "OrdersPage"));
const OrderDetailPage = lazy(() => named(import("@/features/orders"), "OrderDetailPage"));
const CustomersPageMasterDetail = lazy(() => named(import("@/features/customers"), "CustomersPageMasterDetail"));
const CustomerDetailPage = lazy(() => named(import("@/features/customers"), "CustomerDetailPage"));
const InventoryPage = lazy(() => named(import("@/features/inventory"), "InventoryPage"));
const StaffPageMasterDetail = lazy(() => named(import("@/features/staff"), "StaffPageMasterDetail"));
const AttendancePageMasterDetail = lazy(() => named(import("@/features/staff"), "AttendancePageMasterDetail"));
const PayrollPageMasterDetail = lazy(() => named(import("@/features/staff"), "PayrollPageMasterDetail"));
const ExpensesPageMasterDetail = lazy(() => named(import("@/features/finance"), "ExpensesPageMasterDetail"));
const ReportsPage = lazy(() => named(import("@/features/finance"), "ReportsPage"));
const AppsPage = lazy(() => named(import("@/features/apps/AppsPage"), "AppsPage"));
const HelpPage = lazy(() => named(import("@/features/help"), "HelpPage"));
const SettingsPageMasterDetail = lazy(() => named(import("@/features/settings"), "SettingsPageMasterDetail"));
const ShopSettingsPage = lazy(() => named(import("@/features/settings"), "ShopSettingsPage"));
const DeliverySettingsPage = lazy(() => named(import("@/features/settings"), "DeliverySettingsPage"));
const SubscriptionPage = lazy(() => named(import("@/features/settings/pages/SubscriptionPage"), "SubscriptionPage"));
const PaymentHistoryPage = lazy(() => named(import("@/features/settings/pages/PaymentHistoryPage"), "PaymentHistoryPage"));
const PublicPageSettingsPage = lazy(() => named(import("@/features/settings/pages/PublicPageSettingsPage"), "PublicPageSettingsPage"));
const OffersPage = lazy(() => named(import("@/features/settings/pages/OffersPage"), "OffersPage"));

// Super Admin
const SuperAdminAuthProvider = lazy(() => named(import("@/features/super-admin"), "SuperAdminAuthProvider"));
const SuperAdminProtectedRoute = lazy(() => named(import("@/features/super-admin"), "SuperAdminProtectedRoute"));
const SuperAdminLayout = lazy(() => named(import("@/features/super-admin"), "SuperAdminLayout"));
const SuperAdminLoginPage = lazy(() => named(import("@/features/super-admin"), "SuperAdminLoginPage"));
const SuperAdminDashboard = lazy(() => named(import("@/features/super-admin"), "SuperAdminDashboard"));
const SuperAdminShopsPage = lazy(() => named(import("@/features/super-admin"), "ShopsPage"));
const ShopDetailsPage = lazy(() => named(import("@/features/super-admin"), "ShopDetailsPage"));
const ShopsMapPage = lazy(() => named(import("@/features/super-admin"), "ShopsMapPage"));
const SubscriptionsPage = lazy(() => named(import("@/features/super-admin"), "SubscriptionsPage"));
const PlansPage = lazy(() => named(import("@/features/super-admin"), "PlansPage"));
const PaymentsPage = lazy(() => named(import("@/features/super-admin"), "PaymentsPage"));
const PlatformSettingsPage = lazy(() => named(import("@/features/super-admin"), "PlatformSettingsPage"));
const SupportHelpPage = lazy(() => named(import("@/features/super-admin"), "SupportHelpPage"));
const FeedbackPage = lazy(() => named(import("@/features/super-admin"), "FeedbackPage"));
const ItemsListPage = lazy(() => named(import("@/features/super-admin"), "ItemsListPage"));
const NotificationsPage = lazy(() => named(import("@/features/super-admin"), "NotificationsPage"));
const SuperAdminScanPage = lazy(() => named(import("@/features/super-admin/pages/SuperAdminScanPage"), "SuperAdminScanPage"));

// Staff app
const StaffAuthProvider = lazy(() => named(import("@/features/staff-app"), "StaffAuthProvider"));
const StaffProtectedRoute = lazy(() => named(import("@/features/staff-app"), "StaffProtectedRoute"));
const StaffAppLayout = lazy(() => named(import("@/features/staff-app"), "StaffAppLayout"));
const StaffHomePage = lazy(() => named(import("@/features/staff-app"), "StaffHomePage"));
const StaffProfilePage = lazy(() => named(import("@/features/staff-app"), "StaffProfilePage"));
const StaffScanPage = lazy(() => named(import("@/features/staff-app/pages/StaffScanPage"), "StaffScanPage"));

// Driver / Agent app
const DriverAuthProvider = lazy(() => named(import("@/features/driver-app"), "DriverAuthProvider"));
const DriverProtectedRoute = lazy(() => named(import("@/features/driver-app"), "DriverProtectedRoute"));
const DriverAppLayout = lazy(() => named(import("@/features/driver-app"), "DriverAppLayout"));
const TodayPage = lazy(() => named(import("@/features/driver-app/pages/TodayPage"), "TodayPage"));
const PickupsPage = lazy(() => named(import("@/features/driver-app/pages/PickupsPage"), "PickupsPage"));
const PickupDetailPage = lazy(() => named(import("@/features/driver-app/pages/PickupDetailPage"), "PickupDetailPage"));
const DeliveriesPage = lazy(() => named(import("@/features/driver-app/pages/DeliveriesPage"), "DeliveriesPage"));
const DeliveryDetailPage = lazy(() => named(import("@/features/driver-app/pages/DeliveryDetailPage"), "DeliveryDetailPage"));
const DriverProfilePage = lazy(() => named(import("@/features/driver-app/pages/DriverProfilePage"), "DriverProfilePage"));
const DriverScanPage = lazy(() => named(import("@/features/driver-app/pages/DriverScanPage"), "DriverScanPage"));

// Plant portal
const PlantProtectedRoute = lazy(() => named(import("@/features/plant-app/PlantProtectedRoute"), "PlantProtectedRoute"));
const PlantLayout = lazy(() => named(import("@/features/plant-app/PlantLayout"), "PlantLayout"));
const PlantDashboard = lazy(() => named(import("@/features/plant-app/pages/PlantDashboard"), "PlantDashboard"));
const PlantInboundPage = lazy(() => named(import("@/features/plant-app/pages/PlantInboundPage"), "PlantInboundPage"));
const PlantProcessingPage = lazy(() => named(import("@/features/plant-app/pages/PlantProcessingPage"), "PlantProcessingPage"));
const PlantReadyPage = lazy(() => named(import("@/features/plant-app/pages/PlantReadyPage"), "PlantReadyPage"));
const PlantOrderDetailPage = lazy(() => named(import("@/features/plant-app/pages/PlantOrderDetailPage"), "PlantOrderDetailPage"));
const PlantScanPage = lazy(() => named(import("@/features/plant-app/pages/PlantScanPage"), "PlantScanPage"));
const PlantCompletedPage = lazy(() => named(import("@/features/plant-app/pages/PlantCompletedPage"), "PlantCompletedPage"));

/** Fallback shown while a route chunk downloads — the same lightweight ring. */
function RouteFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <LSpinner size="lg" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppManifestUpdater />
      <LToastProvider>
        <AuthProvider>
          <ReceiptPrintProvider>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/track" element={<PublicTrackingPage />} />
            <Route path="/track/:trackingId" element={<PublicTrackingPage />} />
            <Route path="/track/:shopId/:publicId" element={<PublicTrackingPage />} />
            <Route path="/receipt/:orderId" element={<PublicReceiptPage />} />
            <Route path="/order/:shopSlug" element={<PublicOrderPage />} />

            {/* Unified Team login/signup — one entry for staff, plant & agents.
                Resolves the member's role and routes them to the right portal. */}
            <Route path="/team" element={<Navigate to="/team/login" replace />} />
            <Route path="/team/login" element={<TeamLoginPage />} />
            <Route path="/team/signup" element={<TeamSignupPage />} />

            {/* Staff App routes */}
            <Route
              path="/staff/*"
              element={
                <StaffAuthProvider>
                  <Routes>
                    <Route path="login" element={<Navigate to="/team/login" replace />} />
                    <Route path="signup" element={<Navigate to="/team/signup" replace />} />
                    <Route
                      element={
                        <StaffProtectedRoute>
                          <StaffAppLayout />
                        </StaffProtectedRoute>
                      }
                    >
                      <Route index element={<StaffHomePage />} />
                      <Route path="orders/new" element={<NewOrderPage />} />
                      <Route path="orders" element={<OrdersPage />} />
                      <Route path="orders/:orderId" element={<OrderDetailPage />} />
                      <Route path="customers" element={<CustomersPageMasterDetail />} />
                      <Route path="customers/:customerId" element={<CustomerDetailPage />} />
                      <Route path="expenses" element={<ExpensesPageMasterDetail />} />
                      <Route path="scan" element={<StaffScanPage />} />
                      <Route path="profile" element={<StaffProfilePage />} />
                    </Route>
                  </Routes>
                </StaffAuthProvider>
              }
            />

            {/* Driver Agent App routes */}
            <Route
              path="/agent/*"
              element={
                <DriverAuthProvider>
                  <Routes>
                    <Route path="login" element={<Navigate to="/team/login" replace />} />
                    <Route path="signup" element={<Navigate to="/team/signup" replace />} />
                    <Route
                      element={
                        <DriverProtectedRoute>
                          <DriverAppLayout />
                        </DriverProtectedRoute>
                      }
                    >
                      <Route index element={<TodayPage />} />
                      <Route path="orders/new" element={<NewOrderPage />} />
                      <Route path="pickups" element={<PickupsPage />} />
                      <Route path="pickups/:orderId" element={<PickupDetailPage />} />
                      <Route path="deliveries" element={<DeliveriesPage />} />
                      <Route path="deliveries/:orderId" element={<DeliveryDetailPage />} />
                      <Route path="scan" element={<DriverScanPage />} />
                      <Route path="profile" element={<DriverProfilePage />} />
                    </Route>
                  </Routes>
                </DriverAuthProvider>
              }
            />

            {/* Plant Portal routes (Shared Auth with Driver Context) */}
            <Route
              path="/plant/*"
              element={
                <DriverAuthProvider>
                  <Routes>
                    {/* Plant login is handled by the unified team login */}
                    <Route path="login" element={<Navigate to="/team/login" replace />} />
                    <Route
                      element={
                        <PlantProtectedRoute>
                          <PlantLayout />
                        </PlantProtectedRoute>
                      }
                    >
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<PlantDashboard />} />
                      <Route path="inbound" element={<PlantInboundPage />} />
                      <Route path="processing" element={<PlantProcessingPage />} />
                      <Route path="ready" element={<PlantReadyPage />} />
                      <Route path="orders/:orderId" element={<PlantOrderDetailPage />} />
                      <Route path="scan" element={<PlantScanPage />} />
                      <Route path="completed" element={<PlantCompletedPage />} />
                    </Route>
                  </Routes>
                </DriverAuthProvider>
              }
            />

            {/* Super Admin routes */}
            <Route
              path="/super-admin/*"
              element={
                <SuperAdminAuthProvider>
                  <Routes>
                    <Route path="login" element={<SuperAdminLoginPage />} />
                    <Route
                      element={
                        <SuperAdminProtectedRoute>
                          <SuperAdminLayout />
                        </SuperAdminProtectedRoute>
                      }
                    >
                      <Route index element={<SuperAdminDashboard />} />
                      <Route path="plans" element={<PlansPage />} />
                      <Route path="shops" element={<SuperAdminShopsPage />} />
                      <Route path="shops/:shopId" element={<ShopDetailsPage />} />
                      <Route path="map" element={<ShopsMapPage />} />
                      <Route path="subscriptions" element={<SubscriptionsPage />} />
                      <Route path="payments" element={<PaymentsPage />} />
                      <Route path="scan" element={<SuperAdminScanPage />} />
                      <Route path="settings" element={<PlatformSettingsPage />} />
                      <Route path="items-list" element={<ItemsListPage />} />
                      <Route path="notifications" element={<NotificationsPage />} />
                      <Route path="support" element={<SupportHelpPage />} />
                      <Route path="feedback" element={<FeedbackPage />} />
                    </Route>
                  </Routes>
                </SuperAdminAuthProvider>
              }
            />

            {/* Protected routes with layout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="scan" element={<FeatureGuard feature="qrScans"><AdminScanPage /></FeatureGuard>} />
              <Route path="new-order" element={<NewOrderPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:orderId" element={<OrderDetailPage />} />
              <Route path="customers" element={<CustomersPageMasterDetail />} />
              <Route path="customers/:customerId" element={<CustomerDetailPage />} />
              <Route path="inventory" element={<FeatureGuard feature="services"><InventoryPage /></FeatureGuard>} />
              <Route path="manage-staff" element={<FeatureGuard feature="staffManagement"><StaffPageMasterDetail /></FeatureGuard>} />
              <Route path="attendance" element={<FeatureGuard feature="attendance"><AttendancePageMasterDetail /></FeatureGuard>} />
              <Route path="payroll" element={<FeatureGuard feature="payroll"><PayrollPageMasterDetail /></FeatureGuard>} />
              <Route path="expenses" element={<FeatureGuard feature="expenses"><ExpensesPageMasterDetail /></FeatureGuard>} />
              <Route path="reports" element={<FeatureGuard feature="reports"><ReportsPage /></FeatureGuard>} />
              <Route path="apps" element={<AppsPage />} />
              <Route path="settings" element={<SettingsPageMasterDetail />} />
              <Route path="shop-settings" element={<ShopSettingsPage />} />
              <Route path="delivery-settings" element={<DeliverySettingsPage />} />
              <Route path="settings/subscription" element={<OwnerRoute><SubscriptionPage /></OwnerRoute>} />
              <Route path="settings/payment-history" element={<OwnerRoute><PaymentHistoryPage /></OwnerRoute>} />
              <Route path="settings/public-page" element={<OwnerRoute><FeatureGuard feature="publicOrderingPage"><PublicPageSettingsPage /></FeatureGuard></OwnerRoute>} />
              <Route path="settings/offers" element={<FeatureGuard feature="offers"><OffersPage /></FeatureGuard>} />
              <Route path="help" element={<HelpPage />} />
            </Route>

            {/* Bare /subscription → the real billing page. Without this it would fall
                through to /:shopSlug and render the "shop not available" public page. */}
            <Route path="/subscription" element={<Navigate to="/settings/subscription" replace />} />

            {/* Public shop page — clean URL: /:shopSlug (e.g. /ramesh). React Router ranks
                this dynamic route BELOW every static app route, so /dashboard, /orders,
                /login, /track, etc. still win. Reserved slug names are guarded in the
                session guard. /order/:shopSlug above stays as a working alias. */}
            <Route path="/:shopSlug" element={<PublicOrderPage />} />

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </Suspense>
          </ReceiptPrintProvider>
        </AuthProvider>
      </LToastProvider>
    </BrowserRouter>
  );
}

export default App;
