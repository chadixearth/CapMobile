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
import Button from '../../components/Button';
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

  // selections
  const [pickup, setPickup] = useState(null);       // { name?, latitude, longitude }
  const [destination, setDestination] = useState(null);

  // packages / status
  const [tourPackages, setTourPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [networkStatus, setNetworkStatus] = useState('Unknown');
  const [dataSource, setDataSource] = useState('Unknown');

  // bottom sheet (ride request)
  const SHEET_H = 520;
  const [sheetVisible, setSheetVisible] = useState(false);
  const sheetY = useRef(new Animated.Value(SHEET_H)).current; // start off-screen at bottom
  const [activePicker, setActivePicker] = useState('pickup'); // 'pickup' | 'destination'

  // destination list modal (optional quick-pick)
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
    // Ask location permission once (optional, helps if your map shows user location)
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

                <Text style={styles.packageTitle} numberOfLines={2}>
                  {pkg.package_name}
                </Text>

                <View style={styles.metaRow}>
                  {pkg.duration_hours ? (
                    <View style={styles.metaPill}>
                      <Ionicons name="time-outline" size={11} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {pkg.duration_hours}h
                      </Text>
                    </View>
                  ) : null}
                  {pkg.max_pax ? (
                    <View style={styles.metaPill}>
                      <Ionicons name="people-outline" size={11} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {pkg.max_pax}
                      </Text>
                    </View>
                  ) : null}
                  {(typeof pkg.average_rating === 'number' || (pkg.reviews && pkg.reviews.length)) ? (
                    <View style={styles.metaPill}>
                      <Ionicons name="star" size={11} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {(Number(pkg.average_rating) || 0).toFixed(1)} ({pkg.reviews_count ?? (pkg.reviews ? pkg.reviews.length : 0)})
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardBottomRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      pkg.is_active === false && { backgroundColor: '#fdecea', borderColor: '#f5c2c7' },
                    ]}
                  >
                    <Ionicons
                      name={pkg.is_active === false ? 'close-circle-outline' : 'checkmark-circle-outline'}
                      size={13}
                      color={pkg.is_active === false ? '#d32f2f' : '#2e7d32'}
                    />
                    <Text
                      style={[styles.statusText, { color: pkg.is_active === false ? '#d32f2f' : '#2e7d32' }]}
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

      {/* Ride request BOTTOM sheet (with embedded map) */}
      <Modal visible={sheetVisible} transparent animationType="fade" onRequestClose={() => setSheetVisible(false)}>
        <View style={styles.bottomOverlay}>
          <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetY }] }]}>
            {/* drag handle */}
            <View style={styles.grabberWrap}>
              <View style={styles.grabber} />
            </View>

            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Create a Ride Request</Text>
              <TouchableOpacity onPress={() => setSheetVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color="#6B2E2B" />
              </TouchableOpacity>
            </View>

            {/* Toggle which point we're setting */}
            <View style={styles.toggleWrap}>
              <TouchableOpacity
                style={[styles.toggleBtn, activePicker === 'pickup' && styles.toggleBtnActive]}
                onPress={() => setActivePicker('pickup')}
              >
                <MaterialIcons name="my-location" size={16} color={activePicker === 'pickup' ? '#fff' : '#6B2E2B'} />
                <Text style={[styles.toggleText, activePicker === 'pickup' && styles.toggleTextActive]}>Pick-up</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, activePicker === 'destination' && styles.toggleBtnActive]}
                onPress={() => setActivePicker('destination')}
              >
                <MaterialIcons name="location-on" size={16} color={activePicker === 'destination' ? '#fff' : '#6B2E2B'} />
                <Text style={[styles.toggleText, activePicker === 'destination' && styles.toggleTextActive]}>Destination</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.swapBtn}
                onPress={() => {
                  const a = pickup;
                  setPickup(destination);
                  setDestination(a);
                }}
              >
                <Ionicons name="swap-vertical" size={18} color="#6B2E2B" />
              </TouchableOpacity>
            </View>

            {/* Map inside the sheet */}
            <View style={styles.mapWrap}>
              <GoogleMap
                region={CEBU_CITY_REGION}
                style={{ flex: 1 }}
                onPress={handleMapPress}
                markers={[
                  ...(pickup ? [{
                    latitude: pickup.latitude, longitude: pickup.longitude,
                    title: 'Pick-up', id: 'pickup', pinColor: '#2e7d32',
                  }] : []),
                  ...(destination ? [{
                    latitude: destination.latitude, longitude: destination.longitude,
                    title: 'Destination', id: 'dest', pinColor: '#c62828',
                  }] : []),
                ]}
              />
            </View>

            {/* Selected values */}
            <View style={styles.sheetRowMini}>
              <MaterialIcons name="my-location" size={18} color="#6B2E2B" />
              <Text style={styles.rowLabel}>Pick-up</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{renderLocShort(pickup)}</Text>
              <TouchableOpacity onPress={() => setPickup(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color="#9c6a64" />
              </TouchableOpacity>
            </View>
            <View style={styles.sheetRowMini}>
              <MaterialIcons name="location-on" size={18} color="#6B2E2B" />
              <Text style={styles.rowLabel}>Destination</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{renderLocShort(destination)}</Text>
              <TouchableOpacity onPress={() => setDestination(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color="#9c6a64" />
              </TouchableOpacity>
            </View>

            {/* Optional quick-pick list for destinations */}
            <TouchableOpacity style={styles.linkRow} onPress={() => setDestModalVisible(true)}>
              <Ionicons name="list-circle-outline" size={18} color="#6B2E2B" />
              <Text style={styles.linkText}>Choose from terminals list</Text>
            </TouchableOpacity>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setSheetVisible(false)}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, (!pickup || !destination) && { opacity: 0.6 }]}
                disabled={!pickup || !destination || requesting}
                onPress={handleRequestRide}
              >
                <Ionicons name="checkmark" size={14} color="#fff" />
                <Text style={styles.primaryText}>{requesting ? 'Requesting...' : 'Request'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Destination list (still available if they prefer tapping a list) */}
      <Modal visible={destModalVisible} transparent animationType="fade" onRequestClose={() => setDestModalVisible(false)}>
        <View style={styles.bottomOverlay}>
          <View style={styles.listSheet}>
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Select Destination</Text>
              <TouchableOpacity onPress={() => setDestModalVisible(false)}>
                <Ionicons name="close" size={22} color="#6B2E2B" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={TERMINALS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.terminalRow}
                  onPress={() => {
                    setDestination(item);
                    setActivePicker('pickup');
                    setDestModalVisible(false);
                  }}
                >
                  <Ionicons name="location-outline" size={16} color="#6B2E2B" style={{ marginRight: 10 }} />
                  <Text style={styles.terminalText} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => (
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: '#eee', marginHorizontal: 16 }} />
              )}
              contentContainerStyle={{ paddingBottom: 10 }}
            />
          </View>
        </View>
      </Modal>
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
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 8 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#F5E9E2',
    borderWidth: 1,
    borderColor: '#E0CFC2',
  },
  metaText: { color: '#6B2E2B', fontSize: 10, fontWeight: '700' },
  cardBottomRow: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#E7F6EC',
    borderColor: '#C8E6C9',
    borderWidth: 1,
    borderRadius: 999,
    maxWidth: '65%',
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  bookBtn: { backgroundColor: '#6B2E2B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, minWidth: 56, alignItems: 'center' },
  bookBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },

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

  /* Bottom overlay & sheet */
  bottomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  bottomSheet: {
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingBottom: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  grabberWrap: { alignItems: 'center', paddingVertical: 4 },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd' },

  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 6 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#6B2E2B' },

  toggleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E0CFC2',
    backgroundColor: '#F5E9E2',
  },
  toggleBtnActive: { backgroundColor: '#6B2E2B', borderColor: '#6B2E2B' },
  toggleText: { color: '#6B2E2B', fontWeight: '700', fontSize: 12 },
  toggleTextActive: { color: '#fff' },
  swapBtn: { marginLeft: 'auto', padding: 6, borderRadius: 999, backgroundColor: '#F5E9E2', borderWidth: 1, borderColor: '#E0CFC2' },

  mapWrap: { height: 240, borderRadius: 12, overflow: 'hidden', marginHorizontal: 16, marginBottom: 10 },

  sheetRowMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  rowLabel: { color: '#6B2E2B', fontWeight: '700', width: 90, fontSize: 12 },
  rowValue: { flex: 1, color: '#333', fontSize: 13 },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8 },
  linkText: { color: '#6B2E2B', fontWeight: '700', fontSize: 12, textDecorationLine: 'underline' },

  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  secondaryBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  secondaryText: { color: '#444', fontWeight: '700' },
  primaryBtn: { flex: 1, backgroundColor: '#6B2E2B', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, flexDirection: 'row', gap: 8 },
  primaryText: { color: '#fff', fontWeight: '800' },

  /* Destination list */
  listSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: 8,
    paddingBottom: 10,
  },
  terminalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 18 },
  terminalText: { color: '#222', fontSize: 14 },
});
