import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LeafletMapView from '../../components/LeafletMapView';
import BackButton from '../../components/BackButton';
import { getActiveRides, startRideBooking, completeRideBooking, updateDriverLocation } from '../../services/rideHailingService';
import { getCurrentUser } from '../../services/authService';
import LocationService from '../../services/locationService';
import { getAllRoadHighlightsWithPoints, processRoadHighlightsForMap } from '../../services/roadHighlightsService';
import { validateTripStart } from '../../services/tourpackage/tripStartConstraints';

export default function DriverRideTrackingScreen({ navigation, route }) {
  const [loading, setLoading] = useState(true);
  const [activeRide, setActiveRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [routeData, setRouteData] = useState([]);
  const [roadHighlights, setRoadHighlights] = useState([]);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [distance, setDistance] = useState(null);
  const [user, setUser] = useState(null);
  const [carriageInfo, setCarriageInfo] = useState(null);

  useEffect(() => {
    initializeScreen();
    const locationInterval = setInterval(updateLocation, 5000);
    return () => clearInterval(locationInterval);
  }, []);

  const initializeScreen = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'Please log in');
        navigation.goBack();
        return;
      }
      setUser(currentUser);

      // Get active ride
      const result = await getActiveRides(currentUser.id, 'driver');
      if (result.success && result.data && result.data.length > 0) {
        const ride = result.data[0];
        setActiveRide(ride);
        
        // Get carriage info
        if (ride.carriage_id) {
          setCarriageInfo({ name: `Tartanilla ${ride.carriage_id}` });
        }

        // Get initial location
        await updateLocation();
        
        // Load road highlights
        await loadRoadHighlights();
      } else {
        Alert.alert('No Active Ride', 'You don\'t have any active rides');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error initializing:', error);
      Alert.alert('Error', 'Failed to load ride information');
    } finally {
      setLoading(false);
    }
  };

  const loadRoadHighlights = async () => {
    try {
      const roadHighlightsResult = await getAllRoadHighlightsWithPoints();
      if (roadHighlightsResult.success && roadHighlightsResult.roadHighlights) {
        const processedRoads = processRoadHighlightsForMap(roadHighlightsResult.roadHighlights);
        setRoadHighlights(processedRoads);
      }
    } catch (error) {
      console.error('Error loading road highlights:', error);
    }
  };

  const updateLocation = async () => {
    try {
      const location = await LocationService.getCurrentLocation();
      const newLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed || 0,
        heading: location.heading || 0,
      };
      setDriverLocation(newLocation);

      // Update backend
      if (user?.id) {
        await updateDriverLocation(user.id, location.latitude, location.longitude, location.speed || 0, location.heading || 0);
      }

      // Fetch route if we have a destination
      if (activeRide) {
        const destination = activeRide.status === 'driver_assigned' 
          ? { latitude: activeRide.pickup_latitude, longitude: activeRide.pickup_longitude }
          : { latitude: activeRide.dropoff_latitude, longitude: activeRide.dropoff_longitude };
        
        if (destination.latitude && destination.longitude) {
          await fetchRoute(newLocation, destination);
        }
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const fetchRoute = async (from, to) => {
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson&steps=true`;
      
      const response = await fetch(osrmUrl);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates;
        
        setRouteData([{
          coordinates: coordinates.map(coord => ({ lat: coord[1], lng: coord[0] })),
          color: '#FF6B35',
          weight: 5,
          opacity: 0.9,
          name: 'Route',
          id: 'driver_route'
        }]);

        // Calculate estimated time
        const durationMinutes = Math.ceil(route.duration / 60);
        setEstimatedTime(durationMinutes);
        setDistance((route.distance / 1000).toFixed(1));
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      setRouteData([]);
    }
  };

  const handleStartRide = async () => {
    if (!activeRide || activeRide.status !== 'driver_assigned') return;
    
    // Validate trip start constraints for tour packages
    if (activeRide.booking_type === 'tour_package') {
      const validation = validateTripStart(activeRide);
      if (!validation.canStart) {
        Alert.alert('Cannot Start Trip', validation.message);
        return;
      }
    }
    
    try {
      const result = await startRideBooking(activeRide.id, { driver_id: user.id });
      if (result.success) {
        setActiveRide({ ...activeRide, status: 'in_progress' });
        Alert.alert('Ride Started', 'Navigate to the destination');
      } else {
        Alert.alert('Error', result.error || 'Failed to start ride');
      }
    } catch (error) {
      console.error('Error starting ride:', error);
      Alert.alert('Error', 'Failed to start ride');
    }
  };

  const handleCompleteRide = async () => {
    if (!activeRide || activeRide.status !== 'in_progress') return;
    
    Alert.alert(
      'Complete Ride',
      'Have you reached the destination?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              const result = await completeRideBooking(activeRide.id, { driver_id: user.id });
              if (result.success) {
                Alert.alert('Ride Completed', 'Great job!', [
                  { text: 'OK', onPress: () => navigation.goBack() }
                ]);
              } else {
                Alert.alert('Error', result.error || 'Failed to complete ride');
              }
            } catch (error) {
              console.error('Error completing ride:', error);
              Alert.alert('Error', 'Failed to complete ride');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B2E2B" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!activeRide || !driverLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Ride Tracking</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No active ride found</Text>
        </View>
      </View>
    );
  }

  const pickupCoords = { latitude: activeRide.pickup_latitude, longitude: activeRide.pickup_longitude };
  const dropoffCoords = { latitude: activeRide.dropoff_latitude, longitude: activeRide.dropoff_longitude };
  const destination = activeRide.status === 'driver_assigned' ? pickupCoords : dropoffCoords;

  const markers = [
    {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
      title: 'Your Location',
      description: carriageInfo ? carriageInfo.name : 'You are here',
      iconColor: '#FF9800',
      type: 'driver',
      id: 'driver_location'
    },
    {
      latitude: pickupCoords.latitude,
      longitude: pickupCoords.longitude,
      title: 'Pickup',
      description: activeRide.pickup_address,
      iconColor: '#2E7D32',
      id: 'pickup'
    },
    {
      latitude: dropoffCoords.latitude,
      longitude: dropoffCoords.longitude,
      title: 'Destination',
      description: activeRide.dropoff_address,
      iconColor: '#C62828',
      id: 'dropoff'
    }
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Active Ride</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Carriage Info Banner */}
      {carriageInfo && (
        <View style={styles.carriageBanner}>
          <Ionicons name="car-sport" size={20} color="#6B2E2B" />
          <Text style={styles.carriageText}>{carriageInfo.name} is on the way</Text>
        </View>
      )}

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {activeRide.status === 'driver_assigned' ? 'Going to Pickup' : 'Going to Destination'}
            </Text>
          </View>
          {estimatedTime && (
            <View style={styles.timeContainer}>
              <Ionicons name="time" size={16} color="#666" />
              <Text style={styles.timeText}>{estimatedTime} min</Text>
            </View>
          )}
        </View>
        
        {distance && (
          <View style={styles.distanceRow}>
            <Ionicons name="navigate" size={16} color="#666" />
            <Text style={styles.distanceText}>{distance} km away</Text>
          </View>
        )}

        <View style={styles.addressContainer}>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color="#2E7D32" />
            <Text style={styles.addressText} numberOfLines={1}>{activeRide.pickup_address}</Text>
          </View>
          <View style={styles.addressRow}>
            <Ionicons name="flag" size={16} color="#C62828" />
            <Text style={styles.addressText} numberOfLines={1}>{activeRide.dropoff_address}</Text>
          </View>
        </View>

        <View style={styles.passengerRow}>
          <Ionicons name="people" size={16} color="#666" />
          <Text style={styles.passengerText}>{activeRide.passenger_count || 1} passenger{(activeRide.passenger_count || 1) > 1 ? 's' : ''}</Text>
          <View style={styles.fareContainer}>
            <Ionicons name="cash" size={16} color="#2E7D32" />
            <Text style={styles.fareText}>₱{((activeRide.passenger_count || 1) * 10 * 0.8).toFixed(0)}</Text>
          </View>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <LeafletMapView
          region={{
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          markers={markers}
          roads={[...roadHighlights, ...routeData]}
          routes={[]}
          showSatellite={false}
        />
      </View>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        {activeRide.status === 'driver_assigned' && (() => {
          // Check constraints for tour packages
          if (activeRide.booking_type === 'tour_package') {
            const validation = validateTripStart(activeRide);
            if (!validation.canStart) {
              return (
                <View style={styles.constraintContainer}>
                  <View style={styles.constraintBadge}>
                    <Ionicons name="time-outline" size={18} color="#F57C00" />
                    <Text style={styles.constraintText}>{validation.message}</Text>
                  </View>
                  <TouchableOpacity style={[styles.actionButton, styles.disabledButton]} disabled>
                    <Ionicons name="lock-closed" size={20} color="#999" />
                    <Text style={styles.disabledButtonText}>Start Trip</Text>
                  </TouchableOpacity>
                </View>
              );
            }
          }
          return (
            <TouchableOpacity style={styles.actionButton} onPress={handleStartRide}>
              <Ionicons name="play" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Start Trip</Text>
            </TouchableOpacity>
          );
        })()}
        {activeRide.status === 'in_progress' && (
          <TouchableOpacity style={[styles.actionButton, styles.completeButton]} onPress={handleCompleteRide}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Complete Trip</Text>
          </TouchableOpacity>
        )}
      </View>
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
  carriageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  carriageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B2E2B',
  },
  statusCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  distanceText: {
    fontSize: 14,
    color: '#666',
  },
  addressContainer: {
    gap: 8,
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  passengerText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  fareContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fareText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  actionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  constraintContainer: {
    gap: 12,
  },
  constraintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  constraintText: {
    flex: 1,
    fontSize: 14,
    color: '#E65100',
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B2E2B',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
  },
  completeButton: {
    backgroundColor: '#2E7D32',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  disabledButtonText: {
    color: '#999',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});
