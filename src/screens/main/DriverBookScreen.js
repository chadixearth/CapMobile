import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { getAvailableBookingsForDrivers, driverAcceptBooking, getDriverBookings } from '../../services/tourpackage/acceptBooking';
import { getAvailableCustomTourRequestsForDrivers, driverAcceptCustomTourRequest } from '../../services/specialpackage/customPackageRequest';
import { getCurrentUser } from '../../services/authService';

export default function DriverBookScreen({ navigation }) {
  const [availableBookings, setAvailableBookings] = useState([]);
  const [availableCustomTours, setAvailableCustomTours] = useState([]);
  const [driverBookings, setDriverBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptingBooking, setAcceptingBooking] = useState(false);
  const [activeTab, setActiveTab] = useState('available'); // 'available' or 'history'

  useEffect(() => {
    fetchUserAndBookings();
  }, []);

  const fetchUserAndBookings = async () => {
    try {
      setLoading(true);
      
      // Check new auth system first
      let currentUser = await getCurrentUser();
      let userId = null;
      
      if (currentUser) {
        // User is logged in via new auth system
        console.log('Current driver user (new auth):', currentUser);
        setUser(currentUser);
        userId = currentUser.id;
      } else {
        // Fallback to Supabase for existing users
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          Alert.alert('Error', 'Please log in to view bookings');
          setLoading(false);
          return;
        }

        console.log('Current driver user (Supabase):', user);
        setUser(user);
        userId = user.id;
      }

      // Fetch available bookings, custom tour requests, and driver's accepted bookings
      try {
        await Promise.all([
          fetchAvailableBookings(userId),
          fetchAvailableCustomTours(),
          fetchDriverBookings(userId)
        ]);
      } catch (error) {
        console.error('Error in Promise.all:', error);
        // Continue even if one fails
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', `Failed to load bookings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableBookings = async (driverId) => {
    try {
      console.log('Fetching available bookings for drivers...');
      const bookingsData = await getAvailableBookingsForDrivers(driverId);
      console.log('Available bookings response:', bookingsData);
      
      // Handle different response formats
      let processedBookings = [];
      if (bookingsData && bookingsData.success && bookingsData.data && Array.isArray(bookingsData.data.bookings)) {
        processedBookings = bookingsData.data.bookings;
      } else if (Array.isArray(bookingsData)) {
        processedBookings = bookingsData;
      } else if (bookingsData && Array.isArray(bookingsData.results)) {
        processedBookings = bookingsData.results;
      } else if (bookingsData && Array.isArray(bookingsData.data)) {
        processedBookings = bookingsData.data;
      } else {
        console.log('Unexpected bookings data format:', bookingsData);
        processedBookings = [];
      }
      
      console.log('Processed available bookings:', processedBookings);
      setAvailableBookings(processedBookings);
    } catch (error) {
      console.error('Error fetching available bookings:', error);
      setAvailableBookings([]);
    }
  };

  const fetchAvailableCustomTours = async () => {
    try {
      console.log('Fetching available custom tour requests for drivers...');
      const customToursData = await getAvailableCustomTourRequestsForDrivers();
      console.log('Available custom tours response:', customToursData);
      
      if (customToursData && customToursData.success && Array.isArray(customToursData.data)) {
        setAvailableCustomTours(customToursData.data);
      } else {
        console.log('Unexpected custom tours data format:', customToursData);
        setAvailableCustomTours([]);
      }
    } catch (error) {
      console.error('Error fetching available custom tours:', error);
      setAvailableCustomTours([]);
    }
  };

  const fetchDriverBookings = async (driverId) => {
    try {
      console.log('Fetching driver bookings for driver ID:', driverId);
      const bookingsData = await getDriverBookings(driverId);
      console.log('Driver bookings response:', bookingsData);
      
      // Handle different response formats
      let processedBookings = [];
      if (bookingsData && bookingsData.success && bookingsData.data && Array.isArray(bookingsData.data.bookings)) {
        processedBookings = bookingsData.data.bookings;
        console.log('Using bookingsData.data.bookings format');
      } else if (bookingsData && bookingsData.success && bookingsData.data && Array.isArray(bookingsData.data)) {
        processedBookings = bookingsData.data;
        console.log('Using bookingsData.data format');
      } else if (Array.isArray(bookingsData)) {
        processedBookings = bookingsData;
        console.log('Using direct array format');
      } else if (bookingsData && Array.isArray(bookingsData.results)) {
        processedBookings = bookingsData.results;
        console.log('Using bookingsData.results format');
      } else {
        console.log('Unexpected driver bookings data format:', bookingsData);
        console.log('Response type:', typeof bookingsData);
        console.log('Response keys:', bookingsData ? Object.keys(bookingsData) : 'null');
        processedBookings = [];
      }
      
      console.log('Processed driver bookings count:', processedBookings.length);
      console.log('First booking sample:', processedBookings[0]);
      setDriverBookings(processedBookings);
    } catch (error) {
      console.error('Error fetching driver bookings:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      setDriverBookings([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserAndBookings();
    setRefreshing(false);
  };

  const refreshHistory = async () => {
    if (user) {
      console.log('Manually refreshing history for user:', user.id);
      await fetchDriverBookings(user.id);
    }
  };

  const handleAcceptBooking = async (booking) => {
    setSelectedBooking(booking);
    setShowAcceptModal(true);
  };

  const confirmAcceptBooking = async () => {
    if (!selectedBooking || !user) return;

    try {
      setAcceptingBooking(true);
      
      let result;
      const driverData = {
        driver_id: user.id,
        driver_name: user.name || user.user_metadata?.name || user.email || 'Driver',
      };

      // Check if this is a custom tour request or regular booking
      if (selectedBooking.request_type === 'custom_tour') {
        result = await driverAcceptCustomTourRequest(selectedBooking.id, driverData);
      } else {
        result = await driverAcceptBooking(selectedBooking.id, driverData);
      }

      console.log('Accept booking/request response:', result);

      if (result.success) {
        const message = selectedBooking.request_type === 'custom_tour' 
          ? 'Custom tour request accepted successfully!' 
          : 'Booking accepted successfully!';
        
        Alert.alert('Success', message, [
          {
            text: 'OK',
            onPress: () => {
              setShowAcceptModal(false);
              setSelectedBooking(null);
              fetchUserAndBookings(); // Refresh all lists
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to accept booking');
      }
    } catch (error) {
      console.error('Error accepting booking:', error);
      Alert.alert('Error', `Failed to accept booking: ${error.message}`);
    } finally {
      setAcceptingBooking(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'waiting_for_driver':
        return '#FF9800';
      case 'driver_assigned':
        return '#4CAF50';
      case 'in_progress':
        return '#2196F3';
      case 'completed':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      case 'pending':
        return '#9C27B0';
      case 'approved':
        return '#4CAF50';
      case 'rejected':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'waiting_for_driver':
        return 'time';
      case 'driver_assigned':
        return 'checkmark-circle';
      case 'in_progress':
        return 'car';
      case 'completed':
        return 'checkmark-done-circle';
      case 'cancelled':
        return 'close-circle';
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
            {booking.status?.replace('_', ' ') || 'Unknown'}
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

      {booking.status === 'waiting_for_driver' && activeTab === 'available' && (
        <TouchableOpacity 
          style={styles.acceptButton}
          onPress={() => handleAcceptBooking(booking)}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.acceptButtonText}>Accept Booking</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderCustomTourCard = (tour) => (
    <View key={tour.id} style={[styles.bookingCard, styles.customTourCard]}>
      <View style={styles.bookingHeader}>
        <View style={styles.bookingInfo}>
          <Text style={styles.bookingReference}>
            Custom Tour #{tour.id.substring(0, 8)}
          </Text>
          <View style={styles.customTourBadge}>
            <Text style={styles.customTourBadgeText}>CUSTOM</Text>
          </View>
        </View>
        <View style={styles.statusContainer}>
          <Ionicons 
            name={getStatusIcon(tour.status)} 
            size={20} 
            color={getStatusColor(tour.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(tour.status) }]}>
            {tour.status?.replace('_', ' ') || 'Unknown'}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Destination:</Text>
          <Text style={styles.detailValue}>{tour.destination || 'N/A'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Customer:</Text>
          <Text style={styles.detailValue}>{tour.customer_name || 'N/A'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Passengers:</Text>
          <Text style={styles.detailValue}>{tour.number_of_pax || 'N/A'}</Text>
        </View>
        
        {tour.pickup_location && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pickup Location:</Text>
            <Text style={styles.detailValue}>{tour.pickup_location}</Text>
          </View>
        )}
        
        {tour.preferred_date && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Preferred Date:</Text>
            <Text style={styles.detailValue}>{formatDate(tour.preferred_date)}</Text>
          </View>
        )}
        
        {tour.preferred_duration_hours && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration:</Text>
            <Text style={styles.detailValue}>{tour.preferred_duration_hours} hours</Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Contact:</Text>
          <Text style={styles.detailValue}>{tour.contact_number || 'N/A'}</Text>
        </View>
        
        {tour.approved_price && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Approved Price:</Text>
            <Text style={styles.detailValue}>{formatCurrency(tour.approved_price)}</Text>
          </View>
        )}
        
        {tour.special_requests && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Special Requests:</Text>
            <Text style={styles.detailValue}>{tour.special_requests}</Text>
          </View>
        )}
      </View>

      {tour.status === 'waiting_for_driver' && activeTab === 'available' && (
        <TouchableOpacity 
          style={[styles.acceptButton, styles.customTourAcceptButton]}
          onPress={() => handleAcceptBooking(tour)}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.acceptButtonText}>Accept Tour</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons 
        name={activeTab === 'available' ? "car-outline" : "time-outline"} 
        size={64} 
        color="#ccc" 
      />
      <Text style={styles.emptyStateTitle}>
        {activeTab === 'available' ? 'No Available Bookings or Custom Tours' : 'No Booking History'}
      </Text>
      <Text style={styles.emptyStateSubtitle}>
        {activeTab === 'available' 
          ? 'There are currently no bookings or custom tours waiting for drivers. Check back later!'
          : 'You haven\'t accepted any bookings yet. Start by accepting available bookings!'
        }
      </Text>
      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={onRefresh}
      >
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity 
        style={[styles.tabButton, activeTab === 'available' && styles.activeTabButton]}
        onPress={() => setActiveTab('available')}
      >
        <Ionicons 
          name="car-outline" 
          size={20} 
          color={activeTab === 'available' ? '#6B2E2B' : '#666'} 
        />
        <Text style={[styles.tabButtonText, activeTab === 'available' && styles.activeTabButtonText]}>
          Available
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
        onPress={() => setActiveTab('history')}
      >
        <Ionicons 
          name="time-outline" 
          size={20} 
          color={activeTab === 'history' ? '#6B2E2B' : '#666'} 
        />
        <Text style={[styles.tabButtonText, activeTab === 'history' && styles.activeTabButtonText]}>
          History
        </Text>
      </TouchableOpacity>
    </View>
  );

  const currentBookings = activeTab === 'available' ? availableBookings : driverBookings;
  const currentCustomTours = activeTab === 'available' ? availableCustomTours : [];

  // Debug logging
  console.log('Current tab:', activeTab);
  console.log('Available bookings count:', availableBookings.length);
  console.log('Driver bookings count:', driverBookings.length);
  console.log('Current bookings to display:', currentBookings.length);

  return (
    <View style={styles.container}>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {activeTab === 'available' ? 'Available Bookings & Custom Tours' : 'Booking History'}
          </Text>
          <Text style={styles.subtitle}>
            {user?.name || user?.user_metadata?.name || user?.email || 'Driver'}'s {activeTab === 'available' ? 'available' : 'accepted'} bookings
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={onRefresh}
            >
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
            {activeTab === 'history' && (
              <TouchableOpacity 
                style={[styles.refreshButton, { marginLeft: 8 }]}
                onPress={refreshHistory}
              >
                <Text style={styles.refreshButtonText}>Debug History</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {renderTabBar()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              Loading {activeTab === 'available' ? 'available' : 'accepted'} bookings...
            </Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            {(currentBookings.length > 0 || currentCustomTours.length > 0) ? (
              <>
                {currentBookings.map(renderBookingCard)}
                {currentCustomTours.map(renderCustomTourCard)}
              </>
            ) : (
              renderEmptyState()
            )}
          </ScrollView>
        )}
      </View>

      {/* Accept Booking Modal */}
      <Modal
        visible={showAcceptModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAcceptModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedBooking?.request_type === 'custom_tour' ? 'Accept Custom Tour' : 'Accept Booking'}
            </Text>
            <Text style={styles.modalText}>
              Are you sure you want to accept this {selectedBooking?.request_type === 'custom_tour' ? 'custom tour request' : 'booking'}?
            </Text>
            {selectedBooking && (
              <View style={styles.modalBookingInfo}>
                {selectedBooking.request_type === 'custom_tour' ? (
                  <>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Destination:</Text> {selectedBooking.destination || 'N/A'}
                    </Text>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Customer:</Text> {selectedBooking.customer_name || 'N/A'}
                    </Text>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Passengers:</Text> {selectedBooking.number_of_pax}
                    </Text>
                    {selectedBooking.preferred_date && (
                      <Text style={styles.modalBookingText}>
                        <Text style={styles.modalLabel}>Preferred Date:</Text> {formatDate(selectedBooking.preferred_date)}
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Package:</Text> {selectedBooking.package_name}
                    </Text>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Date:</Text> {formatDate(selectedBooking.booking_date)}
                    </Text>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Passengers:</Text> {selectedBooking.number_of_pax}
                    </Text>
                    <Text style={styles.modalBookingText}>
                      <Text style={styles.modalLabel}>Pickup:</Text> {selectedBooking.pickup_address}
                    </Text>
                  </>
                )}
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAcceptModal(false)}
                disabled={acceptingBooking}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton, acceptingBooking && styles.disabledButton]}
                onPress={confirmAcceptBooking}
                disabled={acceptingBooking}
              >
                {acceptingBooking ? (
                  <Text style={styles.confirmButtonText}>Accepting...</Text>
                ) : (
                  <Text style={styles.confirmButtonText}>Accept</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
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
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#6B2E2B',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  activeTabButtonText: {
    color: '#fff',
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
    marginBottom: 12,
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
  acceptButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
  refreshButton: {
    backgroundColor: '#6B2E2B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginHorizontal: 20,
    maxWidth: 400,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalBookingInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  modalBookingText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  modalLabel: {
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  // Custom tour card styles
  customTourCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  customTourBadge: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  customTourBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  customTourAcceptButton: {
    backgroundColor: '#9C27B0',
  },
});
