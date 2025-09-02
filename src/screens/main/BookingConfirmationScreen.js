/**
 * BookingConfirmationScreen - Shows confirmation after successful payment
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, card } from '../../styles/global';
import * as Routes from '../../constants/routes';

const BookingConfirmationScreen = ({ route, navigation }) => {
  const { bookingId, paymentId, bookingReference } = route.params || {};

  const navigateToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: Routes.MAIN }],
    });
  };

  const navigateToBookings = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: Routes.MAIN }],
    });
    // Add a small delay to ensure navigation is complete, then navigate to bookings tab
    setTimeout(() => {
      navigation.navigate('Book');
    }, 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.successContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={80} color={colors.accent} />
          </View>
          
          <Text style={styles.title}>Booking Confirmed!</Text>
          <Text style={styles.subtitle}>
            {paymentId 
              ? 'Your booking has been confirmed and payment has been processed successfully.'
              : 'Your booking has been confirmed. Payment can be completed later through the bookings section.'
            }
          </Text>

          <View style={styles.detailsContainer}>
            <Text style={styles.detailsTitle}>Booking Details</Text>
            
            {bookingReference && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Booking Reference:</Text>
                <Text style={styles.detailValue}>{bookingReference}</Text>
              </View>
            )}
            
            {bookingId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Booking ID:</Text>
                <Text style={styles.detailValue}>{bookingId}</Text>
              </View>
            )}
            
            {paymentId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment ID:</Text>
                <Text style={styles.detailValue}>{paymentId}</Text>
              </View>
            )}
            
            {!paymentId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment Status:</Text>
                <Text style={[styles.detailValue, { color: colors.textSecondary }]}>Pending - Complete later</Text>
              </View>
            )}
          </View>

          <View style={styles.nextStepsContainer}>
            <Text style={styles.nextStepsTitle}>What's Next?</Text>
            
            {!paymentId && (
              <View style={styles.stepItem}>
                <Ionicons name="card-outline" size={20} color={colors.primary} />
                <Text style={styles.stepText}>
                  Complete payment through the bookings section when payment services are available
                </Text>
              </View>
            )}
            
            <View style={styles.stepItem}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              <Text style={styles.stepText}>
                You will receive a notification when a driver accepts your booking
              </Text>
            </View>
            <View style={styles.stepItem}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
              <Text style={styles.stepText}>
                You can chat with your assigned driver through the app
              </Text>
            </View>
            <View style={styles.stepItem}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
              <Text style={styles.stepText}>
                Track your driver's location on the booking day
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={navigateToBookings}
        >
          <Text style={styles.secondaryButtonText}>View My Bookings</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={navigateToHome}
        >
          <Text style={styles.primaryButtonText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.md,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  detailsContainer: {
    ...card,
    width: '100%',
    marginBottom: spacing.lg,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  nextStepsContainer: {
    ...card,
    width: '100%',
  },
  nextStepsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  stepText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 20,
  },
  actionContainer: {
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default BookingConfirmationScreen;