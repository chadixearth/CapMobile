import { Platform, NativeModules } from 'react-native';

// Set this to your backend host IP or hostname
// Update this IP to match your Django server's IP address
<<<<<<< HEAD
export const API_HOST_OVERRIDE = '10.30.165.23';
=======
export const API_HOST_OVERRIDE = '192.168.77.63';
>>>>>>> 3c089584682651f4bf1f38f70c7d62a748127695

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
  return `http://${resolveApiHost()}:8000/api`;
}
