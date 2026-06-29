import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Quicksand_300Light,
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import { I18nextProvider } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import i18n, { initStoredLanguage } from './src/lib/i18n';
import { colors, fonts } from './src/theme';
import { DriverAuthProvider, useDriverAuth } from './src/lib/DriverAuthContext';
import { CurrencyProvider } from './src/lib/currency';
import { NavProvider, type TabKey, type Route } from './src/lib/nav';
import { usePushNotifications, saveTeamMemberToken } from './src/lib/usePushNotifications';

import LoginScreen from './src/screens/LoginScreen';
import TodayScreen from './src/screens/TodayScreen';
import PickupsScreen from './src/screens/PickupsScreen';
import DeliveriesScreen from './src/screens/DeliveriesScreen';
import ScanScreen from './src/screens/ScanScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PickupDetailScreen from './src/screens/PickupDetailScreen';
import DeliveryDetailScreen from './src/screens/DeliveryDetailScreen';
import PlantDashboardScreen from './src/screens/plant/PlantDashboardScreen';
import PlantInboundScreen from './src/screens/plant/PlantInboundScreen';
import PlantProcessingScreen from './src/screens/plant/PlantProcessingScreen';
import PlantReadyScreen from './src/screens/plant/PlantReadyScreen';
import PlantOrderDetailScreen from './src/screens/plant/PlantOrderDetailScreen';
import PlantCompletedScreen from './src/screens/plant/PlantCompletedScreen';
import PlantProfileScreen from './src/screens/plant/PlantProfileScreen';
import PlantScanScreen from './src/screens/plant/PlantScanScreen';
import CustomerListScreen from './src/screens/CustomerListScreen';
import CustomerDetailScreen from './src/screens/CustomerDetailScreen';
import AddCustomerScreen from './src/screens/AddCustomerScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import OrderDetailsScreen from './src/screens/OrderDetailsScreen';
import StaffScanScreen from './src/screens/StaffScanScreen';
import HomeScreen from './src/screens/HomeScreen';
import ExpensesScreen from './src/screens/ExpensesScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import ManagerProfileScreen from './src/screens/ManagerProfileScreen';
import TaxSettingsScreen from './src/screens/TaxSettingsScreen';
import StaffListScreen from './src/screens/StaffListScreen';
import StaffDetailScreen from './src/screens/StaffDetailScreen';
import CreateStaffLoginScreen from './src/screens/CreateStaffLoginScreen';
import AddServiceScreen from './src/screens/AddServiceScreen';
import ServiceItemsScreen from './src/screens/ServiceItemsScreen';
import ServiceAreasScreen from './src/screens/ServiceAreasScreen';
import ExpenseListScreen from './src/screens/ExpenseListScreen';
import CreateOrderScreen, { CreateOrderScreenRef } from './src/screens/CreateOrderScreen';
import OrderReviewScreen from './src/screens/OrderReviewScreen';
import OrderSuccessScreen from './src/screens/OrderSuccessScreen';
import type { DraftOrderPayload } from './src/types/orderDraft';

const TABS: { key: TabKey; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'today', label: 'Today', icon: 'home-filled' },
  { key: 'pickups', label: 'Pickups', icon: 'arrow-circle-up' },
  { key: 'scan', label: 'Scan', icon: 'qr-code-scanner' },
  { key: 'deliveries', label: 'Deliver', icon: 'arrow-circle-down' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];

