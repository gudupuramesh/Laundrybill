import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, LoginPage, ProtectedRoute } from "@/features/auth";
import { ReceiptPrintProvider } from "@/context/ReceiptPrintContext";
import { LToastProvider } from "@/components/laundry";
import { AppManifestUpdater } from "@/components/AppManifestUpdater";
import { FeatureGuard } from "@/components/FeatureGuard";
import { AppLayout } from "@/layouts/AppLayout";
import { DashboardPage } from "@/features/dashboard";
import { SettingsPageMasterDetail, ShopSettingsPage, DeliverySettingsPage } from "@/features/settings";
import { SubscriptionPage } from "@/features/settings/pages/SubscriptionPage";
import { PaymentHistoryPage } from "@/features/settings/pages/PaymentHistoryPage";
import { PublicPageSettingsPage } from "@/features/settings/pages/PublicPageSettingsPage";
import { NewOrderPage } from "@/features/pos";
import { OrdersPage, OrderDetailPage } from "@/features/orders";
import { CustomersPageMasterDetail, CustomerDetailPage } from "@/features/customers";
import { InventoryPage } from "@/features/inventory";
import { StaffPageMasterDetail, AttendancePageMasterDetail, PayrollPageMasterDetail } from "@/features/staff";
import { ExpensesPageMasterDetail, ReportsPage } from "@/features/finance";
import { AppsPage } from "@/features/apps/AppsPage";
import { HelpPage } from "@/features/help";
import { PublicTrackingPage } from "@/features/tracking";
import { PublicReceiptPage } from "@/features/tracking/PublicReceiptPage";
import { PublicOrderPage } from "@/features/public-order";
import {
  SuperAdminAuthProvider,
  SuperAdminProtectedRoute,
  SuperAdminLayout,
  SuperAdminLoginPage,
  SuperAdminDashboard,
  ShopsPage as SuperAdminShopsPage,
  ShopDetailsPage,
  ShopsMapPage,
  SubscriptionsPage,
  PlansPage,
  PaymentsPage,
  PlatformSettingsPage,
  SupportHelpPage,
  FeedbackPage,
  ItemsListPage,
  NotificationsPage,
} from "@/features/super-admin";
import {
  StaffAuthProvider,
  StaffProtectedRoute,
  StaffAppLayout,
  StaffHomePage,
  StaffProfilePage,
} from "@/features/staff-app";
import { TeamLoginPage, TeamSignupPage } from "@/features/team-auth";
import {
  DriverAuthProvider,
  DriverProtectedRoute,
  DriverAppLayout,
} from "@/features/driver-app";
import { TodayPage } from "@/features/driver-app/pages/TodayPage";
import { PickupsPage } from "@/features/driver-app/pages/PickupsPage";
import { PickupDetailPage } from "@/features/driver-app/pages/PickupDetailPage";
import { DeliveriesPage } from "@/features/driver-app/pages/DeliveriesPage";
import { DeliveryDetailPage } from "@/features/driver-app/pages/DeliveryDetailPage";
import { DriverProfilePage } from "@/features/driver-app/pages/DriverProfilePage";
import { PlantProtectedRoute } from "@/features/plant-app/PlantProtectedRoute";
import { PlantLayout } from "@/features/plant-app/PlantLayout";
import { PlantDashboard } from "@/features/plant-app/pages/PlantDashboard";
import { PlantInboundPage } from "@/features/plant-app/pages/PlantInboundPage";
import { PlantProcessingPage } from "@/features/plant-app/pages/PlantProcessingPage";
import { PlantReadyPage } from "@/features/plant-app/pages/PlantReadyPage";
import { PlantOrderDetailPage } from "@/features/plant-app/pages/PlantOrderDetailPage";
import { PlantScanPage } from "@/features/plant-app/pages/PlantScanPage";
import { PlantCompletedPage } from "@/features/plant-app/pages/PlantCompletedPage";
import { DriverScanPage } from "@/features/driver-app/pages/DriverScanPage";
import { StaffScanPage } from "@/features/staff-app/pages/StaffScanPage";
import { SuperAdminScanPage } from "@/features/super-admin/pages/SuperAdminScanPage";
import { AdminScanPage } from "@/features/dashboard/AdminScanPage";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <AppManifestUpdater />
      <LToastProvider>
        <AuthProvider>
          <ReceiptPrintProvider>
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
              <Route path="settings/subscription" element={<SubscriptionPage />} />
              <Route path="settings/payment-history" element={<PaymentHistoryPage />} />
              <Route path="settings/public-page" element={<FeatureGuard feature="publicOrderingPage"><PublicPageSettingsPage /></FeatureGuard>} />
              <Route path="help" element={<HelpPage />} />
            </Route>

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </ReceiptPrintProvider>
        </AuthProvider>
      </LToastProvider>
    </BrowserRouter>
  );
}

export default App;
