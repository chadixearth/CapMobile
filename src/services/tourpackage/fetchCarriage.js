// services/carriageService.js
// Updated to use centralized API request with JWT expiry handling
import { Platform, NativeModules } from 'react-native';
import { apiRequest } from '../authService';

// Function to set API base URL dynamically (kept for compatibility)
export const setApiBaseUrl = (newUrl) => {
  // This function is kept for compatibility but no longer used
  console.warn('setApiBaseUrl is deprecated - using centralized API configuration');
};

// Helper function for API calls using centralized request
async function apiCall(endpoint, options = {}) {
  try {
    const result = await apiRequest(endpoint, options);
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.data?.error || result.error || `HTTP ${result.status}: Request failed`);
    }
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

export const testCarriageConnection = async () => {
  const testEndpoints = [
    '/tartanilla-carriages/',
    '/carriages/',
    '/api/',
    '/'
  ];

  for (const endpoint of testEndpoints) {
    try {
      const result = await apiRequest(endpoint);
      
      if (result.success) {
        return {
          success: true,
          status: result.status,
          endpoint: endpoint,
          data: result.data
        };
      }
    } catch (error) {
      // Try next endpoint
    }
  }
  
  return {
    success: false,
    error: 'No working API endpoint found. Please check your server configuration.',
    testedEndpoints: testEndpoints
  };
};

export const carriageService = {
  // List all carriages
  async getAllCarriages() {
    try {
      const data = await apiCall('/tartanilla-carriages/');
      return unwrapList(data);
    } catch (error) {
      console.error('Error fetching carriages:', error);
      throw error;
    }
  },

  // Retrieve a carriage by ID
  async getCarriageById(carriageId) {
    try {
      const data = await apiCall(`/tartanilla-carriages/${carriageId}/`);
      return unwrapObject(data);
    } catch (error) {
      console.error('Error fetching carriage:', error);
      throw error;
    }
  },

  // Create a new carriage
  async createCarriage(payload) {
    try {
      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      
      const data = await apiCall('/tartanilla-carriages/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      console.log('Parsed response data:', data);
      return unwrapObject(data);
    } catch (error) {
      console.error('Error creating carriage:', error);
      throw error;
    }
  },

  // Update an existing carriage (PATCH by default)
  async updateCarriage(carriageId, updates) {
    try {
      // First attempt with PATCH
      const data = await apiCall(`/tartanilla-carriages/${carriageId}/`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      return unwrapObject(data);
    } catch (error) {
      // Some backends disallow PATCH and require PUT
      const msg = String(error?.message || '');
      if (msg.includes('HTTP 405')) {
        try {
          // First try straight PUT with provided updates (some servers accept partial PUT)
          try {
            const data = await apiCall(`/tartanilla-carriages/${carriageId}/`, {
              method: 'PUT',
              body: JSON.stringify(updates)
            });
            return unwrapObject(data);
          } catch (putErr) {
            const putMsg = String(putErr?.message || '');
            if (putMsg.includes('HTTP 400') || putMsg.includes('HTTP 422')) {
              // Server likely requires full resource on PUT. Fetch current, merge, resend.
              const current = await apiCall(`/tartanilla-carriages/${carriageId}/`);
              const merged = { ...(unwrapObject(current) || {}), ...updates };
              const data2 = await apiCall(`/tartanilla-carriages/${carriageId}/`, {
                method: 'PUT',
                body: JSON.stringify(merged)
              });
              return unwrapObject(data2);
            }
            throw putErr;
          }
        } catch (e) {
          console.error('Error updating carriage with PUT fallback:', e);
          throw e;
        }
      }
      console.error('Error updating carriage:', error);
      throw error;
    }
  },

  // Delete a carriage
  async deleteCarriage(carriageId) {
    try {
      await apiCall(`/tartanilla-carriages/${carriageId}/`, {
        method: 'DELETE'
      });
      return true;
    } catch (error) {
      console.error('Error deleting carriage:', error);
      throw error;
    }
  },

  // Get carriages by owner
  async getByOwner(ownerId) {
    try {
      const data = await apiCall(`/tartanilla-carriages/get_by_owner/?owner_id=${encodeURIComponent(ownerId)}`);
      return unwrapList(data);
    } catch (error) {
      console.error('Error fetching carriages by owner:', error);
      throw error;
    }
  },

  // Get carriages by driver
  async getByDriver(driverId) {
    try {
      const data = await apiCall(`/tartanilla-carriages/get_by_driver/?driver_id=${encodeURIComponent(driverId)}`);
      return unwrapList(data);
    } catch (error) {
      console.error('Error fetching carriages by driver:', error);
      throw error;
    }
  },

  // Get available drivers not assigned to any carriage
  async getAvailableDrivers() {
    try {
      const data = await apiCall('/tartanilla-carriages/get_available_drivers/');
      return unwrapList(data);
    } catch (error) {
      console.error('Error fetching available drivers:', error);
      throw error;
    }
  },

  // Get owners
  async getOwners() {
    try {
      const data = await apiCall('/tartanilla-carriages/get_owners/');
      return unwrapList(data);
    } catch (error) {
      console.error('Error fetching owners:', error);
      throw error;
    }
  },

  // Get user by ID
  async getUserById(userId) {
    try {
      const data = await apiCall(`/tartanilla-carriages/get_user_by_id/?user_id=${encodeURIComponent(userId)}`);
      return unwrapObject(data);
    } catch (error) {
      console.error('Error fetching user by id:', error);
      throw error;
    }
  },

  // Get user by email
  async getUserByEmail(email) {
    try {
      const data = await apiCall(`/tartanilla-carriages/get_user_by_email/?email=${encodeURIComponent(email)}`);
      return unwrapObject(data);
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw error;
    }
  },
};

export default carriageService;


