import { apiBaseUrl, testConnection, getBackendHealth } from './networkConfig';

class ConnectionTester {
  constructor() {
    this.isTestingConnection = false;
    this.lastTestResult = null;
    this.testInterval = null;
  }

  async quickTest() {
    if (this.isTestingConnection) {
      return this.lastTestResult;
    }

    this.isTestingConnection = true;
    console.log('[ConnectionTester] Starting quick connection test...');

    try {
      // Test multiple endpoints quickly
      const endpoints = [
        `${apiBaseUrl()}/quick/`,
        `${apiBaseUrl()}/ping/`,
        `${apiBaseUrl().replace('/api', '')}/health/`
      ];

      const testPromises = endpoints.map(async (url) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);

          const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'Connection': 'close',
              'Cache-Control': 'no-cache',
            },
            keepalive: false
          });

          clearTimeout(timeoutId);
          return { url, success: response.ok, status: response.status };
        } catch (error) {
          return { url, success: false, error: error.message };
        }
      });

      const results = await Promise.allSettled(testPromises);
      const successfulTests = results.filter(r => r.status === 'fulfilled' && r.value.success);

      this.lastTestResult = {
        success: successfulTests.length > 0,
        workingEndpoints: successfulTests.length,
        totalEndpoints: endpoints.length,
        timestamp: Date.now()
      };

      console.log('[ConnectionTester] Test result:', this.lastTestResult);
      return this.lastTestResult;

    } catch (error) {
      console.error('[ConnectionTester] Test failed:', error);
      this.lastTestResult = {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
      return this.lastTestResult;
    } finally {
      this.isTestingConnection = false;
    }
  }

  async diagnoseConnection() {
    console.log('[ConnectionTester] Running connection diagnostics...');
    
    const diagnostics = {
      baseUrl: apiBaseUrl(),
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Basic connectivity
    try {
      const basicTest = await testConnection();
      diagnostics.tests.basicConnectivity = basicTest;
    } catch (error) {
      diagnostics.tests.basicConnectivity = { success: false, error: error.message };
    }

    // Test 2: Health endpoint
    try {
      const healthTest = await getBackendHealth();
      diagnostics.tests.healthEndpoint = healthTest;
    } catch (error) {
      diagnostics.tests.healthEndpoint = { success: false, error: error.message };
    }

    // Test 3: API endpoint
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${apiBaseUrl()}/quick/`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Connection': 'close' },
        keepalive: false
      });

      clearTimeout(timeoutId);
      diagnostics.tests.apiEndpoint = {
        success: response.ok,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      diagnostics.tests.apiEndpoint = { success: false, error: error.message };
    }

    console.log('[ConnectionTester] Diagnostics complete:', diagnostics);
    return diagnostics;
  }

  startPeriodicTest(intervalMs = 30000) {
    if (this.testInterval) {
      clearInterval(this.testInterval);
    }

    this.testInterval = setInterval(async () => {
      await this.quickTest();
    }, intervalMs);

    console.log('[ConnectionTester] Started periodic testing every', intervalMs, 'ms');
  }

  stopPeriodicTest() {
    if (this.testInterval) {
      clearInterval(this.testInterval);
      this.testInterval = null;
      console.log('[ConnectionTester] Stopped periodic testing');
    }
  }
}

export default new ConnectionTester();