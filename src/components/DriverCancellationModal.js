import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { getCancellationReasons, driverCancelBooking } from '../services/tourpackage/driverCancellation';
import { driverCancelRideBooking } from '../services/rideHailingService';

const DriverCancellationModal = ({ 
  visible, 
  onClose, 
  booking, 
  driverId, 
  onCancellationSuccess,
  bookingType = 'tour' // 'tour' or 'ride'
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const cancellationReasons = getCancellationReasons();

  const handleCancel = async () => {
    const reason = selectedReason === 'Other' ? customReason : selectedReason;
    
    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for cancellation');
      return;
    }

    Alert.alert(
      'Confirm Cancellation',
      `Are you sure you want to cancel this booking?\n\nReason: ${reason}\n\nThis will reassign the booking to other available drivers and notify the tourist.`,
      [
        {
          text: 'No, Keep Booking',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => performCancellation(reason),
        },
      ]
    );
  };

  const performCancellation = async (reason) => {
    setIsLoading(true);
    
    try {
      console.log('[CANCELLATION] Sending cancellation request:', {
        bookingId: booking.id,
        driverId: driverId,
        reason: reason
      });
      
      // Use appropriate cancellation service based on booking type
      const result = bookingType === 'ride' 
        ? await driverCancelRideBooking(booking.id, { driver_id: driverId, reason })
        : await driverCancelBooking(booking.id, driverId, reason);
      
      console.log('[CANCELLATION] API Response:', result);
      
      if (result.success) {
        console.log('[CANCELLATION] Success - Report should be created');
        
        Alert.alert(
          'Booking Cancelled',
          result.message || 'Your booking has been cancelled and reassigned to other drivers. The tourist has been notified.',
          [
            {
              text: 'OK',
              onPress: () => {
                onClose();
                if (onCancellationSuccess) {
                  onCancellationSuccess(result);
                }
              },
            },
          ]
        );

        // Show suspension warning if driver was suspended
        if (result.driver_suspended && result.suspension) {
          setTimeout(() => {
            Alert.alert(
              'Account Suspended',
              `Your account has been temporarily suspended due to multiple cancellations. Suspension will be lifted on ${new Date(result.suspension.suspension_end_date).toLocaleDateString()}.`,
              [{ text: 'Understood' }]
            );
          }, 1000);
        }
      } else {
        console.log('[CANCELLATION] Failed:', result.error);
        Alert.alert('Error', result.error || 'Failed to cancel booking');
      }
    } catch (error) {
      console.log('[CANCELLATION] Exception:', error);
      Alert.alert('Error', 'An unexpected error occurred while cancelling the booking');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedReason('');
    setCustomReason('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Cancel Booking</Text>
            
            {booking && (
              <View style={styles.bookingInfo}>
                <Text style={styles.bookingTitle}>{booking.package_name}</Text>
                <Text style={styles.bookingDetails}>
                  {booking.customer_name} • {booking.number_of_pax} passengers
                </Text>
                <Text style={styles.bookingDetails}>
                  {new Date(booking.booking_date).toLocaleDateString()} at {booking.pickup_time}
                </Text>
              </View>
            )}

            <Text style={styles.label}>Reason for Cancellation *</Text>
            <View style={styles.reasonButtons}>
              {cancellationReasons.map((reason, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.reasonButton,
                    selectedReason === reason && styles.selectedReasonButton
                  ]}
                  onPress={() => setSelectedReason(reason)}
                >
                  <Text style={[
                    styles.reasonButtonText,
                    selectedReason === reason && styles.selectedReasonButtonText
                  ]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedReason === 'Other' && (
              <View style={styles.customReasonContainer}>
                <Text style={styles.label}>Please specify:</Text>
                <TextInput
                  style={styles.textInput}
                  value={customReason}
                  onChangeText={setCustomReason}
                  placeholder="Enter your reason for cancellation..."
                  multiline={true}
                  numberOfLines={3}
                  maxLength={200}
                />
                <Text style={styles.characterCount}>
                  {customReason.length}/200 characters
                </Text>
              </View>
            )}

            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                ⚠️ Cancelling this booking will:
              </Text>
              <Text style={styles.warningItem}>• Reassign the booking to other drivers</Text>
              <Text style={styles.warningItem}>• Notify the tourist of the change</Text>
              <Text style={styles.warningItem}>• Create a detailed report for admin review</Text>
              <Text style={styles.warningItem}>• May affect your driver rating and status</Text>
              <Text style={styles.warningItem}>• Frequent cancellations may result in suspension</Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Keep Booking</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleCancel}
                disabled={isLoading || !selectedReason || (selectedReason === 'Other' && !customReason.trim())}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>Cancel Booking</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  bookingInfo: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  bookingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  bookingDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  reasonButtons: {
    marginBottom: 15,
  },
  reasonButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectedReasonButton: {
    backgroundColor: '#6B2E2B',
    borderColor: '#6B2E2B',
  },
  reasonButtonText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  selectedReasonButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  customReasonContainer: {
    marginBottom: 15,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 5,
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  warningItem: {
    fontSize: 13,
    color: '#856404',
    marginBottom: 3,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  confirmButton: {
    backgroundColor: '#dc3545',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DriverCancellationModal;