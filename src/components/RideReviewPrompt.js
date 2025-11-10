import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAROON = '#6B2E2B';

export default function RideReviewPrompt({ visible, onClose, onReview, driverName }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={60} color="#2E7D32" />
          </View>
          
          <Text style={styles.title}>Ride Completed!</Text>
          <Text style={styles.message}>
            How was your experience with {driverName || 'your driver'}?
          </Text>
          
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={onReview}
            activeOpacity={0.8}
          >
            <Ionicons name="star" size={20} color="#fff" />
            <Text style={styles.reviewButtonText}>Rate Driver</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  reviewButton: {
    backgroundColor: MAROON,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    gap: 8,
    marginBottom: 12,
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
});
