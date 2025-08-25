// API Configuration
import { getAccessToken } from '../authService';
import { Platform, NativeModules } from 'react-native';
import { apiBaseUrl } from '../networkConfig';
function getDevServerHost() {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/^[^:]+:\/\/([^:/]+)/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}
const API_BASE_URL = `${apiBaseUrl()}/tour-booking/`;

/**
 * Get all bookings available for drivers to accept
 * @param {string} driverId - The driver's ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} Available bookings
 */
export async function getAvailableBookingsForDrivers(driverId, filters = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('driver_id', driverId);
    queryParams.append('status', filters.status || 'waiting_for_driver');
    
    Object.keys(filters).forEach(key => {
      if (key !== 'status' && filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        queryParams.append(key, filters[key]);
      }
    });
    
    const url = `${API_BASE_URL}available-for-drivers/?${queryParams.toString()}`;
    
    console.log('Fetching available bookings for drivers from:', url);
    
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    console.log('Available bookings response:', data);
    return data;
  } catch (error) {
    const isAbort = error?.name === 'AbortError' || /abort/i.test(error?.message || '');
    if (isAbort) {
      console.warn('Available bookings request aborted/timeout. Returning empty list.');
      return { success: true, data: { bookings: [], count: 0, driver_id: driverId } };
    }
    console.error('Error fetching available bookings for drivers:', error);
    throw error;
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const url = `${API_BASE_URL}driver-accept/${bookingId}/`;
    
    console.log('Accepting booking:', bookingId, 'for driver:', driverData);
    
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(driverData),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    console.log('Accept booking response:', data);
    return data;
  } catch (error) {
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        queryParams.append(key, filters[key]);
      }
    });
    
    // Fix URL construction to match Django endpoint
    const baseUrl = `${API_BASE_URL}driver/${driverId}/`;
    const url = queryParams.toString() ? `${baseUrl}?${queryParams.toString()}` : baseUrl;
    
    console.log('Fetching driver bookings from:', url);
    console.log('Driver ID:', driverId);
    console.log('API Base URL:', API_BASE_URL);
    
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    console.log('Driver bookings response:', data);
    return data;
  } catch (error) {
    const isAbort = error?.name === 'AbortError' || /abort/i.test(error?.message || '');
    if (isAbort) {
      console.warn('Driver bookings request aborted/timeout. Returning empty list.');
      return { success: true, data: [] };
    }
    console.error('Error fetching driver bookings:', error);
    throw error;
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
    
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    // Note: backend currently does NOT implement a start endpoint. This will 404 if called.
    const url = `${API_BASE_URL}start/${bookingId}/`;

    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    console.log('Driver start booking response:', data);
    return data;
  } catch (error) {
    const isAbort = error?.name === 'AbortError' || /abort/i.test(error?.message || '');
    if (isAbort) {
      console.warn('Start booking request aborted/timeout.');
      return { success: false, error: 'Request timeout. Please try again.' };
    }
    console.error('Error starting booking:', error);
    throw error;
  }
}
