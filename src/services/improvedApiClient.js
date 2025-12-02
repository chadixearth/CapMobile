import { getAccessToken, refreshAccessToken, refreshTokenIfNeeded, clearLocalSession, setSessionExpiredCallback } from './authService';
import { apiBaseUrl } from './networkConfig';
import SecurityService from './securityService';

const DEBUG_API = __DEV__;
const log = (...args) => DEBUG_API && console.log('[ApiClient]', ...args);

class ImprovedApiClient {
  constructor() {
    this.baseURL = apiBaseUrl();
    this.maxRetries = 2; // Reduced retries
    this.retryDelay = 500; // Faster retry
    this.sessionExpiredCallback = null;
  }

  setSessionExpiredCallback(callback) {
    this.sessionExpiredCallback = callback;
    setSessionExpiredCallback(callback);
  }

  async handleSessionExpiry() {
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
      timeout = body instanceof FormData ? 60000 : 8000, // Longer timeout for file uploads
      retries = this.maxRetries,
      skipAuth = false
    } = options;

    // Rate limiting check
    try {
      SecurityService.checkRateLimit(endpoint);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: 429
      };
    }

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

        const isFormData = body instanceof FormData;
        
        if (isFormData) {
          log('📤 Uploading FormData...');
        }
        
        const requestHeaders = {
          'Cache-Control': 'no-cache',
          ...SecurityService.getSecureHeaders(),
          ...headers,
        };

        // Don't set Content-Type for FormData - let fetch set it with boundary
        if (!isFormData) {
          requestHeaders['Content-Type'] = 'application/json';
          requestHeaders['Connection'] = 'close';
        }

        if (token && !skipAuth) {
          requestHeaders.Authorization = `Bearer ${token}`;
        }

        // Validate request body if present (skip for FormData)
        let validatedBody = body;
        if (body && !isFormData && typeof body === 'object') {
          try {
            validatedBody = this.validateRequestBody(body, endpoint);
          } catch (validationError) {
            return {
              success: false,
              error: validationError.message,
              status: 400
            };
          }
        }

        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method,
          headers: requestHeaders,
          body: isFormData ? body : (validatedBody ? JSON.stringify(validatedBody) : null),
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

        // Handle JWT expired errors specifically - silently
        if (data && (
          (typeof data === 'object' && data.message && data.message.includes('JWT expired')) ||
          (typeof data === 'object' && data.error && data.error.includes('JWT expired')) ||
          (typeof data === 'string' && data.includes('JWT expired')) ||
          (typeof data === 'object' && data.code && data.code.includes('PGRST301'))
        )) {
          // Handle silently - no logs
          await this.handleSessionExpiry();
          return {
            success: false,
            error: 'silent_jwt_expired',
            status: 401,
            sessionExpired: true,
            silent: true
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
          // Check if this is a JWT expiry error and handle silently
        if (error.message && (error.message.includes('JWT expired') || error.message.includes('PGRST301'))) {
          await this.handleSessionExpiry();
          return {
            success: false,
            error: 'silent_jwt_expired',
            status: 401,
            sessionExpired: true,
            silent: true
          };
        }
        
        // Don't log JWT errors
        if (!error.message.includes('JWT expired') && !error.message.includes('PGRST301')) {
          log(`network error on attempt ${attempt}, retrying in ${this.retryDelay * attempt}ms:`, error.message);
        }
          await this.delay(this.retryDelay * attempt);
          continue;
        }

        if (attempt === retries) {
          // Check if this is a JWT expiry error and handle silently
          if (error.message && (error.message.includes('JWT expired') || error.message.includes('PGRST301'))) {
            await this.handleSessionExpiry();
            return {
              success: false,
              error: 'silent_jwt_expired',
              status: 401,
              sessionExpired: true,
              silent: true
            };
          }
          
          // Don't log JWT errors
          if (!error.message.includes('JWT expired') && !error.message.includes('PGRST301')) {
            log(`❌ API call failed after ${retries} retries:`, error);
          }
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

  /**
   * Validate request body based on endpoint
   */
  validateRequestBody(body, endpoint) {
    if (endpoint.includes('/booking/')) {
      return SecurityService.validateBookingData(body);
    }
    
    if (endpoint.includes('/auth/register') || endpoint.includes('/auth/login')) {
      return SecurityService.validateUserData(body, endpoint.includes('/register'));
    }
    
    // Generic validation for other endpoints
    if (typeof body === 'object') {
      const validated = {};
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') {
          validated[key] = SecurityService.validateInput(value, 'string', { fieldName: key });
        } else {
          validated[key] = value;
        }
      }
      return validated;
    }
    
    return body;
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