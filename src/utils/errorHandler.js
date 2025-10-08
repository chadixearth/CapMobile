import { Alert } from 'react-native';

// Global error handler for the app
export const handleApiError = (error, context = '') => {
  const errorMessage = error?.message || 'An unexpected error occurred';
  
  if (__DEV__) {
    console.error(`[${context}] Error:`, error);
  }
  
  // Network errors
  if (errorMessage.includes('Network request failed')) {
    return 'Network error. Please check your internet connection.';
  }
  
  // Authentication errors
  if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
    return 'Session expired. Please log in again.';
  }
  
  // Server errors
  if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
    return 'Server error. Please try again later.';
  }
  
  // Booking specific errors
  if (context === 'booking') {
    if (errorMessage.includes('already booked')) {
      return 'This time slot is already booked. Please choose another time.';
    }
    if (errorMessage.includes('invalid date')) {
      return 'Invalid date selected. Please choose a valid date.';
    }
  }
  
  // Carriage specific errors
  if (context === 'carriage') {
    if (errorMessage.includes('plate_number')) {
      return 'Invalid plate number. Please check the format.';
    }
    if (errorMessage.includes('already exists')) {
      return 'A carriage with this plate number already exists.';
    }
  }
  
  return errorMessage;
};

export const showErrorAlert = (error, context = '', onRetry = null) => {
  const message = handleApiError(error, context);
  
  const buttons = [{ text: 'OK' }];
  if (onRetry) {
    buttons.unshift({ text: 'Retry', onPress: onRetry });
  }
  
  Alert.alert('Error', message, buttons);
};