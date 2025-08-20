import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { getCustomerBookings } from '../../services/tourpackage/requestBooking';
import { getCurrentUser } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';

const MAROON = '#6B2E2B';

export default function BookScreen({ navigation }) {
  // All hooks must be called at the top level, before any conditional returns
  const auth = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // all | upcoming | completed | cancelled | pending | confirmed
  const [searchQuery, setSearchQuery] = useState('');

  // Handle authentication redirect in useEffect to avoid hooks rule violation
  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
    }
  }, [auth.loading, auth.isAuthenticated, navigation]);

  useEffect(() => {
    if (!auth.loading && auth.isAuthenticated) {
      fetchUserAndBookings();
    }
  }, [auth.loading, auth.isAuthenticated]);

  // Show loading while auth is being determined
  if (auth.loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Return null while redirecting (but after all hooks have been called)
  if (!auth.isAuthenticated) {
    return null;
  }

  const fetchUserAndBookings = async () => {
    try {
      setLoading(true);
      
      // Check new auth system first
      let currentUser = await getCurrentUser();
      let userId = null;
      
      if (currentUser) {
        // User is logged in via new auth system
        console.log('Current user (new auth):', currentUser);
        setUser(currentUser);
        userId = currentUser.id;
      } else {
        // Fallback to Supabase for existing users
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          Alert.alert('Error', 'Please log in to view your bookings');
          return;
        }

        console.log('Current user (Supabase):', user);
        setUser(user);
        userId = user.id;
      }

      // Fetch user's bookings
      console.log('Fetching bookings for user ID:', userId);
      const bookingsData = await getCustomerBookings(userId);
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

  // Derived filtered list
  const filterMatches = (booking) => {
    const status = (booking.status || '').toLowerCase();
    if (activeFilter === 'all') return true;
    if (activeFilter === 'upcoming') return status === 'pending' || status === 'confirmed';
    if (activeFilter === 'completed') return status === 'completed';
    if (activeFilter === 'cancelled') return status === 'cancelled';
    if (activeFilter === 'pending') return status === 'pending';
    if (activeFilter === 'confirmed') return status === 'confirmed';
    return true;
  };

  const searchMatches = (booking) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      (booking.booking_reference || '').toLowerCase().includes(q) ||
      (booking.package_name || '').toLowerCase().includes(q)
    );
  };

  const filteredBookings = bookings.filter((b) => filterMatches(b) && searchMatches(b));

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>My Bookings</Text>
          <Text style={styles.subtitle}>
            {user?.name || user?.user_metadata?.name || user?.email || 'User'}'s booking history
          </Text>
          <View style={styles.headerActions}>
            {(user?.role === 'tourist' || (!user?.role && user)) && (
              <TouchableOpacity 
                style={styles.pillButton}
                onPress={() => navigation.navigate('CustomRequestHistory')}
              >
                <Ionicons name="time-outline" size={16} color="#fff" />
                <Text style={styles.pillButtonText}>Custom Requests</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.pillButton, { backgroundColor: '#444' }]}
              onPress={() => fetchUserAndBookings()}
            >
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.pillButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by reference or package"
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
          {['all','upcoming','confirmed','pending','completed','cancelled'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading your bookings...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          >
            {filteredBookings.length > 0 ? (
              filteredBookings.map(renderBookingCard)
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  historyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    paddingHorizontal: 24,
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
    backgroundColor: MAROON,
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
    display: 'none',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#333',
  },
  filtersRow: {
    paddingHorizontal: 12,
    marginBottom: 12,
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
    color: MAROON,
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: MAROON,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
