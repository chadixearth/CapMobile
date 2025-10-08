import { Alert } from 'react-native';

export const handleBookingError = (error, context = 'booking') => {
  const errorMessage = error?.message || 'An unexpected error occurred';
  
  if (__DEV__) {
    console.error(`[${context}] Error:`, error);
  }
  
  // JWT/Auth errors
  if (errorMessage.includes('JWT expired') || errorMessage.includes('PGRST301')) {
    return 'Session expired. Please log in again.';
  }
  
  // Network errors
  if (errorMessage.includes('Network request failed') || errorMessage.includes('Connection lost')) {
    return 'Network error. Please check your internet connection and try again.';
  }
  
  // Server errors
  if (errorMessage.includes('HTTP 500') || errorMessage.includes('Internal Server Error')) {
    return 'Server error. Please try again in a few moments.';
  }
  
  // Booking specific errors
  if (errorMessage.includes('Failed to fetch driver tour bookings')) {
    return 'Unable to load bookings. Please refresh and try again.';
  }
  
  if (errorMessage.includes('already booked')) {
    return 'This time slot is already booked. Please choose another time.';
  }
  
  if (errorMessage.includes('invalid date')) {
    return 'Invalid date selected. Please choose a valid date.';
  }
  
  // Database column errors
  if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
    return 'Data format error. Please contact support if this persists.';
  }
  
  return errorMessage;
};

export const showBookingErrorAlert = (error, context = 'booking', onRetry = null) => {
  const message = handleBookingError(error, context);
  
  const buttons = [{ text: 'OK' }];
  if (onRetry) {
    buttons.unshift({ text: 'Retry', onPress: onRetry });
  }
  
  Alert.alert('Error', message, buttons);
};

export const isRetryableError = (error) => {
  const errorMessage = error?.message || '';
  
  // Don't retry auth errors
  if (errorMessage.includes('JWT expired') || errorMessage.includes('Session expired')) {
    return false;
  }
  
  // Retry network and server errors
  return errorMessage.includes('Network request failed') ||
         errorMessage.includes('Connection lost') ||
         errorMessage.includes('HTTP 500') ||
         errorMessage.includes('timeout');
};