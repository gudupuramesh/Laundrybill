import React, { useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Quicksand_300Light, Quicksand_400Regular, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n, { initStoredLanguage, setAppLanguageFromDisplayName } from './src/lib/i18n';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import CreateOrderScreen, { CreateOrderScreenRef } from './src/screens/CreateOrderScreen';
import OrderReviewScreen from './src/screens/OrderReviewScreen';
import OrderSuccessScreen from './src/screens/OrderSuccessScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AddServiceScreen from './src/screens/AddServiceScreen';
import ServiceItemsScreen from './src/screens/ServiceItemsScreen';
import OrderDetailsScreen from './src/screens/OrderDetailsScreen';
import CustomerListScreen from './src/screens/CustomerListScreen';
import CustomerDetailScreen from './src/screens/CustomerDetailScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterShopScreen from './src/screens/RegisterShopScreen';
import CreateAccountScreen from './src/screens/CreateAccountScreen';
import ScanScreen from './src/screens/ScanScreen';
import AddCustomerScreen from './src/screens/AddCustomerScreen';
import ExpensesScreen from './src/screens/ExpensesScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import StaffListScreen from './src/screens/StaffListScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import CreateStaffLoginScreen from './src/screens/CreateStaffLoginScreen';
import ExpenseListScreen from './src/screens/ExpenseListScreen';
import StaffDetailScreen from './src/screens/StaffDetailScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import { DraftOrderPayload } from './src/types/orderDraft';
import { configureRevenueCat, loginRevenueCat, logoutRevenueCat } from './src/lib/billing/revenuecat';
import { usePushNotifications, registerBackgroundHandler } from './src/lib/usePushNotifications';
import { usePlanLimits } from './src/lib/usePlanLimits';
import { useMergedOrdersUsed } from './src/lib/useBillingPeriodOrderCount';
import { useAppUpdateChecker } from './src/lib/useAppUpdateChecker';
import UpdateModal from './src/components/UpdateModal';

// Register background message handler (must be outside components)
registerBackgroundHandler();

const ONBOARDING_DONE_KEY = 'onboarding_completed_v1';
const PENDING_REGISTRATION_KEY = 'pending_registration_v1';
const FORCE_SETUP_UID_KEY = 'force_setup_uid_v1';

/** Ensures the native splash is noticeable on fast resumes (cached login); without this, hideAsync runs almost instantly. */
const MIN_SPLASH_MS = 720;

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider>
        <MainLayout />
      </SafeAreaProvider>
    </I18nextProvider>
  );
}

function MainLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const launchStartedAt = useRef(Date.now());
  const [fontsLoaded] = useFonts({
    Quicksand_300Light,
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });
  const [activeTab, setActiveTab] = useState('HOME');
  const [activeScreen, setActiveScreen] = useState<string | null>('LOGIN'); // Start with auth flow
  const [orderDraft, setOrderDraft] = useState<DraftOrderPayload | null>(null);
  const [orderInProgress, setOrderInProgress] = useState(false); // keeps CreateOrderScreen mounted across tabs
  const [ordersInitialFilter, setOrdersInitialFilter] = useState<string | undefined>(undefined);
  const [ordersOpenSearch, setOrdersOpenSearch] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any>(null); // holds the order after placement for success screen
  const [editingOrder, setEditingOrder] = useState<any>(null); // order being edited
  const [pendingRegistration, setPendingRegistration] = useState<{ email: string } | null>(null);
  const [forceSetupFlow, setForceSetupFlow] = useState(false);
  const pendingRegistrationRef = useRef<{ email: string } | null>(null);
  const forceSetupFlowRef = useRef(false);
  const createOrderRef = useRef<CreateOrderScreenRef>(null);
  
  // Firebase Auth State
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null); // from @react-native-firebase/auth
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  React.useEffect(() => {
    void initStoredLanguage();
  }, []);

  const refreshOnboardingFromStorage = React.useCallback(() => {
    void AsyncStorage.getItem(ONBOARDING_DONE_KEY)
      .then((v) => setOnboardingDone(v === '1'))
      .catch(() => setOnboardingDone(true));
  }, []);

  React.useEffect(() => {
    refreshOnboardingFromStorage();
  }, [refreshOnboardingFromStorage]);

  React.useEffect(() => {
    void AsyncStorage.getItem(PENDING_REGISTRATION_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed?.email) {
          setPendingRegistration({ email: String(parsed.email) });
        }
      })
      .catch(() => {});
  }, []);

  /** After logout, re-read storage so we never treat "unknown" as first-launch onboarding. */
  React.useEffect(() => {
    if (!user) refreshOnboardingFromStorage();
  }, [user, refreshOnboardingFromStorage]);

  React.useEffect(() => {
    if (!user) return;
    const { getShopId } = require('./src/lib/auth');
    const { firestore } = require('./src/lib/db');
    const sid = getShopId();
    if (!sid) return;
    try {
      const unsub = firestore()
        .collection('shops')
        .doc(sid)
        .onSnapshot((doc: any) => {
          if (!doc.exists) return;
          const lang = doc.data()?.settings?.language;
          if (lang && typeof lang === 'string') {
            void setAppLanguageFromDisplayName(lang);
          }
        });
      return unsub;
    } catch (e) {
      console.warn('Shop language sync', e);
    }
  }, [user, activeScreen]);

  React.useEffect(() => {
    pendingRegistrationRef.current = pendingRegistration;
  }, [pendingRegistration]);

  React.useEffect(() => {
    forceSetupFlowRef.current = forceSetupFlow;
  }, [forceSetupFlow]);

  // Configure RevenueCat SDK once on mount
  React.useEffect(() => {
    configureRevenueCat().catch((e) => console.warn("[RevenueCat] configure error", e));
  }, []);

  React.useEffect(() => {
    try {
      const { auth, setResolvedShopId } = require('./src/lib/auth');
      const { firestore } = require('./src/lib/db');

      const subscriber = auth().onAuthStateChanged(async (currentUser: any) => {
        setUser(currentUser);
        // Sync RevenueCat identity with Firebase user
        if (currentUser?.uid) {
          loginRevenueCat(currentUser.uid).catch((e) => console.warn("[RevenueCat] login error", e));
        } else {
          logoutRevenueCat().catch(() => {});
        }
        if (currentUser) {
          try {
            const uid = currentUser.uid;
            let foundShopId: string | null = null;
            let routingReason = 'unknown';
            const forcedSetupUid = await AsyncStorage.getItem(FORCE_SETUP_UID_KEY);
            const isForcedSetupForCurrentUser = !!forcedSetupUid && forcedSetupUid === uid;
            const shouldForceSetupNow = forceSetupFlowRef.current || isForcedSetupForCurrentUser;

            const pendingReg = pendingRegistrationRef.current;
            // Fresh signup path: if pending registration exists, always force setup
            // until we can prove a valid shop exists for this uid.
            if (pendingReg || shouldForceSetupNow) {
              const uidShopDoc = await firestore().collection('shops').doc(uid).get();
              const uidShopData = (uidShopDoc.data?.() ?? {}) as any;
              const hasRealShopSetup =
                !!uidShopDoc.exists &&
                typeof uidShopData?.name === 'string' &&
                uidShopData.name.trim().length > 0 &&
                typeof uidShopData?.ownerId === 'string' &&
                uidShopData.ownerId === uid;
              if (!hasRealShopSetup) {
                setResolvedShopId(null);
                routingReason = 'forced_register_pending_signup_no_uid_shop';
                console.log('[auth-route]', routingReason, { uid, pendingEmail: pendingReg?.email || null, currentEmail: currentUser?.email || null });
                setActiveScreen('REGISTER_SHOP');
                if (initializing) setInitializing(false);
                return;
              }
              // Shop exists now; clear pending marker
              setPendingRegistration(null);
              pendingRegistrationRef.current = null;
              setForceSetupFlow(false);
              forceSetupFlowRef.current = false;
              void AsyncStorage.removeItem(PENDING_REGISTRATION_KEY);
              void AsyncStorage.removeItem(FORCE_SETUP_UID_KEY);
              routingReason = 'pending_signup_cleared_uid_shop_exists';
              console.log('[auth-route]', routingReason, { uid });
            }

            // 1. Check users/{uid} — may already have shopId from web app or previous login
            const userDoc = await firestore().collection('users').doc(uid).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              if (userData?.shopId) {
                // Verify the shop still exists
                const shopCheck = await firestore().collection('shops').doc(userData.shopId).get();
                if (shopCheck.exists) {
                  foundShopId = userData.shopId;
                  routingReason = 'found_via_users_doc_shopid';
                }
              }
            }

            // 2. Check if this user IS the shop owner directly (shops/{uid})
            if (!foundShopId) {
              const shopDoc = await firestore().collection('shops').doc(uid).get();
              if (shopDoc.exists) {
                foundShopId = uid;
                routingReason = 'found_via_uid_shop_doc';
              }
            }

            // 3. Cross-provider match: search shops by phone number
            if (!foundShopId && currentUser.phoneNumber) {
              const phone = currentUser.phoneNumber;
              const digits = phone.replace(/\D/g, '').slice(-10);
              if (digits.length === 10) {
                const withPrefix = `+91${digits}`;
                let snap = await firestore().collection('shops').where('phone', '==', withPrefix).limit(1).get();
                if (snap.empty) {
                  snap = await firestore().collection('shops').where('phone', '==', digits).limit(1).get();
                }
                if (!snap.empty) {
                  foundShopId = snap.docs[0].id;
                  routingReason = 'found_via_phone_match';
                  const shopData = snap.docs[0].data();
                  await firestore().collection('users').doc(uid).set({
                    phone: phone,
                    shopId: foundShopId,
                    shopName: shopData.name || '',
                    role: 'admin',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  });
                }
              }
            }

            // Store resolved shopId for all screens to use
            setResolvedShopId(foundShopId);

            if (foundShopId) {
              console.log('[auth-route]', routingReason, { uid, shopId: foundShopId });
              setActiveScreen(null); // Go to Dashboard
            } else {
              routingReason = routingReason === 'unknown' ? 'no_shop_found_go_register' : routingReason;
              console.log('[auth-route]', routingReason, { uid });
              setActiveScreen('REGISTER_SHOP');
            }
          } catch (e) {
            console.error("Error during auth resolution:", e);
            setActiveScreen('REGISTER_SHOP');
          }
        } else {
          setResolvedShopId(null);
          setActiveScreen('LOGIN');
        }
        if (initializing) setInitializing(false);
      });
      return subscriber;
    } catch (e) {
      console.warn("Firebase not available in this environment", e);
      if (initializing) setInitializing(false);
    }
  }, []);

  const bootstrapReady = !initializing && onboardingDone !== null && fontsLoaded;

  React.useEffect(() => {
    if (!bootstrapReady) return;
    const elapsed = Date.now() - launchStartedAt.current;
    const waitMs = Math.max(0, MIN_SPLASH_MS - elapsed);
    const id = setTimeout(() => {
      void SplashScreen.hideAsync();
    }, waitMs);
    return () => clearTimeout(id);
  }, [bootstrapReady]);

  // Register push notifications when user is logged in
  usePushNotifications(user ? (data: any) => {
    // Navigate to order details if notification contains orderId
    if (data?.orderId) {
      setActiveScreen(`ORDER_DETAILS_${data.orderId}`);
    }
  } : undefined);

  // ─── App Update Checker ─────────────────────────────────────────
  const updateInfo = useAppUpdateChecker();
  const [updateDismissed, setUpdateDismissed] = useState(false);

  // ─── Subscription & Plan Limits (for order blocking) ────────────
  const [appSubData, setAppSubData] = React.useState<any>(null);
  const { getShopId: getShopIdFn } = require('./src/lib/auth');
  const { firestore: firestoreFn } = require('./src/lib/db');
  const currentShopId = getShopIdFn();
  const appOrdersUsed = useMergedOrdersUsed(appSubData, currentShopId);
  const appPlanLimits = usePlanLimits(appSubData);

  React.useEffect(() => {
    if (!currentShopId) return;
    const unsub = firestoreFn()
      .collection('subscriptions')
      .doc(currentShopId)
      .onSnapshot((snap: any) => {
        if (snap.exists) setAppSubData(snap.data());
      }, () => {});
    return unsub;
  }, [currentShopId]);

  const planKey = (appSubData?.planId || appSubData?.planName || 'free').toString().toLowerCase();
  const isPaidPlan = ['active'].includes(appSubData?.status) && !['free', 'trial'].includes(planKey);
  const orderLimitReached = !isPaidPlan && appPlanLimits.maxOrders > 0 && appOrdersUsed >= appPlanLimits.maxOrders;

  /** Native splash stays up until bootstrapReady; avoid painting login/dashboard underneath early */
  if (!bootstrapReady) return null;

  const openCreateOrder = () => {
    if (orderLimitReached) {
      Alert.alert(
        t('mobile.orderLimitTitle'),
        t('mobile.orderLimitMessage', { limit: appPlanLimits.maxOrders }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('mobile.upgradePlan'), onPress: () => setActiveScreen('SUBSCRIPTION') },
        ]
      );
      return;
    }
    setEditingOrder(null);
    setOrderInProgress(true);
    setActiveScreen('CREATE_ORDER');
  };

  const openEditOrder = (order: any) => {
    setEditingOrder(order);
    setOrderInProgress(true);
    setActiveScreen('CREATE_ORDER');
  };

  const renderScreen = () => {
    switch (activeTab) {
      case 'HOME':
        return <HomeScreen
                 onNewOrder={openCreateOrder}
                 onScanQR={() => setActiveScreen('SCAN_QR')}
                 onExpense={() => setActiveScreen('EXPENSE_LIST')}
                 onAttendance={() => setActiveScreen('ATTENDANCE')}
                 onDueOrders={() => { setOrdersInitialFilter('due'); setActiveTab('ORDERS'); }}
                 onViewOrders={() => { setOrdersInitialFilter(undefined); setActiveTab('ORDERS'); }}
                 onSearchOrders={() => { setOrdersInitialFilter(undefined); setOrdersOpenSearch(true); setActiveTab('ORDERS'); }}
                 onViewOrder={(id: string) => setActiveScreen(`ORDER_DETAILS_${id}`)}
                 onOpenSubscription={() => setActiveScreen('SUBSCRIPTION')}
               />;
      case 'ORDERS':
        return <OrdersScreen
                 onNewOrder={openCreateOrder}
                 onViewOrder={(id: string) => setActiveScreen(`ORDER_DETAILS_${id}`)}
                 onBack={() => setActiveTab('HOME')}
                 initialFilter={ordersInitialFilter}
                 initialSearchOpen={ordersOpenSearch}
                 onSearchConsumed={() => setOrdersOpenSearch(false)}
               />;
      case 'EXPENSES':
        return <ExpensesScreen
                 onStaffAttendance={() => setActiveScreen('ATTENDANCE')}
                 onStaffList={() => setActiveScreen('STAFF_LIST')}
               />;
      case 'CUSTOMERS':
        return <CustomerListScreen
                 onViewCustomer={(id: string) => setActiveScreen(`CUSTOMER_DETAILS_${id}`)}
                 onAddCustomer={() => setActiveScreen('ADD_CUSTOMER')}
               />;
      case 'SETTINGS':
        return <SettingsScreen
                 onManageServices={() => setActiveScreen('ADD_SERVICE')}
                 onManageItems={() => setActiveScreen('ADD_SERVICE')}
                 onEditProfile={() => setActiveScreen('EDIT_SHOP')}
                 onOpenSubscription={() => setActiveScreen('SUBSCRIPTION')}
                 onStaffList={() => setActiveScreen('STAFF_LIST')}
                 onAttendance={() => setActiveScreen('ATTENDANCE')}
                 onCreateStaffLogin={() => setActiveScreen('CREATE_STAFF_LOGIN')}
                 onExpenseList={() => setActiveScreen('EXPENSE_LIST')}
               />;
      default:
        return <HomeScreen
                 onNewOrder={openCreateOrder}
                 onScanQR={() => setActiveScreen('SCAN_QR')}
                 onExpense={() => setActiveTab('EXPENSES')}
                 onDueOrders={() => { setOrdersInitialFilter('due'); setActiveTab('ORDERS'); }}
                 onViewOrders={() => { setOrdersInitialFilter(undefined); setActiveTab('ORDERS'); }}
                 onViewOrder={(id: string) => setActiveScreen(`ORDER_DETAILS_${id}`)}
                 onOpenSubscription={() => setActiveScreen('SUBSCRIPTION')}
               />;
    }
  };

  if (!user && onboardingDone === false) {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <OnboardingScreen
          onDone={async () => {
            await AsyncStorage.setItem(ONBOARDING_DONE_KEY, '1');
            setOnboardingDone(true);
            setActiveScreen('LOGIN');
          }}
        />
      </View>
    );
  }

  if (activeScreen === 'LOGIN') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <LoginScreen 
          onEmailSignIn={() => {}}
          onOpenCreateAccount={() => setActiveScreen('CREATE_ACCOUNT')}
        />
      </View>
    );
  }

  if (activeScreen === 'CREATE_ACCOUNT') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <CreateAccountScreen
          onBack={() => setActiveScreen('LOGIN')}
          onCreate={async ({ email, password }) => {
            try {
              const pending = { email };
              pendingRegistrationRef.current = pending;
              setPendingRegistration(pending);
              forceSetupFlowRef.current = true;
              setForceSetupFlow(true);
              await AsyncStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify(pending));
              const { registerWithEmailPassword } = require('./src/lib/auth');
              const cred = await registerWithEmailPassword(email, password);
              const createdUid = cred?.user?.uid;
              if (createdUid) {
                await AsyncStorage.setItem(FORCE_SETUP_UID_KEY, createdUid);
              }
              const { setResolvedShopId } = require('./src/lib/auth');
              setResolvedShopId(null);
              setActiveScreen('REGISTER_SHOP');
            } catch (error: any) {
              console.error('Create account error', error);
              alert(error?.message || 'Failed to create account');
            }
          }}
        />
      </View>
    );
  }

  if (activeScreen === 'REGISTER_SHOP') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
        <RegisterShopScreen 
          onComplete={() => {
            setPendingRegistration(null);
            setForceSetupFlow(false);
            forceSetupFlowRef.current = false;
            void AsyncStorage.removeItem(PENDING_REGISTRATION_KEY);
            void AsyncStorage.removeItem(FORCE_SETUP_UID_KEY);
            setActiveScreen(null);
          }} 
          initialPhone=""
          initialName=""
          initialEmail={pendingRegistration?.email || ''}
        />
      </View>
    );
  }

  if (activeScreen === 'EDIT_SHOP') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
        <RegisterShopScreen
          onComplete={() => setActiveScreen(null)}
          onBack={() => setActiveScreen(null)}
          isEditMode={true}
        />
      </View>
    );
  }

  if (activeScreen === 'SUBSCRIPTION') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <SubscriptionScreen onBack={() => setActiveScreen(null)} />
      </View>
    );
  }

  // CREATE_ORDER / ORDER_REVIEW now rendered as overlay in the main return below
  // so the component stays mounted when user switches tabs

  if (activeScreen === 'ADD_SERVICE') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
        <AddServiceScreen
          onBack={() => setActiveScreen(null)}
          onSave={() => setActiveScreen(null)}
          onViewItems={(categoryId: string, categoryName: string) =>
            setActiveScreen(`SERVICE_ITEMS|${categoryId}|${categoryName}`)
          }
        />
      </View>
    );
  }

  if (activeScreen?.startsWith('SERVICE_ITEMS|')) {
    const parts = activeScreen.split('|');
    const categoryId = parts[1] || '';
    const categoryName = parts[2] || '';
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
        <ServiceItemsScreen
          onBack={() => setActiveScreen('ADD_SERVICE')}
          categoryId={categoryId}
          categoryName={categoryName}
        />
      </View>
    );
  }

  if (activeScreen === 'STAFF_LIST') {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
        <StaffListScreen
          onBack={() => setActiveScreen(null)}
          onViewStaff={(id: string) => setActiveScreen(`STAFF_DETAIL_${id}`)}
          onAddStaff={() => {/* TODO: CreateStaffScreen */}}
        />
      </View>
    );
  }

  if (activeScreen?.startsWith('STAFF_DETAIL_')) {
    const sid = activeScreen.replace('STAFF_DETAIL_', '');
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
        <StaffDetailScreen
          onBack={() => setActiveScreen('STAFF_LIST')}
          staffId={sid}
        />
      </View>
    );
  }

  if (activeScreen === 'EXPENSE_LIST') {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
        <ExpenseListScreen onBack={() => setActiveScreen(null)} />
      </View>
    );
  }

  if (activeScreen === 'CREATE_STAFF_LOGIN') {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
        <CreateStaffLoginScreen onBack={() => setActiveScreen('STAFF_LIST')} />
      </View>
    );
  }

  if (activeScreen === 'ATTENDANCE') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
        <AttendanceScreen
          onBack={() => setActiveScreen(null)}
          onAddStaff={() => setActiveScreen('STAFF_LIST')}
        />
      </View>
    );
  }

  if (activeScreen === 'SCAN_QR') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <ScanScreen
          onBack={() => setActiveScreen(null)}
          onScanOrder={(orderId: string) => setActiveScreen(`ORDER_DETAILS_${orderId}`)}
        />
      </View>
    );
  }

  if (activeScreen?.startsWith('ORDER_DETAILS_')) {
    const orderId = activeScreen.replace('ORDER_DETAILS_', '');
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <OrderDetailsScreen
          onBack={() => {
            setActiveScreen(null);
            setActiveTab('ORDERS');
          }}
          orderId={orderId}
          onEditOrder={openEditOrder}
        />
      </View>
    );
  }

  if (activeScreen === 'ADD_CUSTOMER') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <AddCustomerScreen
          onBack={() => setActiveScreen(null)}
          onCreated={(id: string) => setActiveScreen(`CUSTOMER_DETAILS_${id}`)}
        />
      </View>
    );
  }

  // Add Customer from Create Order — goes back to CREATE_ORDER when done
  if (activeScreen === 'ADD_CUSTOMER_FROM_ORDER') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <AddCustomerScreen
          onBack={() => setActiveScreen('CREATE_ORDER')}
          onCreated={() => setActiveScreen('CREATE_ORDER')}
        />
      </View>
    );
  }

  // Edit Customer from Create Order — goes back to CREATE_ORDER when done
  if (activeScreen?.startsWith('EDIT_CUSTOMER_FROM_ORDER_')) {
    const customerId = activeScreen.replace('EDIT_CUSTOMER_FROM_ORDER_', '');
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <CustomerDetailScreen
          onBack={() => setActiveScreen('CREATE_ORDER')}
          customerId={customerId}
          onViewOrder={(id: string) => setActiveScreen(`ORDER_DETAILS_${id}`)}
        />
      </View>
    );
  }

  if (activeScreen?.startsWith('CUSTOMER_DETAILS_')) {
    const customerId = activeScreen.replace('CUSTOMER_DETAILS_', '');
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <CustomerDetailScreen
          onBack={() => setActiveScreen(null)}
          customerId={customerId}
          onViewOrder={(id: string) => setActiveScreen(`ORDER_DETAILS_${id}`)}
        />
      </View>
    );
  }

  const isOrderScreenActive = activeScreen === 'CREATE_ORDER' || activeScreen === 'ORDER_REVIEW' || activeScreen === 'ORDER_SUCCESS';

  return (
    <View style={[styles.safeArea, { paddingTop: isOrderScreenActive ? 0 : insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      {/* Dynamic Screen Content */}
      <View style={styles.content}>
        {renderScreen()}
      </View>

      {/* BottomNavBar — hidden when order screen is active */}
      {!isOrderScreenActive && (
        <View style={[styles.bottomNav, { paddingBottom: 4 + insets.bottom }]}>
          {/* 1. Home */}
          <TouchableOpacity
            style={activeTab === 'HOME' ? styles.navItemActive : styles.navItem}
            onPress={() => setActiveTab('HOME')}
          >
            <MaterialIcons name="home" size={22} color={activeTab === 'HOME' ? colors.navActive : colors.navInactive} />
            <Text style={activeTab === 'HOME' ? styles.navItemTextActive : styles.navItemText}>Home</Text>
          </TouchableOpacity>

          {/* 2. Orders */}
          <TouchableOpacity
            style={activeTab === 'ORDERS' ? styles.navItemActive : styles.navItem}
            onPress={() => { setOrdersInitialFilter(undefined); setActiveTab('ORDERS'); }}
          >
            <MaterialIcons name="receipt-long" size={22} color={activeTab === 'ORDERS' ? colors.navActive : colors.navInactive} />
            <Text style={activeTab === 'ORDERS' ? styles.navItemTextActive : styles.navItemText}>Orders</Text>
          </TouchableOpacity>

          {/* 3. Customers */}
          <TouchableOpacity
            style={activeTab === 'CUSTOMERS' ? styles.navItemActive : styles.navItem}
            onPress={() => setActiveTab('CUSTOMERS')}
          >
            <MaterialIcons name="people" size={22} color={activeTab === 'CUSTOMERS' ? colors.navActive : colors.navInactive} />
            <Text style={activeTab === 'CUSTOMERS' ? styles.navItemTextActive : styles.navItemText}>Customers</Text>
          </TouchableOpacity>

          {/* 4. Finances */}
          <TouchableOpacity
            style={activeTab === 'EXPENSES' ? styles.navItemActive : styles.navItem}
            onPress={() => setActiveTab('EXPENSES')}
          >
            <MaterialIcons name="account-balance-wallet" size={22} color={activeTab === 'EXPENSES' ? colors.navActive : colors.navInactive} />
            <Text style={activeTab === 'EXPENSES' ? styles.navItemTextActive : styles.navItemText}>Finances</Text>
          </TouchableOpacity>

          {/* 5. Settings */}
          <TouchableOpacity
            style={activeTab === 'SETTINGS' ? styles.navItemActive : styles.navItem}
            onPress={() => setActiveTab('SETTINGS')}
          >
            <MaterialIcons name="settings" size={22} color={activeTab === 'SETTINGS' ? colors.navActive : colors.navInactive} />
            <Text style={activeTab === 'SETTINGS' ? styles.navItemTextActive : styles.navItemText}>Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* App Update Modal */}
      {updateInfo?.updateAvailable && !updateDismissed && (
        <UpdateModal info={updateInfo} onDismiss={() => setUpdateDismissed(true)} />
      )}

      {/* CreateOrderScreen overlay — stays mounted while order is in progress */}
      {orderInProgress && (
        <View style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.surface },
          !isOrderScreenActive && { opacity: 0, pointerEvents: 'none' as const },
        ]}>
          <CreateOrderScreen
            ref={createOrderRef}
            onBack={() => { setEditingOrder(null); setActiveScreen(null); }}
            onReviewOrder={(draft) => {
              setOrderDraft(draft);
              setActiveScreen('ORDER_REVIEW');
            }}
            editOrder={editingOrder}
            onAddCustomer={() => setActiveScreen('ADD_CUSTOMER_FROM_ORDER')}
            onEditCustomerDetail={(id) => setActiveScreen(`EDIT_CUSTOMER_FROM_ORDER_${id}`)}
          />
          {activeScreen === 'ORDER_REVIEW' && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background }}>
              <OrderReviewScreen
                onBack={() => setActiveScreen('CREATE_ORDER')}
                draftOrder={orderDraft}
                editOrderId={editingOrder?.id || null}
                editOrder={editingOrder}
                onEditCustomer={() => {
                  createOrderRef.current?.goToCustomerStep();
                  setActiveScreen('CREATE_ORDER');
                }}
                onPlaceOrder={(order: any) => {
                  setPlacedOrder(order);
                  setEditingOrder(null);
                  setActiveScreen('ORDER_SUCCESS');
                }}
              />
            </View>
          )}
          {activeScreen === 'ORDER_SUCCESS' && placedOrder && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background }}>
              <OrderSuccessScreen
                order={placedOrder}
                onViewOrder={() => {
                  const oid = placedOrder.id;
                  setOrderInProgress(false);
                  setPlacedOrder(null);
                  setActiveScreen(`ORDER_DETAILS_${oid}`);
                }}
                onDone={() => {
                  setOrderInProgress(false);
                  setPlacedOrder(null);
                  setActiveScreen(null);
                  setActiveTab('HOME');
                }}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 56,
  },
  navItemActive: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 56,
  },
  navItemText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.navInactive,
  },
  navItemTextActive: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.navActive,
  },
});
