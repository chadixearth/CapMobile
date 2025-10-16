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
import BackButton from '../../components/BackButton';

export default function RideHailingScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [passengerCount, setPassengerCount] = useState(1);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [user, setUser] = useState(null);
  const [activeRide, setActiveRide] = useState(null);

  useEffect(() => {
    initializeScreen();
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



  const onRefresh = async () => {
    setRefreshing(true);
    await initializeScreen();
    setRefreshing(false);
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
      } else {
        Alert.alert('Error', result.error || 'Failed to create ride');
      }
    } catch (error) {
      console.error('Error requesting ride:', error);
      Alert.alert('Error', 'Failed to request ride');
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
          <TextInput
            style={styles.addressInput}
            value={pickupAddress}
            onChangeText={setPickupAddress}
            placeholder="Enter pickup location"
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Destination</Text>
          <TextInput
            style={styles.addressInput}
            value={dropoffAddress}
            onChangeText={setDropoffAddress}
            placeholder="Enter destination"
          />
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
});