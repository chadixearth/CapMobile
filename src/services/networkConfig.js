import { Platform, NativeModules } from 'react-native';

// Set this to your backend host IP or hostname
// Update this IP to match your Django server's IP address



export const API_HOST_OVERRIDE = '10.104.160.23';



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
