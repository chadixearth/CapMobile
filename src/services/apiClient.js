import { apiBaseUrl } from './networkConfig';
import { getAccessToken, clearLocalSession, refreshAccessToken } from './authService';
import { CommonActions } from '@react-navigation/native';
import { withRetry } from './retryHelper';
import { handleBookingError } from './bookingErrorHandler';

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
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: null,
      threshold: 5,
      resetTimeout: 30000 // 30 seconds
    };
  }

  isCircuitOpen() {
    if (this.circuitBreaker.failures < this.circuitBreaker.threshold) {
      return false;
    }
    
    const now = Date.now();
    const timeSinceLastFailure = now - this.circuitBreaker.lastFailureTime;
    
    if (timeSinceLastFailure > this.circuitBreaker.resetTimeout) {
      // Reset circuit breaker
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.lastFailureTime = null;
      return false;
    }
    
    return true;
  }

  recordFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
  }

  recordSuccess() {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.lastFailureTime = null;
  }

  async request(endpoint, options = {}) {
    // Check circuit breaker
    if (this.isCircuitOpen()) {
      throw new Error('Service temporarily unavailable. Please try again later.');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      // Get auth token
      const token = await getAccessToken();
      
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Connection': 'close', // Force connection close to prevent HTTP/2 issues
        'Cache-Control': 'no-cache',
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
        cache: 'no-store', // Prevent caching issues
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') 
        ? await response.json() 
        : await response.text();

      if (!response.ok) {
        // Check if this is a carriage-related business logic error (not a real error)
        const isCarriageError = (response.status === 400 || response.status === 403) && 
          data && 
          (data.error_code === 'NO_CARRIAGE_ASSIGNED' || data.error_code === 'NO_AVAILABLE_CARRIAGE' || data.error_code === 'NO_ELIGIBLE_CARRIAGE');
        
        // Handle auth errors (but not carriage errors)
        if ((response.status === 401 || response.status === 403) && !isCarriageError) {
          console.log(`[ApiClient] Auth error:`, data);
          
          const errorText = typeof data === 'string' ? data : JSON.stringify(data);
          if (errorText.includes('token') || errorText.includes('expired') || errorText.includes('invalid') || errorText.includes('JWT expired')) {
            console.log('[ApiClient] Token expired, attempting refresh');
            
            // Try to refresh token
            const refreshResult = await refreshAccessToken();
            if (refreshResult.success) {
              console.log('[ApiClient] Token refreshed, retrying request');
              // Retry the request with new token
              const newToken = await getAccessToken();
              if (newToken) {
                headers.Authorization = `Bearer ${newToken}`;
                const retryResponse = await fetch(`${this.baseURL}${endpoint}`, {
                  method: 'GET',
                  ...options,
                  headers,
                  signal: controller.signal,
                  cache: 'no-store',
                });
                const retryData = retryResponse.headers.get('content-type')?.includes('application/json') 
                  ? await retryResponse.json() 
                  : await retryResponse.text();
                
                if (retryResponse.ok) {
                  this.recordSuccess();
                  return {
                    success: true,
                    data: retryData,
                    status: retryResponse.status,
                  };
                }
              }
            }
            
            console.log('[ApiClient] Token refresh failed, clearing session and redirecting to login');
            await clearLocalSession();
            navigateToLogin();
            throw new Error('Session expired. Please login again.');
          }
        }
        
        if (!isCarriageError) {
          console.error(`[ApiClient] HTTP Error ${response.status}:`, {
            url: `${this.baseURL}${endpoint}`,
            status: response.status,
            statusText: response.statusText,
            data: data
          });
        } else {
          console.log(`[ApiClient] Carriage validation response ${response.status}:`, data);
        }
        
        // Record failure for 5xx errors
        if (response.status >= 500) {
          this.recordFailure();
        }
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
      }

      // Record success
      this.recordSuccess();

      return {
        success: true,
        data,
        status: response.status,
      };
    } catch (error) {
      // Handle connection termination errors specifically
      const isConnectionError = 
        error.message?.includes('ConnectionTerminated') ||
        error.message?.includes('Network request failed') ||
        error.message?.includes('Connection closed') ||
        error.message?.includes('ECONNRESET') ||
        error.name === 'AbortError';
      
      if (isConnectionError) {
        console.warn('[ApiClient] Connection error detected:', error.message);
        this.recordFailure();
        throw new Error('Connection lost. Please check your network and try again.');
      }
      
      // Record failure for network errors and timeouts
      if (error.name === 'AbortError') {
        this.recordFailure();
        throw new Error('Request timeout');
      }
      
      // Record failure for other network errors
      if (!error.message?.includes('Session expired')) {
        this.recordFailure();
      }
      
      throw error;
    }
  }

  async get(endpoint, options = {}) {
    return withRetry(() => this.request(endpoint, { ...options, method: 'GET' }));
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