// API Configuration
const API_BASE_URL = 'http://192.168.1.8:8000/api';

export async function fetchExampleData() {
  try {
    // Create an AbortController for manual timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${API_BASE_URL}/example/`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return await response.json();
  } catch (error) {
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
  
  // Create an AbortController for manual timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    signal: controller.signal,
  });
  
  clearTimeout(timeoutId);
  if (!response.ok) {
    throw new Error('Failed to request ride');
  }
  return await response.json();
} 