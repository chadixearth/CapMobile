// API Configuration
const API_BASE_URL = 'http://10.196.222.213:8000/api/booking/';

/**
 * Get all bookings available for drivers to accept
 * @param {string} driverId - The driver's ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} Available bookings
 */
export async function getAvailableBookingsForDrivers(driverId, filters = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
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
    
    const response = await fetch(url, {
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
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const url = `${API_BASE_URL}driver-accept/${bookingId}/`;
    
    console.log('Accepting booking:', bookingId, 'for driver:', driverData);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
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
    
    const response = await fetch(url, {
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
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
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
