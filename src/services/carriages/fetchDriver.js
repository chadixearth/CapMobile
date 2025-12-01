// services/carriages/fetchDriver.js
// Driver service using centralized API request with JWT expiry handling
import { apiRequest } from '../authService';

// Helper for API calls using centralized request with rate limiting protection
async function apiCall(endpoint, options = {}, retryCount = 0) {
  try {
    const result = await apiRequest(endpoint, options);
    if (result.success) {
      return result.data;
    }
    throw new Error(result.data?.error || result.error || `HTTP ${result.status}: Request failed`);
  } catch (error) {
    // Handle rate limiting with exponential backoff
    if (error.message?.includes('429') && retryCount < 3) {
      const delay = Math.min(2000 * Math.pow(2, retryCount), 8000);
      console.log(`Rate limited, retrying ${endpoint} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return apiCall(endpoint, options, retryCount + 1);
    }
    throw error;
  }
}

// Normalize server response shapes to plain arrays/objects
const unwrapList = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.results && Array.isArray(data.results)) return data.results;
  if (data.success && Array.isArray(data.data)) return data.data;
  if (data.success && data.data && Array.isArray(data.data)) return data.data;
  // Some APIs may return { success, data: {...} } for single but we expect list here
  if (data.success && data.data && !Array.isArray(data.data)) return [data.data];
  // Fallback: unknown shape
  throw new Error('Unexpected response format from server');
};

const unwrapObject = (data) => {
  if (!data) return null;
  if (data.success && data.data) return data.data;
  if (data.id) return data; // direct object
  // Fallback: unknown shape
  throw new Error('Unexpected response format from server');
};

export const driverService = {
  // List available drivers (use known working endpoint only)
  async getAllDrivers(params = {}) {
    const queryString = Object.keys(params).length
      ? `?${new URLSearchParams(params).toString()}`
      : '';
    const data = await apiCall(`/tartanilla-carriages/get_available_drivers/${queryString}`);
    return unwrapList(data);
  },



  // Retrieve a driver by ID (resolve from available drivers list only)
  async getDriverById(driverId) {
    const list = await this.getAllDrivers();
    const target = String(driverId);
    const match = (Array.isArray(list) ? list : []).find(d => {
      const did = String(d?.id || '');
      const uid = String(d?.user_id || '');
      return did === target || uid === target;
    });
    if (!match) throw new Error('Driver not found in available drivers');
    return match;
  },

  // Suspend a driver
  async suspendDriver({ userId, durationDays, reason }) {
    const payload = {
      user_id: userId,
      duration_days: durationDays,
      reason,
    };
    const data = await apiCall('/accounts/api/suspend-driver/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapObject(data) || { success: true };
  },

  // Unsuspend a driver
  async unsuspendDriver(userId) {
    const data = await apiCall('/accounts/api/unsuspend-driver/', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
    return unwrapObject(data) || { success: true };
  },

  // Get tartanillas assigned to a driver (helper mirroring the web view)
  async getDriverAssignedTartanillas(driverId) {
    const endpoint = `/accounts/api/driver-assigned-tartanillas/?driver_id=${encodeURIComponent(driverId)}`;
    const data = await apiCall(endpoint);
    return unwrapList(data.items || data);
  },
};

export { driverService as default };
