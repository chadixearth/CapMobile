import { getAccessToken } from './authService';
import { apiBaseUrl } from './networkConfig';

const API_BASE_URL = `${apiBaseUrl()}/reports/`;

/**
 * Submit a trip report from driver about tourist
 * @param {string} bookingId - Booking ID
 * @param {string} driverId - Driver ID
 * @param {Object} reportData - Report details (reason, description)
 */
export async function submitTripReport(bookingId, driverId, reportData) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const url = `${API_BASE_URL}trip-report/`;
    
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        booking_id: bookingId,
        driver_id: driverId,
        reporter_type: 'driver',
        ...reportData
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Report failed: ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, data };
    
  } catch (error) {
    console.error('Error submitting trip report:', error);
    throw error;
  }
}

/**
 * Submit a driver report from tourist
 * @param {string} bookingId - Booking ID
 * @param {string} driverId - Driver ID being reported
 * @param {string} touristId - Tourist ID (reporter)
 * @param {Object} reportData - Report details (reason, description)
 */
export async function submitDriverReport(bookingId, driverId, touristId, reportData) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const url = `${API_BASE_URL}driver-report/`;
    
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        booking_id: bookingId,
        driver_id: driverId,
        reporter_id: touristId,
        reporter_type: 'tourist',
        status: 'pending',
        ...reportData
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Driver report error:', errorText);
      throw new Error(`Report failed: ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, data };
    
  } catch (error) {
    console.error('Error submitting driver report:', error);
    throw error;
  }
}

/**
 * Get reports for a specific user (driver or tourist)
 * @param {string} userId - User ID
 * @param {string} userType - 'driver' or 'tourist'
 */
export async function getUserReports(userId, userType = 'driver') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const url = `${API_BASE_URL}user-reports/${userId}/?type=${userType}`;
    
    const token = await getAccessToken().catch(() => null);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch reports: ${response.status}`);
    }
    
    const data = await response.json();
    return { success: true, data: data.data || [] };
    
  } catch (error) {
    console.error('Error fetching user reports:', error);
    return { success: false, error: error.message };
  }
}