function MainShell() {
  const insets = useSafeAreaInsets();
  const { shopName } = useDriverAuth();
  const [tab, setTabState] = useState<TabKey>('today');
  const [stack, setStack] = useState<Route[]>([]);

  // Create/edit-order flow — kept mounted so the cart survives the review overlay
  // (mirrors the staff shell). Agents create orders auto-assigned to themselves
  // and fully edit their own assigned orders.
  const [creating, setCreating] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [orderDraft, setOrderDraft] = useState<DraftOrderPayload | null>(null);
  const [placedOrder, setPlacedOrder] = useState<any>(null);
  const [createStep, setCreateStep] = useState<'create' | 'review' | 'success'>('create');
  const [createSub, setCreateSub] = useState<null | { kind: 'add' } | { kind: 'editCustomer'; id: string }>(null);
  const createOrderRef = useRef<CreateOrderScreenRef>(null);

  const setTab = useCallback((t: TabKey) => {
    setStack([]);
    setTabState(t);
  }, []);
  const navigate = useCallback((route: Route) => setStack((s) => [...s, route]), []);
  const goBack = useCallback((): boolean => {
    let handled = false;
    setStack((s) => {
      if (s.length > 0) {
        handled = true;
        return s.slice(0, -1);
      }
      return s;
    });
    return handled;
  }, []);

  const openCreate = useCallback((order?: any) => {
    setEditingOrder(order || null);
    setOrderDraft(null);
    setPlacedOrder(null);
    setCreateStep('create');
    setCreateSub(null);
    setCreating(true);
  }, []);
  const closeCreate = useCallback(() => {
    setCreating(false);
    setCreateStep('create');
    setOrderDraft(null);
    setPlacedOrder(null);
    setEditingOrder(null);
    setCreateSub(null);
  }, []);

  // Open an order from a push-notification tap.
  const openOrder = useCallback((data: any) => {
    if (!data?.orderId) return;
    const t = data.type as string | undefined;
    if (t && t.includes('out_for_delivery')) {
      setTabState('deliveries');
      setStack([{ name: 'deliveryDetail', orderId: data.orderId }]);
    } else {
      setTabState('pickups');
      setStack([{ name: 'pickupDetail', orderId: data.orderId }]);
    }
  }, []);
  usePushNotifications(openOrder);

  // Android back: unwind the create flow first, then the detail stack.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (creating) {
        if (createSub) { setCreateSub(null); return true; }
        if (createStep === 'review') { setCreateStep('create'); return true; }
        closeCreate();
        return true;
      }
      return goBack();
    });
    return () => sub.remove();
  }, [creating, createSub, createStep, goBack, closeCreate]);

  const top = stack[stack.length - 1];

  const renderTab = () => {
    switch (tab) {
      case 'today':
        return <TodayScreen />;
      case 'pickups':
        return <PickupsScreen />;
      case 'scan':
        return <ScanScreen />;
      case 'deliveries':
        return <DeliveriesScreen />;
      case 'profile':
        return <ProfileScreen />;
    }
  };

  return (
    <NavProvider value={{ tab, setTab, stack, navigate, goBack }}>
      <View style={styles.flex}>
        <View style={styles.flex}>{renderTab()}</View>

        {top?.name === 'pickupDetail' && (
          <View style={styles.overlay}>
            <PickupDetailScreen orderId={top.orderId} onEditOrder={(order: any) => openCreate(order)} />
          </View>
        )}
        {top?.name === 'deliveryDetail' && (
          <View style={styles.overlay}>
            <DeliveryDetailScreen orderId={top.orderId} onEditOrder={(order: any) => openCreate(order)} />
          </View>
        )}

        {/* New Order FAB — agent's entry to the create flow. Hidden over detail/create overlays. */}
        {stack.length === 0 && !creating && (
          <TouchableOpacity
            style={[styles.newOrderFab, { bottom: Math.max(insets.bottom, 10) + 74 }]}
            activeOpacity={0.85}
            onPress={() => openCreate()}
          >
            <MaterialIcons name="add" size={26} color="#fff" />
            <Text style={styles.newOrderFabLabel}>New Order</Text>
          </TouchableOpacity>
        )}

        {stack.length === 0 && !creating && (
        <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {TABS.map((t) => {
            const active = tab === t.key && stack.length === 0;
            if (t.key === 'scan') {
              return (
                <TouchableOpacity
                  key={t.key}
                  style={styles.fabWrap}
                  activeOpacity={0.85}
                  onPress={() => setTab('scan')}
                >
                  <View style={styles.fab}>
                    <MaterialIcons name="qr-code-scanner" size={24} color="#fff" />
                  </View>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                key={t.key}
                style={styles.navItem}
                activeOpacity={0.7}
                onPress={() => setTab(t.key)}
              >
                <MaterialIcons
                  name={t.icon}
                  size={24}
                  color={active ? colors.navActive : colors.navInactive}
                />
                <Text style={[styles.navLabel, active && { color: colors.navActive }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        )}

        {/* Create/edit-order flow overlay — CreateOrderScreen stays mounted under review/success */}
        {creating && (
          <View style={styles.overlay}>
            <CreateOrderScreen
              ref={createOrderRef}
              editOrder={editingOrder}
              onBack={closeCreate}
              onReviewOrder={(draft) => { setOrderDraft(draft); setCreateStep('review'); }}
              onAddCustomer={() => setCreateSub({ kind: 'add' })}
              onEditCustomerDetail={(id) => setCreateSub({ kind: 'editCustomer', id })}
            />
            {createStep === 'review' && (
              <View style={styles.overlay}>
                <OrderReviewScreen
                  draftOrder={orderDraft}
                  editOrderId={editingOrder?.id || null}
                  editOrder={editingOrder}
                  selfAssignAsAgent={!editingOrder}
                  onBack={() => setCreateStep('create')}
                  onEditCustomer={() => { createOrderRef.current?.goToCustomerStep(); setCreateStep('create'); }}
                  onPlaceOrder={(order: any) => { setPlacedOrder(order); setEditingOrder(null); setCreateStep('success'); }}
                />
              </View>
            )}
            {createStep === 'success' && placedOrder && (
              <View style={styles.overlay}>
                <OrderSuccessScreen
                  order={placedOrder}
                  shopName={shopName || undefined}
                  onViewOrder={() => { const oid = placedOrder.id; closeCreate(); setTabState('pickups'); setStack([{ name: 'pickupDetail', orderId: oid }]); }}
                  onDone={() => { closeCreate(); setTabState('today'); }}
                />
              </View>
            )}
            {createSub?.kind === 'add' && (
              <View style={styles.overlay}>
                <AddCustomerScreen onBack={() => setCreateSub(null)} onCreated={(customer) => { createOrderRef.current?.selectCustomerAndAdvance(customer); setCreateSub(null); }} />
              </View>
            )}
            {createSub?.kind === 'editCustomer' && (
              <View style={styles.overlay}>
                <CustomerDetailScreen customerId={createSub.id} onBack={() => setCreateSub(null)} onViewOrder={() => {}} />
              </View>
            )}
          </View>
        )}
      </View>
    </NavProvider>
  );
}

const PLANT_TABS: { key: TabKey; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'plantDashboard', label: 'Home', icon: 'dashboard' },
  { key: 'plantInbound', label: 'Inbound', icon: 'inventory-2' },
  { key: 'plantProcessing', label: 'Process', icon: 'local-laundry-service' },
  { key: 'plantReady', label: 'Ready', icon: 'check-circle' },
  { key: 'plantScan', label: 'Scan', icon: 'qr-code-scanner' },
  { key: 'plantProfile', label: 'Profile', icon: 'person' },
];

/** The Plant role's shell: queue tabs + an order-detail / completed overlay stack. */
function PlantShell() {
  const insets = useSafeAreaInsets();
  const [tab, setTabState] = useState<TabKey>('plantDashboard');
  const [stack, setStack] = useState<Route[]>([]);

  const setTab = useCallback((t: TabKey) => {
    setStack([]);
    setTabState(t);
  }, []);
  const navigate = useCallback((route: Route) => setStack((s) => [...s, route]), []);
  const goBack = useCallback((): boolean => {
    let handled = false;
    setStack((s) => {
      if (s.length > 0) {
        handled = true;
        return s.slice(0, -1);
      }
      return s;
    });
    return handled;
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => goBack());
    return () => sub.remove();
  }, [goBack]);

  // Open an order from a push-notification tap → Inbound + the order detail.
  const openPlantOrder = useCallback((data: any) => {
    if (!data?.orderId) return;
    setTabState('plantInbound');
    setStack([{ name: 'plantOrderDetail', orderId: data.orderId }]);
  }, []);
  usePushNotifications(openPlantOrder, { save: saveTeamMemberToken });

  const top = stack[stack.length - 1];

  const renderTab = () => {
    switch (tab) {
      case 'plantInbound':
        return <PlantInboundScreen />;
      case 'plantProcessing':
        return <PlantProcessingScreen />;
      case 'plantReady':
        return <PlantReadyScreen />;
      case 'plantScan':
        return <PlantScanScreen />;
      case 'plantProfile':
        return <PlantProfileScreen />;
      case 'plantDashboard':
      default:
        return <PlantDashboardScreen />;
    }
  };

  return (
    <NavProvider value={{ tab, setTab, stack, navigate, goBack }}>
      <View style={styles.flex}>
        <View style={styles.flex}>{renderTab()}</View>

        {top?.name === 'plantOrderDetail' && (
          <View style={styles.overlay}>
            <PlantOrderDetailScreen orderId={top.orderId} />
          </View>
        )}
        {top?.name === 'plantCompleted' && (
          <View style={styles.overlay}>
            <PlantCompletedScreen />
          </View>
        )}

        {stack.length === 0 && (
          <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {PLANT_TABS.map((t) => {
              const active = tab === t.key;
              return (
                <TouchableOpacity key={t.key} style={styles.navItem} activeOpacity={0.7} onPress={() => setTab(t.key)}>
                  <MaterialIcons name={t.icon} size={24} color={active ? colors.navActive : colors.navInactive} />
                  <Text style={[styles.navLabel, active && { color: colors.navActive }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </NavProvider>
  );
}

const STAFF_TABS: { key: TabKey; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'staffOrders', label: 'Orders', icon: 'receipt-long' },
  { key: 'staffScan', label: 'Scan', icon: 'qr-code-scanner' },
  { key: 'staffCreate', label: 'Create', icon: 'add-circle' },
  { key: 'staffCustomers', label: 'Customers', icon: 'people' },
  { key: 'staffProfile', label: 'Profile', icon: 'person' },
];

// Flat 5-tab nav mirroring the owner app (Home · Orders · Customers · Finances ·
// Settings) — here Finance is a tab and Profile replaces Settings. Create is
// reached from Home's "New Order" button and the Orders screen FAB (as in owner).
const MANAGER_TABS: { key: TabKey; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'manHome', label: 'Home', icon: 'home-filled' },
  { key: 'manOrders', label: 'Orders', icon: 'receipt-long' },
  { key: 'manCustomers', label: 'Customers', icon: 'people' },
  { key: 'manFinance', label: 'Finance', icon: 'account-balance-wallet' },
  { key: 'manProfile', label: 'Profile', icon: 'person' },
];

/** The Staff role's shell: Orders, Customers, and the full Create-Order flow. */
function StaffShell() {
  const insets = useSafeAreaInsets();
  const { agent, shopName, signOutAgent } = useDriverAuth();
  const [tab, setTabState] = useState<TabKey>('staffOrders');
  const [stack, setStack] = useState<Route[]>([]);

  // Create-order flow — kept mounted so the cart survives the review overlay
  // (mirrors the owner app's orderInProgress orchestration).
  const [creating, setCreating] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [orderDraft, setOrderDraft] = useState<DraftOrderPayload | null>(null);
  const [placedOrder, setPlacedOrder] = useState<any>(null);
  const [createStep, setCreateStep] = useState<'create' | 'review' | 'success'>('create');
  const [createSub, setCreateSub] = useState<null | { kind: 'add' } | { kind: 'editCustomer'; id: string }>(null);
  const createOrderRef = useRef<CreateOrderScreenRef>(null);

  const setTab = useCallback((t: TabKey) => {
    setStack([]);
    setTabState(t);
  }, []);
  const navigate = useCallback((route: Route) => setStack((s) => [...s, route]), []);
  const goBack = useCallback((): boolean => {
    let handled = false;
    setStack((s) => {
      if (s.length > 0) {
        handled = true;
        return s.slice(0, -1);
      }
      return s;
    });
    return handled;
  }, []);

  const openCreate = useCallback((order?: any) => {
    setEditingOrder(order || null);
    setOrderDraft(null);
    setPlacedOrder(null);
    setCreateStep('create');
    setCreateSub(null);
    setCreating(true);
  }, []);
  const closeCreate = useCallback(() => {
    setCreating(false);
    setCreateStep('create');
    setOrderDraft(null);
    setPlacedOrder(null);
    setEditingOrder(null);
    setCreateSub(null);
  }, []);

  // Android back: unwind the create flow first, then the route stack.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (creating) {
        if (createSub) { setCreateSub(null); return true; }
        if (createStep === 'review') { setCreateStep('create'); return true; }
        closeCreate();
        return true;
      }
      return goBack();
    });
    return () => sub.remove();
  }, [creating, createSub, createStep, goBack, closeCreate]);

  // Open an order from a push-notification tap → Orders + the order detail.
  const openStaffOrder = useCallback((data: any) => {
    if (!data?.orderId) return;
    setTabState('staffOrders');
    setStack([{ name: 'orderDetail', orderId: data.orderId }]);
  }, []);
  usePushNotifications(openStaffOrder, { save: saveTeamMemberToken });

  const top = stack[stack.length - 1];

  const renderTab = () => {
    switch (tab) {
      case 'staffCustomers':
        return (
          <CustomerListScreen
            onViewCustomer={(id: string) => navigate({ name: 'customerDetail', customerId: id })}
            onAddCustomer={() => navigate({ name: 'addCustomer' })}
          />
        );
      case 'staffScan':
        // Scan an order/garment tag → open the order to check or update status.
        return <StaffScanScreen />;
      case 'staffProfile':
        return (
          <View style={[styles.center, { padding: 24 }]}>
            <MaterialIcons name="person" size={44} color={colors.primary} />
            <Text style={styles.phTitle}>{agent?.name || 'Staff'}</Text>
            {shopName ? <Text style={styles.phShop}>{shopName}</Text> : null}
            <TouchableOpacity style={styles.phBtn} activeOpacity={0.85} onPress={signOutAgent}>
              <Text style={styles.phBtnText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        );
      case 'staffOrders':
      default:
        // No onNewOrder → OrdersScreen hides its in-screen FAB; the raised
        // Create button in the bottom nav is the single entry to the flow.
        return (
          <OrdersScreen
            onViewOrder={(id: string) => navigate({ name: 'orderDetail', orderId: id })}
          />
        );
    }
  };

  return (
    <NavProvider value={{ tab, setTab, stack, navigate, goBack }}>
      <View style={styles.flex}>
        {/* Tab screens ported from the owner app rely on the parent for the top
            safe-area inset (their own headers use paddingTop:0). The inset strip
            is painted surface-white so it blends into the white screen headers
            (gray `flex` bg here would show a mismatched strip under the status
            bar). The Scan tab is exempt — its camera is full-bleed and self-insets,
            so it gets no top padding. Detail/create overlays handle their own inset. */}
        <View style={[styles.flex, tab !== 'staffScan' && { paddingTop: insets.top, backgroundColor: colors.surface }]}>
          {renderTab()}
        </View>

        {top?.name === 'customerDetail' && (
          <View style={styles.overlay}>
            <CustomerDetailScreen
              customerId={top.customerId}
              onBack={goBack}
              onViewOrder={(id: string) => navigate({ name: 'orderDetail', orderId: id })}
            />
          </View>
        )}
        {top?.name === 'addCustomer' && (
          <View style={styles.overlay}>
            <AddCustomerScreen onBack={goBack} onCreated={() => goBack()} />
          </View>
        )}
        {top?.name === 'orderDetail' && (
          <View style={styles.overlay}>
            <OrderDetailsScreen orderId={top.orderId} onBack={goBack} onEditOrder={(order: any) => openCreate(order)} />
          </View>
        )}

        {stack.length === 0 && !creating && (
          <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {STAFF_TABS.map((t) => {
              // Create is the staff's primary action — render it as a raised accent
              // FAB so it pops out of the flat tab row (same pattern as the agent
              // shell's centre Scan button).
              if (t.key === 'staffCreate') {
                return (
                  <TouchableOpacity key={t.key} style={styles.fabWrap} activeOpacity={0.85} onPress={() => openCreate()}>
                    <View style={styles.fab}>
                      <MaterialIcons name="add" size={28} color="#fff" />
                    </View>
                    <Text style={[styles.navLabel, { color: colors.navActive, marginTop: 2 }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              }
              const active = tab === t.key;
              return (
                <TouchableOpacity key={t.key} style={styles.navItem} activeOpacity={0.7} onPress={() => setTab(t.key)}>
                  <MaterialIcons name={t.icon} size={24} color={active ? colors.navActive : colors.navInactive} />
                  <Text style={[styles.navLabel, active && { color: colors.navActive }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Create-order flow overlay — CreateOrderScreen stays mounted under review/success */}
        {creating && (
          <View style={styles.overlay}>
            <CreateOrderScreen
              ref={createOrderRef}
              editOrder={editingOrder}
              onBack={closeCreate}
              onReviewOrder={(draft) => { setOrderDraft(draft); setCreateStep('review'); }}
              onAddCustomer={() => setCreateSub({ kind: 'add' })}
              onEditCustomerDetail={(id) => setCreateSub({ kind: 'editCustomer', id })}
            />
            {createStep === 'review' && (
              <View style={styles.overlay}>
                <OrderReviewScreen
                  draftOrder={orderDraft}
                  editOrderId={editingOrder?.id || null}
                  editOrder={editingOrder}
                  onBack={() => setCreateStep('create')}
                  onEditCustomer={() => { createOrderRef.current?.goToCustomerStep(); setCreateStep('create'); }}
                  onPlaceOrder={(order: any) => { setPlacedOrder(order); setEditingOrder(null); setCreateStep('success'); }}
                />
              </View>
            )}
            {createStep === 'success' && placedOrder && (
              <View style={styles.overlay}>
                <OrderSuccessScreen
                  order={placedOrder}
                  shopName={shopName || undefined}
                  onViewOrder={() => { const oid = placedOrder.id; closeCreate(); setTabState('staffOrders'); navigate({ name: 'orderDetail', orderId: oid }); }}
                  onDone={() => { closeCreate(); setTabState('staffOrders'); }}
                />
              </View>
            )}
            {createSub?.kind === 'add' && (
              <View style={styles.overlay}>
                <AddCustomerScreen onBack={() => setCreateSub(null)} onCreated={(customer) => { createOrderRef.current?.selectCustomerAndAdvance(customer); setCreateSub(null); }} />
              </View>
            )}
            {createSub?.kind === 'editCustomer' && (
              <View style={styles.overlay}>
                <CustomerDetailScreen customerId={createSub.id} onBack={() => setCreateSub(null)} onViewOrder={() => {}} />
              </View>
            )}
          </View>
        )}
      </View>
    </NavProvider>
  );
}

/**
 * The Manager role's shell: a reports Home dashboard on top of the staff POS
 * surface (Orders, Create, Customers), plus Expenses and Attendance reached from
 * the Home quick-actions. Owner-only/destructive actions (account/staff deletion,
 * billing, shop settings, expense hard-delete) are absent BY CONSTRUCTION — only
 * the screens mounted here are reachable, so there is no denylist to maintain.
 */
function ManagerShell() {
  const insets = useSafeAreaInsets();
  const { agent, shopName, signOutAgent } = useDriverAuth();
  const [tab, setTabState] = useState<TabKey>('manHome');
  const [stack, setStack] = useState<Route[]>([]);

  // Create-order flow — kept mounted so the cart survives the review overlay.
  const [creating, setCreating] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [orderDraft, setOrderDraft] = useState<DraftOrderPayload | null>(null);
  const [placedOrder, setPlacedOrder] = useState<any>(null);
  const [createStep, setCreateStep] = useState<'create' | 'review' | 'success'>('create');
  const [createSub, setCreateSub] = useState<null | { kind: 'add' } | { kind: 'editCustomer'; id: string }>(null);
  const createOrderRef = useRef<CreateOrderScreenRef>(null);

  const setTab = useCallback((t: TabKey) => { setStack([]); setTabState(t); }, []);
  const navigate = useCallback((route: Route) => setStack((s) => [...s, route]), []);
  const goBack = useCallback((): boolean => {
    let handled = false;
    setStack((s) => { if (s.length > 0) { handled = true; return s.slice(0, -1); } return s; });
    return handled;
  }, []);

  const openCreate = useCallback((order?: any) => {
    setEditingOrder(order || null);
    setOrderDraft(null);
    setPlacedOrder(null);
    setCreateStep('create');
    setCreateSub(null);
    setCreating(true);
  }, []);
  const closeCreate = useCallback(() => {
    setCreating(false);
    setCreateStep('create');
    setOrderDraft(null);
    setPlacedOrder(null);
    setEditingOrder(null);
    setCreateSub(null);
  }, []);

  // Android back: unwind the create flow first, then the route stack.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (creating) {
        if (createSub) { setCreateSub(null); return true; }
        if (createStep === 'review') { setCreateStep('create'); return true; }
        closeCreate();
        return true;
      }
      return goBack();
    });
    return () => sub.remove();
  }, [creating, createSub, createStep, goBack, closeCreate]);

  // Open an order from a push-notification tap → Orders + the order detail.
  const openManagerOrder = useCallback((data: any) => {
    if (!data?.orderId) return;
    setTabState('manOrders');
    setStack([{ name: 'orderDetail', orderId: data.orderId }]);
  }, []);
  usePushNotifications(openManagerOrder, { save: saveTeamMemberToken });

  const top = stack[stack.length - 1];

  const renderTab = () => {
    switch (tab) {
      case 'manHome':
        return (
          <HomeScreen
            onNewOrder={() => openCreate()}
            onScanQR={() => navigate({ name: 'managerScan' })}
            onExpense={() => setTab('manFinance')}
            onAttendance={() => navigate({ name: 'managerAttendance' })}
            onDueOrders={() => setTab('manOrders')}
            onViewOrders={() => setTab('manOrders')}
            onSearchOrders={() => setTab('manOrders')}
            onViewOrder={(id: string) => navigate({ name: 'orderDetail', orderId: id })}
          />
        );
      case 'manCustomers':
        return (
          <CustomerListScreen
            onViewCustomer={(id: string) => navigate({ name: 'customerDetail', customerId: id })}
            onAddCustomer={() => navigate({ name: 'addCustomer' })}
          />
        );
      case 'manFinance':
        // Finance/Expenses dashboard as a bottom tab — the parent supplies the
        // top safe-area inset, so no onBack here (tabs have no back). "Staff
        // Attendance" inside opens the attendance overlay.
        return <ExpensesScreen onStaffAttendance={() => navigate({ name: 'managerAttendance' })} />;
      case 'manProfile':
        return (
          <ManagerProfileScreen
            name={agent?.name}
            shopName={shopName}
            onSignOut={signOutAgent}
            onManageExpenses={() => navigate({ name: 'managerExpenseList' })}
            onManageStaff={() => navigate({ name: 'managerStaff' })}
            onMarkAttendance={() => navigate({ name: 'managerAttendance' })}
            onManageService={() => navigate({ name: 'managerService' })}
            onManageItems={() => navigate({ name: 'managerService' })}
            onTaxSettings={() => navigate({ name: 'managerTax' })}
            onServiceArea={() => navigate({ name: 'managerServiceAreas' })}
          />
        );
      case 'manOrders':
      default:
        // onNewOrder → OrdersScreen shows its FAB; with no centre Create tab the
        // FAB (and Home's "New Order" button) are the manager's create entries.
        return (
          <OrdersScreen
            onViewOrder={(id: string) => navigate({ name: 'orderDetail', orderId: id })}
            onNewOrder={() => openCreate()}
          />
        );
    }
  };

  return (
    <NavProvider value={{ tab, setTab, stack, navigate, goBack }}>
      <View style={styles.flex}>
        {/* Tab screens rely on the parent for the top safe-area inset (their own
            headers use paddingTop:0); the strip is surface-white to blend in. */}
        <View style={[styles.flex, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
          {renderTab()}
        </View>

        {top?.name === 'customerDetail' && (
          <View style={styles.overlay}>
            <CustomerDetailScreen
              customerId={top.customerId}
              onBack={goBack}
              onViewOrder={(id: string) => navigate({ name: 'orderDetail', orderId: id })}
            />
          </View>
        )}
        {top?.name === 'addCustomer' && (
          <View style={styles.overlay}>
            <AddCustomerScreen onBack={goBack} onCreated={() => goBack()} />
          </View>
        )}
        {top?.name === 'orderDetail' && (
          <View style={styles.overlay}>
            <OrderDetailsScreen orderId={top.orderId} onBack={goBack} onEditOrder={(order: any) => openCreate(order)} />
          </View>
        )}
        {top?.name === 'managerAttendance' && (
          <View style={styles.overlay}>
            <AttendanceScreen onBack={goBack} />
          </View>
        )}
        {top?.name === 'managerScan' && (
          <View style={styles.overlay}>
            <StaffScanScreen onBack={goBack} />
          </View>
        )}
        {top?.name === 'managerExpenseList' && (
          <View style={styles.overlay}><ExpenseListScreen onBack={goBack} /></View>
        )}
        {top?.name === 'managerStaff' && (
          <View style={styles.overlay}>
            <StaffListScreen
              onBack={goBack}
              onViewStaff={(id: string) => navigate({ name: 'managerStaffDetail', staffId: id })}
              onAddStaff={() => navigate({ name: 'managerCreateLogin' })}
            />
          </View>
        )}
        {top?.name === 'managerStaffDetail' && (
          <View style={styles.overlay}>
            <StaffDetailScreen
              staffId={top.staffId}
              onBack={goBack}
              onCreateLogin={(prefill) => navigate({ name: 'managerCreateLogin', prefill })}
            />
          </View>
        )}
        {top?.name === 'managerCreateLogin' && (
          <View style={styles.overlay}><CreateStaffLoginScreen onBack={goBack} prefill={top.prefill} /></View>
        )}
        {top?.name === 'managerService' && (
          <View style={styles.overlay}>
            <AddServiceScreen
              onBack={goBack}
              onViewItems={(categoryId: string, categoryName: string) => navigate({ name: 'managerItems', categoryId, categoryName })}
            />
          </View>
        )}
        {top?.name === 'managerItems' && (
          <View style={styles.overlay}>
            <ServiceItemsScreen onBack={goBack} categoryId={top.categoryId} categoryName={top.categoryName} />
          </View>
        )}
        {top?.name === 'managerTax' && (
          <View style={styles.overlay}><TaxSettingsScreen onBack={goBack} /></View>
        )}
        {top?.name === 'managerServiceAreas' && (
          <View style={styles.overlay}><ServiceAreasScreen onBack={goBack} /></View>
        )}

        {stack.length === 0 && !creating && (
          <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {MANAGER_TABS.map((t) => {
              const active = tab === t.key;
              return (
                <TouchableOpacity key={t.key} style={styles.navItem} activeOpacity={0.7} onPress={() => setTab(t.key)}>
                  <MaterialIcons name={t.icon} size={24} color={active ? colors.navActive : colors.navInactive} />
                  <Text style={[styles.navLabel, active && { color: colors.navActive }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Create-order flow overlay — CreateOrderScreen stays mounted under review/success */}
        {creating && (
          <View style={styles.overlay}>
            <CreateOrderScreen
              ref={createOrderRef}
              editOrder={editingOrder}
              onBack={closeCreate}
              onReviewOrder={(draft) => { setOrderDraft(draft); setCreateStep('review'); }}
              onAddCustomer={() => setCreateSub({ kind: 'add' })}
              onEditCustomerDetail={(id) => setCreateSub({ kind: 'editCustomer', id })}
            />
            {createStep === 'review' && (
              <View style={styles.overlay}>
                <OrderReviewScreen
                  draftOrder={orderDraft}
                  editOrderId={editingOrder?.id || null}
                  editOrder={editingOrder}
                  onBack={() => setCreateStep('create')}
                  onEditCustomer={() => { createOrderRef.current?.goToCustomerStep(); setCreateStep('create'); }}
                  onPlaceOrder={(order: any) => { setPlacedOrder(order); setEditingOrder(null); setCreateStep('success'); }}
                />
              </View>
            )}
            {createStep === 'success' && placedOrder && (
              <View style={styles.overlay}>
                <OrderSuccessScreen
                  order={placedOrder}
                  shopName={shopName || undefined}
                  onViewOrder={() => { const oid = placedOrder.id; closeCreate(); setTabState('manOrders'); navigate({ name: 'orderDetail', orderId: oid }); }}
                  onDone={() => { closeCreate(); setTabState('manOrders'); }}
                />
              </View>
            )}
            {createSub?.kind === 'add' && (
              <View style={styles.overlay}>
                <AddCustomerScreen onBack={() => setCreateSub(null)} onCreated={(customer) => { createOrderRef.current?.selectCustomerAndAdvance(customer); setCreateSub(null); }} />
              </View>
            )}
            {createSub?.kind === 'editCustomer' && (
              <View style={styles.overlay}>
                <CustomerDetailScreen customerId={createSub.id} onBack={() => setCreateSub(null)} onViewOrder={() => {}} />
              </View>
            )}
          </View>
        )}
      </View>
    </NavProvider>
  );
}

function Root() {
  const { agent, loading } = useDriverAuth();

  if (loading && !agent) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (!agent) return <LoginScreen />;

  // Route by memberType; within the staff surface, role separates manager from staff.
  const memberType = agent.memberType;
  if (memberType === 'plant') return <PlantShell />;
  if (memberType === 'staff') {
    // Within the staff surface, the roster `role` separates manager from staff:
    // a manager gets the fuller ManagerShell (Home/reports + Expenses + Attendance).
    return agent.role === 'manager' ? <ManagerShell /> : <StaffShell />;
  }
  // agent (or legacy/undefined) → the existing delivery shell.
  return <MainShell />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Quicksand_300Light,
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  useEffect(() => {
    initStoredLanguage();
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <DriverAuthProvider>
          <CurrencyProvider>
            <Root />
          </CurrencyProvider>
        </DriverAuthProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  phTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.text, marginTop: 16 },
  phSub: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  phShop: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted, marginTop: 12 },
  phBtn: { marginTop: 28, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  phBtnText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.navInactive },
  fabWrap: { flex: 1, alignItems: 'center' },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  // Agent "New Order" FAB — pinned above the bottom nav, right-aligned.
  newOrderFab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 20,
  },
  newOrderFabLabel: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },
});
