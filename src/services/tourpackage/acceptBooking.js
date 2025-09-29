// API Configuration
import apiClient from '../apiClient';
import NotificationService from '../notificationService';
import { getAccessToken } from '../authService';
import { invalidateData } from '../dataInvalidationService';
const API_BASE_URL = '/tour-booking';

// Booking Policy Constants
export const BOOKING_POLICIES = {
  PENDING_TIMEOUT_MINUTES: 30,
  PAYMENT_DEADLINE_HOURS: 12,
  MAX_ACTIVE_BOOKINGS: 1,
  MAX_DAILY_BOOKINGS: 3,
  MAX_ADVANCE_BOOKING_DAYS: 30
};

// Error Codes
export const BOOKING_ERROR_CODES = {
  BOOKING_EXPIRED: 'BOOKING_EXPIRED',
  BOOKING_NOT_AVAILABLE: 'BOOKING_NOT_AVAILABLE',
  DRIVER_ACTIVE_BOOKING_EXISTS: 'DRIVER_ACTIVE_BOOKING_EXISTS',
  DRIVER_ACTIVE_RIDE_EXISTS: 'DRIVER_ACTIVE_RIDE_EXISTS',
  NO_CARRIAGE_ASSIGNED: 'NO_CARRIAGE_ASSIGNED',
  NO_ELIGIBLE_CARRIAGE: 'NO_ELIGIBLE_CARRIAGE',
  CARRIAGE_SUSPENDED: 'CARRIAGE_SUSPENDED',
  SCHEDULE_CONFLICT: 'SCHEDULE_CONFLICT',
  DAILY_BOOKING_LIMIT_EXCEEDED: 'DAILY_BOOKING_LIMIT_EXCEEDED',
  PAST_DATE_BOOKING: 'PAST_DATE_BOOKING',
  TOO_FAR_ADVANCE: 'TOO_FAR_ADVANCE'
};

/**
 * Get all bookings available for drivers to accept
 * @param {string} driverId - The driver's ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} Available bookings
 */
export async function getAvailableBookingsForDrivers(driverId, filters = {}) {
  try {
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('driver_id', driverId);
    queryParams.append('status', filters.status || 'pending');
    
    Object.keys(filters).forEach(key => {
      if (key !== 'status' && filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        queryParams.append(key, filters[key]);
      }
    });
    
    const endpoint = `${API_BASE_URL}/available-for-drivers/?${queryParams.toString()}`;
    const result = await apiClient.get(endpoint);
    
    // Filter out expired bookings on client side as well
    if (result.data && result.data.data && result.data.data.bookings) {
      const now = new Date();
      const validBookings = result.data.data.bookings.filter(booking => {
        if (booking.created_at) {
          const createdAt = new Date(booking.created_at);
          const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
          return createdAt > thirtyMinutesAgo; // Only show bookings created within last 30 minutes
        }
        return true;
      });
      
      result.data.data.bookings = validBookings;
      result.data.data.count = validBookings.length;
    }
    
    console.log('Available bookings response (with policy filtering):', result.data);
    return result.data;
  } catch (error) {
    console.error('[getAvailableBookingsForDrivers] Error:', error.message);
    // Return empty result instead of throwing to prevent app crashes
    return { success: true, data: { bookings: [], count: 0, driver_id: driverId } };
  }
}

/**
 * Get booking statistics with policy compliance metrics
 * @returns {Promise<Object>} Booking statistics
 */
