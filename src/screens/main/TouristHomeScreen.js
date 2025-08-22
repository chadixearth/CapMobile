import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ScrollView, Modal, Alert, Platform, FlatList, Dimensions } from 'react-native';
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


// Remove the hardcoded tourPackages array
// const tourPackages = [
//   {
//     id: 'A',
//     title: 'Tour A: From Plaza Independencia to Carbon',
//     image: require('../../../assets/images/tourA.png'),
//   },
//   {
//     id: 'B',
//     title: 'Tour B: From Plaza Independencia to Carbon',
//     image: require('../../../assets/images/tourA.png'),
//   },
//   {
//     id: 'C',
//     title: 'Tour C: From Plaza Independencia to Carbon',
//     image: require('../../../assets/images/tourA.png'),
//   },
//   {
//     id: 'D',
//     title: 'Tour D: From Plaza Independencia to Carbon',
//     image: require('../../../assets/images/tourA.png'),
//   },
// ];

const TERMINALS = [
  { id: '1', name: 'Plaza Independencia', latitude: 10.2926, longitude: 123.9058 },
  { id: '2', name: 'Carbon Market Entrance', latitude: 10.2951, longitude: 123.8776 },
  { id: '3', name: 'Carbon Market Exit', latitude: 10.2942, longitude: 123.8779 },
  { id: '4', name: 'Plaza Independencia Gate', latitude: 10.2929, longitude: 123.9055 },
];

const TERMINALS_REGION = {
  latitude: 10.3040, // Center between all terminals
  longitude: 123.9013,
  latitudeDelta: 0.03, // Zoomed in
  longitudeDelta: 0.03,
};

