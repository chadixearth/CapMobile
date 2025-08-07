import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TARTRACKHeader from '../../components/TARTRACKHeader';
import { supabase } from '../../services/supabase';
import { getCustomerBookings } from '../../services/tourpackage/requestBooking';

export default function BookScreen({ navigation }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUserAndBookings();
  }, []);

  const fetchUserAndBookings = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        Alert.alert('Error', 'Please log in to view your bookings');
        return;
      }

      console.log('Current user:', user);
      setUser(user);

      // Fetch user's bookings
      console.log('Fetching bookings for user ID:', user.id);
      const bookingsData = await getCustomerBookings(user.id);
      console.log('Bookings data received:', bookingsData);
      
      // Handle different response formats
      let processedBookings = [];
      if (Array.isArray(bookingsData)) {
        processedBookings = bookingsData;
      } else if (bookingsData && Array.isArray(bookingsData.results)) {
        processedBookings = bookingsData.results;
      } else if (bookingsData && Array.isArray(bookingsData.data)) {
        processedBookings = bookingsData.data;
      } else if (bookingsData && bookingsData.bookings) {
        processedBookings = bookingsData.bookings;
      } else if (bookingsData && bookingsData.data && Array.isArray(bookingsData.data.bookings)) {
        // Handle the nested structure: {data: {bookings: [...]}}
        processedBookings = bookingsData.data.bookings;
      } else if (bookingsData && bookingsData.success && bookingsData.data && Array.isArray(bookingsData.data.bookings)) {
        // Handle the structure: {success: true, data: {bookings: [...]}}
        processedBookings = bookingsData.data.bookings;
      } else {
        console.log('Unexpected bookings data format:', bookingsData);
        processedBookings = [];
      }
      
      console.log('Processed bookings:', processedBookings);
      if (processedBookings.length > 0) {
        console.log('First booking sample:', processedBookings[0]);
      }
      setBookings(processedBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', `Failed to load your bookings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserAndBookings();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      case 'completed':
        return '#2196F3';
      default:
        return '#757575';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'cancelled':
        return 'close-circle';
      case 'completed':
        return 'checkmark-done-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    return timeString;
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return `₱${parseFloat(amount).toFixed(2)}`;
  };

  const renderBookingCard = (booking) => (
    <View key={booking.id} style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={styles.bookingInfo}>
          <Text style={styles.bookingReference}>
            Ref: {booking.booking_reference || 'N/A'}
          </Text>
          <Text style={styles.bookingDate}>
            {formatDate(booking.booking_date)}
          </Text>
        </View>
        <View style={styles.statusContainer}>
          <Ionicons 
            name={getStatusIcon(booking.status)} 
            size={20} 
            color={getStatusColor(booking.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
            {booking.status || 'Unknown'}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Package:</Text>
          <Text style={styles.detailValue}>{booking.package_name || 'N/A'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Pickup Time:</Text>
          <Text style={styles.detailValue}>{formatTime(booking.pickup_time)}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Passengers:</Text>
          <Text style={styles.detailValue}>{booking.number_of_pax || 'N/A'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Pickup Address:</Text>
          <Text style={styles.detailValue}>{booking.pickup_address || 'N/A'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Contact:</Text>
          <Text style={styles.detailValue}>{booking.contact_number || 'N/A'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Total Amount:</Text>
          <Text style={styles.detailValue}>{formatCurrency(booking.total_amount)}</Text>
        </View>
        
        {booking.special_requests && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Special Requests:</Text>
            <Text style={styles.detailValue}>{booking.special_requests}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateTitle}>No Bookings Found</Text>
      <Text style={styles.emptyStateSubtitle}>
        You haven't made any bookings yet. Start exploring our tour packages!
      </Text>
      <TouchableOpacity 
        style={styles.exploreButton}
        onPress={() => navigation.navigate('TouristHome')}
      >
        <Text style={styles.exploreButtonText}>Explore Packages</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <TARTRACKHeader onNotificationPress={() => navigation.navigate('NotificationScreen')} />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>My Bookings</Text>
          <Text style={styles.subtitle}>
            {user?.user_metadata?.name || user?.email || 'User'}'s booking history
          </Text>
          <TouchableOpacity 
            style={styles.debugButton}
            onPress={() => {
              console.log('Testing API connection...');
              fetchUserAndBookings();
            }}
          >
            <Text style={styles.debugButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading your bookings...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            {bookings.length > 0 ? (
              bookings.map(renderBookingCard)
            ) : (
              renderEmptyState()
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  bookingInfo: {
    flex: 1,
  },
  bookingReference: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  bookingDate: {
    fontSize: 14,
    color: '#666',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  bookingDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  exploreButton: {
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
