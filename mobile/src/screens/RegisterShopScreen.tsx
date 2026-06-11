import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Pressable, Image, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, radii, shadows, spacing } from '../theme';
import { HelpButton } from '../components/HelpButton';
let Location: typeof import('expo-location') | null = null;
try { Location = require('expo-location'); } catch {}
import { firestore } from '../lib/db';
import { auth, getShopId, setResolvedShopId } from '../lib/auth';
import { COUNTRIES, getCountry, getCountryCodeFromPhone } from '../lib/country-config';
import { normalizePhoneForCountry, toE164 } from '../lib/currency-format';
const R2_WORKER_URL = process.env.EXPO_PUBLIC_R2_WORKER_URL || 'https://laundryboss-r2.gudupuramesh.workers.dev';
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h24 = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12.toString().padStart(2, '0')}:${m} ${ampm}`;
});

async function uploadImageToR2(shopId: string, uri: string, fileName: string): Promise<{ key: string; publicUrl: string }> {
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: fileName,
    type: 'image/jpeg',
  } as any);
  formData.append('shopId', shopId);
  formData.append('folder', 'shop-logos');

  const res = await fetch(`${R2_WORKER_URL}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload logo');
  }
  const data = await res.json();
  return { key: data.key, publicUrl: data.publicUrl };
}

