import { apiBaseUrl } from './networkConfig';
import { getCurrentUser } from './authService';
import { supabase } from './supabase';

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
    
    // Don't mask server errors - let them bubble up
    if (!response.ok) {
      console.error(`Server error ${response.status}:`, response.statusText);
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

export async function testConnection() {
  try {
    console.log('Testing API connection...');
    const res = await request('/tartanilla-carriages/test_connection/');
    console.log('Test connection response:', res);
    return res;
  } catch (error) {
    console.error('Test connection error:', error);
    return { ok: false, data: { success: false, error: error.message } };
  }
}

export async function getMyCarriages() {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // Test connection first
    console.log('Testing connection before fetching carriages...');
    const testRes = await testConnection();
    console.log('Connection test result:', testRes);
    
    // For drivers, get carriages assigned to them
    if (user.role === 'driver') {
      console.log('Fetching carriages for driver:', user.id);
      const res = await request(`/tartanilla-carriages/get_by_driver/?driver_id=${user.id}`);
      console.log('Driver carriages response:', res);
      
      if (res.ok && res.data) {
        console.log('Full driver response:', JSON.stringify(res.data, null, 2));
        // Handle the response format: {"data": [...], "success": true}
        const carriages = res.data.data || res.data || [];
        console.log('Parsed driver carriages data:', carriages);
        console.log('Carriages count:', carriages.length);
        
        // Ensure we return an array
        const finalCarriages = Array.isArray(carriages) ? carriages : [];
        console.log('Final carriages to return:', finalCarriages.length);
        return { success: true, data: finalCarriages };
      }
      console.error('Failed to fetch driver carriages:', res.data);
      return { success: false, error: res.data?.error || 'Failed to fetch carriages' };
    }
    
    // For owners and driver-owners, get carriages they own
    if (user.role === 'owner' || user.role === 'driver-owner') {
      console.log('Fetching carriages for owner:', user.id);
      const res = await request(`/tartanilla-carriages/get_by_owner/?owner_id=${user.id}`);
      console.log('Owner carriages response:', res);
      
      if (res.ok) {
        console.log('Full owner response:', JSON.stringify(res.data, null, 2));
        // Handle both response formats: {data: [...]} and {success: true, data: [...]}
        let carriages = [];
        if (res.data?.success && Array.isArray(res.data?.data)) {
          carriages = res.data.data;
        } else if (Array.isArray(res.data?.data)) {
          carriages = res.data.data;
        } else if (Array.isArray(res.data)) {
          carriages = res.data;
        }
        console.log('Parsed owner carriages data:', carriages);
        console.log('Carriages count:', carriages.length);
        return { success: true, data: carriages };
      }
      console.error('Failed to fetch owner carriages:', res.data);
      return { success: false, error: res.data?.error || 'Failed to fetch carriages' };
    }
    
    // Default case - no carriages
    return { success: true, data: [] };

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

export async function getAllDrivers() {
  try {
    const res = await request('/tartanilla-carriages/get_all_drivers/');
    
    if (res.ok) {
      const drivers = res.data?.data || [];
      return { 
        success: true, 
        data: drivers
      };
    }
    
    return { 
      success: false, 
      error: res.data?.error || 'Failed to fetch all drivers',
      data: []
    };
  } catch (error) {
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

export async function cancelDriverAssignment(carriageId) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    const res = await request(`/tartanilla-carriages/${carriageId}/cancel-assignment/`, {
      method: 'POST',
      body: JSON.stringify({
        owner_id: user.id
      }),
    });
    
    if (res.ok) {
      return { success: true, data: res.data?.data };
    }
    return { success: false, error: res.data?.error || 'Failed to cancel assignment' };
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

export async function reassignDriver(carriageId, newDriverId) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return { success: false, error: 'User not authenticated' };
    }

    const res = await request(`/tartanilla-carriages/${carriageId}/reassign-driver/`, {
      method: 'POST',
      body: JSON.stringify({
        owner_id: user.id,
        new_driver_id: newDriverId
      }),
    });
    
    if (res.ok) {
      return { success: true, data: res.data?.data };
    }
    return { success: false, error: res.data?.error || 'Failed to reassign driver' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}