import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { checkRideWaitTime, cancelRideBooking } from '../services/rideHailingService';

const RideMonitor = ({ bookingId, customerId, onRideUpdate, onCancel }) => {
  const [waitInfo, setWaitInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bookingId) return;

    const checkWaitTime = async () => {
      try {
        const result = await checkRideWaitTime(bookingId);
        if (result.success) {
          setWaitInfo(result);
          if (onRideUpdate) {
            onRideUpdate(result);
          }
        }
      } catch (error) {
        console.error('Error checking wait time:', error);
      }
    };

    // Check immediately
    checkWaitTime();

    // Set up interval to check every 30 seconds
    const interval = setInterval(checkWaitTime, 30000);

    return () => clearInterval(interval);
  }, [bookingId, onRideUpdate]);

  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await cancelRideBooking(bookingId, {
                customer_id: customerId,
                reason: 'Customer cancelled - long wait time'
              });
              
              if (result.success) {
                Alert.alert('Success', 'Ride cancelled successfully');
                if (onCancel) {
                  onCancel();
                }
              } else {
                Alert.alert('Error', result.error || 'Failed to cancel ride');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel ride');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (!waitInfo || !waitInfo.waiting) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.waitInfo}>
        <Text style={styles.waitText}>
          Waiting for driver: {waitInfo.wait_minutes} minutes
        </Text>
        
        {waitInfo.suggest_cancel && (
          <View style={styles.suggestionContainer}>
            <Text style={styles.suggestionText}>
              🕐 It's been over 5 minutes. Consider cancelling and trying again.
            </Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelRide}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>
                {loading ? 'Cancelling...' : 'Cancel Ride'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  waitInfo: {
    alignItems: 'center',
  },
  waitText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  suggestionContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default RideMonitor;