export default function RegisterShopScreen({
  onComplete,
  onBack,
  initialPhone,
  initialName,
  initialEmail,
  isEditMode = false,
}: {
  onComplete: () => void,
  onBack?: () => void,
  initialPhone?: string,
  initialName?: string,
  initialEmail?: string,
  isEditMode?: boolean
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const initialDetectedCountry = getCountryCodeFromPhone(initialPhone || auth().currentUser?.phoneNumber || '') || 'IN';
  const [countryCode, setCountryCode] = useState(initialDetectedCountry);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showOpenTimePicker, setShowOpenTimePicker] = useState(false);
  const [showCloseTimePicker, setShowCloseTimePicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const selectedCountry = getCountry(countryCode);
  const filteredCountries = COUNTRIES.filter((c) => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.phoneCode.toLowerCase().includes(q)
    );
  });
  const sanitizePhoneInput = (value: string, nextCountryCode: string) => {
    const cfg = getCountry(nextCountryCode);
    let digits = String(value || '').replace(/\D/g, '');
    // For India mobile numbers, avoid persisting "0xxxxxxxxx" local format.
    if (cfg.code === 'IN') digits = digits.replace(/^0+/, '');
    return digits.slice(0, cfg.phoneDigits);
  };
  
  const [formData, setFormData] = useState({
    name: initialName || '',
    email: initialEmail || auth().currentUser?.email || '',
    phone: sanitizePhoneInput(
      normalizePhoneForCountry(initialPhone || auth().currentUser?.phoneNumber || '', { countryCode: initialDetectedCountry }),
      initialDetectedCountry
    ),
    street: '',
    area: '',
    city: '',
    state: '',
    pincode: '',
    gstNumber: '',
    taxEnabled: true,
    taxRate: '18',
    openTime: '09:00 AM',
    closeTime: '09:00 PM',
    terms: isEditMode // auto check for edit mode
  });

  const [fetching, setFetching] = useState(true);
  const [logoUri, setLogoUri] = useState('');
  const [logoKey, setLogoKey] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  // Setup progress overlay (for new shops only)
  const SETUP_STEPS = [
    'Setting up shop profile...',
    'Configuring business preferences...',
    'Populating master services...',
    'Adding clothing items & pricing...',
    'Initializing staff directories...',
    'Deploying financial ledgers...',
  ];
  const [showSetupOverlay, setShowSetupOverlay] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [setupDone, setSetupDone] = useState(false);

  // Always check for existing shop/user data — handles web-registered users logging in on mobile
  useEffect(() => {
    const fetchExistingData = async () => {
      try {
        const user = auth().currentUser;
        const uid = user?.uid || '';
        const authEmail = user?.email || '';
        const shopId = getShopId() || uid;

        // 1. Check if shop already exists (web-registered user or edit mode)
        const shopDoc = await firestore().collection('shops').doc(shopId).get();
        if (shopDoc.exists) {
          const data = (shopDoc.data() ?? {}) as any;
          const shopSettings = (data.settings ?? {}) as any;
          setFormData({
            name: data.name || '',
            email: data.email || authEmail || initialEmail || '',
            phone: sanitizePhoneInput(
              normalizePhoneForCountry(data.phone || initialPhone || auth().currentUser?.phoneNumber || '', { countryCode: shopSettings.countryCode || 'IN' }),
              shopSettings.countryCode || 'IN'
            ),
            street: data.location?.address || '',
            area: data.location?.area || '',
            city: data.location?.city || '',
            state: data.location?.state || '',
            pincode: data.location?.pincode || '',
            gstNumber: data.gstNumber || '',
            taxEnabled: shopSettings.tax?.enabled !== false,
            taxRate: String(shopSettings.tax?.rate ?? '18'),
            openTime: data.businessHours?.openTime || '09:00 AM',
            closeTime: data.businessHours?.closeTime || '09:00 PM',
            terms: isEditMode,
          });
          setLogoUri(data.logoUrl || '');
          setLogoKey(data.logoKey || '');
          setCountryCode(shopSettings.countryCode || 'IN');
          if (data.location?.lat && data.location?.lng) {
            setGpsCoords({ lat: data.location.lat, lng: data.location.lng });
          }
        } else {
          // 2. No shop yet — check users collection for any existing profile info (email, phone)
          const userDoc = await firestore().collection('users').doc(uid).get();
          if (userDoc.exists) {
            const userData = (userDoc.data() ?? {}) as any;
            setFormData(prev => ({
              ...prev,
              email: userData.email || authEmail || initialEmail || prev.email,
              phone: sanitizePhoneInput(
                normalizePhoneForCountry(userData.phone || initialPhone || auth().currentUser?.phoneNumber || prev.phone, { countryCode }),
                countryCode
              ),
            }));
          } else {
            setFormData(prev => ({
              ...prev,
              email: authEmail || initialEmail || prev.email,
            }));
          }
          // Otherwise keep form clean/empty for brand new users
        }
      } catch (e) {
        console.error("Error fetching existing data:", e);
      } finally {
        setFetching(false);
      }
    };
    fetchExistingData();
  }, []);

  const handleChange = (key: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handlePickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setLogoUri(result.assets[0].uri);
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to select image');
    }
  };

  const handleGetLocation = async () => {
    try {
      if (!Location) {
        Alert.alert('Location Unavailable', 'Location services are not available in this build. Please enter the address manually.');
        return;
      }
      setFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed to auto-fill your shop address. You can enter the address manually instead.');
        setFetchingLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      setGpsCoords({ lat: latitude, lng: longitude });

      // Try reverse geocoding to auto-fill address fields
      try {
        const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo) {
          setFormData(prev => ({
            ...prev,
            street: geo.street || geo.name || prev.street,
            area: geo.district || geo.subregion || prev.area,
            city: geo.city || prev.city,
            state: geo.region || prev.state,
            pincode: geo.postalCode || prev.pincode,
          }));
        }
      } catch {
        // Reverse geocode failed — coordinates still saved, user fills address manually
      }
    } catch (e: any) {
      Alert.alert('Location Error', e?.message || 'Could not get your current location. Please enter the address manually.');
    } finally {
      setFetchingLocation(false);
    }
  };

  // Seed default categories + items for new shops
  // Tries platform catalog (platformSettings/defaultCatalog) first, then hardcoded defaults
  const seedDefaultInventory = async (shopId: string) => {
    const DEFAULT_CATEGORIES = [
      { id: "iron", name: "Iron Only", icon: "wind", order: 1, turnaroundDays: 1 },
      { id: "wash", name: "Wash & Fold", icon: "droplets", order: 2, turnaroundDays: 2 },
      { id: "washiron", name: "Wash & Iron", icon: "sparkles", order: 3, turnaroundDays: 3 },
      { id: "dryclean", name: "Dry Cleaning", icon: "shirt", order: 4, turnaroundDays: 4 },
      { id: "household", name: "Household", icon: "home", order: 5, turnaroundDays: 3 },
      { id: "shoes", name: "Shoe Cleaning", icon: "footprints", order: 6, turnaroundDays: 3 },
      { id: "premium", name: "Premium Care", icon: "star", order: 7, turnaroundDays: 5 },
    ];

    const DEFAULT_ITEMS = [
      { categoryId: "iron", categoryName: "Iron Only", subCategory: "Men's Wear", name: "Shirt", basePrice: 15, pricingType: "piece", turnaroundDays: 1, order: 101 },
      { categoryId: "iron", categoryName: "Iron Only", subCategory: "Men's Wear", name: "T-Shirt", basePrice: 12, pricingType: "piece", turnaroundDays: 1, order: 102 },
      { categoryId: "iron", categoryName: "Iron Only", subCategory: "Men's Wear", name: "Kurta", basePrice: 20, pricingType: "piece", turnaroundDays: 1, order: 103 },
      { categoryId: "iron", categoryName: "Iron Only", subCategory: "Men's Wear", name: "Trouser", basePrice: 18, pricingType: "piece", turnaroundDays: 1, order: 104 },
      { categoryId: "iron", categoryName: "Iron Only", subCategory: "Men's Wear", name: "Jeans", basePrice: 20, pricingType: "piece", turnaroundDays: 1, order: 105 },
      { categoryId: "iron", categoryName: "Iron Only", subCategory: "Women's Wear", name: "Top / Kurti", basePrice: 15, pricingType: "piece", turnaroundDays: 1, order: 107 },
      { categoryId: "iron", categoryName: "Iron Only", subCategory: "Women's Wear", name: "Saree (Cotton)", basePrice: 30, pricingType: "piece", turnaroundDays: 1, order: 113 },
      { categoryId: "iron", categoryName: "Iron Only", subCategory: "Women's Wear", name: "Saree (Silk)", basePrice: 50, pricingType: "piece", turnaroundDays: 1, order: 114 },
      { categoryId: "iron", categoryName: "Iron Only", subCategory: "Household", name: "Bedsheet (Single)", basePrice: 25, pricingType: "piece", turnaroundDays: 1, order: 116 },
      { categoryId: "iron", categoryName: "Iron Only", subCategory: "Household", name: "Bedsheet (Double)", basePrice: 35, pricingType: "piece", turnaroundDays: 1, order: 117 },
      { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Packages", name: "Regular Load (Per Kg)", basePrice: 49, pricingType: "kg", turnaroundDays: 2, order: 200 },
      { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Men's Wear", name: "Shirt", basePrice: 30, pricingType: "piece", turnaroundDays: 2, order: 202 },
      { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Men's Wear", name: "T-Shirt", basePrice: 25, pricingType: "piece", turnaroundDays: 2, order: 203 },
      { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Men's Wear", name: "Jeans", basePrice: 40, pricingType: "piece", turnaroundDays: 2, order: 204 },
      { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Household", name: "Towel (Bath)", basePrice: 30, pricingType: "piece", turnaroundDays: 2, order: 210 },
      { categoryId: "wash", categoryName: "Wash & Fold", subCategory: "Household", name: "Bedsheet (Single)", basePrice: 50, pricingType: "piece", turnaroundDays: 2, order: 211 },
      { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Packages", name: "Regular Load (Per Kg)", basePrice: 69, pricingType: "kg", turnaroundDays: 3, order: 300 },
      { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Men's Wear", name: "Shirt (Cotton)", basePrice: 40, pricingType: "piece", turnaroundDays: 3, order: 301 },
      { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Men's Wear", name: "Trouser/Jeans", basePrice: 50, pricingType: "piece", turnaroundDays: 3, order: 304 },
      { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Women's Wear", name: "Top/Kurti", basePrice: 40, pricingType: "piece", turnaroundDays: 3, order: 306 },
      { categoryId: "washiron", categoryName: "Wash & Iron", subCategory: "Women's Wear", name: "Saree (Cotton)", basePrice: 80, pricingType: "piece", turnaroundDays: 3, order: 309 },
      { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Men's Wear", name: "Suit (2 Piece)", basePrice: 250, pricingType: "piece", turnaroundDays: 4, order: 401 },
      { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Men's Wear", name: "Blazer/Jacket", basePrice: 150, pricingType: "piece", turnaroundDays: 4, order: 403 },
      { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Women's Wear", name: "Saree (Silk)", basePrice: 250, pricingType: "piece", turnaroundDays: 4, order: 407 },
      { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Women's Wear", name: "Lehenga (Bridal)", basePrice: 700, pricingType: "piece", turnaroundDays: 5, order: 409 },
      { categoryId: "dryclean", categoryName: "Dry Cleaning", subCategory: "Household", name: "Blanket (Double)", basePrice: 300, pricingType: "piece", turnaroundDays: 4, order: 414 },
      { categoryId: "household", categoryName: "Household", subCategory: "Bedding", name: "Blanket (Wash)", basePrice: 200, pricingType: "piece", turnaroundDays: 3, order: 501 },
      { categoryId: "household", categoryName: "Household", subCategory: "Curtains", name: "Curtains (Wash)", basePrice: 80, pricingType: "piece", turnaroundDays: 3, order: 503 },
      { categoryId: "household", categoryName: "Household", subCategory: "Carpets", name: "Carpet (Vacuum)", basePrice: 15, pricingType: "sqft", turnaroundDays: 3, order: 504 },
      { categoryId: "shoes", categoryName: "Shoe Cleaning", subCategory: "Men's Footwear", name: "Sports Shoes", basePrice: 200, pricingType: "piece", turnaroundDays: 3, order: 601 },
      { categoryId: "shoes", categoryName: "Shoe Cleaning", subCategory: "Men's Footwear", name: "Sneakers", basePrice: 250, pricingType: "piece", turnaroundDays: 3, order: 602 },
      { categoryId: "shoes", categoryName: "Shoe Cleaning", subCategory: "Men's Footwear", name: "Leather Shoes", basePrice: 300, pricingType: "piece", turnaroundDays: 3, order: 603 },
      { categoryId: "premium", categoryName: "Premium Care", subCategory: "Bags", name: "Designer Handbag", basePrice: 500, pricingType: "piece", turnaroundDays: 5, order: 701 },
      { categoryId: "premium", categoryName: "Premium Care", subCategory: "Travel", name: "Travel Bag/Suitcase", basePrice: 400, pricingType: "piece", turnaroundDays: 3, order: 703 },
      { categoryId: "premium", categoryName: "Premium Care", subCategory: "Kids", name: "Soft Toy Cleaning", basePrice: 100, pricingType: "piece", turnaroundDays: 3, order: 704 },
    ];

    // 1. Try loading platform defaults from SuperAdmin (includes images)
    let platformCategories: any[] = [];
    let platformItems: any[] = [];

    try {
      const catalogDoc = await firestore().collection('platformSettings').doc('defaultCatalog').get();
      if (catalogDoc.exists) {
        const data = catalogDoc.data();
        if (data?.categories?.length && data?.items?.length) {
          platformCategories = data.categories;
          platformItems = data.items;
        }
      }
    } catch (e) {
      console.warn('Could not fetch platform catalog, using hardcoded defaults');
    }

    const usePlatform = platformCategories.length > 0 && platformItems.length > 0;
    const cats = usePlatform ? platformCategories : DEFAULT_CATEGORIES;
    const items = usePlatform ? platformItems : DEFAULT_ITEMS;

    // 2. Write categories
    for (const cat of cats) {
      await firestore().collection(`shops/${shopId}/categories`).doc(cat.id).set({
        name: cat.name,
        icon: cat.icon,
        order: cat.order,
        turnaroundDays: cat.turnaroundDays,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // 3. Write items
    for (const item of items) {
      const itemData: Record<string, any> = {
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        subCategory: item.subCategory || '',
        name: item.name,
        basePrice: item.basePrice,
        pricingType: item.pricingType,
        turnaroundDays: item.turnaroundDays,
        order: item.order,
        expressMultiplier: 1.5,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      if (item.imageUrl) itemData.imageUrl = item.imageUrl;
      await firestore().collection(`shops/${shopId}/inventory`).add(itemData);
    }
  };

  const handleCreateShop = async () => {
    if (!formData.name || !formData.street || !formData.city || !formData.pincode) {
      alert(t('mobile.fillRequiredShop'));
      return;
    }
    if (!formData.terms) {
      alert(t('mobile.agreeTermsFirst'));
      return;
    }

    setLoading(true);
    try {
      const user = auth().currentUser;
      const uid = user?.uid || '';
      const resolvedEmail = (formData.email || user?.email || '').trim().toLowerCase();
      const currentShopId = getShopId() || uid;
      const saveId = isEditMode ? currentShopId : uid;
      if (!uid) {
        setLoading(false);
        alert(t('mobile.failedRegisterShop'));
        return;
      }

      // Duplicate email check
      if (resolvedEmail) {
        const emailSnap = await firestore().collection('shops').where('email', '==', resolvedEmail).limit(2).get();
        const otherShopWithEmail = emailSnap.docs?.find((d: any) => d.id !== currentShopId);
        if (otherShopWithEmail) {
          setLoading(false);
          alert(t('mobile.emailInUseOtherShop'));
          return;
        }
      }

      // Duplicate phone check
      if (formData.phone) {
        const rawDigits = normalizePhoneForCountry(formData.phone, { countryCode });
        const phoneVariants = [toE164(rawDigits, { countryCode }), rawDigits];
        for (const variant of phoneVariants) {
          const phoneSnap = await firestore().collection('shops').where('phone', '==', variant).limit(2).get();
          const otherShopWithPhone = phoneSnap.docs?.find((d: any) => d.id !== currentShopId);
          if (otherShopWithPhone) {
            setLoading(false);
            alert(t('mobile.phoneInUseOtherShop'));
            return;
          }
        }
      }

      let finalLogoUrl = logoUri || '';
      let finalLogoKey = logoKey || '';
      if (logoUri && logoUri.startsWith('file://')) {
        setUploadingLogo(true);
        const fileName = `shop-logo-${Date.now()}.jpg`;
        const uploaded = await uploadImageToR2(saveId, logoUri, fileName);
        finalLogoUrl = uploaded.publicUrl;
        finalLogoKey = uploaded.key;
        setLogoUri(uploaded.publicUrl);
        setLogoKey(uploaded.key);
        setUploadingLogo(false);
      }

      const shopData = {
        name: formData.name,
        email: resolvedEmail,
        phone: toE164(formData.phone, { countryCode }),
        logoUrl: finalLogoUrl || '',
        logoKey: finalLogoKey || '',
        ownerId: uid,
        location: {
          address: formData.street,
          area: formData.area,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          ...(gpsCoords ? { lat: gpsCoords.lat, lng: gpsCoords.lng } : {}),
        },
        gstNumber: formData.gstNumber,
        businessHours: {
          openTime: formData.openTime,
          closeTime: formData.closeTime
        },
        updatedAt: new Date(),
      };

      if (!isEditMode) {
        // New shop — write full settings object
        Object.assign(shopData, {
          settings: {
            countryCode: selectedCountry.code,
            currency: selectedCountry.currencyCode,
            currencySymbol: selectedCountry.currencySymbol,
            phoneCountryCode: selectedCountry.phoneCode,
            locale: selectedCountry.locale,
            timezone: selectedCountry.timezone,
            tax: { enabled: formData.taxEnabled, name: selectedCountry.taxName, rate: Number(formData.taxRate) || 0 },
            taxName: selectedCountry.taxName,
            orderPrefix: "A",
            nextOrderNumber: 1,
            adsEnabled: true,
            showSelfPromo: true,
            whatsappNotifications: true,
            smsNotifications: false,
          },
          createdAt: new Date(),
        });
      } else {
        // Edit mode — update country-related settings (merge, preserves orderPrefix, nextOrderNumber, etc.)
        Object.assign(shopData, {
          settings: {
            countryCode: selectedCountry.code,
            currency: selectedCountry.currencyCode,
            currencySymbol: selectedCountry.currencySymbol,
            phoneCountryCode: selectedCountry.phoneCode,
            locale: selectedCountry.locale,
            timezone: selectedCountry.timezone,
            taxName: selectedCountry.taxName,
            tax: { enabled: formData.taxEnabled, name: selectedCountry.taxName, rate: Number(formData.taxRate) || 0 },
          },
        });
      }

      // 1. Create or Update the shop document
      await firestore().collection('shops').doc(saveId).set(shopData, { merge: isEditMode });

      // 2. Create/Update user document with shopId link and admin role.
      // Retry once before failing to avoid rare transient write issues.
      const upsertUserMapping = async () => {
        await firestore().collection('users').doc(uid).set({
          email: resolvedEmail,
          phone: toE164(formData.phone, { countryCode }),
          shopId: saveId,
          shopName: formData.name,
          role: 'admin',
          createdAt: new Date(),
          updatedAt: new Date()
        }, { merge: true });
      };
      try {
        await upsertUserMapping();
      } catch (mapErr) {
        console.warn('User mapping write failed, retrying once:', mapErr);
        await upsertUserMapping();
      }

      // 3. Update resolved shopId so all screens use it immediately
      setResolvedShopId(saveId);

      // 4. Seed default inventory for NEW shops with animated progress overlay
      if (!isEditMode) {
        setShowSetupOverlay(true);
        setSetupStep(0);

        // Step 0: Setting up shop profile (already done above)
        await new Promise(r => setTimeout(r, 600));
        setSetupStep(1);

        // Step 1: Configuring business preferences
        await new Promise(r => setTimeout(r, 500));
        setSetupStep(2);

        // Step 2: Populating master services (categories)
        try {
          await seedDefaultInventory(saveId);
        } catch (seedErr) {
          console.warn('Default inventory seeding failed (non-fatal):', seedErr);
        }
        setSetupStep(3);

        // Step 3: Adding clothing items (already done inside seedDefaultInventory)
        await new Promise(r => setTimeout(r, 400));
        setSetupStep(4);

        // Step 4: Initializing staff directories
        // Create a default subscription doc for the free plan
        try {
          await firestore().collection('subscriptions').doc(saveId).set({
            planId: 'free',
            planName: 'Free',
            status: 'active',
            usage: { ordersThisMonth: 0, totalCustomers: 0, totalStaff: 0, totalServices: 0 },
            createdAt: new Date(),
          }, { merge: true });
        } catch {}
        await new Promise(r => setTimeout(r, 400));
        setSetupStep(5);

        // Step 5: Deploying financial ledgers
        await new Promise(r => setTimeout(r, 500));

        // Enable first-time tutorial auto-popups so the new user sees each page's video once
        try { await AsyncStorage.setItem('tutorials_autoshow_enabled', '1'); } catch {}

        // All done — show success
        setSetupDone(true);
        await new Promise(r => setTimeout(r, 1500));
        setShowSetupOverlay(false);
      }

      // Done! Redirect to dashboard.
      onComplete();

    } catch (e: any) {
      console.error('Failed to create shop:', e);
      alert(e.message || t('mobile.failedRegisterShop'));
    } finally {
      setUploadingLogo(false);
      setLoading(false);
    }
  };

  if (fetching) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top App Bar */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            {isEditMode && onBack && (
              <TouchableOpacity onPress={onBack} style={{ padding: 4, marginRight: 4 }}>
                <MaterialIcons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>{isEditMode ? t('mobile.editShopProfile') : t('mobile.registerShop')}</Text>
          </View>
          <HelpButton pageId="mobile_shopProfile" />
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <TouchableOpacity style={styles.logoPlaceholder} onPress={handlePickLogo} disabled={uploadingLogo}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.logoImage} />
              ) : (
                <MaterialIcons name="storefront" size={40} color={colors.textMuted} />
              )}
              <View style={styles.cameraIconBadge}>
                {uploadingLogo ? <ActivityIndicator size="small" color={colors.surface} /> : <MaterialIcons name="photo-camera" size={16} color={colors.surface} />}
              </View>
            </TouchableOpacity>
            <Text style={styles.logoText}>{t('mobile.uploadShopLogo')}</Text>
          </View>

          {/* Section 1: Shop Details */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('mobile.shopDetailsSection')}</Text>

            <Text style={styles.label}>{t('mobile.shopNameLabel')}</Text>
            <TextInput style={styles.input} placeholder="e.g. LaundryFlow Express" value={formData.name} onChangeText={(t) => handleChange('name', t)} />

            <Text style={styles.label}>{t('mobile.emailAddressLabel')}</Text>
            <TextInput style={styles.input} placeholder={t('mobile.phEmail')} keyboardType="email-address" autoCapitalize="none" value={formData.email} onChangeText={(t) => handleChange('email', t)} />

            <Text style={styles.label}>Country</Text>
            <TouchableOpacity style={styles.countrySelectBtn} onPress={() => setShowCountryPicker(true)}>
              <Text style={styles.countrySelectText} numberOfLines={1}>{selectedCountry.name} ({selectedCountry.phoneCode})</Text>
              <MaterialIcons name="expand-more" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <Text style={styles.label}>{t('mobile.mobileNumberLabel')}</Text>
            <View style={styles.phoneInputContainer}>
              <TouchableOpacity onPress={() => setShowCountryPicker(true)}>
                <Text style={styles.phonePrefix}>{selectedCountry.phoneCode}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.phoneInput}
                placeholder={`${selectedCountry.phoneDigits} digits`}
                keyboardType="phone-pad"
                value={formData.phone}
                maxLength={selectedCountry.phoneDigits}
                onChangeText={(t) => handleChange('phone', sanitizePhoneInput(t, countryCode))}
              />
            </View>

            {/* Auto-detected settings from country */}
            <View style={styles.autoDetectedRow}>
              <View style={styles.autoDetectedChip}>
                <MaterialIcons name="receipt" size={14} color={colors.primary} />
                <Text style={styles.autoDetectedText}>Tax: {selectedCountry.taxName}</Text>
              </View>
              <View style={styles.autoDetectedChip}>
                <MaterialIcons name="straighten" size={14} color={colors.primary} />
                <Text style={styles.autoDetectedText}>Weight: {selectedCountry.weightUnit}</Text>
              </View>
              <View style={styles.autoDetectedChip}>
                <MaterialIcons name="payments" size={14} color={colors.primary} />
                <Text style={styles.autoDetectedText}>{selectedCountry.currencySymbol} {selectedCountry.currencyCode}</Text>
              </View>
            </View>
          </View>

          {/* Section 2: Location */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('mobile.locationSection')}</Text>

            <Text style={styles.label}>{t('mobile.streetAddressLabel')}</Text>
            <TextInput style={styles.input} placeholder="e.g. Plot 42, Main Street" value={formData.street} onChangeText={(t) => handleChange('street', t)} />

            <View style={styles.row}>
              <View style={styles.flex1Box}>
                <Text style={styles.label}>{t('mobile.areaLocalityLabel')}</Text>
                <TextInput style={styles.input} placeholder="Area / Locality" value={formData.area} onChangeText={(t) => handleChange('area', t)} />
              </View>
              <View style={styles.flex1Box}>
                <Text style={styles.label}>{t('mobile.cityLabel')}</Text>
                <TextInput style={styles.input} placeholder="City" value={formData.city} onChangeText={(t) => handleChange('city', t)} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.flex1Box}>
                <Text style={styles.label}>{t('mobile.stateLabel')}</Text>
                <TextInput style={styles.input} placeholder="State" value={formData.state} onChangeText={(t) => handleChange('state', t)} />
              </View>
              <View style={styles.flex1Box}>
                <Text style={styles.label}>{t('mobile.pinCodeLabel')}</Text>
                <TextInput style={styles.input} placeholder="PIN / ZIP" keyboardType="number-pad" value={formData.pincode} onChangeText={(t) => handleChange('pincode', t)} />
              </View>
            </View>
          </View>

          {/* Section 3: Business & Tax */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>BUSINESS & TAX</Text>

            {/* Tax Enable Toggle */}
            <View style={styles.taxToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.taxToggleTitle}>Enable {selectedCountry.taxName}</Text>
                <Text style={styles.taxToggleSubtitle}>Apply tax to all new orders</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggleSwitch, formData.taxEnabled && styles.toggleSwitchActive]}
                onPress={() => handleChange('taxEnabled', !formData.taxEnabled)}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleKnob, formData.taxEnabled && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>

            {formData.taxEnabled && (
              <View style={styles.row}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.label}>Tax Type</Text>
                  <View style={styles.taxTypeDisplay}>
                    <MaterialIcons name="receipt" size={16} color={colors.primary} />
                    <Text style={styles.taxTypeText}>{selectedCountry.taxName}</Text>
                  </View>
                </View>
                <View style={{ flex: 0.8 }}>
                  <Text style={styles.label}>Tax Rate (%)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="18"
                    keyboardType="number-pad"
                    value={formData.taxRate}
                    onChangeText={(t) => handleChange('taxRate', t.replace(/[^0-9]/g, ''))}
                    maxLength={3}
                  />
                </View>
              </View>
            )}

            <Text style={styles.label}>{`${selectedCountry.taxName} Number (Optional)`}</Text>
            <TextInput
              style={styles.input}
              placeholder={`e.g. ${selectedCountry.code === 'IN' ? '36AAAAA1111A1Z1' : 'Tax ID'}`}
              autoCapitalize="characters"
              value={formData.gstNumber}
              onChangeText={(t) => handleChange('gstNumber', t)}
            />

            <Text style={styles.label}>Operating Hours</Text>
            <View style={styles.hoursRow}>
              <View style={styles.timeField}>
                <Text style={styles.timeFieldLabel}>Open</Text>
                <TouchableOpacity style={styles.timeSelectBtn} onPress={() => setShowOpenTimePicker(true)}>
                  <Text style={styles.timeInput}>{formData.openTime}</Text>
                  <MaterialIcons name="expand-more" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.timeSpan}>to</Text>
              <View style={styles.timeField}>
                <Text style={styles.timeFieldLabel}>Close</Text>
                <TouchableOpacity style={styles.timeSelectBtn} onPress={() => setShowCloseTimePicker(true)}>
                  <Text style={styles.timeInput}>{formData.closeTime}</Text>
                  <MaterialIcons name="expand-more" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Section 4: Legal */}
          <View style={styles.legalSection}>
            <TouchableOpacity onPress={() => handleChange('terms', !formData.terms)} style={styles.checkboxTouch}>
              <MaterialIcons name={formData.terms ? "check-box" : "check-box-outline-blank"} size={22} color={formData.terms ? colors.primary : colors.textMuted} />
            </TouchableOpacity>
            <Text style={styles.legalText}>{t('mobile.agreeTermsRegister')}</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={showCountryPicker} transparent animationType="fade" onRequestClose={() => setShowCountryPicker(false)}>
        <Pressable style={styles.modalDismiss} onPress={() => setShowCountryPicker(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Select country</Text>
          <TextInput
            style={styles.countrySearchInput}
            placeholder="Search country / code / dial code"
            value={countrySearch}
            onChangeText={setCountrySearch}
            autoCapitalize="none"
          />
          <ScrollView style={{ maxHeight: 360 }}>
            {filteredCountries.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[styles.countryOption, c.code === countryCode && styles.countryOptionActive]}
                onPress={() => {
                  setCountryCode(c.code);
                  setFormData((prev) => ({
                    ...prev,
                    phone: sanitizePhoneInput(normalizePhoneForCountry(prev.phone, { countryCode: c.code }), c.code),
                  }));
                  setCountrySearch('');
                  setShowCountryPicker(false);
                }}
              >
                <Text style={styles.countryOptionText}>{c.name} ({c.phoneCode})</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showOpenTimePicker} transparent animationType="fade" onRequestClose={() => setShowOpenTimePicker(false)}>
        <Pressable style={styles.modalDismiss} onPress={() => setShowOpenTimePicker(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Select opening time</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {TIME_OPTIONS.map((time) => (
              <TouchableOpacity
                key={`open-${time}`}
                style={[styles.countryOption, formData.openTime === time && styles.countryOptionActive]}
                onPress={() => {
                  handleChange('openTime', time);
                  setShowOpenTimePicker(false);
                }}
              >
                <Text style={styles.countryOptionText}>{time}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showCloseTimePicker} transparent animationType="fade" onRequestClose={() => setShowCloseTimePicker(false)}>
        <Pressable style={styles.modalDismiss} onPress={() => setShowCloseTimePicker(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Select closing time</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {TIME_OPTIONS.map((time) => (
              <TouchableOpacity
                key={`close-${time}`}
                style={[styles.countryOption, formData.closeTime === time && styles.countryOptionActive]}
                onPress={() => {
                  handleChange('closeTime', time);
                  setShowCloseTimePicker(false);
                }}
              >
                <Text style={styles.countryOptionText}>{time}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Footer Action */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateShop} disabled={loading || uploadingLogo}>
          {loading && !showSetupOverlay ? <ActivityIndicator color={colors.surface} /> : (
            <View style={styles.btnContent}>
              <Text style={styles.primaryBtnText}>{isEditMode ? t('mobile.saveShopChanges') : t('mobile.createShopBtn')}</Text>
              <MaterialIcons name={isEditMode ? "save" : "arrow-forward"} size={20} color={colors.surface} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Setup Progress Overlay (new shops only) ────────────────── */}
      {showSetupOverlay && (
        <View style={styles.setupOverlay}>
          {!setupDone ? (
            <>
              {/* Logo */}
              <View style={styles.setupLogoWrap}>
                <View style={styles.setupLogoBadge}>
                  <MaterialIcons name="local-laundry-service" size={38} color="#fff" />
                </View>
                <Text style={styles.setupBrand}>Laundry Bill</Text>
                <Text style={styles.setupSubtitle}>Initializing Environment...</Text>
              </View>

              {/* Progress Card */}
              <View style={styles.setupCard}>
                {/* Progress bar */}
                <View style={styles.setupProgressSection}>
                  <View style={styles.setupProgressHeader}>
                    <Text style={styles.setupProgressLabel}>{SETUP_STEPS[Math.min(setupStep, SETUP_STEPS.length - 1)]}</Text>
                    <Text style={styles.setupProgressPct}>{Math.round(((setupStep + 1) / SETUP_STEPS.length) * 100)}%</Text>
                  </View>
                  <View style={styles.setupProgressTrack}>
                    <View style={[styles.setupProgressFill, { width: `${((setupStep + 1) / SETUP_STEPS.length) * 100}%` }]} />
                  </View>
                </View>

                {/* Task list */}
                <View style={styles.setupTaskList}>
                  {SETUP_STEPS.map((step, i) => {
                    const isDone = i < setupStep;
                    const isActive = i === setupStep;
                    return (
                      <View key={i} style={[styles.setupTaskRow, isDone && styles.setupTaskDone, isActive && styles.setupTaskActive, !isDone && !isActive && styles.setupTaskPending]}>
                        <View style={styles.setupTaskIcon}>
                          {isDone ? (
                            <View style={styles.setupTaskCheckCircle}>
                              <MaterialIcons name="check" size={12} color="#fff" />
                            </View>
                          ) : isActive ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <View style={styles.setupTaskDot} />
                          )}
                        </View>
                        <Text style={[styles.setupTaskLabel, isActive && { color: colors.primary, fontFamily: fonts.bold }, isDone && { color: colors.textMuted }]}>
                          {step}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          ) : (
            /* Success state */
            <View style={styles.setupSuccessWrap}>
              <View style={styles.setupSuccessCircle}>
                <MaterialIcons name="check" size={40} color="#fff" />
              </View>
              <Text style={styles.setupSuccessTitle}>Setup Complete!</Text>
              <Text style={styles.setupSuccessDesc}>Redirecting to dashboard...</Text>
            </View>
          )}
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 64,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginLeft: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingBottom: 100,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  logoText: {
    marginTop: 12,
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  card: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: radii.card,
    marginBottom: 20,
    ...shadows.card,
    ...shadows.cardBorder,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    height: 48,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.badge,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  flex1Box: {
    flex: 1,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.badge,
    alignItems: 'center',
    marginBottom: 16,
  },
  countrySelectBtn: {
    height: 44,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.badge,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    flexDirection: 'row',
    marginBottom: 10,
  },
  countrySelectText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  phonePrefix: {
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.textMuted,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 8,
  },
  timeField: {
    flex: 1,
    gap: 6,
  },
  timeFieldLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
  },
  timeInput: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: 'left',
  },
  timeSelectBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.badge,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeSpan: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    marginBottom: 12,
  },
  legalSection: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    alignItems: 'flex-start',
    gap: 12,
  },
  checkboxTouch: {
    marginTop: 2,
  },
  legalText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  linkText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    textDecorationLine: 'underline',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    ...shadows.elevated,
  },
  primaryBtn: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: radii.badge,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.surface,
  },
  modalDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, marginBottom: 10 },
  countrySearchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
    backgroundColor: colors.background,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryTint,
    borderRadius: radii.badge,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  locationBtnText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  locationCoords: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 12,
    marginTop: -6,
    paddingHorizontal: 4,
  },
  taxToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.badge,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  taxToggleTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  taxToggleSubtitle: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    marginTop: 1,
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleSwitchActive: {
    backgroundColor: colors.success,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  taxTypeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    backgroundColor: colors.primaryTint,
    borderRadius: radii.badge,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  taxTypeText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  autoDetectedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -4,
  },
  autoDetectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  autoDetectedText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  countryOption: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: radii.badge },
  countryOptionActive: { backgroundColor: colors.primaryTint },
  countryOptionText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },

  // ── Setup Progress Overlay ──────────────────────────────────
  setupOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  setupLogoWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  setupLogoBadge: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: '#0F1E36',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#0C2340',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  setupBrand: {
    fontSize: 22,
    fontFamily: fonts.extrabold,
    color: colors.text,
  },
  setupSubtitle: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    marginTop: 4,
  },
  setupCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 18,
    shadowColor: '#141E3C',
    shadowOpacity: 0.08,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  setupProgressSection: {
    gap: 8,
  },
  setupProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setupProgressLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    flex: 1,
  },
  setupProgressPct: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  setupProgressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 3,
    overflow: 'hidden',
  },
  setupProgressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  setupTaskList: {
    gap: 14,
  },
  setupTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  setupTaskDone: {
    opacity: 0.8,
  },
  setupTaskActive: {
    opacity: 1,
  },
  setupTaskPending: {
    opacity: 0.3,
  },
  setupTaskIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupTaskCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupTaskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  setupTaskLabel: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  setupSuccessWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupSuccessCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: colors.success,
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  setupSuccessTitle: {
    fontSize: 22,
    fontFamily: fonts.extrabold,
    color: colors.text,
    textAlign: 'center',
  },
  setupSuccessDesc: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
});
