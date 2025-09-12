import { Alert } from 'react-native';
import * as Routes from '../constants/routes';

/**
 * Centralized error handling service for the mobile app
 * Provides consistent error messaging and navigation handling
 */
class ErrorHandlingService {
  static navigationRef = null;
  static errorModalRef = null;

  /**
   * Set navigation reference for error handling that requires navigation
   * @param {Object} navigation - React Navigation ref
   */
  static setNavigationRef(navigation) {
    this.navigationRef = navigation;
  }

  /**
   * Set error modal reference for showing custom error modals
   * @param {Object} modalRef - ErrorModal component ref
   */
  static setErrorModalRef(modalRef) {
    this.errorModalRef = modalRef;
  }

  /**
   * Handle authentication errors (session expired, unauthorized, etc.)
   * @param {string} error - Error message
   * @param {Object} options - Additional options
   */
  static handleAuthError(error, options = {}) {
    const {
      title = 'Authentication Required',
      showModal = true,
      autoNavigateToLogin = true,
      customMessage = null,
    } = options;

    // Common authentication error messages
    const authErrorMessages = {
      'session_expired': 'Your session has expired. Please log in again to continue.',
      'unauthorized': 'You need to be logged in to access this feature.',
      'invalid_token': 'Your session is no longer valid. Please log in again.',
      'account_suspended': 'Your account has been suspended. Please contact support.',
      'account_deleted': 'Your account has been deleted and cannot be restored.',
      'insufficient_permissions': 'You don\'t have permission to perform this action.',
    };

    const message = customMessage || authErrorMessages[error] || 'Authentication error occurred. Please log in again.';

    if (showModal && this.errorModalRef) {
      this.errorModalRef.show({
        type: 'warning',
        title,
        message,
        primaryButtonText: 'Go to Login',
        onPrimaryPress: () => {
          if (autoNavigateToLogin && this.navigationRef) {
            this.navigationRef.reset({
              index: 0,
              routes: [{ name: Routes.WELCOME }],
            });
          }
        },
      });
    } else {
      Alert.alert(
        title,
        message,
        [
          {
            text: 'Go to Login',
            onPress: () => {
              if (autoNavigateToLogin && this.navigationRef) {
                this.navigationRef.reset({
                  index: 0,
                  routes: [{ name: Routes.WELCOME }],
                });
              }
            },
          },
        ],
        { cancelable: false }
      );
    }
  }

  /**
   * Handle network errors (connection issues, timeouts, etc.)
   * @param {string} error - Error message
   * @param {Object} options - Additional options
   */
  static handleNetworkError(error, options = {}) {
    const {
      title = 'Connection Error',
      showModal = true,
      showRetry = true,
      onRetry = null,
    } = options;

    const networkErrorMessages = {
      'timeout': 'Request timed out. Please check your internet connection and try again.',
      'no_internet': 'No internet connection. Please check your network settings.',
      'server_error': 'Server is temporarily unavailable. Please try again later.',
      'network_error': 'Network error occurred. Please check your connection.',
    };

    const message = networkErrorMessages[error] || 'A network error occurred. Please try again.';

    if (showModal && this.errorModalRef) {
      const buttons = showRetry && onRetry ? {
        primaryButtonText: 'Retry',
        secondaryButtonText: 'Cancel',
        onPrimaryPress: onRetry,
      } : {
        primaryButtonText: 'OK',
      };

      this.errorModalRef.show({
        type: 'error',
        title,
        message,
        ...buttons,
      });
    } else {
      const alertButtons = [{ text: 'OK' }];
      if (showRetry && onRetry) {
        alertButtons.unshift({ text: 'Retry', onPress: onRetry });
      }

      Alert.alert(title, message, alertButtons);
    }
  }

  /**
   * Handle validation errors (form errors, input validation, etc.)
   * @param {string} message - Error message
   * @param {Object} options - Additional options
   */
  static handleValidationError(message, options = {}) {
    const {
      title = 'Validation Error',
      showModal = true,
    } = options;

    if (showModal && this.errorModalRef) {
      this.errorModalRef.show({
        type: 'warning',
        title,
        message,
        primaryButtonText: 'OK',
      });
    } else {
      Alert.alert(title, message, [{ text: 'OK' }]);
    }
  }

