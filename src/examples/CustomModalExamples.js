// examples/CustomModalExamples.js
// This file shows how to use the custom modal system instead of Alert.alert

import CustomModalService from '../services/CustomModalService';
import { CustomAlert } from '../utils/customAlert';

// EXAMPLE 1: Replace simple Alert.alert
// OLD WAY:
// Alert.alert('Success', 'Booking accepted successfully!');

// NEW WAY:
export const showBookingSuccess = () => {
  CustomModalService.showSuccess({
    title: 'Booking Accepted!',
    message: 'You have successfully accepted the booking. The customer has been notified.',
    primaryActionText: 'Great!',
    autoCloseMs: 3000 // Auto close after 3 seconds
  });
};

// EXAMPLE 2: Replace confirmation Alert.alert
// OLD WAY:
// Alert.alert(
//   'Cancel Booking',
//   'Are you sure you want to cancel this booking?',
//   [
//     { text: 'No', style: 'cancel' },
//     { text: 'Yes', onPress: () => cancelBooking() }
//   ]
// );

// NEW WAY:
export const showCancelBookingConfirmation = (onConfirm) => {
  CustomModalService.showConfirmation({
    title: 'Cancel Booking',
    message: 'Are you sure you want to cancel this booking? This action cannot be undone.',
    primaryActionText: 'Yes, Cancel',
    secondaryActionText: 'Keep Booking',
    onPrimaryAction: onConfirm,
    iconName: 'warning',
    iconColor: '#F59E0B'
  });
};

// EXAMPLE 3: Replace error Alert.alert
// OLD WAY:
// Alert.alert('Error', 'Failed to update profile. Please try again.');

// NEW WAY:
export const showProfileUpdateError = () => {
  CustomModalService.showError({
    title: 'Update Failed',
    message: 'Failed to update your profile. Please check your connection and try again.',
    primaryActionText: 'Try Again'
  });
};

// EXAMPLE 4: Using CustomAlert utility (easier migration)
// OLD WAY:
// Alert.alert('Warning', 'Your location is turned off. Please enable it for better service.');

// NEW WAY:
export const showLocationWarning = () => {
  CustomAlert.warning(
    'Location Required',
    'Your location is turned off. Please enable it for better service and accurate ride tracking.'
  );
};

// EXAMPLE 5: Complex confirmation with custom actions
export const showLogoutConfirmation = (onLogout) => {
  CustomModalService.showConfirmation({
    title: 'Sign Out',
    message: 'Are you sure you want to sign out? You will need to log in again to access your account.',
    primaryActionText: 'Sign Out',
    secondaryActionText: 'Stay Logged In',
    onPrimaryAction: () => {
      // Show success message after logout
      CustomModalService.showSuccess({
        title: 'Signed Out',
        message: 'You have been successfully signed out.',
        autoCloseMs: 2000
      });
      onLogout();
    },
    iconName: 'log-out',
    iconColor: '#EF4444'
  });
};

// EXAMPLE 6: Info modal with custom styling
export const showAppUpdateInfo = () => {
  CustomModalService.showInfo({
    title: 'App Update Available',
    message: 'A new version of the app is available with improved features and bug fixes. Update now for the best experience.',
    primaryActionText: 'Update Now',
    secondaryActionText: 'Later',
    showSecondaryAction: true,
    onPrimaryAction: () => {
      // Handle app update
      console.log('Redirecting to app store...');
    },
    iconName: 'download',
    iconColor: '#3B82F6'
  });
};

// EXAMPLE 7: Success with custom action
export const showPaymentSuccess = (amount, onViewReceipt) => {
  CustomModalService.showSuccess({
    title: 'Payment Successful!',
    message: `Your payment of ₱${amount} has been processed successfully. Thank you for your business!`,
    primaryActionText: 'View Receipt',
    secondaryActionText: 'Done',
    showSecondaryAction: true,
    onPrimaryAction: onViewReceipt,
    iconName: 'card',
    iconColor: '#22C55E'
  });
};

// EXAMPLE 8: Error with retry functionality
export const showNetworkError = (onRetry) => {
  CustomModalService.showError({
    title: 'Connection Error',
    message: 'Unable to connect to the server. Please check your internet connection and try again.',
    primaryActionText: 'Retry',
    secondaryActionText: 'Cancel',
    showSecondaryAction: true,
    onPrimaryAction: onRetry,
    iconName: 'wifi-off',
    iconColor: '#EF4444'
  });
};

// EXAMPLE 9: Using in async functions
export const handleBookingAction = async (bookingId) => {
  try {
    // Show loading state (you can create a loading modal too)
    const response = await acceptBooking(bookingId);
    
    if (response.success) {
      CustomModalService.showSuccess({
        title: 'Booking Accepted!',
        message: 'You have successfully accepted the booking. The customer has been notified.',
        autoCloseMs: 3000
      });
    } else {
      CustomModalService.showError({
        title: 'Failed to Accept',
        message: response.message || 'Unable to accept the booking. Please try again.',
        primaryActionText: 'Retry',
        onPrimaryAction: () => handleBookingAction(bookingId)
      });
    }
  } catch (error) {
    CustomModalService.showError({
      title: 'Something went wrong',
      message: 'An unexpected error occurred. Please try again later.',
      primaryActionText: 'OK'
    });
  }
};

// Mock function for example
const acceptBooking = async (bookingId) => {
  // Simulate API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 1000);
  });
};

export default {
  showBookingSuccess,
  showCancelBookingConfirmation,
  showProfileUpdateError,
  showLocationWarning,
  showLogoutConfirmation,
  showAppUpdateInfo,
  showPaymentSuccess,
  showNetworkError,
  handleBookingAction
};