const DEFAULT_REGION = {
  latitude: 10.3157,
  longitude: 123.8854,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const CEBU_CITY_REGION = {
  latitude: 10.295,
  longitude: 123.89,
  latitudeDelta: 0.018,
  longitudeDelta: 0.018,
};

export default function TouristHomeScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [pickupTerminal, setPickupTerminal] = useState(null);
  const [destinationTerminal, setDestinationTerminal] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [picking, setPicking] = useState(null); // 'pickup' or 'destination'
  const [mapRegion, setMapRegion] = useState(DEFAULT_REGION);
  const [selectedCoord, setSelectedCoord] = useState(null);
  const [terminalModalVisible, setTerminalModalVisible] = useState(false);
  const [terminalPickingType, setTerminalPickingType] = useState(null); // 'pickup' or 'destination'
  const [selectedTerminalId, setSelectedTerminalId] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [tourPackages, setTourPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [networkStatus, setNetworkStatus] = useState('Unknown');
  const [dataSource, setDataSource] = useState('Unknown');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailPackage, setDetailPackage] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef(null);
  const SCREEN_WIDTH = Dimensions.get('window').width;
  const CARD_MARGIN = 16;
  const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;

  // Handle returned terminal from TerminalsScreen
  useFocusEffect(
    React.useCallback(() => {
      if (navigation && navigation.getState) {
        const params = navigation.getState().routes.find(r => r.name === 'TouristHome')?.params;
        if (params?.selectedTerminal && params?.type) {
          if (params.type === 'pickup') {
            setPickupTerminal(params.selectedTerminal);
            setDestinationTerminal(null); // Reset destination if pickup changes
            // Automatically proceed to destination selection
            setTimeout(() => {
              navigation.navigate('Terminals', { type: 'destination' });
            }, 300);
          } else if (params.type === 'destination') {
            setDestinationTerminal(params.selectedTerminal);
          }
          // Clear params after use
          navigation.setParams({ selectedTerminal: undefined, type: undefined });
        }
      }
    }, [navigation])
  );

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoadingPackages(true);
        console.log('Fetching packages using tourPackageService...');
        
        const packages = await tourPackageService.getAllPackages();
        console.log('✅ Successfully fetched packages:', packages);
        
        setTourPackages(Array.isArray(packages) ? packages : []);
        setDataSource('Real API Data');
        setNetworkStatus('Connected');
      } catch (error) {
        console.error('❌ Error fetching packages:', error);
        setDataSource('Mock Data (API Error)');
        setTourPackages([]);
        setNetworkStatus('Failed');
      } finally {
        setLoadingPackages(false);
      }
    };

    fetchPackages();
  }, []);

  // Ask for location permission and open picker
  const handlePickLocation = async (type) => {
    if (Platform.OS !== 'web') {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location permission is required to pick a location.');
        return;
      }
    }
    setPicking(type);
    setSelectedCoord(null);
    setModalVisible(true);
  };

  // When user taps on map
  const handleMapPress = (e) => {
    setSelectedCoord(e.nativeEvent.coordinate);
  };

  // Confirm selection
  const handleConfirmLocation = () => {
    if (!selectedCoord) return;
    if (picking === 'pickup') {
      setPickupTerminal(selectedCoord);
      setDestinationTerminal(null); // Reset destination if pickup changes
    } else if (picking === 'destination') {
      setDestinationTerminal(selectedCoord);
    }
    setModalVisible(false);
    setPicking(null);
    setSelectedCoord(null);
  };

  // Open modal to pick terminal
  const openTerminalPicker = (type) => {
    setTerminalPickingType(type);
    setTerminalModalVisible(true);
  };

  // Handle terminal marker press
  const handleTerminalSelect = (terminal) => {
    setSelectedTerminalId(terminal.id);
    if (terminalPickingType === 'pickup') {
      setPickupTerminal(terminal);
      setDestinationTerminal(null); // Reset destination if pickup changes
    } else if (terminalPickingType === 'destination') {
      setDestinationTerminal(terminal);
    }
    setTimeout(() => {
      setTerminalModalVisible(false);
      setTerminalPickingType(null);
      setSelectedTerminalId(null);
    }, 300);
  };

  // Render location as string
  const renderLocation = (loc) => {
    if (!loc) return '';
    return `Lat: ${loc.latitude.toFixed(5)}, Lng: ${loc.longitude.toFixed(5)}`;
  };

  const handleRequestRide = async () => {
    if (!pickupTerminal || !destinationTerminal) return;
    setRequesting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('User not found');
      await requestRide({
        pickup: { lat: pickupTerminal.latitude, lng: pickupTerminal.longitude },
        destination: { lat: destinationTerminal.latitude, lng: destinationTerminal.longitude },
        userId,
      });
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
        <Ionicons name="search" size={20} color="#fff" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search Packages"
          placeholderTextColor="#fff"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Maxim-like Pick-up & Destination */}
      <View style={styles.maximContainer}>
        <TouchableOpacity style={styles.inputRow} onPress={() => openTerminalPicker('pickup')}>
          <MaterialIcons name="my-location" size={20} color="#6B2E2B" style={{ marginRight: 8 }} />
          <Text style={styles.maximInput}>
            {pickupTerminal ? pickupTerminal.name : 'Pick-up Location'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.inputRow, { opacity: pickupTerminal ? 1 : 0.5 }]}
          onPress={() => pickupTerminal && openTerminalPicker('destination')}
          disabled={!pickupTerminal}
        >
          <MaterialIcons name="location-on" size={20} color="#6B2E2B" style={{ marginRight: 8 }} />
          <Text style={styles.maximInput}>
            {destinationTerminal ? destinationTerminal.name : 'Destination'}
          </Text>
        </TouchableOpacity>
        {pickupTerminal && destinationTerminal && (
          <View style={{ marginTop: 16 }}>
            <Button title={requesting ? 'Requesting...' : 'Request'} onPress={handleRequestRide} disabled={requesting} />
          </View>
        )}
      </View>

      {/* Terminal Picker Modal */}
      <Modal visible={terminalModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={{ position: 'absolute', left: 0, padding: 8, zIndex: 2 }}
                onPress={() => { setTerminalModalVisible(false); setSelectedTerminalId(null); }}>
                <Ionicons name="close" size={28} color="#6B2E2B" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {terminalPickingType === 'pickup' ? 'Select Pick-up Terminal' : 'Select Destination Terminal'}
              </Text>
            </View>
            <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}>
              <GoogleMap
                region={terminalPickingType === 'pickup' ? CEBU_CITY_REGION : TERMINALS_REGION}
                markers={TERMINALS.map(t => ({
                  latitude: t.latitude,
                  longitude: t.longitude,
                  title: t.name,
                  description: `Tap to select as ${terminalPickingType}`,
                  id: t.id,
                  pinColor: selectedTerminalId === t.id ? '#6B2E2B' : undefined,
                  onPress: () => handleTerminalSelect(t),
                }))}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Featured Image */}
        <Image
          source={require('../../../assets/images/tourA.png')}
          style={styles.featuredImage}
          resizeMode="cover"
        />

        {/* Tour Packages */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tour Packages</Text>
          <TouchableOpacity 
            style={styles.customRequestButton}
            onPress={() => navigation.navigate('CustomPackageRequest')}
          >
            <Ionicons name="add-circle-outline" size={16} color="#6B2E2B" />
            <Text style={styles.customRequestButtonText}>Custom Request</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.networkStatusContainer}>
          <View>
            <Text style={[styles.networkStatus, { color: networkStatus === 'Connected' ? '#4CAF50' : '#F44336' }]}>
              Network: {networkStatus}
            </Text>
            <Text style={[styles.networkStatus, { color: '#666', fontSize: 10 }]}>
              Data Source: {dataSource}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.testButton}
            onPress={async () => {
              console.log('Testing connection...');
                             try {
                 const result = await testConnection();
                 console.log('Connection test result:', result);
                 if (result.success) {
                   Alert.alert('Connection Test Success', 
                     `✅ Found working API endpoint!\n\n` +
                     `URL: ${result.url}\n` +
                     `Status: ${result.status}\n\n` +
                     `Response preview:\n${result.text}`
                   );
                 } else {
                   Alert.alert('Connection Test Failed', 
                     `Error: ${result.error}\n\n` +
                     `Tested URLs:\n${result.testedUrls?.slice(0, 3).join('\n')}...\n\n` +
                     `Please check:\n` +
                     `1. Your backend server is running\n` +
                     `2. Your computer's IP is correct: 10.196.222.213\n` +
                     `3. Your phone and computer are on the same network\n` +
                     `4. Your API endpoints are configured correctly`
                   );
                 }
              } catch (error) {
                console.error('Test failed:', error);
                Alert.alert('Connection Test Failed', error.message);
              }
            }}
          >
            <Text style={styles.testButtonText}>Test Connection</Text>
          </TouchableOpacity>
        </View>
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
          <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            {tourPackages.map((pkg, index) => (
              <TouchableOpacity
                key={pkg.id || `${pkg.package_name}-${index}`}
                activeOpacity={0.9}
                style={[styles.packageCard, { width: '100%', marginHorizontal: 0 }]}
                onPress={() => { setDetailPackage(pkg); setDetailModalVisible(true); }}
              >
                {pkg.photos && pkg.photos.length > 0 ? (
                  <Image source={{ uri: pkg.photos[0] }} style={[styles.packageImage, { height: 140 }]} resizeMode="cover" />
                ) : (
                  <Image source={require('../../../assets/images/tourA.png')} style={[styles.packageImage, { height: 140 }]} resizeMode="cover" />
                )}
                <View style={styles.cardTopRow}>
                  <Text style={styles.packageTitle} numberOfLines={1}>{pkg.package_name}</Text>
                  <Text style={styles.packagePrice} numberOfLines={1}>
                    {typeof pkg.price === 'number' || !isNaN(parseFloat(pkg.price)) ? `₱${Number(pkg.price).toFixed(0)}` : '—'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  {pkg.duration_hours ? (
                    <View style={styles.metaPill}>
                      <Ionicons name="time-outline" size={12} color="#6B2E2B" />
                      <Text style={styles.metaText}>{pkg.duration_hours}h</Text>
                    </View>
                  ) : null}
                  {pkg.max_pax ? (
                    <View style={styles.metaPill}>
                      <Ionicons name="people-outline" size={12} color="#6B2E2B" />
                      <Text style={styles.metaText}>{pkg.max_pax}</Text>
                    </View>
                  ) : null}
                  {(typeof pkg.average_rating === 'number' || (pkg.reviews && pkg.reviews.length)) ? (
                    <View style={styles.metaPill}>
                      <Ionicons name="star" size={12} color="#E3B341" />
                      <Text style={styles.metaText}>
                        {`${(Number(pkg.average_rating) || 0).toFixed(1)} (${pkg.reviews_count ?? (pkg.reviews ? pkg.reviews.length : 0)})`}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {!!pkg.description && (
                  <Text style={styles.packageDescription} numberOfLines={2}>
                    {pkg.description}
                  </Text>
                )}
                {(pkg.pickup_location || pkg.destination) && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {pkg.pickup_location ? (
                      <View style={styles.infoRow}>
                        <Ionicons name="navigate-outline" size={14} color="#6B2E2B" />
                        <Text style={styles.infoText} numberOfLines={1}>{pkg.pickup_location}</Text>
                      </View>
                    ) : null}
                    {pkg.destination ? (
                      <View style={styles.infoRow}>
                        <Ionicons name="flag-outline" size={14} color="#6B2E2B" />
                        <Text style={styles.infoText} numberOfLines={1}>{pkg.destination}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  <View style={[styles.statusBadge, pkg.is_active === false && { backgroundColor: '#fdecea', borderColor: '#f5c2c7' }]}>
                    <Ionicons 
                      name={pkg.is_active === false ? 'close-circle-outline' : 'checkmark-circle-outline'} 
                      size={14} 
                      color={pkg.is_active === false ? '#d32f2f' : '#2e7d32'} 
                    />
                    <Text style={[styles.statusText, { color: pkg.is_active === false ? '#d32f2f' : '#2e7d32' }]}>
                      {pkg.is_active === false ? 'Unavailable' : 'Available'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.bookChip}
                    onPress={() => {
                      navigation.navigate(Routes.REQUEST_BOOKING, {
                        packageId: pkg.id,
                        packageData: pkg,
                      });
                    }}
                  >
                    <Ionicons name="cart-outline" size={14} color="#fff" />
                    <Text style={styles.bookChipText}>Book</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      {/* Package Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide" transparent onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }] }>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Package Details</Text>
            </View>
            <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
              {detailPackage && (
                <>
                  {/* Image */}
                  {detailPackage.photos && detailPackage.photos.length > 0 ? (
                    <Image source={{ uri: detailPackage.photos[0] }} style={styles.detailImage} resizeMode="cover" />
                  ) : (
                    <Image source={require('../../../assets/images/tourA.png')} style={styles.detailImage} resizeMode="cover" />
                  )}

                  {/* Title + Price */}
                  <View style={styles.detailHeaderRow}>
                    <Text style={styles.detailTitle} numberOfLines={2}>{detailPackage.package_name}</Text>
                    <Text style={styles.detailPrice} numberOfLines={1}>
                      {typeof detailPackage.price === 'number' || !isNaN(parseFloat(detailPackage.price)) ? `₱${Number(detailPackage.price).toFixed(2)}` : '—'}
                    </Text>
                  </View>

                  {/* Chips */}
                  <View style={styles.detailChipsRow}>
                    {detailPackage.duration_hours ? (
                      <View style={styles.detailChip}>
                        <Ionicons name="time-outline" size={14} color="#6B2E2B" />
                        <Text style={styles.detailChipText}>{detailPackage.duration_hours}h</Text>
                      </View>
                    ) : null}
                    {detailPackage.max_pax ? (
                      <View style={styles.detailChip}>
                        <Ionicons name="people-outline" size={14} color="#6B2E2B" />
                        <Text style={styles.detailChipText}>{detailPackage.max_pax} pax</Text>
                      </View>
                    ) : null}
                    {(typeof detailPackage.average_rating === 'number' || (detailPackage.reviews && detailPackage.reviews.length)) ? (
                      <View style={styles.detailChip}>
                        <Ionicons name="star" size={14} color="#E3B341" />
                        <Text style={styles.detailChipText}>
                          {`${(Number(detailPackage.average_rating) || 0).toFixed(1)} (${detailPackage.reviews_count ?? (detailPackage.reviews ? detailPackage.reviews.length : 0)})`}
                        </Text>
                      </View>
                    ) : null}
                    <View style={[styles.detailChip, detailPackage.is_active === false && { backgroundColor: '#fdecea', borderColor: '#f5c2c7' }]}>
                      <Ionicons name={detailPackage.is_active === false ? 'close-circle-outline' : 'checkmark-circle-outline'} size={14} color={detailPackage.is_active === false ? '#d32f2f' : '#2e7d32'} />
                      <Text style={[styles.detailChipText, detailPackage.is_active === false ? { color: '#d32f2f' } : { color: '#2e7d32' }]}>
                        {detailPackage.is_active === false ? 'Unavailable' : 'Available'}
                      </Text>
                    </View>
                  </View>

                  {/* Description */}
                  {detailPackage.description ? (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.detailSectionTitle}>Description</Text>
                      <Text style={styles.detailDescription}>{detailPackage.description}</Text>
                    </View>
                  ) : null}

                  {/* Reviews */}
                  {(detailPackage.reviews && detailPackage.reviews.length > 0) && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.detailSectionTitle}>Reviews</Text>
                      {detailPackage.reviews.slice(0, 3).map((rv, idx) => (
                        <View key={idx} style={styles.reviewItem}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                            <Ionicons name="person-circle-outline" size={16} color="#6B2E2B" />
                            <Text style={styles.reviewAuthor}>{rv.author || rv.user_name || 'Anonymous'}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Ionicons name="star" size={12} color="#E3B341" />
                            <Text style={styles.reviewRating}>{typeof rv.rating === 'number' ? rv.rating.toFixed(1) : '0.0'}</Text>
                          </View>
                          {!!rv.comment && (
                            <Text style={styles.reviewText} numberOfLines={3}>{rv.comment}</Text>
                          )}
                        </View>
                      ))}
                      {detailPackage.reviews.length > 3 && (
                        <Text style={{ color: '#666', fontSize: 12 }}>
                          +{detailPackage.reviews.length - 3} more reviews
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Info rows */}
                  <View style={{ marginTop: 8 }}>
                    {detailPackage.pickup_location ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="navigate-outline" size={16} color="#6B2E2B" />
                        <Text style={styles.detailLabel}>Pickup</Text>
                        <Text style={styles.detailValue}>{detailPackage.pickup_location}</Text>
                      </View>
                    ) : null}
                    {detailPackage.destination ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="flag-outline" size={16} color="#6B2E2B" />
                        <Text style={styles.detailLabel}>Destination</Text>
                        <Text style={styles.detailValue}>{detailPackage.destination}</Text>
                      </View>
                    ) : null}
                    {detailPackage.route ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="map-outline" size={16} color="#6B2E2B" />
                        <Text style={styles.detailLabel}>Route</Text>
                        <Text style={styles.detailValue}>{detailPackage.route}</Text>
                      </View>
                    ) : null}
                    {detailPackage.available_days && detailPackage.available_days.length > 0 ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={16} color="#6B2E2B" />
                        <Text style={styles.detailLabel}>Available</Text>
                        <Text style={styles.detailValue}>{detailPackage.available_days.join(', ')}</Text>
                      </View>
                    ) : null}
                    {detailPackage.expiration_date ? (
                      <View style={styles.detailRow}>
                        <Ionicons name="alert-circle-outline" size={16} color="#6B2E2B" />
                        <Text style={styles.detailLabel}>Expires</Text>
                        <Text style={styles.detailValue}>{detailPackage.expiration_date}</Text>
                      </View>
                    ) : null}
                  </View>
                </>
              )}
            </ScrollView>

            {/* Actions */}
            {detailPackage && (
              <View style={styles.detailActionsRow}>
                <TouchableOpacity style={styles.detailSecondaryBtn} onPress={() => setDetailModalVisible(false)}>
                  <Text style={styles.detailSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.detailPrimaryBtn}
                  onPress={() => {
                    setDetailModalVisible(false);
                    navigation.navigate(Routes.REQUEST_BOOKING, {
                      packageId: detailPackage.id,
                      packageData: detailPackage,
                    });
                  }}
                >
                  <Ionicons name="cart-outline" size={16} color="#fff" />
                  <Text style={styles.detailPrimaryText}>Book</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 40,
    backgroundColor: '#fff',
  },
  logo: { fontSize: 24, fontWeight: 'bold', color: '#7B3F00', letterSpacing: 1 },
  headerIcons: { flexDirection: 'row' },
  icon: { marginLeft: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B2E2B',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    height: 40,
  },
  searchInput: { flex: 1, color: '#fff', marginLeft: 8 },
  featuredImage: {
    width: '92%',
    height: 140,
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
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  customRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5E9E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0CFC2',
  },
  customRequestButtonText: {
    color: '#6B2E2B',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  networkStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  networkStatus: {
    fontSize: 12,
    fontWeight: '600',
  },

  noPackagesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    marginHorizontal: 16,
  },
  noPackagesText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  noPackagesSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  packagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    marginBottom: 24,
    paddingBottom: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 16,
  },
  filtersRow: {
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  filterChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginHorizontal: 4,
  },
  filterChipActive: {
    backgroundColor: '#F5E9E2',
    borderColor: '#E0CFC2',
  },
  filterChipText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#6B2E2B',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ddd',
  },
  dotActive: {
    backgroundColor: '#6B2E2B',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  packageCard: {
    width: '44%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 16,
    alignItems: 'flex-start',
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  packageImage: {
    width: '100%',
    height: 90,
    borderRadius: 8,
    marginBottom: 8,
  },
  cardTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  packageTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'left',
    color: '#333',
  },
  packageDescription: {
    marginTop: 6,
    color: '#555',
    fontSize: 12,
    lineHeight: 16,
  },
  packagePrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6B2E2B',
    marginBottom: 2,
    textAlign: 'right',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    flex: 1,
    color: '#444',
    fontSize: 12,
  },
  metaRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 10,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F5E9E2',
    borderWidth: 1,
    borderColor: '#E0CFC2',
  },
  metaText: {
    color: '#6B2E2B',
    fontSize: 11,
    fontWeight: '700',
  },
  bookChip: {
    marginTop: 'auto',
    alignSelf: 'flex-end',
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookChipText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#E7F6EC',
    borderColor: '#C8E6C9',
    borderWidth: 1,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  maximContainer: {
    backgroundColor: '#F5E9E2',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0CFC2',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  maximInput: {
    flex: 1,
    fontSize: 16,
    color: '#6B2E2B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 8,
    minHeight: '60%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
    position: 'relative',
  },
  detailContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  detailImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  detailTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#333',
    marginRight: 8,
  },
  detailPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6B2E2B',
  },
  detailChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F5E9E2',
    borderWidth: 1,
    borderColor: '#E0CFC2',
    borderRadius: 999,
  },
  detailChipText: {
    color: '#6B2E2B',
    fontWeight: '700',
  },
  reviewItem: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  reviewAuthor: {
    marginLeft: 6,
    color: '#333',
    fontWeight: '700',
    fontSize: 12,
  },
  reviewRating: {
    marginLeft: 6,
    color: '#333',
    fontWeight: '700',
    fontSize: 12,
  },
  reviewText: {
    color: '#555',
    fontSize: 12,
    lineHeight: 16,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  detailDescription: {
    color: '#555',
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  detailLabel: {
    width: 90,
    color: '#444',
    fontWeight: '700',
  },
  detailValue: {
    flex: 1,
    color: '#333',
  },
  detailActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  detailSecondaryBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  detailSecondaryText: {
    color: '#444',
    fontWeight: '700',
  },
  detailPrimaryBtn: {
    flex: 1,
    backgroundColor: '#6B2E2B',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
  },
  detailPrimaryText: {
    color: '#fff',
    fontWeight: '800',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B2E2B',
    textAlign: 'center',
    flex: 1,
  },
  testButton: {
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
});