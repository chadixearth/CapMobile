// services/carriageService.js
// Use your computer's IP address instead of localhost for mobile devices
// Updated to match the IP used in authService
let API_BASE_URL = 'http://192.168.1.8:8000/api/tartanilla-carriages/';

// Function to set API base URL dynamically
export const setApiBaseUrl = (newUrl) => {
  API_BASE_URL = newUrl;
};

// Helper: timeout via AbortController
const withTimeout = async (promiseFactory, ms = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const response = await promiseFactory(controller.signal);
    return response;
  } finally {
    clearTimeout(id);
  }
};

// Helper: robust JSON parsing and format handling
const parseJsonSafely = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!contentType.includes('application/json')) {
    throw new Error('Response is not JSON');
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Failed to parse JSON');
  }
};

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
  const testUrls = [
    'http://192.168.1.8:8000/api/tartanilla-carriages/',
    'http://192.168.1.8:8000/api/carriages/',
    'http://192.168.1.8:8000/tartanilla-carriages/',
    'http://192.168.1.8:8000/carriages/',
    'http://192.168.1.8:8000/api/',
    'http://192.168.1.8:8000/',
  ];

  for (const url of testUrls) {
    try {
      const res = await withTimeout((signal) => fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' }, signal }), 5000);
      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();
      if (contentType.includes('application/json')) {
        try {
          const json = JSON.parse(text);
          return { success: true, status: res.status, url, data: json, text: text.substring(0, 200) };
        } catch (_) {
          // fallthrough
        }
      }
      if (text.includes('api') || text.includes('carriage') || text.includes('tartanilla')) {
        return { success: true, status: res.status, url, warning: 'Endpoint found but returns HTML instead of JSON', text: text.substring(0, 200) };
      }
    } catch (_) {
      // continue
    }
  }
  return { success: false, error: 'No working API endpoint found. Please check your server configuration.', testedUrls: testUrls };
};

export const carriageService = {
  // List all carriages
  async getAllCarriages() {
    try {
      const response = await withTimeout((signal) => fetch(`${API_BASE_URL}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal,
      }));

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await parseJsonSafely(response);
      return unwrapList(data);
    } catch (error) {
      console.error('Error fetching carriages:', error);
      throw error;
    }
  },

  // Retrieve a carriage by ID
  async getCarriageById(carriageId) {
    try {
      const response = await withTimeout((signal) => fetch(`${API_BASE_URL}${carriageId}/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal,
      }));

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await parseJsonSafely(response);
      return unwrapObject(data);
    } catch (error) {
      console.error('Error fetching carriage:', error);
      throw error;
    }
  },

  // Create a new carriage
  async createCarriage(payload) {
    try {
      const response = await withTimeout((signal) => fetch(`${API_BASE_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      }));

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await parseJsonSafely(response);
      return unwrapObject(data);
    } catch (error) {
      console.error('Error creating carriage:', error);
      throw error;
    }
  },

  // Update an existing carriage (PATCH by default)
  async updateCarriage(carriageId, updates) {
    try {
      const response = await withTimeout((signal) => fetch(`${API_BASE_URL}${carriageId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(updates),
        signal,
      }));

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await parseJsonSafely(response);
      return unwrapObject(data);
    } catch (error) {
      console.error('Error updating carriage:', error);
      throw error;
    }
  },

  // Delete a carriage
  async deleteCarriage(carriageId) {
    try {
      const response = await withTimeout((signal) => fetch(`${API_BASE_URL}${carriageId}/`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
        signal,
      }));

      if (!response.ok && response.status !== 204) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return true;
    } catch (error) {
      console.error('Error deleting carriage:', error);
      throw error;
    }
  },

  // Get carriages by owner
  async getByOwner(ownerId) {
    try {
      const url = `${API_BASE_URL}get_by_owner/?owner_id=${encodeURIComponent(ownerId)}`;
      const response = await withTimeout((signal) => fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal,
      }));

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await parseJsonSafely(response);
      return unwrapList(data);
    } catch (error) {
      console.error('Error fetching carriages by owner:', error);
      throw error;
    }
  },

  // Get carriages by driver
  async getByDriver(driverId) {
    try {
      const url = `${API_BASE_URL}get_by_driver/?driver_id=${encodeURIComponent(driverId)}`;
      const response = await withTimeout((signal) => fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal,
      }));

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await parseJsonSafely(response);
      return unwrapList(data);
    } catch (error) {
      console.error('Error fetching carriages by driver:', error);
      throw error;
    }
  },

  // Get available drivers not assigned to any carriage
  async getAvailableDrivers() {
    try {
      const response = await withTimeout((signal) => fetch(`${API_BASE_URL}get_available_drivers/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal,
      }));

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await parseJsonSafely(response);
      // This endpoint returns { success, data: [...] }
      return unwrapList(data);
    } catch (error) {
      console.error('Error fetching available drivers:', error);
      throw error;
    }
  },

  // Get owners
  async getOwners() {
    try {
      const response = await withTimeout((signal) => fetch(`${API_BASE_URL}get_owners/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal,
      }));

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await parseJsonSafely(response);
      return unwrapList(data);
    } catch (error) {
      console.error('Error fetching owners:', error);
      throw error;
    }
  },

  // Get user by ID
  async getUserById(userId) {
    try {
      const url = `${API_BASE_URL}get_user_by_id/?user_id=${encodeURIComponent(userId)}`;
      const response = await withTimeout((signal) => fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal,
      }));

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await parseJsonSafely(response);
      return unwrapObject(data);
    } catch (error) {
      console.error('Error fetching user by id:', error);
      throw error;
    }
  },

  // Get user by email
  async getUserByEmail(email) {
    try {
      const url = `${API_BASE_URL}get_user_by_email/?email=${encodeURIComponent(email)}`;
      const response = await withTimeout((signal) => fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal,
      }));

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await parseJsonSafely(response);
      return unwrapObject(data);
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw error;
    }
  },
};

export default carriageService;


