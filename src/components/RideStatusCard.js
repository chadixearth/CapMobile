import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [waitStartTime, setWaitStartTime] = useState(null);

  useEffect(() => {
    if (ride.status === 'driver_assigned' && ride.driver_id) {
      fetchDriverLocation();
      const interval = setInterval(fetchDriverLocation, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [ride]);

  useEffect(() => {
    const initializeTimer = async () => {
      if (ride.status === 'waiting_for_driver') {
        const storageKey = `ride_wait_start_${ride.id}`;
        try {
          const stored = await AsyncStorage.getItem(storageKey);
          if (stored) {
            setWaitStartTime(parseInt(stored, 10));
          } else {
            const startTime = Date.now();
            setWaitStartTime(startTime);
            await AsyncStorage.setItem(storageKey, startTime.toString());
          }
        } catch (error) {
          console.error('Error initializing timer:', error);
          const startTime = Date.now();
          setWaitStartTime(startTime);
        }
      } else {
        setWaitingTime(0);
        setWaitStartTime(null);
        const storageKey = `ride_wait_start_${ride.id}`;
        await AsyncStorage.removeItem(storageKey);
      }
    };
    initializeTimer();
  }, [ride.status, ride.id]);

  useEffect(() => {
    if (ride.status === 'waiting_for_driver' && waitStartTime) {
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - waitStartTime) / 1000);
        setWaitingTime(elapsed);
        
        if (elapsed >= 300 && elapsed < 305) {
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
    }
  }, [ride.status, waitStartTime, navigation]);

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
            <View style={styles.mapHeaderContent}>
              <View style={styles.driverInfo}>
                <Ionicons name="person-circle" size={40} color="#6B2E2B" />
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>{ride.driver_display_name || ride.driver_name || 'Driver'}</Text>
                  {ride.carriage_name && (
                    <View style={styles.carriageInfo}>
                      <Ionicons name="car-sport" size={14} color="#666" />
                      <Text style={styles.carriageText}>{ride.carriage_name}</Text>
                    </View>
                  )}
                  {driverLocation && (
                    <View style={styles.etaInfo}>
                      <Ionicons name="time" size={14} color="#FF9500" />
                      <Text style={styles.etaText}>ETA: 3-8 mins</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowMap(false)} style={styles.closeButton}>
                <Ionicons name="close-circle" size={32} color="#6B2E2B" />
              </TouchableOpacity>
            </View>
          </View>
          <LiveTrackingMap ride={ride} />
          <View style={styles.mapFooter}>
            <View style={styles.footerRow}>
              <Ionicons name="location" size={16} color="#2E7D32" />
              <Text style={styles.footerText} numberOfLines={1}>{ride.pickup_address}</Text>
            </View>
            <View style={styles.footerRow}>
              <Ionicons name="flag" size={16} color="#C62828" />
              <Text style={styles.footerText} numberOfLines={1}>{ride.dropoff_address}</Text>
            </View>
          </View>
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
    backgroundColor: '#F5E9E2',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#E0CFC2',
  },
  mapHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  carriageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  carriageText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  etaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  etaText: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  mapFooter: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
});

export default RideStatusCard;