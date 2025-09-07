import { apiBaseUrl } from './networkConfig';
import { getAccessToken, clearLocalSession } from './authService';
import { CommonActions } from '@react-navigation/native';

let navigationRef = null;

export function setNavigationRef(ref) {
  navigationRef = ref;
}

function navigateToLogin() {
  if (navigationRef) {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      })
    );
  }
}

class ApiClient {
  constructor() {
    this.baseURL = apiBaseUrl();
    this.timeout = 15000;
  }

  async request(endpoint, options = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      // Get auth token
      const token = await getAccessToken();
      
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      };

      // Add auth token to all requests
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      console.log(`[ApiClient] ${options.method || 'GET'} ${this.baseURL}${endpoint}`);
      console.log(`[ApiClient] Auth token:`, token ? 'Present' : 'Missing');

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle auth errors
      if (response.status === 401 || response.status === 403) {
        const errorData = await response.text();
        console.log(`[ApiClient] Auth error:`, errorData);
        
        if (errorData.includes('token') || errorData.includes('expired') || errorData.includes('invalid')) {
          console.log('[ApiClient] Token expired, clearing session and redirecting to login');
          await clearLocalSession();
          navigateToLogin();
          throw new Error('Session expired. Please login again.');
        }
      }

      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') 
        ? await response.json() 
        : await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
      }

      return {
        success: true,
        data,
        status: response.status,
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export default new ApiClient();