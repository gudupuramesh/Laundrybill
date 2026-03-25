import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { firestore } from '../lib/db';
import { auth, getShopId, setResolvedShopId } from '../lib/auth';

export default function RegisterShopScreen({
  onComplete,
  onBack,
  initialPhone,
  isEditMode = false,
}: {
  onComplete: () => void,
  onBack?: () => void,
  initialPhone?: string,
  isEditMode?: boolean
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: initialPhone || auth().currentUser?.phoneNumber || '',
    street: '',
    area: '',
    city: '',
    state: '',
    pincode: '',
    gstNumber: '',
    openTime: '09:00',
    closeTime: '21:00',
    terms: isEditMode // auto check for edit mode
  });

  const [fetching, setFetching] = useState(true);

  // Always check for existing shop/user data — handles web-registered users logging in on mobile
  useEffect(() => {
    const fetchExistingData = async () => {
      try {
        const user = auth().currentUser;
        const uid = user?.uid || '';
        const shopId = getShopId() || uid;

        // 1. Check if shop already exists (web-registered user or edit mode)
        const shopDoc = await firestore().collection('shops').doc(shopId).get();
        if (shopDoc.exists) {
          const data = shopDoc.data();
          setFormData({
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || initialPhone || auth().currentUser?.phoneNumber || '',
            street: data.location?.address || '',
            area: data.location?.area || '',
            city: data.location?.city || '',
            state: data.location?.state || '',
            pincode: data.location?.pincode || '',
            gstNumber: data.gstNumber || '',
            openTime: data.businessHours?.openTime || '09:00',
            closeTime: data.businessHours?.closeTime || '21:00',
            terms: isEditMode,
          });
        } else {
          // 2. No shop yet — check users collection for any existing profile info (email, phone)
          const userDoc = await firestore().collection('users').doc(uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            setFormData(prev => ({
              ...prev,
              email: userData.email || prev.email,
              phone: userData.phone || initialPhone || auth().currentUser?.phoneNumber || prev.phone,
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
      const currentShopId = getShopId() || uid;

      // Duplicate email check
      if (formData.email) {
        const emailSnap = await firestore().collection('shops').where('email', '==', formData.email).limit(2).get();
        const otherShopWithEmail = emailSnap.docs?.find((d: any) => d.id !== currentShopId);
        if (otherShopWithEmail) {
          setLoading(false);
          alert(t('mobile.emailInUseOtherShop'));
          return;
        }
      }

      // Duplicate phone check
      if (formData.phone) {
        const rawDigits = formData.phone.replace(/\D/g, '').slice(-10);
        const phoneVariants = [`+91${rawDigits}`, rawDigits];
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

      const shopData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        ownerId: uid,
        location: {
          address: formData.street,
          area: formData.area,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
        },
        gstNumber: formData.gstNumber,
        businessHours: {
          openTime: formData.openTime,
          closeTime: formData.closeTime
        },
        updatedAt: new Date(),
      };

      if (!isEditMode) {
        Object.assign(shopData, {
          settings: {
            currency: "INR",
            timezone: "Asia/Kolkata",
            orderPrefix: "A",
            nextOrderNumber: 1,
            adsEnabled: true,
            showSelfPromo: true,
            whatsappNotifications: true,
            smsNotifications: false,
          },
          createdAt: new Date(),
        });
      }

      // Use currentShopId for edit mode (shop may belong to different uid), uid for new shops
      const saveId = isEditMode ? currentShopId : uid;

      // 1. Create or Update the shop document
      await firestore().collection('shops').doc(saveId).set(shopData, { merge: isEditMode });

      // 2. Create/Update user document with shopId link and admin role
      await firestore().collection('users').doc(uid).set({
        email: formData.email,
        phone: formData.phone,
        shopId: saveId,
        shopName: formData.name,
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // 3. Update resolved shopId so all screens use it immediately
      setResolvedShopId(saveId);

      // 4. Seed default inventory for NEW shops (categories + items from platform defaults or hardcoded)
      if (!isEditMode) {
        try {
          await seedDefaultInventory(saveId);
        } catch (seedErr) {
          console.warn('Default inventory seeding failed (non-fatal):', seedErr);
        }
      }

      // Done! Redirect to dashboard.
      onComplete();

    } catch (e: any) {
      console.error('Failed to create shop:', e);
      alert(e.message || t('mobile.failedRegisterShop'));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color="#0056bd" />
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
                <MaterialIcons name="arrow-back" size={24} color="#191c1e" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>{isEditMode ? t('mobile.editShopProfile') : t('mobile.registerShop')}</Text>
          </View>
          <MaterialIcons name="more-vert" size={24} color="#64748b" />
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <TouchableOpacity style={styles.logoPlaceholder}>
              <MaterialIcons name="storefront" size={40} color="#737685" />
              <View style={styles.cameraIconBadge}>
                <MaterialIcons name="photo-camera" size={16} color="#ffffff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.logoText}>{t('mobile.uploadShopLogo')}</Text>
          </View>

          {/* Section 1: Shop Details */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('mobile.shopDetailsSection')}</Text>
            
            <Text style={styles.label}>{t('mobile.shopNameLabel')}</Text>
            <TextInput style={styles.input} placeholder={t('mobile.phShopName')} value={formData.name} onChangeText={(t) => handleChange('name', t)} />

            <View style={styles.row}>
              <View style={styles.flex1Box}>
                <Text style={styles.label}>{t('mobile.emailAddressLabel')}</Text>
                <TextInput style={styles.input} placeholder={t('mobile.phEmail')} keyboardType="email-address" value={formData.email} onChangeText={(t) => handleChange('email', t)} />
              </View>
              <View style={styles.flex1Box}>
                <Text style={styles.label}>{t('mobile.mobileNumberLabel')}</Text>
                <View style={styles.phoneInputContainer}>
                  <Text style={styles.phonePrefix}>+91</Text>
                  <TextInput style={styles.phoneInput} placeholder={t('mobile.phPhone10')} keyboardType="phone-pad" value={formData.phone.replace('+91', '')} onChangeText={(t) => handleChange('phone', '+91' + t)} />
                </View>
              </View>
            </View>
          </View>

          {/* Section 2: Location */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('mobile.locationSection')}</Text>
            
            <Text style={styles.label}>{t('mobile.streetAddressLabel')}</Text>
            <TextInput style={styles.input} placeholder={t('mobile.phStreet')} value={formData.street} onChangeText={(t) => handleChange('street', t)} />

            <View style={styles.row}>
              <View style={styles.flex1Box}>
                <Text style={styles.label}>{t('mobile.areaLocalityLabel')}</Text>
                <TextInput style={styles.input} placeholder={t('mobile.phArea')} value={formData.area} onChangeText={(t) => handleChange('area', t)} />
              </View>
              <View style={styles.flex1Box}>
                <Text style={styles.label}>{t('mobile.cityLabel')}</Text>
                <TextInput style={styles.input} placeholder={t('mobile.phCity')} value={formData.city} onChangeText={(t) => handleChange('city', t)} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.flex1Box}>
                <Text style={styles.label}>{t('mobile.stateLabel')}</Text>
                <TextInput style={styles.input} placeholder={t('mobile.phState')} value={formData.state} onChangeText={(t) => handleChange('state', t)} />
              </View>
              <View style={styles.flex1Box}>
                <Text style={styles.label}>{t('mobile.pinCodeLabel')}</Text>
                <TextInput style={styles.input} placeholder={t('mobile.phPin')} keyboardType="number-pad" value={formData.pincode} onChangeText={(t) => handleChange('pincode', t)} />
              </View>
            </View>
          </View>

          {/* Section 3: Business Info */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('mobile.businessInfoSection')}</Text>

            <Text style={styles.label}>{t('mobile.gstOptionalLabel')}</Text>
            <TextInput style={styles.input} placeholder={t('mobile.phGst')} autoCapitalize="characters" value={formData.gstNumber} onChangeText={(t) => handleChange('gstNumber', t)} />

            <Text style={styles.label}>{t('mobile.operatingHours')}</Text>
            <View style={styles.hoursRow}>
              <TextInput style={styles.timeInput} placeholder={t('mobile.phTimeOpen')} value={formData.openTime} onChangeText={(t) => handleChange('openTime', t)} />
              <Text style={styles.timeSpan}>{t('mobile.timeTo')}</Text>
              <TextInput style={styles.timeInput} placeholder={t('mobile.phTimeClose')} value={formData.closeTime} onChangeText={(t) => handleChange('closeTime', t)} />
            </View>
          </View>

          {/* Section 4: Legal */}
          <View style={styles.legalSection}>
            <TouchableOpacity onPress={() => handleChange('terms', !formData.terms)} style={styles.checkboxTouch}>
              <MaterialIcons name={formData.terms ? "check-box" : "check-box-outline-blank"} size={22} color={formData.terms ? "#00408f" : "#737685"} />
            </TouchableOpacity>
            <Text style={styles.legalText}>{t('mobile.agreeTermsRegister')}</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Action */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateShop} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : (
            <View style={styles.btnContent}>
              <Text style={styles.primaryBtnText}>{isEditMode ? t('mobile.saveShopChanges') : t('mobile.createShopBtn')}</Text>
              <MaterialIcons name={isEditMode ? "save" : "arrow-forward"} size={20} color="#ffffff" />
            </View>
          )}
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
    fontFamily: 'Inter',
    fontWeight: '600',
    color: '#191c1e',
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
    backgroundColor: '#e7e8ea',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#c3c6d6',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00408f',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logoText: {
    marginTop: 12,
    fontSize: 10,
    fontWeight: '600',
    color: '#434654',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00408f',
    letterSpacing: 1,
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#434654',
    marginBottom: 4,
  },
  input: {
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#191c1e',
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
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  phonePrefix: {
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#737685',
    borderRightWidth: 1,
    borderRightColor: '#e1e2e4',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#191c1e',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 4,
  },
  timeInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#191c1e',
    textAlign: 'center',
  },
  timeSpan: {
    fontSize: 12,
    fontWeight: '700',
    color: '#737685',
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
    fontWeight: '400',
    color: '#434654',
    lineHeight: 18,
  },
  linkText: {
    color: '#00408f',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 20,
  },
  primaryBtn: {
    height: 56,
    backgroundColor: '#0056bd',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00408f',
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
    fontWeight: '700',
    color: '#ffffff',
  }
});
