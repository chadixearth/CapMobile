// API Configuration
import apiClient from '../apiClient';
import NotificationService from '../notificationService';
import { getAccessToken } from '../authService';
import { invalidateData } from '../dataInvalidationService';
const API_BASE_URL = '/tour-booking';

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
    
    console.log('Available bookings response:', result.data);
    return result.data;
  } catch (error) {
    console.error('[getAvailableBookingsForDrivers] Error:', error.message);
    // Return empty result instead of throwing to prevent app crashes
    return { success: true, data: { bookings: [], count: 0, driver_id: driverId } };
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
        // Enhanced notification with payment reminder
        const notifResult = await NotificationService.sendNotification(
          [result.data.data.customer_id],
          'Booking Accepted! Payment Required ✅💳',
          `Great news! ${driverData.driver_name || 'A driver'} has accepted your booking. Please complete payment to confirm your tour.`,
          'booking_accepted',
          'tourist'
        );
        console.log('[AcceptBooking] Tourist notification result:', notifResult);
      } catch (notifError) {
        console.warn('[AcceptBooking] Failed to notify tourist (non-critical):', notifError);
      }
    } else {
      console.warn('[AcceptBooking] No valid booking data to notify tourist about');
    }
    
    console.log('Accept booking response:', result.data);
    if (result.data?.success) {
      invalidateData.bookings();
    }
    return result.data;
  } catch (error) {
    // Handle carriage-related errors gracefully
    if (error.message && (error.message.includes('HTTP 403') || error.message.includes('HTTP 400'))) {
      try {
        // Parse the error response to check for carriage errors
        const errorMatch = error.message.match(/HTTP (?:403|400): (.+)/);
        if (errorMatch) {
          const errorData = JSON.parse(errorMatch[1]);
          if (errorData.error_code === 'NO_CARRIAGE_ASSIGNED' || errorData.error_code === 'NO_AVAILABLE_CARRIAGE' || errorData.error_code === 'NO_ELIGIBLE_CARRIAGE') {
            // Return the error as a structured response instead of throwing
            console.log('Carriage validation response - driver can view but not accept:', errorData);
            return {
              success: false,
              error: errorData.error,
              error_code: errorData.error_code,
              can_view_only: errorData.can_view_only || true,
              friendly_message: errorData.friendly_message
            };
          }
        }
      } catch (parseError) {
        console.warn('Could not parse carriage error response:', parseError);
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
 * Driver cancels an accepted booking
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
    if (result.data?.success) {
      invalidateData.bookings();
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
