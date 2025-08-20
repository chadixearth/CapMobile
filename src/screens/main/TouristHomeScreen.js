import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ScrollView, Modal, Alert, Platform } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import GoogleMap from '../../components/GoogleMap';
import Button from '../../components/Button';
import Notification from '../../components/Notification';
import { useFocusEffect } from '@react-navigation/native';
import { requestRide } from '../../services/api';
import { tourPackageService, testConnection } from '../../services/tourpackage/fetchPackage';

import { supabase } from '../../services/supabase';
import TARTRACKHeader from '../../components/TARTRACKHeader';
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

      <ScrollView>
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
                     `2. Your computer's IP is correct: 192.168.101.74\n` +
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
          <View style={styles.packagesContainer}>
            {tourPackages.map((pkg) => (
              <View key={pkg.id || pkg.package_name} style={styles.packageCard}>
                {/* Photos */}
                {pkg.photos && pkg.photos.length > 0 ? (
                  <Image 
                    source={{ uri: pkg.photos[0] }} 
                    style={styles.packageImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Image 
                    source={require('../../../assets/images/tourA.png')} 
                    style={styles.packageImage}
                    resizeMode="cover"
                  />
                )}
                
                <Text style={styles.packageTitle}>{pkg.package_name}</Text>
                <Text style={styles.packageDescription}>{pkg.description}</Text>
                
                {/* Price */}
                <Text style={styles.packagePrice}>
                  ₱{pkg.price?.toFixed(2) || 'Price not available'}
                </Text>
                
                {/* Duration */}
                {pkg.duration_hours && (
                  <Text style={styles.packageInfo}>
                    Duration: {pkg.duration_hours} hours
                  </Text>
                )}
                
                {/* Location */}
                {pkg.pickup_location && (
                  <Text style={styles.packageInfo}>Pickup: {pkg.pickup_location}</Text>
                )}
                {pkg.destination && (
                  <Text style={styles.packageInfo}>Destination: {pkg.destination}</Text>
                )}
                
                {/* Max Passengers */}
                {pkg.max_pax && (
                  <Text style={styles.packageInfo}>Max: {pkg.max_pax} passengers</Text>
                )}
                
                {/* Available Days */}
                {pkg.available_days && pkg.available_days.length > 0 && (
                  <Text style={styles.packageInfo}>
                    Available: {pkg.available_days.join(', ')}
                  </Text>
                )}
                
                {/* Route */}
                {pkg.route && (
                  <Text style={styles.packageInfo}>Route: {pkg.route}</Text>
                )}
                
                {/* Expiration */}
                {pkg.expiration_date && (
                  <Text style={styles.packageInfo}>Expires: {pkg.expiration_date}</Text>
                )}
                
                {/* Status */}
                <View style={styles.statusContainer}>
                  <Text style={[
                    styles.packageStatus, 
                    { color: pkg.is_active ? '#4CAF50' : '#F44336' }
                  ]}>
                    {pkg.is_active ? 'Available' : 'Unavailable'}
                  </Text>
                  {pkg.is_expired && (
                    <Text style={[styles.packageStatus, { color: '#FF9800' }]}>
                      Expired
                    </Text>
                  )}
                </View>
                
                                 <Button 
                   title="Book" 
                   onPress={() => {
                     navigation.navigate(Routes.REQUEST_BOOKING, {
                       packageId: pkg.id,
                       packageData: pkg
                     });
                   }} 
                 />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
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
    height: 120,
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
    marginBottom: 80,
  },
  packageCard: {
    width: '44%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 16,
    alignItems: 'center',
    padding: 8,
  },
  packageImage: {
    width: '100%',
    height: 70,
    borderRadius: 8,
    marginBottom: 8,
  },
  packageTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
    color: '#333',
  },
  packageDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 16,
  },
  packagePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6B2E2B',
    marginBottom: 4,
    textAlign: 'center',
  },
  packageInfo: {
    fontSize: 11,
    color: '#555',
    textAlign: 'center',
    marginBottom: 2,
  },
  packageStatus: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  bookButton: {
    backgroundColor: '#6B2E2B',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  bookButtonText: { color: '#fff', fontWeight: 'bold' },
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