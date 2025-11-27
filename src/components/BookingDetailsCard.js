import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BookingDetailsCard = ({ booking, onAccept, onDecline, userType = 'driver' }) => {
  const [timeElapsed, setTimeElapsed] = useState('');

  useEffect(() => {
    const updateTimeElapsed = () => {
      if (booking.created_at) {
        const now = new Date();
        const created = new Date(booking.created_at);
        const diffMs = now - created;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        
        if (diffMins < 1) {
          setTimeElapsed('Just now');
        } else if (diffMins < 60) {
          setTimeElapsed(`${diffMins}m ago`);
        } else {
          const diffHours = Math.floor(diffMins / 60);
          setTimeElapsed(`${diffHours}h ${diffMins % 60}m ago`);
        }
      }
    };

    updateTimeElapsed();
    const interval = setInterval(updateTimeElapsed, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [booking.created_at]);

  const handleCallPassenger = () => {
    if (booking.customer_phone) {
      Linking.openURL(`tel:${booking.customer_phone}`);
    } else {
      Alert.alert('No Contact', 'Passenger phone number not available');
    }
  };

  const handleNavigateToPickup = () => {
    if (booking.pickup_latitude && booking.pickup_longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${booking.pickup_latitude},${booking.pickup_longitude}`;
      Linking.openURL(url);
    } else {
      Alert.alert('No Location', 'Pickup coordinates not available');
    }
  };

  const getUrgencyColor = () => {
    if (!booking.created_at) return '#666';
    
    const now = new Date();
    const created = new Date(booking.created_at);
    const diffMins = Math.floor((now - created) / (1000 * 60));
    
    if (diffMins > 15) return '#E53E3E'; // Red - Very urgent
    if (diffMins > 10) return '#F56500'; // Orange - Urgent  
    if (diffMins > 5) return '#D69E2E';  // Yellow - Moderate
    return '#38A169'; // Green - Fresh
  };

  const totalFare = (booking.passenger_count || 1) * 10;
  const driverEarnings = totalFare * 0.8;

  return (
    <View style={styles.card}>
      {/* Header with timing and urgency */}
      <View style={styles.header}>
        <View style={styles.timeInfo}>
          <Ionicons name="time-outline" size={16} color={getUrgencyColor()} />
          <Text style={[styles.timeText, { color: getUrgencyColor() }]}>
            {timeElapsed}
          </Text>
        </View>
        <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor() }]}>
          <Text style={styles.urgencyText}>
            {booking.created_at && (new Date() - new Date(booking.created_at)) / (1000 * 60) > 10 ? 'URGENT' : 'NEW'}
          </Text>
        </View>
      </View>

      {/* Passenger Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={18} color="#6B2E2B" />
          <Text style={styles.sectionTitle}>Passenger Details</Text>
        </View>
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerCount}>
            {booking.passenger_count || 1} passenger{(booking.passenger_count || 1) > 1 ? 's' : ''}
          </Text>
          {booking.customer_name && (
            <Text style={styles.passengerName}>{booking.customer_name}</Text>
          )}
          {booking.customer_phone && (
            <TouchableOpacity style={styles.phoneButton} onPress={handleCallPassenger}>
              <Ionicons name="call-outline" size={16} color="#007AFF" />
              <Text style={styles.phoneText}>{booking.customer_phone}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Route Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="location-outline" size={18} color="#6B2E2B" />
          <Text style={styles.sectionTitle}>Route Details</Text>
        </View>
        <View style={styles.routeInfo}>
          <View style={styles.locationRow}>
            <View style={styles.locationDot} />
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationAddress}>{booking.pickup_address}</Text>
            </View>
            <TouchableOpacity style={styles.navButton} onPress={handleNavigateToPickup}>
              <Ionicons name="navigate-outline" size={16} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, styles.dropoffDot]} />
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>Drop-off</Text>
              <Text style={styles.locationAddress}>{booking.dropoff_address}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Financial Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="cash-outline" size={18} color="#6B2E2B" />
          <Text style={styles.sectionTitle}>Earnings</Text>
        </View>
        <View style={styles.fareInfo}>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Total Fare</Text>
            <Text style={styles.fareAmount}>₱{totalFare}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Your Share (80%)</Text>
            <Text style={[styles.fareAmount, styles.driverEarnings]}>₱{driverEarnings}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Payment</Text>
            <Text style={styles.paymentMethod}>Cash</Text>
          </View>
        </View>
      </View>

      {/* Special Notes */}
      {booking.notes && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={18} color="#6B2E2B" />
            <Text style={styles.sectionTitle}>Notes</Text>
          </View>
          <Text style={styles.notesText}>{booking.notes}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.declineButton]} 
          onPress={() => onDecline(booking)}
        >
          <Ionicons name="close-outline" size={20} color="#E53E3E" />
          <Text style={styles.declineText}>Decline</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.acceptButton]} 
          onPress={() => onAccept(booking)}
        >
          <Ionicons name="checkmark-outline" size={20} color="#fff" />
          <Text style={styles.acceptText}>Accept Ride</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  passengerInfo: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  passengerCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6B2E2B',
    marginBottom: 4,
  },
  passengerName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  routeInfo: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#38A169',
  },
  dropoffDot: {
    backgroundColor: '#E53E3E',
  },
  locationDetails: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  locationAddress: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginTop: 2,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#DDD',
    marginLeft: 5,
    marginVertical: 4,
  },
  fareInfo: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fareLabel: {
    fontSize: 14,
    color: '#666',
  },
  fareAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  driverEarnings: {
    color: '#38A169',
    fontSize: 16,
    fontWeight: '700',
  },
  paymentMethod: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B2E2B',
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  declineButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  acceptButton: {
    backgroundColor: '#6B2E2B',
  },
  declineText: {
    color: '#E53E3E',
    fontWeight: '600',
    fontSize: 16,
  },
  acceptText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default BookingDetailsCard;