import { Platform, NativeModules } from 'react-native';

// Set this to your backend host IP or hostname
// Update this IP to match your Django server's IP address
export const API_HOST_OVERRIDE = '192.168.8.103';

export function resolveApiHost() {
  try {
    if (API_HOST_OVERRIDE && API_HOST_OVERRIDE.trim()) {
      return API_HOST_OVERRIDE.trim();
    }
    const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/^[^:]+:\/\/([^:/]+)/);
    if (match && match[1]) return match[1];
  } catch {}
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

export function apiBaseUrl() {
  const host = resolveApiHost();
  const protocol = 'http'; // Force HTTP for development
  const port = ':8000';
  return `${protocol}://${host}${port}/api`;
}

// Get backend health status with faster timeout
export async function getBackendHealth() {
  try {
    const baseUrl = apiBaseUrl().replace('/api', '');
    const healthUrl = `${baseUrl}/health/`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // Reduced to 2 seconds
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Connection': 'close',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Keep-Alive': 'timeout=1, max=1',
      },
      keepalive: false
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.text();
      return { success: true, status: response.status, data };
    } else {
      return { success: false, status: response.status, error: 'Health check failed' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test connection function with multiple endpoints
export async function testConnection() {
  const endpoints = [
    `${apiBaseUrl()}/quick/`,
    `${apiBaseUrl()}/ping/`,
    `${apiBaseUrl().replace('/api', '')}/health/`
  ];
  
  for (const url of endpoints) {
    try {
      console.log(`[networkConfig] Testing connection to: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Connection': 'close',
          'Cache-Control': 'no-cache',
          'Keep-Alive': 'timeout=1, max=1',
        },
        keepalive: false
      });
      
      clearTimeout(timeoutId);
      console.log(`[networkConfig] Connection test result: ${response.status}`);
      
      if (response.ok) {
        return { success: true, status: response.status, endpoint: url };
      }
    } catch (error) {
      console.log(`[networkConfig] Connection test failed for ${url}: ${error.message}`);
      continue;
    }
  }
  
  return { success: false, error: 'All connection tests failed' };
}

// Test notification endpoint specifically
export async function testNotificationEndpoint() {
  try {
    const url = `${apiBaseUrl()}/notifications/`;
    console.log(`[networkConfig] Testing notification endpoint: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Connection': 'close',
        'Cache-Control': 'no-cache',
      }
    });
    
    clearTimeout(timeoutId);
    console.log(`[networkConfig] Notification endpoint test result: ${response.status}`);
    // 400 means endpoint exists but has validation errors (which is expected without proper params)
    // 404 means endpoint doesn't exist
    // 500+ means server error
    return { success: response.status !== 404, status: response.status };
  } catch (error) {
    console.log(`[networkConfig] Notification endpoint test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test registration endpoint specifically
export async function testRegistrationEndpoint() {
  try {
    const url = `${apiBaseUrl()}/auth/register/`;
    console.log(`[networkConfig] Testing registration endpoint: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Try a minimal POST request to see if endpoint exists
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({})
    });
    
    clearTimeout(timeoutId);
    console.log(`[networkConfig] Registration endpoint test result: ${response.status}`);
    // 400 = endpoint exists but validation failed (expected)
    // 404 = endpoint doesn't exist
    // 500+ = server error
    return { success: response.status !== 404, status: response.status };
  } catch (error) {
    console.log(`[networkConfig] Registration endpoint test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}
