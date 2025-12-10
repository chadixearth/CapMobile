import { apiBaseUrl } from './networkConfig';
import { getAccessToken } from './authService';
import connectionManager from './connectionManager';
import ResponseHandler from './responseHandler';

class NetworkClient {
  constructor() {
    this.baseURL = apiBaseUrl();
    this.defaultTimeout = 15000; // Increased for better reliability
    this.maxRetries = 2;
  }

  async request(endpoint, options = {}) {
    const {
      method = 'GET',
      body,
      headers = {},
      timeout = this.defaultTimeout,
      retries = this.maxRetries,
      ...otherOptions
    } = options;

    // Get connection headers from manager
    const connectionHeaders = connectionManager.getConnectionHeaders();
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...connectionHeaders,
      ...headers,
    };

    // Add auth token if available
    const token = await getAccessToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    let lastError = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      let controller = null;
      let timeoutId = null;
      
      try {
        controller = new AbortController();
        timeoutId = setTimeout(() => {
          if (controller && !controller.signal.aborted) {
            controller.abort();
          }
        }, timeout);

        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          cache: 'no-store',
          ...otherOptions,
        });

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // Handle response with enhanced parsing
        let data;
        try {
          const responseText = await response.text();
          
          if (!responseText || responseText.trim() === '') {
            console.warn('[NetworkClient] Empty response received');
            data = {
              success: response.ok,
              data: [],
              message: 'Empty response from server'
            };
          } else {
            // Check if response is HTML (404 error page)
            if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
              console.error('[NetworkClient] Received HTML instead of JSON');
              throw new Error(`HTTP ${response.status}: Endpoint not found or returned HTML`);
            }
            
            try {
              data = JSON.parse(responseText);
            } catch (jsonError) {
              if (jsonError.message.includes('Unterminated string') || 
                  jsonError.message.includes('Unexpected end of input')) {
                console.warn('[NetworkClient] Detected truncated JSON response');
                
                if (responseText.includes('"success": true')) {
                  const messageMatch = responseText.match(/"message":\s*"([^"]*)"/);;
                  data = {
                    success: true,
                    message: messageMatch ? messageMatch[1] : 'Operation completed successfully',
                    data: []
                  };
                } else {
                  data = {
                    success: false,
                    error: 'Invalid JSON response from server',
                    data: []
                  };
                }
              } else {
                console.error('[NetworkClient] JSON parse error:', jsonError.message);
                console.error('[NetworkClient] Response text:', responseText.substring(0, 200));
                throw new Error(`HTTP ${response.status}: Invalid JSON response from server`);
              }
            }
          }
        } catch (parseError) {
          console.error('[NetworkClient] Response parsing failed:', parseError);
          throw parseError;
        }

        if (response.ok) {
          // Record successful request
          connectionManager.recordSuccess();
          
          // Ensure response has proper structure
          if (!data || typeof data !== 'object') {
            data = ResponseHandler.createSafeResponse(data);
          }
          
          return {
            success: true,
            data,
            status: response.status,
          };
        } else {
          // Handle error responses
          const errorMessage = data?.error || data?.message || response.statusText || 'Unknown error';
          
          // Don't log certain expected business logic errors as network errors
          const isExpectedBusinessError = response.status === 400 && (
            errorMessage.includes('active ride request') ||
            errorMessage.includes('ACTIVE_RIDE_EXISTS') ||
            errorMessage.includes('Tour package has expired') ||
            errorMessage.includes('cannot be booked')
          );
          
          if (isExpectedBusinessError) {
            // Don't retry or log as network error for business logic validation
            return {
              success: false,
              error: errorMessage,
              status: response.status,
              data: data
            };
          }
          
          throw new Error(`HTTP ${response.status}: ${errorMessage}`);
        }

      } catch (error) {
        // Clean up timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        lastError = error;
        
        // Check if this is a recoverable connection error
        const isRecoverableError = (error) => {
          if (!error) return false;
          const errorMessage = error.message?.toLowerCase() || '';
          return (
            errorMessage.includes('winerror 10054') ||
            errorMessage.includes('forcibly closed') ||
            errorMessage.includes('existing connection') ||
            errorMessage.includes('connection reset') ||
            errorMessage.includes('readerror') ||
            errorMessage.includes('http2') ||
            errorMessage.includes('stream_id')
          );
        };
        
        if (isRecoverableError(error)) {
          console.log(`Recoverable connection error detected: ${error.message}`);
          
          // Simple recovery: force connection reset and continue with retry
          connectionManager.forceConnectionReset();
          
          // Add extra delay for connection recovery
          if (attempt < retries) {
            const recoveryDelay = Math.min(3000 * Math.pow(2, attempt - 1), 10000);
            console.log(`Waiting ${recoveryDelay}ms for connection recovery...`);
            await new Promise(resolve => setTimeout(resolve, recoveryDelay));
            continue;
          }
        }
        
        // Handle abort errors specifically
        if (error && (error.name === 'AbortError' || (error.message && error.message.includes('Aborted')))) {
          console.log(`Request timeout on attempt ${attempt}`);
          if (attempt < retries) {
            // Exponential backoff for timeout retries
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new Error('Request timeout');
        }
        
        // Check for connection errors using the manager
        const isConnectionError = connectionManager.isConnectionError(error);
        
        // Check for Windows socket errors specifically
        const isSocketError = error && error.message && (
          error.message.includes('WinError 10035') ||
          error.message.includes('WinError 10054') ||
          error.message.includes('EWOULDBLOCK') ||
          error.message.includes('EAGAIN') ||
          error.message.includes('socket operation could not be completed') ||
          error.message.includes('forcibly closed') ||
          error.message.includes('existing connection')
        );
        
        if (isConnectionError || isSocketError) {
          connectionManager.recordConnectionError();
        }

        // Check for server errors that should be retried
        const isRetryableError = error && (
          (error.message && error.message.includes('500')) ||
          (error.message && error.message.includes('502')) ||
          (error.message && error.message.includes('503')) ||
          (error.message && error.message.includes('504')) ||
          isConnectionError ||
          isSocketError
        );

        if (isRetryableError && attempt < retries) {
          const delay = isSocketError ? 
            Math.min(2000 * Math.pow(2, attempt - 1), 8000) : // Longer delay for socket errors
            Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          
          const errorType = isSocketError ? 'socket' : 'network';
          // Don't log JWT expiry errors
          if (!error.message.includes('JWT expired') && !error.message.includes('PGRST301')) {
            console.log(`${errorType} error on attempt ${attempt}, retrying in ${delay}ms:`, error.message);
          }
          
          // Force connection reset for Windows socket errors
          if (isSocketError && attempt > 1) {
            connectionManager.forceConnectionReset();
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        break;
      }
    }

    // Handle final error
    if (!lastError) {
      throw new Error('Request failed without specific error');
    }
    
    // Don't log timeout errors as errors
    if (lastError.name === 'AbortError' || (lastError.message && lastError.message.includes('Aborted'))) {
      throw new Error('Request timeout');
    }
    
    // Don't log expected business errors or JWT expiry errors
    if (lastError.message && (
      lastError.message.includes('active ride request') ||
      lastError.message.includes('JWT expired') ||
      lastError.message.includes('PGRST301')
    )) {
      throw lastError;
    }
    
    // Don't log network request failed errors (they're common)
    if (lastError.message && lastError.message.includes('Network request failed')) {
      throw lastError;
    }
    
    console.error(`API call failed after ${retries} retries:`, lastError);
    throw lastError;
  }

  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint, data, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body: data });
  }

  async put(endpoint, data, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body: data });
  }

  async patch(endpoint, data, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body: data });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export default new NetworkClient();