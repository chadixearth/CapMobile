import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../../services/authService';
import { 
  getAvailableRideBookings, 
  acceptRideBooking 
} from '../../services/rideHailingService';
import { getCarriagesByOwner } from '../../services/api';
import OwnerBookingCard from '../../components/OwnerBookingCard';
import TARTRACKHeader from '../../components/TARTRACKHeader';

export default function EnhancedOwnerBookScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [user, setUser] = useState(null);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [assigning, setAssigning] = useState(false);

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
      await Promise.all([loadBookings(), loadAvailableDrivers()]);
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
        // Sort by urgency - oldest bookings first
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

  const loadAvailableDrivers = async () => {
    try {
      if (!user?.id) return;
      
      const carriagesResult = await getCarriagesByOwner(user.id);
      if (carriagesResult.success) {
        // Extract available drivers from carriages
        const drivers = carriagesResult.data
          .filter(carriage => 
            carriage.assigned_driver && 
            carriage.status === 'available'
          )
          .map(carriage => ({
            id: carriage.assigned_driver.id || carriage.assigned_driver_id,
            name: carriage.assigned_driver.name || 
                  carriage.assigned_driver.full_name ||
                  `${carriage.assigned_driver.first_name || ''} ${carriage.assigned_driver.last_name || ''}`.trim() ||
                  'Unknown Driver',
            phone: carriage.assigned_driver.phone || '',
            carriage_id: carriage.id,
            carriage_plate: carriage.plate_number,
            status: 'available'
          }))
          .filter(driver => driver.id); // Remove drivers without IDs

        setAvailableDrivers(drivers);
      }
    } catch (error) {
      console.error('Error loading available drivers:', error);
      setAvailableDrivers([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBookings(), loadAvailableDrivers()]);
    setRefreshing(false);
  };

  const handleAssignDriver = (booking) => {
    if (availableDrivers.length === 0) {
      Alert.alert(
        'No Available Drivers',
        'You don\'t have any available drivers in your fleet at the moment. Make sure your carriages are assigned to drivers and marked as available.',
        [{ text: 'OK' }]
      );
      return;
    }

    setSelectedBooking(booking);
    setShowDriverModal(true);
  };

  const handleDriverSelection = async (driver) => {
    if (!selectedBooking || assigning) return;

    setAssigning(true);
    try {
      const result = await acceptRideBooking(selectedBooking.id, {
        driver_id: driver.id,
        driver_name: driver.name,
        driver_phone: driver.phone,
        carriage_id: driver.carriage_id,
        estimated_arrival: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
      });

      if (result.success) {
        Alert.alert(
          'Driver Assigned Successfully!',
          `${driver.name} has been assigned to this ride. The passenger has been notified.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setShowDriverModal(false);
                setSelectedBooking(null);
                loadBookings(); // Refresh bookings
              }
            }
          ]
        );
      } else {
        Alert.alert('Assignment Failed', result.error || 'Failed to assign driver');
      }
    } catch (error) {
      console.error('Error assigning driver:', error);
      Alert.alert('Error', 'Failed to assign driver. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  const handleViewDetails = (booking) => {
    Alert.alert(
      'Booking Details',
      `Booking ID: ${booking.id}\n` +
      `Created: ${new Date(booking.created_at).toLocaleString()}\n` +
      `Passengers: ${booking.passenger_count || 1}\n` +
      `From: ${booking.pickup_address}\n` +
      `To: ${booking.dropoff_address}\n` +
      `Total Fare: ₱${(booking.passenger_count || 1) * 10}\n` +
      `Your Share: ₱${(booking.passenger_count || 1) * 10 * 0.2}\n` +
      `Status: ${booking.status}` +
      (booking.notes ? `\n\nNotes: ${booking.notes}` : ''),
      [{ text: 'OK' }]
    );
  };

  const getBookingStats = () => {
    const total = bookings.length;
    const urgent = bookings.filter(b => {
      if (!b.created_at) return false;
      const diffMins = (new Date() - new Date(b.created_at)) / (1000 * 60);
      return diffMins > 10;
    }).length;
    const totalRevenue = bookings.reduce((sum, b) => sum + ((b.passenger_count || 1) * 10 * 0.2), 0);
    
    return { total, urgent, totalRevenue };
  };

  const stats = getBookingStats();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B2E2B" />
        <Text style={styles.loadingText}>Loading fleet bookings...</Text>
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
        <Text style={styles.headerTitle}>Fleet Management</Text>
        <Text style={styles.headerSubtitle}>
          Manage ride assignments for your tartanilla fleet
        </Text>
      </View>

      {/* Stats Overview */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Active Bookings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: stats.urgent > 0 ? '#DC2626' : '#059669' }]}>
            {stats.urgent}
          </Text>
          <Text style={styles.statLabel}>Urgent</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#6B2E2B' }]}>₱{stats.totalRevenue}</Text>
          <Text style={styles.statLabel}>Potential Revenue</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{availableDrivers.length}</Text>
          <Text style={styles.statLabel}>Available Drivers</Text>
        </View>
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
            <Ionicons name="car-outline" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>No Active Bookings</Text>
            <Text style={styles.emptySubtitle}>
              Your fleet is ready for new ride requests.
            </Text>
          </View>
        ) : (
          bookings.map((booking) => (
            <OwnerBookingCard
              key={booking.id}
              booking={booking}
              onAssignDriver={handleAssignDriver}
              onViewDetails={handleViewDetails}
              availableDrivers={availableDrivers}
            />
          ))
        )}
      </ScrollView>

      {/* Driver Assignment Modal */}
      <Modal
        visible={showDriverModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => !assigning && setShowDriverModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Driver</Text>
              <TouchableOpacity 
                onPress={() => !assigning && setShowDriverModal(false)}
                disabled={assigning}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedBooking && (
              <View style={styles.bookingInfo}>
                <Text style={styles.bookingInfoTitle}>Booking Details:</Text>
                <Text style={styles.bookingInfoText}>
                  {selectedBooking.passenger_count || 1} passenger{(selectedBooking.passenger_count || 1) > 1 ? 's' : ''} • ₱{(selectedBooking.passenger_count || 1) * 10}
                </Text>
                <Text style={styles.bookingInfoText} numberOfLines={1}>
                  From: {selectedBooking.pickup_address}
                </Text>
                <Text style={styles.bookingInfoText} numberOfLines={1}>
                  To: {selectedBooking.dropoff_address}
                </Text>
              </View>
            )}

            <Text style={styles.driverListTitle}>Available Drivers:</Text>
            
            <FlatList
              data={availableDrivers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.driverItem, assigning && styles.driverItemDisabled]}
                  onPress={() => handleDriverSelection(item)}
                  disabled={assigning}
                >
                  <View style={styles.driverInfo}>
                    <View style={styles.driverAvatar}>
                      <Ionicons name="person" size={20} color="#6B2E2B" />
                    </View>
                    <View style={styles.driverDetails}>
                      <Text style={styles.driverName}>{item.name}</Text>
                      <Text style={styles.driverCarriage}>
                        Carriage: {item.carriage_plate || `TC${item.carriage_id}`}
                      </Text>
                      {item.phone && (
                        <Text style={styles.driverPhone}>{item.phone}</Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#CCC" />
                </TouchableOpacity>
              )}
              style={styles.driverList}
            />

            {assigning && (
              <View style={styles.assigningOverlay}>
                <ActivityIndicator size="large" color="#6B2E2B" />
                <Text style={styles.assigningText}>Assigning driver...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  bookingInfo: {
    backgroundColor: '#F8F9FA',
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  bookingInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bookingInfoText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  driverListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  driverList: {
    maxHeight: 300,
  },
  driverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  driverItemDisabled: {
    opacity: 0.5,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  driverCarriage: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  driverPhone: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  assigningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assigningText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B2E2B',
    fontWeight: '600',
  },
});