export async function getBookingStats() {
  try {
    const endpoint = `${API_BASE_URL}/stats/`;
    const result = await apiClient.get(endpoint);
    
    console.log('Booking stats with policy metrics:', result.data);
    return result.data;
  } catch (error) {
    console.error('[getBookingStats] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Driver accepts a booking
 * @param {string} bookingId - The booking ID to accept
 * @param {Object} driverData - Driver information
 * @param {string} driverData.driver_id - Driver's ID
 * @param {string} driverData.driver_name - Driver's name
 * @returns {Promise<Object>} Acceptance result
 */
export async function driverAcceptBooking(bookingId, driverData) {
  try {
    console.log('Accepting booking:', bookingId, 'for driver:', driverData);
    
    const endpoint = `${API_BASE_URL}/driver-accept/${bookingId}/`;
    const result = await apiClient.post(endpoint, driverData);
    
    // Notify tourist that booking was accepted
    if (result.data && result.data.success && result.data.data) {
      try {
        console.log('[AcceptBooking] Triggering tourist notification for accepted booking:', result.data.data.id);
        // Enhanced notification with payment deadline
        const paymentDeadline = result.data.payment_deadline;
        const deadlineDate = paymentDeadline ? new Date(paymentDeadline).toLocaleString() : '12 hours';
        
        const notifResult = await NotificationService.sendNotification(
          [result.data.data.customer_id],
          'Driver Assigned - Payment Required! ✅💳',
          `Great news! ${driverData.driver_name || 'A driver'} has accepted your booking. Please complete payment by ${deadlineDate} to confirm your tour.`,
          'booking_accepted',
          'tourist'
        );
        console.log('[AcceptBooking] Enhanced tourist notification result:', notifResult);
        console.log('[AcceptBooking] Booking accepted successfully with policies:', result.data.policies_applied);
      } catch (notifError) {
        console.warn('[AcceptBooking] Failed to notify tourist (non-critical):', notifError);
      }
    } else {
      console.warn('[AcceptBooking] No valid booking data to notify tourist about');
    }
    
    console.log('Accept booking response with policies:', result.data);
    if (result.data?.success) {
      invalidateData.bookings();
    }
    return result.data;
  } catch (error) {
    // Handle booking policy violations and validation errors gracefully
    if (error.message && (error.message.includes('HTTP 403') || error.message.includes('HTTP 400') || error.message.includes('HTTP 409') || error.message.includes('HTTP 410'))) {
      try {
        // Parse the error response to check for various errors
        const errorMatch = error.message.match(/HTTP (?:403|400|409|410): (.+)/);
        if (errorMatch) {
          const errorData = JSON.parse(errorMatch[1]);
          const knownErrorCodes = [
            // Carriage-related errors
            'NO_CARRIAGE_ASSIGNED', 
            'NO_AVAILABLE_CARRIAGE', 
            'NO_ELIGIBLE_CARRIAGE',
            'CARRIAGE_SUSPENDED',
            'CARRIAGE_CHECK_FAILED',
            // Active booking/ride conflicts
            'DRIVER_ACTIVE_BOOKING_EXISTS',
            'DRIVER_ACTIVE_RIDE_EXISTS',
            // Booking policy violations
            'BOOKING_EXPIRED',
            'BOOKING_NOT_AVAILABLE',
            'SCHEDULE_CONFLICT',
            'PAST_DATE_BOOKING',
            'TOO_FAR_ADVANCE',
            'DAILY_BOOKING_LIMIT_EXCEEDED'
          ];
          
          if (knownErrorCodes.includes(errorData.error_code)) {
            // Return the error as a structured response instead of throwing
            console.log('Booking policy violation or validation error:', errorData);
            return {
              success: false,
              error: errorData.error,
              error_code: errorData.error_code,
              can_view_only: errorData.can_view_only || false,
              friendly_message: errorData.friendly_message || errorData.error,
              active_booking: errorData.active_booking,
              active_ride: errorData.active_ride,
              // Policy-specific data
              booking_date: errorData.booking_date,
              booking_time: errorData.booking_time,
              current_count: errorData.current_count,
              max_allowed: errorData.max_allowed,
              expired_at: errorData.expired_at,
              created_at: errorData.created_at,
              max_date: errorData.max_date
            };
          }
        }
      } catch (parseError) {
        console.warn('Could not parse error response:', parseError);
      }
    }
    
    console.error('Error accepting booking:', error);
    throw error;
  }
}

/**
 * Get all bookings assigned to a specific driver
 * @param {string} driverId - The driver's ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} Driver's bookings
 */
export async function getDriverBookings(driverId, filters = {}) {
  try {
    // Build query parameters
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        queryParams.append(key, filters[key]);
      }
    });
    
    const endpoint = `${API_BASE_URL}/driver/${driverId}/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const result = await apiClient.get(endpoint);
    
    // Add policy compliance information to the response
    if (result.data?.success && result.data.data?.statistics) {
      const stats = result.data.data.statistics;
      const statusCounts = stats.status_counts || {};
      
      // Calculate policy compliance metrics
      const policyMetrics = {
        completion_rate: stats.total_bookings > 0 ? 
          ((statusCounts.completed || 0) / stats.total_bookings * 100).toFixed(1) : '0.0',
        cancellation_rate: stats.total_bookings > 0 ? 
          ((statusCounts.cancelled || 0) / stats.total_bookings * 100).toFixed(1) : '0.0',
        active_bookings: (statusCounts.driver_assigned || 0) + (statusCounts.in_progress || 0)
      };
      
      result.data.data.policy_metrics = policyMetrics;
    }
    
    console.log('Driver bookings response:', result.data);
    return result.data;
  } catch (error) {
    console.error('Error fetching driver bookings:', error.message);
    // Return empty result instead of throwing to prevent app crashes
    return { success: true, data: { bookings: [], count: 0, driver_info: { id: driverId, name: 'Driver' }, statistics: { total_bookings: 0, total_earnings: 0 } } };
  }
}

/**
 * Update booking status
 * @param {string} bookingId - The booking ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Update result
 */
export async function updateBookingStatus(bookingId, status) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const url = `${API_BASE_URL}${bookingId}/`;
    
    console.log('Updating booking status:', bookingId, 'to:', status);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    console.log('Update booking status response:', data);
    return data;
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
}

/**
 * Driver completes an assigned booking
 * @param {string} bookingId - The booking ID
 * @param {string} driverId - The driver's ID (must match assigned driver)
 * @returns {Promise<Object>} Completion result
 */
export async function driverCompleteBooking(bookingId, driverId) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    // Backend exposes: /api/tour-booking/complete/{booking_id}/
    const url = `${API_BASE_URL}complete/${bookingId}/`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ driver_id: driverId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    console.log('Driver complete booking response:', data);
    
    // Log money flow information if available
    if (data?.money_flow) {
      console.log('[CompleteBooking] Money flow processed:', {
        driver_share: data.money_flow.driver_share,
        driver_percentage: data.money_flow.driver_percentage
      });
    }
    
    if (data?.success) {
      invalidateData.bookings();
      invalidateData.earnings();
    }
    return data;
  } catch (error) {
    const isAbort = error?.name === 'AbortError' || /abort/i.test(error?.message || '');
    if (isAbort) {
      console.warn('Complete booking request aborted/timeout.');
      return { success: false, error: 'Request timeout. Please try again.' };
    }
    console.error('Error completing booking:', error);
    throw error;
  }
}

/**
 * Driver starts an assigned booking (transitions to in_progress)
 * @param {string} bookingId - The booking ID
 * @param {string} driverId - The driver's ID (must match assigned driver)
 * @returns {Promise<Object>} Start result
 */
export async function driverStartBooking(bookingId, driverId) {
  try {
    const endpoint = `${API_BASE_URL}/start/${bookingId}/`;
    const result = await apiClient.post(endpoint, { driver_id: driverId });
    
    console.log('Driver start booking response:', result.data);
    
    // Handle policy validation errors for starting bookings
    if (!result.data?.success && result.data?.error) {
      if (result.data.error.includes('before the scheduled date')) {
        console.log('[StartBooking] Policy violation: Cannot start before scheduled date');
      } else if (result.data.error.includes('Only paid bookings')) {
        console.log('[StartBooking] Policy violation: Booking must be paid first');
      }
    }
    
    if (result.data?.success) {
      invalidateData.bookings();
    }
    return result.data;
  } catch (error) {
    console.error('Error starting booking:', error);
    if (error.message?.includes('timeout')) {
      return { success: false, error: 'Request timeout. Please try again.' };
    }
    throw error;
  }
}

/**
 * Get current booking policies and constraints
 * @returns {Promise<Object>} Booking policies
 */
export async function getBookingPolicies() {
  try {
    const endpoint = `${API_BASE_URL}/booking-policies/`;
    const result = await apiClient.get(endpoint);
    
    console.log('Booking policies response:', result.data);
    return result.data;
  } catch (error) {
    console.error('[getBookingPolicies] Error:', error.message);
    // Return default policies if API fails
    return {
      success: true,
      data: {
        booking_expiration: { pending_booking_timeout: '30 minutes' },
        payment_deadline: { payment_timeout: '12 hours' },
        driver_constraints: { max_active_bookings: 1, max_daily_bookings: 3 }
      }
    };
  }
}

/**
 * Check if driver can accept bookings (policy validation)
 * @param {string} driverId - The driver's ID
 * @returns {Promise<Object>} Eligibility check result
 */
export async function checkDriverEligibility(driverId) {
  try {
    // This would typically be a dedicated endpoint, but we can simulate it
    // by checking the driver's current bookings and carriage status
    const driverBookings = await getDriverBookings(driverId, { status: 'driver_assigned,in_progress' });
    
    const eligibilityCheck = {
      can_accept_bookings: true,
      reasons: [],
      active_bookings: 0,
      daily_bookings: 0,
      carriage_status: 'unknown'
    };
    
    if (driverBookings.success && driverBookings.data) {
      const activeBookings = driverBookings.data.bookings.filter(b => 
        ['driver_assigned', 'in_progress'].includes(b.status)
      );
      
      eligibilityCheck.active_bookings = activeBookings.length;
      
      if (activeBookings.length >= 1) {
        eligibilityCheck.can_accept_bookings = false;
        eligibilityCheck.reasons.push('Already has active booking');
      }
      
      // Check daily bookings (today)
      const today = new Date().toISOString().split('T')[0];
      const todayBookings = driverBookings.data.bookings.filter(b => 
        b.booking_date && b.booking_date.startsWith(today)
      );
      
      eligibilityCheck.daily_bookings = todayBookings.length;
      
      if (todayBookings.length >= 3) {
        eligibilityCheck.can_accept_bookings = false;
        eligibilityCheck.reasons.push('Daily booking limit reached (3/day)');
      }
    }
    
    return {
      success: true,
      data: eligibilityCheck
    };
  } catch (error) {
    console.error('[checkDriverEligibility] Error:', error.message);
    return {
      success: false,
      error: error.message,
      data: {
        can_accept_bookings: false,
        reasons: ['Unable to verify eligibility']
      }
    };
  }
}

/**
 * Driver cancels an accepted booking (with policy awareness)
 * @param {string} bookingId
 * @param {string} driverId
 * @param {string} reason
 * @returns {Promise<Object>}
 */
export async function driverCancelBooking(bookingId, driverId, reason = 'Cancelled by driver') {
  try {
    const endpoint = `${API_BASE_URL}/driver-cancel/${bookingId}/`;
    const result = await apiClient.post(endpoint, { driver_id: driverId, reason });
    
    console.log('Driver cancel booking response:', result.data);
    
    // Handle successful cancellation with reassignment
    if (result.data?.success) {
      invalidateData.bookings();
      
      // Log policy compliance
      if (result.data.reassignment_status === 'broadcasted') {
        console.log('[CancelBooking] Booking reassigned to other drivers per policy');
      }
    }
    
    return result.data;
  } catch (error) {
    console.error('Error cancelling booking:', error);
    if (error.message?.includes('timeout')) {
      return { success: false, error: 'Request timeout. Please try again.' };
    }
    throw error;
  }
}

/**
 * Trigger booking cleanup (expire pending and cancel unpaid)
 * @returns {Promise<Object>} Cleanup result
 */
export async function triggerBookingCleanup() {
  try {
    const endpoint = `${API_BASE_URL}/cleanup-bookings/`;
    const result = await apiClient.post(endpoint);
    
    console.log('Booking cleanup response:', result.data);
    if (result.data?.success) {
      invalidateData.bookings();
    }
    return result.data;
  } catch (error) {
    console.error('Error triggering booking cleanup:', error);
    return { success: false, error: error.message };
  }
}
