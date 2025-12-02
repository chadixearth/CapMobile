import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { getCurrentUser } from '../../services/authService';
import { 
  getAvailableRideBookings, 
  acceptRideBooking,
  driverCancelRideBooking 
} from '../../services/rideHailingService';
import * as Location from 'expo-location';
import BookingDetailsCard from '../../components/BookingDetailsCard';
import TARTRACKHeader from '../../components/TARTRACKHeader';

export default function EnhancedDriverBookScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [user, setUser] = useState(null);
  const [acceptingBooking, setAcceptingBooking] = useState(null);

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'Please log in to view bookings');
        navigation.goBack();
        return;
      }
      setUser(currentUser);
      await loadBookings();
    } catch (error) {
      console.error('Error initializing screen:', error);
      Alert.alert('Error', 'Failed to load booking information');
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      const result = await getAvailableRideBookings();
      if (result.success) {
        // Sort by creation time - most urgent first
        const sortedBookings = (result.data || []).sort((a, b) => {
          return new Date(a.created_at) - new Date(b.created_at);
        });
        setBookings(sortedBookings);
      } else {
        console.error('Failed to load bookings:', result.error);
        setBookings([]);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookings([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const handleAcceptBooking = async (booking) => {
    if (acceptingBooking) return; // Prevent double-tap

    // Check if location services are enabled
    const LocationService = (await import('../../services/locationService')).default;
    const hasPermission = await LocationService.requestPermissions('driver');
    if (!hasPermission) {
      return; // Alert already shown by requestPermissions
    }

    Alert.alert(
      'Accept Booking',
      `Accept this ride for ${booking.passenger_count || 1} passenger${(booking.passenger_count || 1) > 1 ? 's' : ''}?\n\nYou will earn ₱${((booking.passenger_count || 1) * 10 * 0.8).toFixed(0)} from this trip.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setAcceptingBooking(booking.id);
            try {
              const result = await acceptRideBooking(booking.id, {
                driver_id: user.id,
                driver_name: user.name || user.email,
                driver_phone: user.phone || '',
                estimated_arrival: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
              });

              if (result.success) {
                Alert.alert(
                  'Booking Accepted!',
                  'You have successfully accepted this ride. The passenger has been notified.',
                  [
                    {
                      text: 'Start Navigation',
                      onPress: () => {
                        navigation.navigate('DriverRideTracking');
                      }
                    },
                    {
                      text: 'Later',
                      onPress: () => {
                        navigation.navigate('DriverHome');
                      }
                    }
                  ]
                );
                await loadBookings(); // Refresh the list
              } else {
                Alert.alert('Error', result.error || 'Failed to accept booking');
              }
            } catch (error) {
              console.error('Error accepting booking:', error);
              Alert.alert('Error', 'Failed to accept booking. Please try again.');
            } finally {
              setAcceptingBooking(null);
            }
          }
        }
      ]
    );
  };

  const handleDeclineBooking = async (booking) => {
    Alert.alert(
      'Decline Booking',
      'Are you sure you want to decline this ride request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            // For now, just remove from local list
            // In a real app, you might want to track declined bookings
            setBookings(prev => prev.filter(b => b.id !== booking.id));
            Alert.alert('Booking Declined', 'This booking has been removed from your list.');
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B2E2B" />
        <Text style={styles.loadingText}>Loading available rides...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TARTRACKHeader
        onMessagePress={() => navigation.navigate('Chat')}
        onNotificationPress={() => navigation.navigate('Notification')}
      />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Available Rides</Text>
        <Text style={styles.headerSubtitle}>
          {bookings.length} ride{bookings.length !== 1 ? 's' : ''} waiting for drivers
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Available Rides</Text>
            <Text style={styles.emptySubtitle}>
              Check back later for new ride requests in your area.
            </Text>
          </View>
        ) : (
          bookings.map((booking) => (
            <BookingDetailsCard
              key={booking.id}
              booking={booking}
              onAccept={handleAcceptBooking}
              onDecline={handleDeclineBooking}
              userType="driver"
            />
          ))
        )}

        {acceptingBooking && (
          <View style={styles.acceptingOverlay}>
            <ActivityIndicator size="large" color="#6B2E2B" />
            <Text style={styles.acceptingText}>Accepting booking...</Text>
          </View>
        )}
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
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  acceptingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  acceptingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B2E2B',
    fontWeight: '600',
  },
});