// API Configuration
import { Platform, NativeModules } from 'react-native';
import { apiBaseUrl } from './networkConfig';

function getDevServerHost() {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/^[^:]+:\/\/([^:/]+)/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

const API_BASE_URL = apiBaseUrl();

export async function fetchExampleData() {
  try {
    // Create an AbortController for manual timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${API_BASE_URL}/example/`, {
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
  const url = `${API_BASE_URL}/request-ride/`;
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${API_BASE_URL}/tartanilla-carriages/get_by_driver/?driver_id=${driverId}`, {
      signal: controller.signal,
      headers: {
        'Connection': 'close',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error('Failed to fetch carriages');
    }
    return await response.json();
  } catch (error) {
    if (error.message?.includes('ConnectionTerminated')) {
      throw new Error('Connection lost. Please check your network and try again.');
    }
    throw error;
  }
}

export async function acceptCarriageAssignment(carriageId, driverId) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${API_BASE_URL}/tartanilla-carriages/${carriageId}/driver-accept/`, {
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
    
    const response = await fetch(`${API_BASE_URL}/tartanilla-carriages/${carriageId}/driver-decline/`, {
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

export async function updateCarriageStatus(carriageId, statusData) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${API_BASE_URL}/tartanilla-carriages/${carriageId}/update-status/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(statusData),
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