// API Configuration
import { Platform, NativeModules } from 'react-native';
import { buildApiUrl, validateApiUrl } from './urlValidator';

function getDevServerHost() {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/^[^:]+:\/\/([^:/]+)/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}



export async function fetchExampleData() {
  try {
    // Create an AbortController for manual timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const url = buildApiUrl('/example/');
    if (!validateApiUrl(url)) {
      throw new Error('Invalid API URL');
    }
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Connection': 'close',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return await response.json();
  } catch (error) {
    if (error.message?.includes('ConnectionTerminated')) {
      throw new Error('Connection lost. Please check your network and try again.');
    }
    throw error;
  }
}

export async function requestRide({ pickup, destination, userId }) {
  const url = buildApiUrl('/request-ride/');
  if (!validateApiUrl(url)) {
    throw new Error('Invalid API URL');
  }
  const body = JSON.stringify({
    pickup,
    destination,
    userId,
  });
  
  try {
    // Create an AbortController for manual timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close',
        'Cache-Control': 'no-cache',
      },
      body,
      signal: controller.signal,
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error('Failed to request ride');
    }
    return await response.json();
  } catch (error) {
    if (error.message?.includes('ConnectionTerminated')) {
      throw new Error('Connection lost. Please check your network and try again.');
    }
    throw error;
  }
}

// Tartanilla Carriage API functions
export async function getCarriagesByDriver(driverId) {
  try {
    console.log(`[getCarriagesByDriver] Fetching carriages for driver: ${driverId}`);
    
    const { apiClient } = await import('./improvedApiClient');
    const result = await apiClient.get(`/tartanilla-carriages/get_by_driver/?driver_id=${driverId}`);
    
    console.log(`[getCarriagesByDriver] API result:`, result);
    
    if (result.success) {
      const carriages = result.data?.data || result.data || [];
      console.log(`[getCarriagesByDriver] Found ${carriages.length} carriages for driver ${driverId}`);
      return { success: true, data: carriages };
    } else {
      console.log(`[getCarriagesByDriver] API failed:`, result.error);
      return { success: false, error: result.error || 'Failed to fetch carriages', data: [] };
    }
  } catch (error) {
    console.error(`[getCarriagesByDriver] Error:`, error);
    return { success: false, error: error.message || 'Network error', data: [] };
  }
}

export async function acceptCarriageAssignment(carriageId, driverId) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const url = buildApiUrl(`/tartanilla-carriages/${carriageId}/driver-accept/`);
    if (!validateApiUrl(url)) {
      throw new Error('Invalid API URL');
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({ driver_id: driverId }),
      signal: controller.signal,
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error('Failed to accept assignment');
    }
    return await response.json();
  } catch (error) {
    if (error.message?.includes('ConnectionTerminated')) {
      throw new Error('Connection lost. Please check your network and try again.');
    }
    throw error;
  }
}

export async function declineCarriageAssignment(carriageId, driverId) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const url = buildApiUrl(`/tartanilla-carriages/${carriageId}/driver-decline/`);
    if (!validateApiUrl(url)) {
      throw new Error('Invalid API URL');
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({ driver_id: driverId }),
      signal: controller.signal,
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error('Failed to decline assignment');
    }
    return await response.json();
  } catch (error) {
    if (error.message?.includes('ConnectionTerminated')) {
      throw new Error('Connection lost. Please check your network and try again.');
    }
    throw error;
  }
}

export async function updateCarriageStatus(carriageId, newStatus) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const url = buildApiUrl(`/tartanilla-carriages/${carriageId}/`);
    if (!validateApiUrl(url)) {
      throw new Error('Invalid API URL');
    }
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({ status: newStatus }),
      signal: controller.signal,
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error('Failed to update carriage status');
    }
    return await response.json();
  } catch (error) {
    if (error.message?.includes('ConnectionTerminated')) {
      throw new Error('Connection lost. Please check your network and try again.');
    }
    throw error;
  }
} 