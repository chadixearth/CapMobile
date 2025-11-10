import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, Linking, Platform } from 'react-native';
import { createRideBooking, getMyActiveRides } from '../services/rideHailingService';
import LocationService from '../services/locationService';
import RideMonitor from './RideMonitor';
import { getSession } from '../services/authService';

const RideBookingScreen = () => {
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [passengerCount, setPassengerCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeRide, setActiveRide] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUserAndActiveRides();
  }, []);

  const loadUserAndActiveRides = async () => {
    try {
      const session = await getSession();
      if (session?.user) {
        setUser(session.user);
        
        // Check for active rides
        const activeRidesResult = await getMyActiveRides(session.user.id);
        if (activeRidesResult.success && activeRidesResult.data.length > 0) {
          setActiveRide(activeRidesResult.data[0]);
        }
      }
    } catch (error) {
      console.error('Error loading user and active rides:', error);
    }
  };

  const handleBookRide = async () => {
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      Alert.alert('Error', 'Please enter both pickup and dropoff addresses');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Please log in to book a ride');
      return;
    }

    setLoading(true);
    try {
      // Get current location
      const currentLocation = await LocationService.getCurrentLocation();
      
      // If location is null, permissions were denied (Alert already shown)
      if (currentLocation === null) {
        setLoading(false);
        return;
      }

      const bookingData = {
        customer_id: user.id,
        pickup_address: pickupAddress.trim(),
        dropoff_address: dropoffAddress.trim(),
        passenger_count: passengerCount,
        notes: `Ride hailing booking for ${passengerCount} passenger${passengerCount > 1 ? 's' : ''}`,
      };

      // Add location if available
      if (currentLocation) {
        bookingData.pickup_latitude = currentLocation.latitude;
        bookingData.pickup_longitude = currentLocation.longitude;
      }

      const result = await createRideBooking(bookingData);

      if (result.success) {
        Alert.alert('Success', 'Ride booked successfully! Looking for nearby drivers...');
        setActiveRide(result.data);
        setPickupAddress('');
        setDropoffAddress('');
        setPassengerCount(1);
      } else {
        // Handle specific error types
        if (result.error_code === 'DATABASE_SCHEMA_ERROR') {
          Alert.alert(
            'Service Unavailable', 
            'The ride booking service is temporarily unavailable. Please try again in a few minutes.',
            [{ text: 'OK' }]
          );
        } else if (result.error_code === 'ACTIVE_RIDE_EXISTS') {
          Alert.alert(
            'Active Ride Found', 
            result.error,
            [
              { text: 'OK' },
              { text: 'Refresh', onPress: loadUserAndActiveRides }
            ]
          );
        } else {
          Alert.alert('Error', result.error || 'Failed to book ride');
        }
      }
    } catch (error) {
      // Handle database schema errors gracefully
      if (error.message && error.message.includes('ride_type') && error.message.includes('schema cache')) {
        Alert.alert(
          'Service Unavailable', 
          'The ride booking service is temporarily unavailable due to a system update. Please try again in a few minutes.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to book ride. Please try again.');
      }
      console.error('Ride booking error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRideUpdate = (waitInfo) => {
    console.log('Ride wait info updated:', waitInfo);
  };

  const handleRideCancel = () => {
    setActiveRide(null);
    Alert.alert('Ride Cancelled', 'You can book a new ride now.');
  };

  if (activeRide) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Your Active Ride</Text>
        
        <View style={styles.rideDetails}>
          <Text style={styles.detailText}>From: {activeRide.pickup_address}</Text>
          <Text style={styles.detailText}>To: {activeRide.dropoff_address}</Text>
          <Text style={styles.detailText}>Passengers: {activeRide.passenger_count || 1}</Text>
          <Text style={styles.detailText}>Total Fare: ₱{activeRide.total_fare || (activeRide.passenger_count || 1) * 10}</Text>
          <Text style={styles.statusText}>Status: {activeRide.status}</Text>
          
          {activeRide.driver_name && (
            <Text style={styles.driverText}>Driver: {activeRide.driver_name}</Text>
          )}
        </View>

        <RideMonitor
          bookingId={activeRide.id}
          customerId={user?.id}
          onRideUpdate={handleRideUpdate}
          onCancel={handleRideCancel}
          createdAt={activeRide.created_at}
        />

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadUserAndActiveRides}
        >
          <Text style={styles.refreshButtonText}>Refresh Status</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Book a Ride</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Pickup Address"
          value={pickupAddress}
          onChangeText={setPickupAddress}
          multiline
        />

        <TextInput
          style={styles.input}
          placeholder="Dropoff Address"
          value={dropoffAddress}
          onChangeText={setDropoffAddress}
          multiline
        />

        <View style={styles.passengerSection}>
          <Text style={styles.passengerLabel}>Number of Passengers:</Text>
          <View style={styles.passengerControls}>
            <TouchableOpacity
              style={[styles.passengerButton, passengerCount <= 1 && styles.passengerButtonDisabled]}
              onPress={() => setPassengerCount(Math.max(1, passengerCount - 1))}
              disabled={passengerCount <= 1}
            >
              <Text style={styles.passengerButtonText}>-</Text>
            </TouchableOpacity>
            
            <Text style={styles.passengerCount}>{passengerCount}</Text>
            
            <TouchableOpacity
              style={[styles.passengerButton, passengerCount >= 4 && styles.passengerButtonDisabled]}
              onPress={() => setPassengerCount(Math.min(4, passengerCount + 1))}
              disabled={passengerCount >= 4}
            >
              <Text style={styles.passengerButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.fareText}>Fare: ₱{(passengerCount * 10).toFixed(2)} (₱10 per person)</Text>
        </View>

        <TouchableOpacity
          style={[styles.bookButton, loading && styles.bookButtonDisabled]}
          onPress={handleBookRide}
          disabled={loading}
        >
          <Text style={styles.bookButtonText}>
            {loading ? 'Booking...' : 'Book Ride'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.infoText}>
        📍 We'll use your current location for pickup if available
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  form: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    minHeight: 50,
  },
  bookButton: {
    backgroundColor: '#007bff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: '#ccc',
  },
  bookButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  rideDetails: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  detailText: {
    fontSize: 16,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 8,
  },
  driverText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
  },
  refreshButton: {
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  passengerSection: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  passengerLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  passengerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  passengerButton: {
    backgroundColor: '#007bff',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  passengerButtonDisabled: {
    backgroundColor: '#ccc',
  },
  passengerButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  passengerCount: {
    fontSize: 24,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'center',
  },
  fareText: {
    fontSize: 14,
    color: '#28a745',
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default RideBookingScreen;