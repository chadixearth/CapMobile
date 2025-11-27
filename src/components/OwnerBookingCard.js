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

const OwnerBookingCard = ({ booking, onAssignDriver, onViewDetails, availableDrivers = [] }) => {
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
    const interval = setInterval(updateTimeElapsed, 30000);

    return () => clearInterval(interval);
  }, [booking.created_at]);

  const getStatusColor = (status) => {
    const colors = {
      'waiting_for_driver': '#F59E0B',
      'driver_assigned': '#3B82F6',
      'in_progress': '#10B981',
      'completed': '#6B7280',
      'cancelled': '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  const getStatusText = (status) => {
    const texts = {
      'waiting_for_driver': 'Waiting for Driver',
      'driver_assigned': 'Driver Assigned',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    };
    return texts[status] || status;
  };

  const getUrgencyLevel = () => {
    if (!booking.created_at) return 'normal';
    
    const now = new Date();
    const created = new Date(booking.created_at);
    const diffMins = Math.floor((now - created) / (1000 * 60));
    
    if (diffMins > 15) return 'critical';
    if (diffMins > 10) return 'high';
    if (diffMins > 5) return 'medium';
    return 'normal';
  };

  const urgencyLevel = getUrgencyLevel();
  const urgencyColors = {
    critical: '#DC2626',
    high: '#EA580C',
    medium: '#D97706',
    normal: '#059669'
  };

  const totalFare = (booking.passenger_count || 1) * 10;
  const driverShare = totalFare * 0.8;
  const ownerShare = totalFare * 0.2;

  return (
    <View style={[styles.card, urgencyLevel === 'critical' && styles.criticalCard]}>
      {/* Header with status and timing */}
      <View style={styles.header}>
        <View style={styles.statusInfo}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(booking.status) }]} />
          <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
        </View>
        <View style={styles.timeInfo}>
          <Ionicons name="time-outline" size={14} color={urgencyColors[urgencyLevel]} />
          <Text style={[styles.timeText, { color: urgencyColors[urgencyLevel] }]}>
            {timeElapsed}
          </Text>
        </View>
      </View>

      {/* Booking Overview */}
      <View style={styles.overview}>
        <View style={styles.overviewItem}>
          <Ionicons name="people-outline" size={18} color="#6B2E2B" />
          <Text style={styles.overviewText}>
            {booking.passenger_count || 1} passenger{(booking.passenger_count || 1) > 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.overviewItem}>
          <Ionicons name="cash-outline" size={18} color="#059669" />
          <Text style={styles.overviewText}>₱{totalFare} total</Text>
        </View>
        <View style={styles.overviewItem}>
          <Ionicons name="car-outline" size={18} color="#3B82F6" />
          <Text style={styles.overviewText}>
            {booking.driver_name || 'No driver assigned'}
          </Text>
        </View>
      </View>

      {/* Route Summary */}
      <View style={styles.routeSection}>
        <View style={styles.routeHeader}>
          <Ionicons name="location-outline" size={16} color="#6B2E2B" />
          <Text style={styles.routeTitle}>Route</Text>
        </View>
        <View style={styles.routeDetails}>
          <View style={styles.locationItem}>
            <View style={[styles.locationDot, styles.pickupDot]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {booking.pickup_address}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.locationItem}>
            <View style={[styles.locationDot, styles.dropoffDot]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {booking.dropoff_address}
            </Text>
          </View>
        </View>
      </View>

      {/* Financial Breakdown */}
      <View style={styles.financeSection}>
        <Text style={styles.financeTitle}>Revenue Breakdown</Text>
        <View style={styles.financeGrid}>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Driver (80%)</Text>
            <Text style={styles.financeAmount}>₱{driverShare}</Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Owner (20%)</Text>
            <Text style={[styles.financeAmount, styles.ownerAmount]}>₱{ownerShare}</Text>
          </View>
        </View>
      </View>

      {/* Driver Assignment Status */}
      {booking.status === 'waiting_for_driver' && (
        <View style={styles.driverSection}>
          <View style={styles.driverHeader}>
            <Ionicons name="person-add-outline" size={16} color="#F59E0B" />
            <Text style={styles.driverTitle}>Driver Assignment Needed</Text>
          </View>
          <Text style={styles.driverSubtitle}>
            {availableDrivers.length} available driver{availableDrivers.length !== 1 ? 's' : ''} in your fleet
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.detailsButton]} 
          onPress={() => onViewDetails(booking)}
        >
          <Ionicons name="eye-outline" size={18} color="#6B2E2B" />
          <Text style={styles.detailsText}>View Details</Text>
        </TouchableOpacity>
        
        {booking.status === 'waiting_for_driver' && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.assignButton]} 
            onPress={() => onAssignDriver(booking)}
          >
            <Ionicons name="person-add-outline" size={18} color="#fff" />
            <Text style={styles.assignText}>Assign Driver</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Urgency Indicator */}
      {urgencyLevel === 'critical' && (
        <View style={styles.urgencyBanner}>
          <Ionicons name="warning-outline" size={16} color="#fff" />
          <Text style={styles.urgencyText}>URGENT: Customer waiting 15+ minutes</Text>
        </View>
      )}
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
  criticalCard: {
    borderColor: '#DC2626',
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  routeSection: {
    marginBottom: 16,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  routeDetails: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pickupDot: {
    backgroundColor: '#059669',
  },
  dropoffDot: {
    backgroundColor: '#DC2626',
  },
  locationText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#DDD',
    marginLeft: 3,
    marginVertical: 4,
  },
  financeSection: {
    marginBottom: 16,
  },
  financeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  financeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  financeItem: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  financeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  financeAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  ownerAmount: {
    color: '#6B2E2B',
  },
  driverSection: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  driverTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  driverSubtitle: {
    fontSize: 12,
    color: '#78350F',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  detailsButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  assignButton: {
    backgroundColor: '#6B2E2B',
  },
  detailsText: {
    color: '#6B2E2B',
    fontWeight: '600',
    fontSize: 14,
  },
  assignText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  urgencyBanner: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    backgroundColor: '#DC2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  urgencyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default OwnerBookingCard;