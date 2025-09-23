import { apiBaseUrl } from './networkConfig';
import { getCurrentUser } from './authService';

// Request limiter for tartanilla service
let lastRequest = 0;
const MIN_REQUEST_INTERVAL = 200; // 200ms between requests

async function request(path, options = {}) {
  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequest;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequest = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    });
    
    clearTimeout(timeoutId);
    
    // Handle connection errors gracefully
    if (!response.ok && response.status >= 500) {
      console.warn(`Server error ${response.status}, returning empty data`);
      return { ok: true, data: { success: true, data: [] } };
    }
    
    const data = await response.json();
    return { ok: response.ok, data };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Request timeout, returning empty data');
      return { ok: true, data: { success: true, data: [] } };
    }
    return { ok: false, data: { success: false, error: error.message } };
  }
}

export async function getMyCarriages() {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // For drivers, get carriages assigned to them
    if (user.role === 'driver' || user.role === 'driver-owner') {
      const res = await request(`/tartanilla-carriages/get_by_driver/?driver_id=${user.id}`);
      if (res.ok) {
        return { success: true, data: res.data?.data || [] };
      }
      return { success: false, error: res.data?.error || 'Failed to fetch carriages' };
    }
    
    // For owners, get carriages they own
    const res = await request(`/tartanilla-carriages/get_by_owner/?owner_id=${user.id}`);
    if (res.ok) {
      return { success: true, data: res.data?.data || [] };
    }
    return { success: false, error: res.data?.error || 'Failed to fetch carriages' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getAvailableDrivers() {
  try {
    console.log('Fetching available drivers from:', `${apiBaseUrl()}/tartanilla-carriages/get_available_drivers/`);
    const res = await request('/tartanilla-carriages/get_available_drivers/');
    console.log('Available drivers response:', res);
    
    if (res.ok) {
      const drivers = res.data?.data || [];
      const debug = res.data?.debug || {};
      
      console.log('Driver fetch debug info:', debug);
      console.log('Available drivers:', drivers);
      
      return { 
        success: true, 
        data: drivers,
        debug: debug
      };
    }
    
    console.error('Failed to fetch drivers:', res.data?.error);
    return { 
      success: false, 
      error: res.data?.error || 'Failed to fetch drivers',
      data: []
    };
  } catch (error) {
    console.error('Error in getAvailableDrivers:', error);
    return { 
      success: false, 
      error: error.message,
      data: []
    };
  }
}

export async function createTestDrivers() {
  try {
    console.log('Creating test drivers...');
    const res = await request('/tartanilla-carriages/create_test_drivers/', {
      method: 'POST'
    });
    console.log('Create test drivers response:', res);
    
    if (res.ok) {
      return { success: true, data: res.data?.data || [] };
    }
    return { success: false, error: res.data?.error || 'Failed to create test drivers' };
  } catch (error) {
    console.error('Error creating test drivers:', error);
    return { success: false, error: error.message };
  }
}

export async function assignDriverToCarriage(carriageId, driverId) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    const res = await request(`/tartanilla-carriages/${carriageId}/owner-select-driver/`, {
      method: 'POST',
      body: JSON.stringify({
        owner_id: user.id,
        driver_id: driverId
      }),
    });
    
    if (res.ok) {
      return { success: true, data: res.data?.data };
    }
    return { success: false, error: res.data?.error || 'Failed to assign driver' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function createCarriage(carriageData) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    const res = await request('/tartanilla-carriages/', {
      method: 'POST',
      body: JSON.stringify({
        ...carriageData,
        assigned_owner_id: user.id
      }),
    });
    
    if (res.ok) {
      return { success: true, data: res.data?.data };
    }
    return { success: false, error: res.data?.error || 'Failed to create carriage' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}