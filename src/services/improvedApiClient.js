import { getAccessToken, refreshAccessToken, refreshTokenIfNeeded, clearLocalSession, setSessionExpiredCallback } from './authService';
import { apiBaseUrl } from './networkConfig';

const DEBUG_API = __DEV__;
const log = (...args) => DEBUG_API && console.log('[ApiClient]', ...args);

class ImprovedApiClient {
  constructor() {
    this.baseURL = apiBaseUrl();
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second base delay
    this.sessionExpiredCallback = null;
  }

  setSessionExpiredCallback(callback) {
    this.sessionExpiredCallback = callback;
    setSessionExpiredCallback(callback);
  }

  async handleSessionExpiry() {
    log('Session expired - clearing local session');
    await clearLocalSession();
    if (this.sessionExpiredCallback) {
      this.sessionExpiredCallback();
    }
  }

  /**
   * Make HTTP request with enhanced error handling and retry logic
   */
  async makeRequest(endpoint, options = {}) {
    const {
      method = 'GET',
      headers = {},
      body = null,
      timeout = 30000,
      retries = this.maxRetries,
      skipAuth = false
    } = options;

    log(`${method} ${endpoint}`);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Refresh token if needed before each attempt
        if (!skipAuth) {
          await refreshTokenIfNeeded();
        }
        
        const token = !skipAuth ? await getAccessToken() : null;
        log('Auth token:', token ? 'Present' : 'None');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const requestHeaders = {
          'Content-Type': 'application/json',
          'Connection': 'close',
          'Cache-Control': 'no-cache',
          ...headers,
        };

        if (token && !skipAuth) {
          requestHeaders.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : null,
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(timeoutId);

        // Handle different response types
        const contentType = response.headers.get('content-type') || '';
        let data;
        
        if (contentType.includes('application/json')) {
          const text = await response.text();
          try {
            data = JSON.parse(text);
          } catch (parseError) {
            log('JSON parse error:', parseError.message);
            data = { error: 'Invalid JSON response', raw: text };
          }
        } else {
          data = await response.text();
          if (data.trim().startsWith('<')) {
            data = { error: 'Received HTML instead of JSON - endpoint may not exist' };
          }
        }

        if (response.ok) {
          log(`✅ ${method} ${endpoint} - Success`);
          return { success: true, data, status: response.status };
        }

        // Handle specific error cases
        if (response.status === 401) {
          log('❌ Unauthorized - session expired');
          
          // Don't try to refresh, just handle session expiry
          await this.handleSessionExpiry();
          return {
            success: false,
            error: 'Session expired. Please log in again.',
            status: 401,
            sessionExpired: true
          };
        }

        // Handle JWT expired errors specifically
        if (data && (
          (typeof data === 'object' && data.message && data.message.includes('JWT expired')) ||
          (typeof data === 'object' && data.error && data.error.includes('JWT expired')) ||
          (typeof data === 'string' && data.includes('JWT expired')) ||
          (typeof data === 'object' && data.error && data.error.includes('PGRST301'))
        )) {
          log('JWT expired error detected');
          
          // Don't retry, just handle session expiry immediately
          await this.handleSessionExpiry();
          return {
            success: false,
            error: 'Session expired. Please log in again.',
            status: 401,
            sessionExpired: true
          };
        }

        // Retry on server errors
        if (response.status >= 500 && attempt < retries) {
          log(`Server error ${response.status}, retrying attempt ${attempt + 1}`);
          await this.delay(this.retryDelay * attempt);
          continue;
        }

        // Handle network errors that should be retried
        if (response.status === 0 || response.status === 503) {
          if (attempt < retries) {
            log(`Network error (${response.status}), retrying attempt ${attempt + 1}`);
            await this.delay(this.retryDelay * attempt);
            continue;
          }
        }

        log(`❌ ${method} ${endpoint} - HTTP ${response.status}:`, data);
        return {
          success: false,
          error: this.extractErrorMessage(data),
          status: response.status,
          data
        };

      } catch (error) {
        log(`Request failed on attempt ${attempt}:`, error.message);
        
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timeout',
            status: 0
          };
        }

        // Network errors that should be retried
        if (this.isRetryableNetworkError(error) && attempt < retries) {
          log(`network error on attempt ${attempt}, retrying in ${this.retryDelay * attempt}ms:`, error.message);
          await this.delay(this.retryDelay * attempt);
          continue;
        }

        if (attempt === retries) {
          log(`❌ API call failed after ${retries} retries:`, error);
          return {
            success: false,
            error: error.message || 'Network error',
            status: 0
          };
        }

        // Wait before retrying
        await this.delay(this.retryDelay * attempt);
      }
    }
  }

  /**
   * Extract meaningful error message from response data
   */
  extractErrorMessage(data) {
    if (typeof data === 'string') {
      return data;
    }
    
    if (typeof data === 'object' && data !== null) {
      return data.error || data.message || data.detail || 'Unknown error';
    }
    
    return 'Unknown error';
  }

  /**
   * Check if error is retryable
   */
  isRetryableNetworkError(error) {
    const retryableErrors = [
      'Network request failed',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ConnectionTerminated',
      'Connection closed',
      'getaddrinfo failed'
    ];
    
    return retryableErrors.some(retryableError => 
      error.message && error.message.includes(retryableError)
    );
  }

  /**
   * Delay helper for retry logic
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods
  async get(endpoint, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint, data, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'POST', body: data });
  }

  async put(endpoint, data, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'PUT', body: data });
  }

  async delete(endpoint, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'DELETE' });
  }

  async patch(endpoint, data, options = {}) {
    return this.makeRequest(endpoint, { ...options, method: 'PATCH', body: data });
  }
}

// Create singleton instance
export const apiClient = new ImprovedApiClient();

// Export class for custom instances
export { ImprovedApiClient };

// Legacy compatibility - update existing services to use this
export default apiClient;