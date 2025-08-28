// src/screens/main/TouristHomeScreen.js
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Modal,
  Alert,
  Platform,
  FlatList,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import GoogleMap from '../../components/GoogleMap';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { useFocusEffect } from '@react-navigation/native';
import { requestRide } from '../../services/api';
import { tourPackageService, testConnection } from '../../services/tourpackage/fetchPackage';
import { supabase } from '../../services/supabase';
import * as Routes from '../../constants/routes';

const TERMINALS = [
  { id: '1', name: 'Plaza Independencia', latitude: 10.2926, longitude: 123.9058 },
  { id: '2', name: 'Carbon Market Entrance', latitude: 10.2951, longitude: 123.8776 },
  { id: '3', name: 'Carbon Market Exit', latitude: 10.2942, longitude: 123.8779 },
  { id: '4', name: 'Plaza Independencia Gate', latitude: 10.2929, longitude: 123.9055 },
];

const CEBU_CITY_REGION = { latitude: 10.295, longitude: 123.89, latitudeDelta: 0.018, longitudeDelta: 0.018 };

export default function TouristHomeScreen({ navigation }) {
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [search, setSearch] = useState('');
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [tourPackages, setTourPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [networkStatus, setNetworkStatus] = useState('Unknown');
  const [dataSource, setDataSource] = useState('Unknown');

  const SHEET_H = 520;
  const [sheetVisible, setSheetVisible] = useState(false);
  const sheetY = useRef(new Animated.Value(SHEET_H)).current;
  const [activePicker, setActivePicker] = useState('pickup');
  const [destModalVisible, setDestModalVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    Animated.timing(sheetY, {
      toValue: sheetVisible ? 0 : SHEET_H,
      duration: 260,
      easing: sheetVisible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [sheetVisible, sheetY]);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoadingPackages(true);
        const packages = await tourPackageService.getAllPackages();
        setTourPackages(Array.isArray(packages) ? packages : []);
        setDataSource('Real API Data');
        setNetworkStatus('Connected');
      } catch (error) {
        console.error('Fetch packages error:', error);
        setTourPackages([]);
        setDataSource('Mock Data (API Error)');
        setNetworkStatus('Failed');
      } finally {
        setLoadingPackages(false);
      }
    };
    fetchPackages();
  }, []);

  useFocusEffect(React.useCallback(() => () => {}, []));

  const openRideSheet = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Location.requestForegroundPermissionsAsync();
      } catch {}
    }
    setSheetVisible(true);
  };

  const renderLocShort = (loc) => {
    if (!loc) return 'Not selected';
    if (loc.name) return loc.name;
    return `Lat ${loc.latitude.toFixed(4)}, Lng ${loc.longitude.toFixed(4)}`;
  };

  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    if (activePicker === 'pickup') {
      setPickup({ name: 'Dropped Pin', latitude, longitude });
    } else {
      setDestination({ name: 'Dropped Pin', latitude, longitude });
    }
  };

  const handleRequestRide = async () => {
    if (!pickup || !destination) return;
    setRequesting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('User not found');
      await requestRide({
        pickup: { lat: pickup.latitude, lng: pickup.longitude },
        destination: { lat: destination.latitude, lng: destination.longitude },
        userId,
      });
      setSheetVisible(false);
      Alert.alert('Request sent!', 'Your ride request has been sent.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to request ride.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TARTRACKHeader onNotificationPress={() => navigation.navigate('NotificationScreen')} />

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#fff" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search Packages"
          placeholderTextColor="#fff"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Image source={require('../../../assets/tartanilla.jpg')} style={styles.featuredImage} resizeMode="cover" />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tour Packages</Text>
          <TouchableOpacity
            style={styles.testButton}
            onPress={async () => {
              try {
                const result = await testConnection();
                Alert.alert(
                  result.success ? 'Connection Test Success' : 'Connection Test Failed',
                  result.success
                    ? `✅ Found working API endpoint!\n\nURL: ${result.url}\nStatus: ${result.status}\n\nResponse preview:\n${result.text}`
                    : `Error: ${result.error}\n\nTested URLs:\n${result.testedUrls?.slice(0, 3).join('\n')}...`
                );
              } catch (error) {
                Alert.alert('Connection Test Failed', error.message);
              }
            }}
          >
            <Text style={styles.testButtonText}>Test Connection</Text>
          </TouchableOpacity>
        </View>

        <Text
          style={[
            styles.networkStatus,
            {
              marginHorizontal: 16,
              marginBottom: 8,
              color: networkStatus === 'Connected' ? '#4CAF50' : networkStatus === 'Failed' ? '#F44336' : '#666',
            },
          ]}
        >
          Network: {networkStatus}  ·  Source: {dataSource}
        </Text>

        {loadingPackages ? (
          <Text style={{ textAlign: 'center', marginVertical: 16 }}>Loading packages...</Text>
        ) : tourPackages.length === 0 ? (
          <View style={styles.noPackagesContainer}>
            <Text style={styles.noPackagesText}>No tour packages available</Text>
            <Text style={styles.noPackagesSubtext}>
              {dataSource === 'No Data' ? 'API endpoint not returning valid data' : 'Please try again later'}
            </Text>
          </View>
        ) : (
          <View style={styles.gridWrap}>
            {tourPackages.map((pkg, index) => (
              <TouchableOpacity
                key={pkg.id || `${pkg.package_name}-${index}`}
                activeOpacity={0.9}
                style={styles.packageCard}
                onPress={() =>
                  navigation.navigate(Routes.REQUEST_BOOKING, {
                    packageId: pkg.id,
                    packageData: pkg,
                  })
                }
              >
                {pkg.photos && pkg.photos.length > 0 ? (
                  <Image source={{ uri: pkg.photos[0] }} style={styles.packageImage} resizeMode="cover" />
                ) : (
                  <Image source={require('../../../assets/images/tourA.png')} style={styles.packageImage} resizeMode="cover" />
                )}

                {/* Title */}
                <Text style={styles.packageTitle} numberOfLines={2}>
                  {pkg.package_name}
                </Text>

                {/* Inline meta: duration, pax, rating */}
                <View style={styles.metaRow}>
                  {pkg.duration_hours ? (
                    <View style={styles.metaInline}>
                      <Ionicons name="time-outline" size={12} />
                      <Text style={styles.metaInlineText} numberOfLines={1}>
                        {pkg.duration_hours}h
                      </Text>
                    </View>
                  ) : null}

                  {pkg.max_pax ? (
                    <View style={styles.metaInline}>
                      <Ionicons name="people-outline" size={12} />
                      <Text style={styles.metaInlineText} numberOfLines={1}>
                        {pkg.max_pax}
                      </Text>
                    </View>
                  ) : null}

                  {(typeof pkg.average_rating === 'number' || (pkg.reviews && pkg.reviews.length)) ? (
                    <View style={styles.metaInline}>
                      <Ionicons name="star" size={12} />
                      <Text style={styles.metaInlineText} numberOfLines={1}>
                        {(Number(pkg.average_rating) || 0).toFixed(1)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Bottom row: Availability + Book */}
                <View style={styles.cardBottomRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      pkg.is_active === false && { backgroundColor: '#fdecea', borderColor: '#f5c2c7' },
                    ]}
                  >
                    <Ionicons
                      name={pkg.is_active === false ? 'close-circle-outline' : 'checkmark-circle-outline'}
                      size={12}
                      color={pkg.is_active === false ? '#d32f2f' : '#2e7d32'}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: pkg.is_active === false ? '#d32f2f' : '#2e7d32' },
                      ]}
                      numberOfLines={1}
                    >
                      {pkg.is_active === false ? 'Unavailable' : 'Available'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.bookBtn}
                    onPress={() =>
                      navigation.navigate(Routes.REQUEST_BOOKING, { packageId: pkg.id, packageData: pkg })
                    }
                  >
                    <Ionicons name="book-outline" size={12} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.bookBtnText} numberOfLines={1}>Book</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating + button -> opens BOTTOM sheet */}
      <TouchableOpacity style={styles.fab} onPress={openRideSheet} activeOpacity={0.9}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 24 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B2E2B',
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 36,
    marginTop: 18,
  },
  searchInput: { flex: 1, color: '#fff', marginLeft: 6, fontSize: 13 },

  featuredImage: {
    width: '92%',
    height: 150,
    borderRadius: 12,
    alignSelf: 'center',
    marginVertical: 8,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#222' },

  testButton: { backgroundColor: '#6B2E2B', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  testButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  networkStatus: { fontSize: 12, fontWeight: '600' },

  /* Grid */
  gridWrap: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  /* Card */
  packageCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(107,46,43,0.45)',
    marginBottom: 16,
    padding: 10,
    minHeight: 210,
  },
  packageImage: { width: '100%', height: 100, borderRadius: 12, marginBottom: 8 },
  packageTitle: { color: '#333', fontSize: 13, fontWeight: '700', lineHeight: 16, minHeight: 32 },

  /* Inline meta */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    marginTop: 2,
    marginBottom: 8,
  },
  metaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '33%',
  },
  metaInlineText: {
    marginLeft: 4,
    color: '#6B2E2B',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Bottom row */
  cardBottomRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 5,
    backgroundColor: '#E7F6EC',
    borderColor: '#C8E6C9',
    borderWidth: 1,
    borderRadius: 999,
    maxWidth: '65%',
    marginRight: 2,
  },
  statusText: { fontSize: 10, fontWeight: '700' },

  /* Book button w/ icon */
  bookBtn: {
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },

  /* FAB */
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6B2E2B',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
