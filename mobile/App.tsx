import React, { useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n, { initStoredLanguage, setAppLanguageFromDisplayName } from './src/lib/i18n';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import OtpVerificationScreen from './src/screens/OtpVerificationScreen';
import RegisterShopScreen from './src/screens/RegisterShopScreen';
import ScanScreen from './src/screens/ScanScreen';
import AddCustomerScreen from './src/screens/AddCustomerScreen';
import ExpensesScreen from './src/screens/ExpensesScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import { DraftOrderPayload } from './src/types/orderDraft';

const ONBOARDING_DONE_KEY = 'onboarding_completed_v1';

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
  const [activeTab, setActiveTab] = useState('HOME');
  const [activeScreen, setActiveScreen] = useState<string | null>('LOGIN'); // Start with auth flow
  const [orderDraft, setOrderDraft] = useState<DraftOrderPayload | null>(null);
  const [userPhone, setUserPhone] = useState<string>('');
  const [orderInProgress, setOrderInProgress] = useState(false); // keeps CreateOrderScreen mounted across tabs
  const [ordersInitialFilter, setOrdersInitialFilter] = useState<string | undefined>(undefined);
  const [placedOrder, setPlacedOrder] = useState<any>(null); // holds the order after placement for success screen
  const [editingOrder, setEditingOrder] = useState<any>(null); // order being edited
  const createOrderRef = useRef<CreateOrderScreenRef>(null);
  
  // Firebase Auth State
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null); // from @react-native-firebase/auth
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  // Keep a ref so the auth handler can access the latest phone entered
  const userPhoneRef = React.useRef(userPhone);
  React.useEffect(() => { userPhoneRef.current = userPhone; }, [userPhone]);

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
    try {
      const { auth, setResolvedShopId } = require('./src/lib/auth');
      const { firestore } = require('./src/lib/db');

      const subscriber = auth().onAuthStateChanged(async (currentUser: any) => {
        setUser(currentUser);
        if (currentUser) {
          try {
            const uid = currentUser.uid;
            let foundShopId: string | null = null;

            // 1. Check users/{uid} — may already have shopId from web app or previous login
            const userDoc = await firestore().collection('users').doc(uid).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              if (userData?.shopId) {
                // Verify the shop still exists
                const shopCheck = await firestore().collection('shops').doc(userData.shopId).get();
                if (shopCheck.exists) {
                  foundShopId = userData.shopId;
                }
              }
            }

            // 2. Check if this user IS the shop owner directly (shops/{uid})
            if (!foundShopId) {
              const shopDoc = await firestore().collection('shops').doc(uid).get();
              if (shopDoc.exists) {
                foundShopId = uid;
              }
            }

            // 3. Cross-provider match: search shops by phone number
            //    (handles: user registered on web with email, now logging in with same phone on mobile)
            if (!foundShopId) {
              const phone = currentUser.phoneNumber || userPhoneRef.current;
              if (phone) {
                const digits = phone.replace(/\D/g, '').slice(-10);
                if (digits.length === 10) {
                  const withPrefix = `+91${digits}`;
                  // Try +91 format first, then raw digits
                  let snap = await firestore().collection('shops').where('phone', '==', withPrefix).limit(1).get();
                  if (snap.empty) {
                    snap = await firestore().collection('shops').where('phone', '==', digits).limit(1).get();
                  }
                  if (!snap.empty) {
                    foundShopId = snap.docs[0].id;
                    const shopData = snap.docs[0].data();
                    // Link this auth identity to the existing shop (like web app does)
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
            }

            // Store resolved shopId for all screens to use
            setResolvedShopId(foundShopId);

            if (foundShopId) {
              setActiveScreen(null); // Go to Dashboard
            } else {
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

  const bootstrapReady = !initializing && onboardingDone !== null;

  React.useEffect(() => {
    if (!bootstrapReady) return;
    const elapsed = Date.now() - launchStartedAt.current;
    const waitMs = Math.max(0, MIN_SPLASH_MS - elapsed);
    const id = setTimeout(() => {
      void SplashScreen.hideAsync();
    }, waitMs);
    return () => clearTimeout(id);
  }, [bootstrapReady]);

  /** Native splash stays up until bootstrapReady; avoid painting login/dashboard underneath early */
  if (!bootstrapReady) return null;

  const openCreateOrder = () => {
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
                 onExpense={() => setActiveTab('EXPENSES')}
                 onDueOrders={() => { setOrdersInitialFilter('due'); setActiveTab('ORDERS'); }}
                 onViewOrders={() => { setOrdersInitialFilter(undefined); setActiveTab('ORDERS'); }}
                 onViewOrder={(id: string) => setActiveScreen(`ORDER_DETAILS_${id}`)}
                 onOpenSubscription={() => setActiveScreen('SUBSCRIPTION')}
               />;
      case 'ORDERS':
        return <OrdersScreen
                 onNewOrder={openCreateOrder}
                 onViewOrder={(id: string) => setActiveScreen(`ORDER_DETAILS_${id}`)}
                 initialFilter={ordersInitialFilter}
               />;
      case 'EXPENSES':
        return <ExpensesScreen />;
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
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fb" />
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
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fb" />
        <LoginScreen 
          onGetOtp={async (phone: string) => {
            setUserPhone(phone);
            try {
              const { sendMsg91Otp } = require('./src/lib/auth');
              await sendMsg91Otp(phone);
              setActiveScreen('OTP_VERIFICATION');
            } catch (error) {
              console.error(error);
              alert(t('mobile.failedToSendOtp'));
            }
          }} 
        />
      </View>
    );
  }

  if (activeScreen === 'OTP_VERIFICATION') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fb" />
        <OtpVerificationScreen 
          phoneNumber={userPhone || '98765 43210'}
          onBack={() => setActiveScreen('LOGIN')}
          onVerify={async (otp) => {
            try {
              const { verifyMsg91Otp } = require('./src/lib/auth');
              await verifyMsg91Otp(userPhone, otp);
              // onAuthStateChanged in the useEffect handles the redirect automatically
            } catch (error: any) {
              console.error('Invalid OTP', error);
              alert(error.message || t('mobile.invalidOtpMsg'));
            }
          }} 
        />
      </View>
    );
  }

  if (activeScreen === 'REGISTER_SHOP') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <RegisterShopScreen 
          onComplete={() => setActiveScreen(null)} 
          initialPhone={userPhone}
        />
      </View>
    );
  }

  if (activeScreen === 'EDIT_SHOP') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
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
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fb" />
        <SubscriptionScreen onBack={() => setActiveScreen(null)} />
      </View>
    );
  }

  // CREATE_ORDER / ORDER_REVIEW now rendered as overlay in the main return below
  // so the component stays mounted when user switches tabs

  if (activeScreen === 'ADD_SERVICE') {
    return (
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
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
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ServiceItemsScreen
          onBack={() => setActiveScreen('ADD_SERVICE')}
          categoryId={categoryId}
          categoryName={categoryName}
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
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fb" />
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
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fb" />
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
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fb" />
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
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fb" />
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
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fb" />
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
      <StatusBar barStyle="dark-content" backgroundColor={activeScreen === 'ORDER_REVIEW' || activeScreen === 'ORDER_SUCCESS' ? '#f8f9fb' : isOrderScreenActive ? '#ffffff' : '#f8f9fb'} />

      {/* Dynamic Screen Content */}
      <View style={styles.content}>
        {renderScreen()}
      </View>

      {/* BottomNavBar — hidden when order screen is active */}
      {!isOrderScreenActive && (
        <View style={[styles.bottomNav, { paddingBottom: 4 + insets.bottom }]}>
          <TouchableOpacity
            style={activeTab === 'HOME' ? styles.navItemActive : styles.navItem}
            onPress={() => setActiveTab('HOME')}
          >
            <MaterialIcons name="home" size={20} color={activeTab === 'HOME' ? "#006f63" : "#94a3b8"} />
            <Text style={activeTab === 'HOME' ? styles.navItemTextActive : styles.navItemText}>{t('common.home')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={activeTab === 'ORDERS' ? styles.navItemActive : styles.navItem}
            onPress={() => { setOrdersInitialFilter(undefined); setActiveTab('ORDERS'); }}
          >
            <MaterialIcons name="receipt-long" size={20} color={activeTab === 'ORDERS' ? "#006f63" : "#94a3b8"} />
            <Text style={activeTab === 'ORDERS' ? styles.navItemTextActive : styles.navItemText}>{t('common.orders')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={activeTab === 'EXPENSES' ? styles.navItemActive : styles.navItem}
            onPress={() => setActiveTab('EXPENSES')}
          >
            <MaterialIcons name="payments" size={20} color={activeTab === 'EXPENSES' ? "#006f63" : "#94a3b8"} />
            <Text style={activeTab === 'EXPENSES' ? styles.navItemTextActive : styles.navItemText}>{t('mobile.tabFinance')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={activeTab === 'CUSTOMERS' ? styles.navItemActive : styles.navItem}
            onPress={() => setActiveTab('CUSTOMERS')}
          >
            <MaterialIcons name="groups" size={20} color={activeTab === 'CUSTOMERS' ? "#006f63" : "#94a3b8"} />
            <Text style={activeTab === 'CUSTOMERS' ? styles.navItemTextActive : styles.navItemText}>{t('mobile.tabClients')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={activeTab === 'SETTINGS' ? styles.navItemActive : styles.navItem}
            onPress={() => setActiveTab('SETTINGS')}
          >
            <MaterialIcons name="settings" size={20} color={activeTab === 'SETTINGS' ? "#006f63" : "#94a3b8"} />
            <Text style={activeTab === 'SETTINGS' ? styles.navItemTextActive : styles.navItemText}>{t('common.settings')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CreateOrderScreen overlay — stays mounted while order is in progress */}
      {orderInProgress && (
        <View style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#ffffff' },
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
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f8f9fb' }}>
              <OrderReviewScreen
                onBack={() => setActiveScreen('CREATE_ORDER')}
                draftOrder={orderDraft}
                editOrderId={editingOrder?.id || null}
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
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f8f9fb' }}>
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
    backgroundColor: '#f8f9fb',
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.97)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  navItemActive: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#e0faf5',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 16,
  },
  navItemText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94a3b8',
  },
  navItemTextActive: {
    fontSize: 9,
    fontWeight: '700',
    color: '#006f63',
  },
});
