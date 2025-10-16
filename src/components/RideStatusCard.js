import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { checkRideStatus, getDriverLocation, cancelRideBooking } from '../services/rideHailingService';
import LiveTrackingMap from './LiveTrackingMap';
import { useNavigation } from '@react-navigation/native';

const RideStatusCard = ({ ride, onRefresh }) => {
  const navigation = useNavigation();
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [waitingTime, setWaitingTime] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (ride.status === 'driver_assigned' && ride.driver_id) {
      fetchDriverLocation();
      const interval = setInterval(fetchDriverLocation, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [ride]);

  useEffect(() => {
    if (ride.status === 'waiting_for_driver') {
      let startTime;
      try {
        startTime = new Date(ride.created_at).getTime();
        if (isNaN(startTime)) {
          startTime = Date.now();
        }
      } catch {
        startTime = Date.now();
      }
      
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setWaitingTime(Math.max(0, elapsed));
        
        if (elapsed >= 300 && elapsed < 305) { // Show alert only once between 5:00-5:05
          Alert.alert(
            'Still Looking for Driver',
            'It\'s been 5 minutes. Would you like to rebook or cancel your ride?',
            [
              { text: 'Cancel Ride', style: 'destructive', onPress: confirmCancelRide },
              { text: 'Rebook Ride', onPress: () => {
                confirmCancelRide();
                setTimeout(() => navigation.navigate('Home'), 500);
              }}
            ]
          );
        }
      };
      
      updateTimer();
      const timer = setInterval(updateTimer, 1000);
      
      return () => clearInterval(timer);
    } else {
      setWaitingTime(0);
    }
  }, [ride.status, ride.created_at, ride.id]);

  const fetchDriverLocation = async () => {
    try {
      console.log(`[RideStatusCard] Fetching location for driver: ${ride.driver_id}`);
      const result = await getDriverLocation(ride.driver_id);
      console.log(`[RideStatusCard] Location result:`, result);
      
      if (result.success && result.data) {
        const locationData = {
          ...result.data,
          latitude: parseFloat(result.data.latitude),
          longitude: parseFloat(result.data.longitude),
          lastUpdate: new Date(result.data.updated_at || Date.now())
        };
        console.log(`[RideStatusCard] Setting driver location:`, locationData);
        setDriverLocation(locationData);
      } else {
        console.log('[RideStatusCard] No driver location found:', result.error);
      }
    } catch (error) {
      console.error('[RideStatusCard] Error fetching driver location:', error);
    }
  };

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const result = await checkRideStatus(ride.id);
      if (result.success && onRefresh) {
        onRefresh(result.data);
      }
    } catch (error) {
      console.error('Error refreshing ride status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = () => {
    switch (ride.status) {
      case 'waiting_for_driver':
        const minutes = Math.floor(waitingTime / 60);
        const seconds = waitingTime % 60;
        return {
          icon: 'time-outline',
          color: '#FF9500',
          text: 'Looking for driver...',
          subtitle: `Waiting ${minutes}:${seconds.toString().padStart(2, '0')} - Finding you a driver`
        };
      case 'driver_assigned':
        return {
          icon: 'car-outline',
          color: '#007AFF',
          text: `${ride.driver_name || 'Driver'} is on the way`,
          subtitle: driverLocation ? 
            `Location updated ${driverLocation.lastUpdate ? driverLocation.lastUpdate.toLocaleTimeString() : 'recently'}` : 
            'Getting driver location...'
        };
      case 'in_progress':
        return {
          icon: 'navigate-outline',
          color: '#34C759',
          text: 'Trip in progress',
          subtitle: 'Enjoy your ride!'
        };
      case 'completed':
        return {
          icon: 'checkmark-circle-outline',
          color: '#34C759',
          text: 'Trip completed',
          subtitle: 'Thank you for riding with us'
        };
      default:
        return {
          icon: 'help-outline',
          color: '#8E8E93',
          text: 'Unknown status',
          subtitle: ''
        };
    }
  };

  const handleMessageDriver = () => {
    navigation.navigate('Communication', { 
      screen: 'ChatRoom',
      params: { 
        bookingId: ride.id,
        subject: `Ride: ${ride.pickup_address?.substring(0, 15) || 'Pickup'} → ${ride.dropoff_address?.substring(0, 15) || 'Destination'}`,
        participantRole: 'driver',
        requestType: 'ride_hailing',
        userRole: 'passenger',
        contactName: ride.driver_name || 'Driver'
      }
    });
  };

  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'Keep Ride', style: 'cancel' },
        { text: 'Cancel Ride', style: 'destructive', onPress: confirmCancelRide }
      ]
    );
  };

  const confirmCancelRide = async () => {
    setCancelling(true);
    try {
      console.log('Cancelling ride:', ride.id, 'for customer:', ride.customer_id);
      const result = await cancelRideBooking(ride.id, {
        customer_id: ride.customer_id,
        reason: 'Customer cancelled from mobile app'
      });
      console.log('Cancel result:', result);
      if (result.success) {
        // Remove the ride from the list immediately
        if (onRefresh) {
          onRefresh({ ...ride, status: 'cancelled' });
        }
        Alert.alert('Ride Cancelled', 'Your ride has been cancelled successfully.');
      } else {
        console.error('Cancel failed:', result);
        Alert.alert('Error', result.error || 'Failed to cancel ride');
      }
    } catch (error) {
      console.error('Error cancelling ride:', error);
      Alert.alert('Error', 'Failed to cancel ride. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.statusContainer}>
          <Ionicons name={statusInfo.icon} size={24} color={statusInfo.color} />
          <View style={styles.statusText}>
            <Text style={styles.statusTitle}>{statusInfo.text}</Text>
            <Text style={styles.statusSubtitle}>{statusInfo.subtitle}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={refreshStatus} disabled={loading}>
          <Ionicons 
            name="refresh-outline" 
            size={20} 
            color={loading ? '#8E8E93' : '#007AFF'} 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.details}>
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={16} color="#34C759" />
          <Text style={styles.address} numberOfLines={1}>{ride.pickup_address}</Text>
        </View>
        <View style={styles.addressRow}>
          <Ionicons name="flag-outline" size={16} color="#FF3B30" />
          <Text style={styles.address} numberOfLines={1}>{ride.dropoff_address}</Text>
        </View>
        
        <View style={styles.rideInfo}>
          <View style={styles.infoItem}>
            <Ionicons name="people" size={14} color="#6B2E2B" />
            <Text style={styles.infoText}>{ride.passenger_count || 1} passenger{(ride.passenger_count || 1) > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time" size={14} color="#6B2E2B" />
            <Text style={styles.infoText}>{new Date(ride.created_at).toLocaleTimeString()}</Text>
          </View>
          {ride.fare && (
            <View style={styles.infoItem}>
              <Ionicons name="cash" size={14} color="#6B2E2B" />
              <Text style={styles.infoText}>₱{ride.fare}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.actionRow}>
        {ride.status === 'waiting_for_driver' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.cancelButton]}
            onPress={handleCancelRide}
            disabled={cancelling}
          >
            <Ionicons name="close-circle" size={16} color="#FF3B30" />
            <Text style={styles.cancelButtonText}>{cancelling ? 'Cancelling...' : 'Cancel Ride'}</Text>
          </TouchableOpacity>
        )}
        
        {ride.status === 'driver_assigned' && (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, styles.trackButton]} 
              onPress={() => setShowMap(true)}
            >
              <Ionicons name="map" size={16} color="#007AFF" />
              <Text style={styles.trackButtonText}>Track Driver</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.messageButton]} 
              onPress={handleMessageDriver}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#34C759" />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      
      {ride.status === 'driver_assigned' && (
        <Text style={styles.cashNote}>💰 Cash payment on arrival</Text>
      )}
      
      <Modal
        visible={showMap}
        animationType="slide"
        onRequestClose={() => setShowMap(false)}
      >
        <View style={styles.mapModal}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>Tracking {ride.driver_name}</Text>
            <TouchableOpacity onPress={() => setShowMap(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <LiveTrackingMap ride={ride} />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginVertical: 12,
    marginHorizontal: 20,
    shadowColor: '#6B2E2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#F5E9E2',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontWeight: '600',
  },
  details: {
    marginTop: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  address: {
    marginLeft: 8,
    fontSize: 15,
    color: '#333',
    flex: 1,
    fontWeight: '600',
  },
  rideInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#F5E9E2',
    backgroundColor: '#FEFBFA',
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#6B2E2B',
    fontWeight: '700',
  },
  cashNote: {
    marginTop: 8,
    fontSize: 12,
    color: '#FF9500',
    textAlign: 'center',
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flex: 1,
    borderWidth: 1,
  },
  trackButton: {
    backgroundColor: '#E3F2FD',
    borderColor: '#BBDEFB',
  },
  trackButtonText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#1976D2',
    fontWeight: '700',
  },
  messageButton: {
    backgroundColor: '#E8F5E8',
    borderColor: '#C8E6C9',
  },
  messageButtonText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#388E3C',
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
  },
  cancelButtonText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#D32F2F',
    fontWeight: '700',
  },
  mapModal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
});

export default RideStatusCard;