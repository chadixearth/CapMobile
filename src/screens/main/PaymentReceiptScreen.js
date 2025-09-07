import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAROON = '#6B2E2B';

export default function PaymentReceiptScreen({ navigation, route }) {
  const { paymentData, bookingData } = route.params;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Receipt</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successSubtitle}>Your booking has been confirmed</Text>
        </View>

        <View style={styles.receiptCard}>
          <Text style={styles.receiptTitle}>Receipt Details</Text>
          
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Payment ID:</Text>
            <Text style={styles.receiptValue}>{paymentData?.paymentId || 'N/A'}</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Booking Reference:</Text>
            <Text style={styles.receiptValue}>{bookingData?.bookingReference || 'N/A'}</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Package:</Text>
            <Text style={styles.receiptValue}>{bookingData?.packageName || 'N/A'}</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Amount Paid:</Text>
            <Text style={[styles.receiptValue, styles.amount]}>
              {formatCurrency(paymentData?.amount || bookingData?.amount || 0)}
            </Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Payment Method:</Text>
            <Text style={styles.receiptValue}>
              {paymentData?.paymentMethod?.toUpperCase() || 'N/A'}
            </Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Date & Time:</Text>
            <Text style={styles.receiptValue}>
              {formatDate(paymentData?.paidAt || new Date())}
            </Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Status:</Text>
            <Text style={[styles.receiptValue, styles.statusPaid]}>PAID</Text>
          </View>
        </View>

        <View style={styles.bookingInfo}>
          <Text style={styles.infoTitle}>Booking Information</Text>
          <Text style={styles.infoText}>
            Your tour has been booked successfully. You will receive a confirmation 
            message shortly. Please keep this receipt for your records.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.homeButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    backgroundColor: MAROON,
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  successIcon: {
    alignItems: 'center',
    marginVertical: 32,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
    marginTop: 16,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  receiptCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  receiptLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  receiptValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  amount: {
    fontSize: 16,
    color: MAROON,
    fontWeight: '700',
  },
  statusPaid: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  bookingInfo: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  homeButton: {
    backgroundColor: MAROON,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});