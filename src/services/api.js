// API Configuration
const API_BASE_URL = 'http://10.196.222.213:8081/api';
const FALLBACK_BASE_URL = 'http://192.168.1.100:8000/api'; // Fallback URL

export async function fetchExampleData() {
  try {
    // IMPORTANT: Replace with your computer's LAN IP address so your phone can access the backend
    // Example: http://192.168.1.100:8000/api/example/
    const response = await fetch('http://192.168.X.X:8000/api/example/');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}



export async function requestRide({ pickup, destination, userId }) {
  // IMPORTANT: Replace with your backend's ride request endpoint and LAN IP
  const url = 'http://192.168.X.X:8000/api/request-ride/';
  const body = JSON.stringify({
    pickup,
    destination,
    userId,
  });
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  });
  if (!response.ok) {
    throw new Error('Failed to request ride');
  }
  return await response.json();
} 