  /**
   * Handle payment errors
   * @param {string} error - Error type
   * @param {Object} options - Additional options
   */
  static handlePaymentError(error, options = {}) {
    const {
      title = 'Payment Error',
      showModal = true,
      onRetry = null,
    } = options;

    const paymentErrorMessages = {
      'payment_failed': 'Payment could not be processed. Please try again or use a different payment method.',
      'payment_timeout': 'Payment request timed out. Please try again.',
      'invalid_payment_method': 'The selected payment method is not available. Please choose another option.',
      'insufficient_funds': 'Insufficient funds in your account. Please check your balance or use another payment method.',
      'payment_declined': 'Your payment was declined. Please contact your bank or try a different payment method.',
    };

    const message = paymentErrorMessages[error] || 'A payment error occurred. Please try again.';

    if (showModal && this.errorModalRef) {
      const buttons = onRetry ? {
        primaryButtonText: 'Retry Payment',
        secondaryButtonText: 'Cancel',
        onPrimaryPress: onRetry,
      } : {
        primaryButtonText: 'OK',
      };

      this.errorModalRef.show({
        type: 'error',
        title,
        message,
        ...buttons,
      });
    } else {
      const alertButtons = [{ text: 'OK' }];
      if (onRetry) {
        alertButtons.unshift({ text: 'Retry Payment', onPress: onRetry });
      }

      Alert.alert(title, message, alertButtons);
    }
  }

  /**
   * Handle booking errors
   * @param {string} error - Error type
   * @param {Object} options - Additional options
   */
  static handleBookingError(error, options = {}) {
    const {
      title = 'Booking Error',
      showModal = true,
      onRetry = null,
    } = options;

    const bookingErrorMessages = {
      'session_expired_booking': 'Your session expired while creating the booking. Please log in and try again.',
      'booking_unavailable': 'This booking is no longer available. Please select a different option.',
      'booking_conflict': 'There is a conflict with your booking. Please check your schedule and try again.',
      'booking_failed': 'Booking could not be created. Please try again.',
    };

    const message = bookingErrorMessages[error] || 'A booking error occurred. Please try again.';

    // Handle session expired specifically for bookings
    if (error === 'session_expired_booking') {
      this.handleAuthError('session_expired', {
        title: 'Session Expired',
        customMessage: 'Your session expired while creating the booking. Please log in and try booking again.',
      });
      return;
    }

    if (showModal && this.errorModalRef) {
      const buttons = onRetry ? {
        primaryButtonText: 'Try Again',
        secondaryButtonText: 'Cancel',
        onPrimaryPress: onRetry,
      } : {
        primaryButtonText: 'OK',
      };

      this.errorModalRef.show({
        type: 'error',
        title,
        message,
        ...buttons,
      });
    } else {
      const alertButtons = [{ text: 'OK' }];
      if (onRetry) {
        alertButtons.unshift({ text: 'Try Again', onPress: onRetry });
      }

      Alert.alert(title, message, alertButtons);
    }
  }

  /**
   * Show success message
   * @param {string} message - Success message
   * @param {Object} options - Additional options
   */
  static showSuccess(message, options = {}) {
    const {
      title = 'Success',
      showModal = true,
      autoClose = true,
      autoCloseDelay = 3000,
    } = options;

    if (showModal && this.errorModalRef) {
      this.errorModalRef.show({
        type: 'success',
        title,
        message,
        primaryButtonText: 'OK',
        autoClose,
        autoCloseDelay,
      });
    } else {
      Alert.alert(title, message, [{ text: 'OK' }]);
    }
  }

  /**
   * Show info message
   * @param {string} message - Info message
   * @param {Object} options - Additional options
   */
  static showInfo(message, options = {}) {
    const {
      title = 'Information',
      showModal = true,
    } = options;

    if (showModal && this.errorModalRef) {
      this.errorModalRef.show({
        type: 'info',
        title,
        message,
        primaryButtonText: 'OK',
      });
    } else {
      Alert.alert(title, message, [{ text: 'OK' }]);
    }
  }

  /**
   * Generic error handler that determines error type and handles appropriately
   * @param {Object} error - Error object or string
   * @param {Object} options - Additional options
   */
  static handleError(error, options = {}) {
    const errorString = typeof error === 'string' ? error : (error?.message || 'An unexpected error occurred');
    
    // Safely check error string with null/undefined protection
    const safeErrorString = errorString || '';
    
    // Determine error type based on error message/code
    if (safeErrorString.includes('session') || safeErrorString.includes('unauthorized') || safeErrorString.includes('authentication')) {
      this.handleAuthError('session_expired', options);
    } else if (safeErrorString.includes('network') || safeErrorString.includes('timeout') || safeErrorString.includes('connection')) {
      this.handleNetworkError('network_error', options);
    } else if (safeErrorString.includes('payment')) {
      this.handlePaymentError('payment_failed', options);
    } else if (safeErrorString.includes('booking')) {
      this.handleBookingError('booking_failed', options);
    } else {
      // Generic error
      this.handleValidationError(errorString, options);
    }
  }
}

export default ErrorHandlingService;