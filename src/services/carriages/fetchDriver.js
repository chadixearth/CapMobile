// services/carriages/fetchDriver.js
// Driver service using centralized API request with JWT expiry handling
import { apiRequest } from '../authService';

// Helper for API calls using centralized request
async function apiCall(endpoint, options = {}) {
  try {
    const result = await apiRequest(endpoint, options);
    if (result.success) {
      return result.data;
    }
    throw new Error(result.data?.error || result.error || `HTTP ${result.status}: Request failed`);
  } catch (error) {
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
  // List all drivers (attempt multiple likely endpoints; first success wins)
  async getAllDrivers(params = {}) {
    const queryString = Object.keys(params).length
      ? new URLSearchParams(params).toString()
      : '';

    const candidates = [
      // Likely REST endpoints (apiBaseUrl already includes '/api')
      '/drivers/',
      '/accounts/drivers/',
      // Generic users collections
      '/users/',
      '/accounts/users/',
    ].map(base => base.includes('?')
      ? `${base}${queryString ? `&${queryString}` : ''}`
      : `${base}${queryString ? `?${queryString}` : ''}`);

    // Try candidates one by one
    for (const base of candidates) {
      const endpoint = base.includes('?')
        ? `${base}${queryString ? `&${queryString}` : ''}`
        : `${base}${queryString ? `?${queryString}` : ''}`;
      try {
        const data = await apiCall(endpoint);
        return unwrapList(data);
      } catch (e) {
        // try next candidate
      }
    }

    // Fallback: available drivers (if full list is not available)
    try {
      const data = await apiCall('/tartanilla-carriages/get_available_drivers/');
      return unwrapList(data);
    } catch (e) {
      // Surface the last error
      throw new Error('Failed to fetch drivers from all known endpoints');
    }
  },

  // Retrieve a driver by ID
  async getDriverById(driverId) {
    const candidates = [
      `/drivers/${driverId}/`,
      `/accounts/drivers/${driverId}/`,
      `/users/${driverId}/`,
      `/accounts/users/${driverId}/`,
      // Fallback used by carriage services in this app
      `/tartanilla-carriages/get_user_by_id/?user_id=${encodeURIComponent(driverId)}`,
    ];

    for (const endpoint of candidates) {
      try {
        const data = await apiCall(endpoint);
        return unwrapObject(data);
      } catch (e) {
        // try next
      }
    }
    throw new Error('Driver not found from known endpoints');
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
