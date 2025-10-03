/**
 * Connection Manager to handle HTTP/2 connection issues
 */

class ConnectionManager {
  constructor() {
    this.connectionErrors = 0;
    this.lastErrorTime = null;
    this.maxErrors = 5;
    this.resetInterval = 30000; // 30 seconds
  }

  recordConnectionError() {
    this.connectionErrors++;
    this.lastErrorTime = Date.now();
    
    if (this.connectionErrors >= this.maxErrors) {
      console.warn('[ConnectionManager] Too many connection errors, forcing connection reset');
      this.forceConnectionReset();
    }
  }

  recordSuccess() {
    // Reset error count on successful requests
    if (this.connectionErrors > 0) {
      this.connectionErrors = Math.max(0, this.connectionErrors - 1);
    }
  }

  shouldResetConnection() {
    if (this.connectionErrors === 0) return false;
    
    const now = Date.now();
    const timeSinceLastError = now - (this.lastErrorTime || 0);
    
    return this.connectionErrors >= this.maxErrors || timeSinceLastError > this.resetInterval;
  }

  forceConnectionReset() {
    console.log('[ConnectionManager] Forcing connection reset');
    this.connectionErrors = 0;
    this.lastErrorTime = null;
    
    // Force garbage collection of any cached connections
    if (global.gc) {
      global.gc();
    }
    
    // Additional cleanup for React Native
    if (global.__turboModuleProxy) {
      // Clear any cached network modules
      try {
        global.__turboModuleProxy = null;
        setTimeout(() => {
          global.__turboModuleProxy = require('react-native/Libraries/TurboModule/TurboModuleRegistry');
        }, 100);
      } catch (e) {
        console.warn('[ConnectionManager] Could not reset turbo modules:', e);
      }
    }
  }

  getConnectionHeaders() {
    const headers = {
      'Connection': 'close',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    };

    // If we've had recent connection issues, add more aggressive headers
    if (this.connectionErrors > 2) {
      headers['Keep-Alive'] = 'timeout=1, max=1';
      headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    return headers;
  }

  isConnectionError(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';
    
    return (
      errorMessage.includes('connectionterminated') ||
      errorMessage.includes('connection closed') ||
      errorMessage.includes('connection reset') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('stream_id') ||
      errorMessage.includes('network request failed') ||
      errorMessage.includes('winerror 10054') ||
      errorMessage.includes('forcibly closed') ||
      errorMessage.includes('existing connection') ||
      errorMessage.includes('readerror') ||
      errorMessage.includes('http2') ||
      errorName === 'aborterror'
    );
  }
}

export default new ConnectionManager();