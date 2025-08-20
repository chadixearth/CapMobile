// API Configuration
const API_BASE_URL = 'http://192.168.1.8:8000/api';

/**
 * Fetch all map data including points, roads, and configuration
 * @returns {Promise<Object>} Map data with points, roads, and config
 */
export async function fetchMapData() {
  try {
    // Create an AbortController for manual timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${API_BASE_URL}/map/data/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch map data');
    }
    
    return data.data;
  } catch (error) {
    console.error('Error fetching map data:', error);
    throw error;
  }
}

/**
 * Fetch only terminal/pickup points for map selection
 * @returns {Promise<Object>} Terminal points data
 */
export async function fetchTerminals() {
  try {
    // Create an AbortController for manual timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${API_BASE_URL}/map/terminals/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch terminals');
    }
    
    return data.data.terminals;
  } catch (error) {
    console.error('Error fetching terminals:', error);
    throw error;
  }
}
