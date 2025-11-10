import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../../services/authService';
import { 
  createRideBooking, 
  checkActiveRide 
} from '../../services/rideHailingService';
import LocationService from '../../services/locationService';
import { getRoadHighlights, findNearestRoadPoint } from '../../services/roadHighlightsService';
import { getRoutesByPickup } from '../../services/rideHailingService';
import BackButton from '../../components/BackButton';
import LeafletMapView from '../../components/LeafletMapView';
import { fetchMapData } from '../../services/map/fetchMap';

export default function RideHailingScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [passengerCount, setPassengerCount] = useState(1);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [user, setUser] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [findingNearestRoad, setFindingNearestRoad] = useState(false);
  const [nearestRoad, setNearestRoad] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [mapData, setMapData] = useState(null);
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [selectingLocation, setSelectingLocation] = useState(null);

  useEffect(() => {
    initializeScreen();
    loadMapData();
  }, []);

  const initializeScreen = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'Please log in to book rides');
        navigation.goBack();
        return;
      }
      setUser(currentUser);

      const activeCheck = await checkActiveRide(currentUser.id, 'customer');
      if (activeCheck.success && activeCheck.has_active_ride) {
        setActiveRide(activeCheck.active_rides[0]);
      }
    } catch (error) {
      console.error('Error initializing screen:', error);
      Alert.alert('Error', 'Failed to load ride information');
    } finally {
      setLoading(false);
    }
  };

  const loadMapData = async () => {
    try {
      console.log('[RideHailing] Loading map data...');
      const data = await fetchMapData({ forceRefresh: false });
      const { getAllRoadHighlightsWithPoints, processRoadHighlightsForMap } = await import('../../services/roadHighlightsService');
      
      console.log('[RideHailing] Fetching road highlights...');
      const roadData = await getAllRoadHighlightsWithPoints();
      console.log('[RideHailing] Road data result:', roadData.success, 'roads:', roadData.roadHighlights?.length);
      
      if (roadData.success && roadData.roadHighlights.length > 0) {
        const processedRoads = processRoadHighlightsForMap(roadData.roadHighlights);
        console.log('[RideHailing] Processed roads with coordinates:', processedRoads.length);
        
        const allPoints = [
          ...(data?.points || []),
          ...(roadData.pickupPoints || []),
          ...(roadData.dropoffPoints || [])
        ];
        
        console.log('[RideHailing] Setting map data with', processedRoads.length, 'roads');
        setMapData({ 
          ...data,
          points: allPoints,
          roads: processedRoads
        });
      } else {
        console.log('[RideHailing] No road highlights, using basic map data');
        setMapData(data);
      }
    } catch (error) {
      console.error('[RideHailing] Error loading map data:', error);
      const data = await fetchMapData({ forceRefresh: false });
      setMapData(data);
    }
  };



  const onRefresh = async () => {
    setRefreshing(true);
    await initializeScreen();
    setRefreshing(false);
  };

  const getCurrentLocationForPickup = async () => {
    setGettingLocation(true);
    try {
      const location = await LocationService.getCurrentLocation();
      setPickupAddress('Current Location (GPS)');
      Alert.alert('Location Found', 'Your current location has been set as pickup point.');
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        'Location Error',
        error.message || 'Unable to get your current location. Please enter your pickup location manually.',
        [{ text: 'OK' }]
      );
    } finally {
      setGettingLocation(false);
    }
  };

  const findNearestRoadForPickup = async () => {
    setFindingNearestRoad(true);
    try {
      console.log('Getting current location...');
      const location = await LocationService.getCurrentLocation();
      console.log('Current location:', location);
      
      console.log('Fetching road highlights...');
      const roads = await getRoadHighlights();
      console.log('Roads fetched:', roads.length);
      
      if (roads.length === 0) {
        Alert.alert('No Roads Found', 'No available roads found in your area. The map data may not be loaded yet.');
        return;
      }

      console.log('Finding nearest road point...');
      const nearestRoadPoint = findNearestRoadPoint(
        roads, 
        location.latitude, 
        location.longitude,
        500 // 500 meters max distance
      );

      if (nearestRoadPoint) {
        setNearestRoad(nearestRoadPoint);
        setPickupAddress(`${nearestRoadPoint.name} (${Math.round(nearestRoadPoint.distance)}m away)`);
        Alert.alert(
          'Nearest Road Found', 
          `Found ${nearestRoadPoint.name} approximately ${Math.round(nearestRoadPoint.distance)} meters from your location.`
        );
      } else {
        Alert.alert(
          'No Nearby Roads', 
          `No available roads found within 500 meters of your location.\n\nSearched ${roads.length} roads from your current position.\n\nPlease enter your pickup location manually.`
        );
      }
    } catch (error) {
      console.error('Error finding nearest road:', error);
      Alert.alert(
        'Error', 
        `Unable to find nearest road: ${error.message}\n\nPlease check your location settings and try again.`
      );
    } finally {
      setFindingNearestRoad(false);
    }
  };

  const handleMapLocationSelect = async (location, type) => {
    if (type === 'pickup') {
      setPickupLocation(location);
      setPickupAddress(location.name || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);
    } else if (type === 'dropoff') {
      setDropoffLocation(location);
      setDropoffAddress(location.name || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);
    }
    setSelectingLocation(null);
    setShowMap(false);
  };

  const handleMapPress = (location) => {
    if (selectingLocation) {
      Alert.alert(
        'Confirm Selection',
        `Select this location as ${selectingLocation} point?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Select',
            onPress: () => handleMapLocationSelect(location, selectingLocation)
          }
        ]
      );
    }
  };

  const handleMarkerPress = (marker) => {
    if (selectingLocation) {
      Alert.alert(
        'Confirm Selection',
        `Select ${marker.title} as ${selectingLocation} location?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Select',
            onPress: () => handleMapLocationSelect({
              id: marker.id,
              name: marker.title,
              latitude: marker.latitude,
              longitude: marker.longitude,
              pointType: marker.pointType
            }, selectingLocation)
          }
        ]
      );
    }
  };

  const openMapForSelection = async (type) => {
    setSelectingLocation(type);
    console.log('[RideHailing] Opening map, current roads:', mapData?.roads?.length || 0);
    // Always reload to get fresh road data
    await loadMapData();
    setShowMap(true);
  };

  const handleRequestRide = async () => {
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      Alert.alert('Missing Information', 'Please enter pickup and destination addresses');
      return;
    }

    if (passengerCount <= 0 || passengerCount > 4) {
      Alert.alert('Invalid Passenger Count', 'Please select between 1 and 4 passengers');
      return;
    }

    try {
      const result = await createRideBooking({
        customer_id: user.id,
        pickup_address: pickupAddress.trim(),
        dropoff_address: dropoffAddress.trim(),
        passenger_count: parseInt(passengerCount),
        notes: 'Ride created from mobile app'
      });

      if (result.success) {
        Alert.alert(
          'Ride Requested!',
          `Your ride has been requested for ${passengerCount} passenger${passengerCount > 1 ? 's' : ''}.\n\nTotal fare: ₱${passengerCount * 10}\n\nYou will be notified when a driver accepts your request.`,
          [
            { 
              text: 'OK', 
              onPress: () => {
                navigation.navigate('Terminals');
              }
            }
          ]
        );
      } else if (result.error_code === 'ACTIVE_RIDE_EXISTS') {
        Alert.alert('Active Ride Found', result.error);
      } else if (result.error_code === 'LOCATION_ERROR') {
        Alert.alert(
          'Location Services Required', 
          result.error + '\n\nLocation is needed to help drivers find you.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Try Again', 
              onPress: () => handleRequestRide()
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to create ride');
      }
    } catch (error) {
      console.error('Error requesting ride:', error);
      if (error.message && error.message.includes('location')) {
        Alert.alert(
          'Location Error', 
          'Unable to get your current location. Please make sure location services are enabled and try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Try Again', 
              onPress: () => handleRequestRide()
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to request ride. Please try again.');
      }
    }
  };







  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B2E2B" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Request Ride</Text>
        <View style={{ width: 40 }} />
      </View>

      {activeRide && (
        <View style={styles.activeRideCard}>
          <Ionicons name="car" size={20} color="#2E7D32" />
          <Text style={styles.activeRideTitle}>You have an active ride</Text>
          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => navigation.navigate('Terminals')}
          >
            <Text style={styles.trackButtonText}>Track Ride</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Pickup Location</Text>
          <View style={styles.locationInputContainer}>
            <TextInput
              style={[styles.addressInput, styles.locationInput]}
              value={pickupAddress}
              onChangeText={setPickupAddress}
              placeholder="Enter pickup location"
            />
            <TouchableOpacity
              style={styles.locationButton}
              onPress={getCurrentLocationForPickup}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <ActivityIndicator size="small" color="#6B2E2B" />
              ) : (
                <Ionicons name="location" size={20} color="#6B2E2B" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.locationButton, styles.roadButton]}
              onPress={findNearestRoadForPickup}
              disabled={findingNearestRoad}
            >
              {findingNearestRoad ? (
                <ActivityIndicator size="small" color="#2E7D32" />
              ) : (
                <Ionicons name="trail-sign" size={20} color="#2E7D32" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.locationButton, styles.mapButton]}
              onPress={() => openMapForSelection('pickup')}
            >
              <Ionicons name="map" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.locationHint}>Tap 📍 for GPS, 🛣️ for nearest road, or 🗺️ to select on map</Text>
          {nearestRoad && (
            <Text style={styles.nearestRoadInfo}>
              Nearest road: {nearestRoad.name} ({Math.round(nearestRoad.distance)}m away)
            </Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Destination</Text>
          <View style={styles.locationInputContainer}>
            <TextInput
              style={[styles.addressInput, styles.locationInput]}
              value={dropoffAddress}
              onChangeText={setDropoffAddress}
              placeholder="Enter destination"
            />
            <TouchableOpacity
              style={[styles.locationButton, styles.mapButton]}
              onPress={() => openMapForSelection('dropoff')}
            >
              <Ionicons name="map" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.locationHint}>Tap 🗺️ to select destination on map</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Passengers ({passengerCount}/4)</Text>
          <View style={styles.passengerSelector}>
            <TouchableOpacity
              style={styles.passengerButton}
              onPress={() => setPassengerCount(Math.max(1, passengerCount - 1))}
            >
              <Ionicons name="remove" size={20} color="#6B2E2B" />
            </TouchableOpacity>
            <Text style={styles.passengerCount}>{passengerCount}</Text>
            <TouchableOpacity
              style={styles.passengerButton}
              onPress={() => setPassengerCount(Math.min(4, passengerCount + 1))}
            >
              <Ionicons name="add" size={20} color="#6B2E2B" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.requestButton,
            (!pickupAddress.trim() || !dropoffAddress.trim() || activeRide) && styles.requestButtonDisabled
          ]}
          onPress={handleRequestRide}
          disabled={!pickupAddress.trim() || !dropoffAddress.trim() || activeRide}
        >
          <Ionicons name="car" size={20} color="#fff" />
          <Text style={styles.requestButtonText}>Request Ride (₱{passengerCount * 10})</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Map Modal */}
      {showMap && (
        <View style={styles.mapModal}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>
              Select {selectingLocation === 'pickup' ? 'Pickup' : 'Drop-off'} Location
            </Text>
            <TouchableOpacity onPress={() => setShowMap(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.mapContainer}>
            {mapData && (() => {
              const roads = mapData.roads || [];
              console.log('[RideHailing] Rendering map with', roads.length, 'roads');
              return (
                <LeafletMapView
                  region={{
                    latitude: mapData?.config?.center_latitude || 10.3157,
                    longitude: mapData?.config?.center_longitude || 123.8854,
                    latitudeDelta: 0.06,
                    longitudeDelta: 0.06,
                  }}
                  markers={[
                    ...(mapData?.points || []).map(point => ({
                      latitude: parseFloat(point.latitude),
                      longitude: parseFloat(point.longitude),
                      title: point.name,
                      description: point.description || '',
                      pointType: point.point_type,
                      iconColor: point.stroke_color || point.icon_color || '#FF0000',
                      id: point.id,
                    })),
                    ...(pickupLocation ? [{
                      latitude: pickupLocation.latitude,
                      longitude: pickupLocation.longitude,
                      title: 'Pickup Location',
                      description: 'Selected pickup point',
                      pointType: 'pickup',
                      iconColor: '#2E7D32',
                      id: 'selected-pickup'
                    }] : []),
                    ...(dropoffLocation ? [{
                      latitude: dropoffLocation.latitude,
                      longitude: dropoffLocation.longitude,
                      title: 'Drop-off Location',
                      description: 'Selected drop-off point',
                      pointType: 'dropoff',
                      iconColor: '#C62828',
                      id: 'selected-dropoff'
                    }] : [])
                  ]}
                  roads={roads}
                  routes={mapData?.routes || []}
                  onMarkerPress={handleMarkerPress}
                  onMapPress={handleMapPress}
                />
              );
            })()}
          </View>
          <View style={styles.mapInstructions}>
            <Text style={styles.instructionText}>
              {selectingLocation === 'pickup' 
                ? 'Blue lines show available routes. Tap on a terminal marker or anywhere on the map to select pickup location'
                : 'Tap anywhere on the map to select drop-off location'
              }
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  activeRideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    gap: 8,
  },
  activeRideTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  trackButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  trackButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  sectionCard: {
    margin: 16,
    marginBottom: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 44,
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationInput: {
    flex: 1,
  },
  locationButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F5E9E2',
    borderWidth: 1,
    borderColor: '#E0CFC2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadButton: {
    backgroundColor: '#E8F5E8',
    borderColor: '#C8E6C9',
  },
  mapButton: {
    backgroundColor: '#E3F2FD',
    borderColor: '#BBDEFB',
  },
  locationHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  nearestRoadInfo: {
    fontSize: 11,
    color: '#2E7D32',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  passengerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  passengerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5E9E2',
    borderWidth: 2,
    borderColor: '#E0CFC2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6B2E2B',
    minWidth: 40,
    textAlign: 'center',
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B2E2B',
    margin: 16,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  requestButtonDisabled: {
    backgroundColor: '#CCC',
  },
  requestButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  rideCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rideDest: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  rideSpots: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  rideStatus: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  joinButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: '#CCC',
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  mapModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  mapTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
  },
  mapInstructions: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});