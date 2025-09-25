/**
 * Mobile-specific network diagnostics and error handling
 */

import { Platform } from 'react-native';
// import NetInfo from '@react-native-community/netinfo';
import { apiBaseUrl } from './networkConfig';

class MobileDiagnostics {
  constructor() {
    this.connectionState = null;
    this.errorCounts = {
      json_parse: 0,
      network: 0,
      timeout: 0,
      server: 0
    };
    this.lastHealthCheck = null;
    this.healthCheckInterval = null;
  }

  async initialize() {
    // Monitor network state - disabled for now
    // NetInfo.addEventListener(state => {
    //   this.connectionState = state;
    //   console.log('[MobileDiagnostics] Network state:', {
    //     type: state.type,
    //     connected: state.isConnected,
    //     reachable: state.isInternetReachable
    //   });
    // });

    // Start periodic health checks
    this.startHealthChecks();
  }

  startHealthChecks() {
    // Check every 2 minutes
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 120000);

    // Initial check
    this.performHealthCheck();
  }

  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  async performHealthCheck() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${apiBaseUrl()}/health/`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      this.lastHealthCheck = {
        timestamp: new Date().toISOString(),
        success: response.ok,
        status: response.status,
        latency: Date.now() - performance.now()
      };

      if (response.ok) {
        console.log('[MobileDiagnostics] Health check passed');
      } else {
        console.warn('[MobileDiagnostics] Health check failed:', response.status);
      }

    } catch (error) {
      this.lastHealthCheck = {
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
        latency: null
      };

      console.warn('[MobileDiagnostics] Health check error:', error.message);
    }
  }

  recordError(error, context = '') {
    const errorType = this.classifyError(error);
    this.errorCounts[errorType]++;

    console.log(`[MobileDiagnostics] Recorded ${errorType} error in ${context}:`, error.message);

    // Auto-recovery suggestions
    if (errorType === 'json_parse' && this.errorCounts.json_parse > 5) {
      console.warn('[MobileDiagnostics] High JSON parse error count - server may be returning malformed responses');
    }

    if (errorType === 'network' && this.errorCounts.network > 3) {
      console.warn('[MobileDiagnostics] High network error count - connection may be unstable');
    }
  }

  classifyError(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('json parse') || message.includes('unexpected end of input')) {
      return 'json_parse';
    }

    if (message.includes('network') || message.includes('connection') || message.includes('econnreset')) {
      return 'network';
    }

    if (message.includes('timeout') || message.includes('aborted')) {
      return 'timeout';
    }

    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return 'server';
    }

    return 'unknown';
  }

  async getNetworkInfo() {
    // Simplified network info without NetInfo dependency
    return {
      type: 'unknown',
      connected: true, // Assume connected for now
      reachable: true,
      details: null
    };
  }

  getDiagnosticReport() {
    return {
      platform: Platform.OS,
      version: Platform.Version,
      connection: this.connectionState,
      errorCounts: { ...this.errorCounts },
      lastHealthCheck: this.lastHealthCheck,
      timestamp: new Date().toISOString()
    };
  }

  async testConnectivity() {
    const results = {
      network: false,
      server: false,
      api: false,
      latency: null
    };

    try {
      // Test network connectivity
      const networkInfo = await this.getNetworkInfo();
      results.network = networkInfo.connected && networkInfo.reachable;

      if (!results.network) {
        return results;
      }

      // Test server connectivity
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(`${apiBaseUrl()}/health/`, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        results.latency = Date.now() - startTime;
        results.server = response.status < 500;

        // Test API functionality
        if (results.server) {
          try {
            const data = await response.json();
            results.api = data && typeof data === 'object';
          } catch (e) {
            results.api = false;
          }
        }

      } catch (error) {
        clearTimeout(timeoutId);
        results.server = false;
        results.api = false;
      }

    } catch (error) {
      console.error('[MobileDiagnostics] Connectivity test failed:', error);
    }

    return results;
  }

  getSuggestions() {
    const suggestions = [];

    if (!this.connectionState?.isConnected) {
      suggestions.push('Check your internet connection');
    }

    if (this.errorCounts.json_parse > 3) {
      suggestions.push('Server may be experiencing issues - try again later');
    }

    if (this.errorCounts.network > 3) {
      suggestions.push('Network connection appears unstable - try switching networks');
    }

    if (this.errorCounts.timeout > 3) {
      suggestions.push('Requests are timing out - check your connection speed');
    }

    if (this.lastHealthCheck && !this.lastHealthCheck.success) {
      suggestions.push('Server health check failed - service may be temporarily unavailable');
    }

    return suggestions;
  }

  reset() {
    this.errorCounts = {
      json_parse: 0,
      network: 0,
      timeout: 0,
      server: 0
    };
  }
}

export default new MobileDiagnostics();