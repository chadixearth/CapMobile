/**
 * Connection Recovery Service for Mobile App
 * Handles Windows socket errors and HTTP/2 connection issues
 */

import connectionManager from './connectionManager';
import networkClient from './networkClient';

class ConnectionRecoveryService {
  constructor() {
    this.recoveryAttempts = 0;
    this.maxRecoveryAttempts = 3;
    this.isRecovering = false;
    this.recoveryQueue = [];
  }

  /**
   * Check if error is a recoverable connection error
   */
  isRecoverableError(error) {
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
  }

  /**
   * Attempt to recover from connection error
   */
  async attemptRecovery() {
    if (this.isRecovering) {
      return false;
    }

    this.isRecovering = true;
    this.recoveryAttempts++;

    try {
      console.log(`[ConnectionRecovery] Attempting recovery ${this.recoveryAttempts}/${this.maxRecoveryAttempts}`);
      
      // Force connection reset
      connectionManager.forceConnectionReset();
      
      // Wait for connections to clear
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test connection with a simple health check
      const healthCheck = await this.performHealthCheck();
      
      if (healthCheck) {
        console.log('[ConnectionRecovery] Recovery successful');
        this.recoveryAttempts = 0;
        this.isRecovering = false;
        
        // Process any queued requests
        await this.processRecoveryQueue();
        
        return true;
      } else {
        console.log('[ConnectionRecovery] Recovery failed, will retry');
        this.isRecovering = false;
        return false;
      }
    } catch (error) {
      console.error('[ConnectionRecovery] Recovery attempt failed:', error);
      this.isRecovering = false;
      return false;
    }
  }

  /**
   * Perform a simple health check
   */
  async performHealthCheck() {
    try {
      const response = await networkClient.get('/api/health/', {
        timeout: 10000,
        retries: 1
      });
      
      return response.success;
    } catch (error) {
      console.log('[ConnectionRecovery] Health check failed:', error.message);
      return false;
    }
  }

  /**
   * Add request to recovery queue
   */
  queueRequest(requestFunc, resolve, reject) {
    this.recoveryQueue.push({
      requestFunc,
      resolve,
      reject,
      timestamp: Date.now()
    });
  }

  /**
   * Process queued requests after recovery
   */
  async processRecoveryQueue() {
    const queue = [...this.recoveryQueue];
    this.recoveryQueue = [];

    for (const item of queue) {
      try {
        const result = await item.requestFunc();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }
    }
  }

  /**
   * Handle connection error with recovery
   */
  async handleConnectionError(error, originalRequestFunc) {
    if (!this.isRecoverableError(error)) {
      throw error;
    }

    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.error('[ConnectionRecovery] Max recovery attempts reached');
      throw new Error('Connection recovery failed after maximum attempts');
    }

    // If already recovering, queue the request
    if (this.isRecovering) {
      return new Promise((resolve, reject) => {
        this.queueRequest(originalRequestFunc, resolve, reject);
      });
    }

    // Attempt recovery
    const recovered = await this.attemptRecovery();
    
    if (recovered) {
      // Retry the original request
      try {
        return await originalRequestFunc();
      } catch (retryError) {
        // If retry fails with same error, don't attempt recovery again
        if (this.isRecoverableError(retryError)) {
          throw new Error('Connection still unstable after recovery');
        }
        throw retryError;
      }
    } else {
      throw new Error('Connection recovery failed');
    }
  }

  /**
   * Reset recovery state
   */
  reset() {
    this.recoveryAttempts = 0;
    this.isRecovering = false;
    this.recoveryQueue = [];
  }

  /**
   * Get recovery status
   */
  getStatus() {
    return {
      isRecovering: this.isRecovering,
      recoveryAttempts: this.recoveryAttempts,
      queuedRequests: this.recoveryQueue.length
    };
  }
}

export default new ConnectionRecoveryService();