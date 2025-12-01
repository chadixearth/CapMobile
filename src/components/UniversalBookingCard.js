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

const UniversalBookingCard = ({ 
  booking, 
  onAccept, 
  onDecline, 
  onViewDetails,
  userType = 'driver',
  bookingType = 'tour' // 'tour', 'ride', 'custom'
}) => {
  const [timeElapsed, setTimeElapsed] = useState('');

  useEffect(() => {
    const updateTimeElapsed = () => {
      const createdAt = booking.created_at || booking.booking_date;
      if (createdAt) {
        const now = new Date();
        const created = new Date(createdAt);
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
    const interval = setInterval(updateTimeElapsed, 30000);
    return () => clearInterval(interval);
  }, [booking.created_at, booking.booking_date]);

  const getBookingTypeInfo = () => {
    switch (bookingType) {
      case 'ride':
        return {
          icon: 'car-outline',
          title: 'Ride Request',
          color: '#007AFF'
        };
      case 'custom':
        return {
          icon: 'star-outline',
          title: 'Custom Tour',
          color: '#FF9500'
        };
      default:
        return {
          icon: 'map-outline',
          title: 'Tour Package',
          color: '#6B2E2B'
        };
    }
  };

  const getUrgencyColor = () => {
    const createdAt = booking.created_at || booking.booking_date;
    if (!createdAt) return '#666';
    
    const now = new Date();
    const created = new Date(createdAt);
    const diffMins = Math.floor((now - created) / (1000 * 60));
    
    if (diffMins > 15) return '#E53E3E';
    if (diffMins > 10) return '#F56500';
    if (diffMins > 5) return '#D69E2E';
    return '#38A169';
  };

  const getBookingDetails = () => {
    switch (bookingType) {
      case 'ride':
        return {
          participants: booking.passenger_count || 1,
          participantLabel: 'passenger',
          from: booking.pickup_address,
          to: booking.dropoff_address,
          fare: (booking.passenger_count || 1) * 10,
          driverShare: (booking.passenger_count || 1) * 10 * 0.8,
          date: booking.created_at ? new Date(booking.created_at).toLocaleDateString() : 'Today',
          time: 'ASAP'
        };
      case 'custom':
        return {
          participants: booking.number_of_people || booking.pax || 1,
          participantLabel: 'person',
          from: booking.pickup_location || booking.starting_point,
          to: booking.destination || booking.end_point,
          fare: booking.total_amount || booking.price || 0,
          driverShare: (booking.total_amount || booking.price || 0) * 0.8,
          date: booking.booking_date || booking.preferred_date,
          time: booking.booking_time || booking.preferred_time || 'TBD'
        };
      default: // tour
        return {
          participants: booking.number_of_people || booking.pax || 1,
          participantLabel: 'person',
          from: booking.pickup_location || 'Tour Starting Point',
          to: booking.package_name || booking.destination,
          fare: booking.total_amount || booking.price || 0,
          driverShare: (booking.total_amount || booking.price || 0) * 0.8,
          date: booking.booking_date,
          time: booking.booking_time || booking.start_time || '09:00'
        };
    }
  };

  const handleCallCustomer = () => {
    const phone = booking.customer_phone || booking.phone || booking.contact_number;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('No Contact', 'Customer phone number not available');
    }
  };

  const handleNavigate = () => {
    const details = getBookingDetails();
    if (booking.pickup_latitude && booking.pickup_longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${booking.pickup_latitude},${booking.pickup_longitude}`;
      Linking.openURL(url);
    } else if (details.from) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(details.from)}`;
      Linking.openURL(url);
    } else {
      Alert.alert('No Location', 'Location information not available');
    }
  };

  const typeInfo = getBookingTypeInfo();
  const details = getBookingDetails();
  const urgencyColor = getUrgencyColor();

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.typeInfo}>
          <Ionicons name={typeInfo.icon} size={18} color={typeInfo.color} />
          <Text style={[styles.typeText, { color: typeInfo.color }]}>
            {typeInfo.title}
          </Text>
        </View>
        <View style={styles.timeInfo}>
          <Ionicons name="time-outline" size={16} color={urgencyColor} />
          <Text style={[styles.timeText, { color: urgencyColor }]}>
            {timeElapsed}
          </Text>
        </View>
      </View>

      {/* Booking Overview */}
      <View style={styles.overview}>
        <View style={styles.overviewItem}>
          <Ionicons name="people-outline" size={16} color="#6B2E2B" />
          <Text style={styles.overviewText}>
            {details.participants} {details.participantLabel}{details.participants > 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.overviewItem}>
          <Ionicons name="calendar-outline" size={16} color="#6B2E2B" />
          <Text style={styles.overviewText}>
            {details.date ? new Date(details.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
          </Text>
        </View>
        <View style={styles.overviewItem}>
          <Ionicons name="time-outline" size={16} color="#6B2E2B" />
          <Text style={styles.overviewText}>
            {details.time ? (details.time.length === 5 ? details.time : new Date('2000-01-01T' + details.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })) : 'TBD'}
          </Text>
        </View>
      </View>

      {/* Customer Info */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={18} color="#6B2E2B" />
          <Text style={styles.sectionTitle}>Customer</Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>
            {booking.customer_name || booking.name || 'Customer'}
          </Text>
          {(booking.customer_phone || booking.phone) && (
            <TouchableOpacity style={styles.phoneButton} onPress={handleCallCustomer}>
              <Ionicons name="call-outline" size={16} color="#007AFF" />
              <Text style={styles.phoneText}>
                {booking.customer_phone || booking.phone}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Route/Destination Info */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="location-outline" size={18} color="#6B2E2B" />
          <Text style={styles.sectionTitle}>
            {bookingType === 'ride' ? 'Route' : 'Destination'}
          </Text>
        </View>
        <View style={styles.routeInfo}>
          {bookingType === 'ride' ? (
            <>
              <View style={styles.locationRow}>
                <View style={styles.pickupDot} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {details.from}
                </Text>
                <TouchableOpacity style={styles.navButton} onPress={handleNavigate}>
                  <Ionicons name="navigate-outline" size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.locationRow}>
                <View style={styles.dropoffDot} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {details.to}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.locationRow}>
              <View style={styles.tourDot} />
              <Text style={styles.locationText} numberOfLines={2}>
                {details.to}
              </Text>
              <TouchableOpacity style={styles.navButton} onPress={handleNavigate}>
                <Ionicons name="navigate-outline" size={16} color="#007AFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Financial Info */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="cash-outline" size={18} color="#6B2E2B" />
          <Text style={styles.sectionTitle}>Earnings</Text>
        </View>
        <View style={styles.fareInfo}>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Total Amount</Text>
            <Text style={styles.fareAmount}>₱{details.fare}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Your Share (80%)</Text>
            <Text style={[styles.fareAmount, styles.driverEarnings]}>
              ₱{details.driverShare.toFixed(0)}
            </Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Payment Status</Text>
            <Text style={[styles.paymentStatus, 
              booking.payment_status === 'paid' ? styles.paidStatus : styles.pendingStatus
            ]}>
              {booking.payment_status || 'Pending'}
            </Text>
          </View>
        </View>
      </View>

      {/* Special Notes */}
      {(booking.notes || booking.special_requests || booking.description) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={18} color="#6B2E2B" />
            <Text style={styles.sectionTitle}>Notes</Text>
          </View>
          <Text style={styles.notesText}>
            {booking.notes || booking.special_requests || booking.description}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {onViewDetails && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.detailsButton]} 
            onPress={() => onViewDetails(booking)}
          >
            <Ionicons name="eye-outline" size={18} color="#6B2E2B" />
            <Text style={styles.detailsText}>Details</Text>
          </TouchableOpacity>
        )}
        
        {onDecline && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.declineButton]} 
            onPress={() => onDecline(booking)}
          >
            <Ionicons name="close-outline" size={18} color="#E53E3E" />
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
        )}
        
        {onAccept && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.acceptButton]} 
            onPress={() => onAccept(booking)}
          >
            <Ionicons name="checkmark-outline" size={18} color="#fff" />
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
        )}
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
  typeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  overview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  overviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  overviewText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  customerInfo: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
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
    gap: 10,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38A169',
  },
  dropoffDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E53E3E',
  },
  tourDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6B2E2B',
  },
  locationText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  navButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#E3F2FD',
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#DDD',
    marginLeft: 4,
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
    fontSize: 13,
    color: '#666',
  },
  fareAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  driverEarnings: {
    color: '#38A169',
    fontSize: 15,
    fontWeight: '700',
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  paidStatus: {
    backgroundColor: '#E8F5E8',
    color: '#2E7D32',
  },
  pendingStatus: {
    backgroundColor: '#FFF3E0',
    color: '#F57C00',
  },
  notesText: {
    fontSize: 13,
    color: '#666',
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  detailsButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  declineButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  acceptButton: {
    backgroundColor: '#6B2E2B',
  },
  detailsText: {
    color: '#6B2E2B',
    fontWeight: '600',
    fontSize: 14,
  },
  declineText: {
    color: '#E53E3E',
    fontWeight: '600',
    fontSize: 14,
  },
  acceptText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default UniversalBookingCard;