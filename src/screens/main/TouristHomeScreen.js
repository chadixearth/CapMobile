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
  ActivityIndicator,
  RefreshControl, // ✅ added
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import LeafletMapView from '../../components/LeafletMapView';

import { fetchMapData } from '../../services/map/fetchMap';
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

  // ✅ Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);

  // ---------- Sheet state ----------
  const SHEET_H = 540;
  const [sheetVisible, setSheetVisible] = useState(false);
  const sheetY = useRef(new Animated.Value(SHEET_H)).current;
  const [activePicker, setActivePicker] = useState('pickup'); // 'pickup' | 'destination'
  const [requesting, setRequesting] = useState(false);
  const [mapRegion, setMapRegion] = useState(CEBU_CITY_REGION);
  const [roads, setRoads] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [filteredPackages, setFilteredPackages] = useState([]);
  const [sortBy, setSortBy] = useState('default'); // 'default', 'price_low', 'price_high', 'rating'

  useEffect(() => {
    Animated.timing(sheetY, {
      toValue: sheetVisible ? 0 : SHEET_H,
      duration: 260,
      easing: sheetVisible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [sheetVisible, sheetY]);

  // Recenter to the most relevant point when sheet is shown / fields change
  useEffect(() => {
    if (!sheetVisible) return;
    if (activePicker === 'pickup' && pickup) {
      setMapRegion((r) => ({ ...r, latitude: pickup.latitude, longitude: pickup.longitude }));
    } else if (activePicker === 'destination' && destination) {
      setMapRegion((r) => ({ ...r, latitude: destination.latitude, longitude: destination.longitude }));
    } else {
      setMapRegion(CEBU_CITY_REGION);
    }
  }, [sheetVisible, activePicker, pickup, destination]);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoadingPackages(true);
        const packages = await tourPackageService.getAllPackages();
        const packagesArray = Array.isArray(packages) ? packages : [];
        setTourPackages(packagesArray);
        setFilteredPackages(packagesArray);
        setDataSource('API Data');
        setNetworkStatus('Connected');
      } catch (error) {
        console.error('Fetch packages error:', error);
        setTourPackages([]);
        setDataSource('API Error');
        setNetworkStatus('Failed');
      } finally {
        setLoadingPackages(false);
      }
    };
    
    const loadMapData = async () => {
      try {
        const mapData = await fetchMapData({ cacheOnly: true });
        if (mapData?.roads) setRoads(mapData.roads);
        if (mapData?.points) {
          setMarkers(mapData.points.map(point => ({
            latitude: parseFloat(point.latitude || 0),
            longitude: parseFloat(point.longitude || 0),
            title: point.name || 'Point',
            id: point.id || Math.random().toString()
          })));
        }
      } catch (error) {
        console.warn('Failed to load map data:', error);
      }
    };
    
    fetchPackages();
    loadMapData();
  }, []);

  // Filter and sort packages
  useEffect(() => {
    let filtered = [...tourPackages];
    
    // Apply search filter
    if (search.trim()) {
      filtered = filtered.filter(pkg => 
        pkg.package_name?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Apply sorting
    switch (sortBy) {
      case 'price_low':
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price_high':
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'rating':
        filtered.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        break;
      default:
        // Keep original order
        break;
    }
    
    setFilteredPackages(filtered);
  }, [tourPackages, search, sortBy]);

  useFocusEffect(React.useCallback(() => () => {}, []));

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      const packages = await tourPackageService.getAllPackages();
      const packagesArray = Array.isArray(packages) ? packages : [];
      setTourPackages(packagesArray);
      setFilteredPackages(packagesArray);
      setDataSource('Refreshed');
      setNetworkStatus('Connected');
    } catch (error) {
      console.error('Refresh packages error:', error);
      setDataSource('Refresh Failed');
      setNetworkStatus('Failed');
    } finally {
      setRefreshing(false);
    }
  };

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
    const { latitude, longitude } = e?.nativeEvent?.coordinate || {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
    
    // Check if click is on a road highlight
    const clickedRoad = roads.find(road => {
      if (road.road_coordinates) {
        const coords = JSON.parse(road.road_coordinates);
        return coords.some(coord => {
          const distance = Math.sqrt(
            Math.pow(coord[0] - latitude, 2) + Math.pow(coord[1] - longitude, 2)
          );
          return distance < 0.001;
        });
      }
      return false;
    });
    
    if (clickedRoad) {
      const coords = JSON.parse(clickedRoad.road_coordinates);
      const roadPoint = coords[0];
      const point = { 
        name: clickedRoad.name || 'Road Point', 
        latitude: roadPoint[0], 
        longitude: roadPoint[1] 
      };
      
      if (activePicker === 'pickup') setPickup(point);
      else setDestination(point);
    }
  };

  const useCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to use current location.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { name: 'Current Location', latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      if (activePicker === 'pickup') setPickup(point);
      else setDestination(point);
      setMapRegion((r) => ({ ...r, latitude: point.latitude, longitude: point.longitude }));
    } catch (err) {
      Alert.alert('Location error', err.message || 'Failed to get current location.');
    }
  };

  const chooseTerminal = (t) => {
    const point = { name: t.name, latitude: t.latitude, longitude: t.longitude };
    if (activePicker === 'pickup') setPickup(point);
    else setDestination(point);
    setMapRegion((r) => ({ ...r, latitude: t.latitude, longitude: t.longitude }));
  };

  const swapPoints = () => {
    setPickup(destination);
    setDestination(pickup);
  };

  const handleRequestRide = async () => {
    if (!pickup || !destination) {
      Alert.alert('Pick points', 'Please select both pickup and destination.');
      return;
    }
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
      <TARTRACKHeader onNotificationPress={() => navigation.navigate('Notification')}
                      onMessagePress={() => navigation.navigate('Chat')} />

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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        // ✅ Pull-to-refresh control
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6B2E2B" />
        }
      >
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

        {/* Filter Row */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Sort by:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { key: 'default', label: 'Default' },
              { key: 'price_low', label: 'Price ↑' },
              { key: 'price_high', label: 'Price ↓' },
              { key: 'rating', label: 'Rating ↓' }
            ].map(filter => (
              <TouchableOpacity
                key={filter.key}
                style={[styles.filterBtn, sortBy === filter.key && styles.filterBtnActive]}
                onPress={() => setSortBy(filter.key)}
              >
                <Text style={[styles.filterBtnText, sortBy === filter.key && styles.filterBtnTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <Text
          style={[
            styles.networkStatus,
            {
              marginHorizontal: 16,
              marginBottom: 8,
              color:
                networkStatus === 'Connected' ? '#4CAF50' : networkStatus === 'Failed' ? '#F44336' : '#666',
            },
          ]}
        >
          Network: {networkStatus}  ·  Source: {dataSource}
        </Text>

        {loadingPackages ? (
          <Text style={{ textAlign: 'center', marginVertical: 16 }}>Loading packages...</Text>
        ) : filteredPackages.length === 0 ? (
          <View style={styles.noPackagesContainer}>
            <Text style={styles.noPackagesText}>No tour packages available</Text>
            <Text style={styles.noPackagesSubtext}>
              {dataSource === 'No Data' ? 'API endpoint not returning valid data' : 'Please try again later'}
            </Text>
          </View>
        ) : (
          <View style={styles.gridWrap}>
            {filteredPackages.map((pkg, index) => (
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
                  <Image
                    source={require('../../../assets/images/tourA.png')}
                    style={styles.packageImage}
                    resizeMode="cover"
                  />
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
                    <Text style={styles.bookBtnText} numberOfLines={1}>
                      Book
                    </Text>
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

      {/* ========= Bottom Sheet Modal ========= */}
      <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={() => setSheetVisible(false)}>
        {/* Backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setSheetVisible(false)} />

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: sheetY }],
            },
          ]}
        >
          {/* Grabber + title + close */}
          <View style={styles.sheetHeader}>
            <View style={styles.grabber} />
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Request a Ride</Text>
              <TouchableOpacity onPress={() => setSheetVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color="#222" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Picker toggles */}
          <View style={styles.toggleRow}>
            {['pickup', 'destination'].map((k) => {
              const active = activePicker === k;
              return (
                <TouchableOpacity
                  key={k}
                  style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                  onPress={() => setActivePicker(k)}
                >
                  <Ionicons
                    name={k === 'pickup' ? 'locate-outline' : 'flag-outline'}
                    size={14}
                    color={active ? '#6B2E2B' : '#666'}
                  />
                  <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                    {k === 'pickup' ? 'Set Pickup' : 'Set Destination'}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={styles.swapBtn} onPress={swapPoints}>
              <Ionicons name="swap-vertical" size={16} color="#6B2E2B" />
              <Text style={styles.swapText}>Swap</Text>
            </TouchableOpacity>
          </View>

          {/* Location rows */}
          <View style={styles.rowField}>
            <Ionicons name="locate" size={16} color="#2e7d32" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Pickup</Text>
              <Text style={styles.fieldValue} numberOfLines={1}>
                {renderLocShort(pickup)}
              </Text>
            </View>
            {pickup && (
              <TouchableOpacity onPress={() => setPickup(null)}>
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.rowField}>
            <Ionicons name="flag" size={16} color="#C62828" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Destination</Text>
              <Text style={styles.fieldValue} numberOfLines={1}>
                {renderLocShort(destination)}
              </Text>
            </View>
            {destination && (
              <TouchableOpacity onPress={() => setDestination(null)}>
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick actions */}
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={useCurrentLocation}>
              <Ionicons name="navigate-circle-outline" size={16} color="#6B2E2B" />
              <Text style={styles.quickText}>Use my location</Text>
            </TouchableOpacity>
            <Text style={styles.quickHint}>
              Tap road highlights to set {activePicker === 'pickup' ? 'pickup' : 'destination'}.
            </Text>
          </View>

          {/* Map */}
          <View style={styles.mapWrap}>
            <LeafletMapView
              style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}
              region={mapRegion}
              roads={roads}
              markers={markers}
              onPress={handleMapPress}
              showsUserLocation
            />
            {/* Simple markers overlay (if your GoogleMap doesn’t accept children markers) */}
            {pickup && (
              <View pointerEvents="none" style={[styles.pin, { left: 12, top: 12 }]}>
                <Ionicons name="location-sharp" size={18} color="#2e7d32" />
                <Text style={styles.pinText}>Pickup</Text>
              </View>
            )}
            {destination && (
              <View pointerEvents="none" style={[styles.pin, { right: 12, bottom: 12 }]}>
                <Ionicons name="flag" size={18} color="#C62828" />
                <Text style={styles.pinText}>Destination</Text>
              </View>
            )}
          </View>

          {/* Terminals quick list */}
          <FlatList
            data={TERMINALS}
            keyExtractor={(t) => t.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 2 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.terminalPill} onPress={() => chooseTerminal(item)}>
                <Ionicons name="location-outline" size={14} color="#6B2E2B" />
                <Text style={styles.terminalText} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.requestBtn, (!pickup || !destination || requesting) && { opacity: 0.6 }]}
            onPress={handleRequestRide}
            disabled={!pickup || !destination || requesting}
            activeOpacity={0.9}
          >
            {requesting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.requestBtnText}>Request Ride</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
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

  /* Filter Row */
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 12,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  filterBtnActive: {
    backgroundColor: '#6B2E2B',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterBtnTextActive: {
    color: '#fff',
  },

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
    gap: 2,
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

  /* --------- Bottom Sheet Styles --------- */
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 540,
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    elevation: 18,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -6 },
  },
  sheetHeader: { alignItems: 'center', marginBottom: 6 },
  grabber: {
    width: 38,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E0E0E0',
    marginBottom: 6,
  },
  sheetTitleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#222' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    marginRight: 8,
    backgroundColor: '#FAFAFA',
  },
  toggleBtnActive: { borderColor: '#6B2E2B', backgroundColor: '#FFF' },
  toggleText: { marginLeft: 6, fontSize: 12, color: '#666', fontWeight: '700' },
  toggleTextActive: { color: '#6B2E2B' },

  swapBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7EFEF',
    borderColor: '#EADCDC',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  swapText: { marginLeft: 6, color: '#6B2E2B', fontWeight: '700', fontSize: 12 },

  rowField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  fieldLabel: { fontSize: 11, color: '#888', marginBottom: 2 },
  fieldValue: { fontSize: 13, color: '#222', fontWeight: '700' },

  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F5E9E2',
    borderRadius: 999,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#EBD7CF',
  },
  quickText: { marginLeft: 6, color: '#6B2E2B', fontWeight: '800', fontSize: 12 },
  quickHint: { color: '#777', fontSize: 12 },

  mapWrap: {
    height: 210,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEE',
    backgroundColor: '#EEE',
  },
  pin: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  pinText: { marginLeft: 6, fontSize: 11, fontWeight: '700', color: '#333' },

  terminalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EADCDC',
    backgroundColor: '#F7EFEF',
    marginRight: 8,
  },
  terminalText: { marginLeft: 6, color: '#6B2E2B', fontWeight: '700', fontSize: 12 },

  requestBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#6B2E2B',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  requestBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  /* Misc states for empty packages */
  noPackagesContainer: { padding: 16, alignItems: 'center' },
  noPackagesText: { fontSize: 16, fontWeight: '800', color: '#333', marginBottom: 6 },
  noPackagesSubtext: { fontSize: 12, color: '#777', textAlign: 'center' },
});
