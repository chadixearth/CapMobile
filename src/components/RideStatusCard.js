import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { checkRideStatus, getDriverLocation } from '../services/rideHailingService';
import LiveTrackingMap from './LiveTrackingMap';
import { useNavigation } from '@react-navigation/native';

const RideStatusCard = ({ ride, onRefresh }) => {
  const navigation = useNavigation();
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (ride.status === 'driver_assigned' && ride.driver_id) {
      fetchDriverLocation();
      const interval = setInterval(fetchDriverLocation, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [ride]);

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
        return {
          icon: 'time-outline',
          color: '#FF9500',
          text: 'Looking for driver...',
          subtitle: 'We are finding a driver for you'
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
      </View>

      {ride.status === 'driver_assigned' && (
        <>
          <View style={styles.actionRow}>
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
              <Text style={styles.messageButtonText}>Message Driver</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cashNote}>💰 Cash payment on arrival</Text>
        </>
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
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
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
    fontSize: 14,
    color: '#000',
    flex: 1,
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
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  trackButton: {
    backgroundColor: '#F0F8FF',
  },
  trackButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  messageButton: {
    backgroundColor: '#F0FFF0',
    borderWidth: 1,
    borderColor: '#E8F5E8',
  },
  messageButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
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