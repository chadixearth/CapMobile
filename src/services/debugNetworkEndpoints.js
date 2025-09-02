/**
 * Debug utility to test backend endpoints
 * Use this to verify which endpoints are working and which are missing
 */

import { apiBaseUrl } from './networkConfig';

class EndpointTester {
  constructor() {
    this.baseURL = apiBaseUrl();
    this.timeout = 5000;
  }

  /**
   * Test a specific endpoint
   * @param {string} endpoint - The endpoint to test (e.g., '/auth/profile/')
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {Object} options - Additional options like headers, body
   * @returns {Promise<Object>} Test result
   */
  async testEndpoint(endpoint, method = 'GET', options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method,
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...options.headers,
        },
        ...options,
      });

      const statusText = response.status === 200 ? '✅ SUCCESS' : 
                        response.status === 404 ? '❌ NOT FOUND' :
                        response.status === 401 ? '🔐 UNAUTHORIZED' :
                        response.status === 403 ? '🚫 FORBIDDEN' :
                        response.status >= 500 ? '💥 SERVER ERROR' :
                        '⚠️ OTHER';

      let responseData = null;
      try {
        responseData = await response.text();
        // Try to parse as JSON if possible
        if (responseData.startsWith('{') || responseData.startsWith('[')) {
          responseData = JSON.parse(responseData);
        }
      } catch (e) {
        // Keep as text if not JSON
      }

      return {
        endpoint,
        method,
        status: response.status,
        statusText: response.statusText,
        success: response.status >= 200 && response.status < 300,
        available: response.status !== 404,
        result: statusText,
        data: responseData,
        url,
      };
    } catch (error) {
      return {
        endpoint,
        method,
        status: null,
        statusText: 'NETWORK ERROR',
        success: false,
        available: false,
        result: '🔌 NETWORK ERROR',
        error: error.message,
        url,
      };
    }
  }

  /**
   * Test multiple endpoints at once
   * @returns {Promise<Object>} Comprehensive test results
   */
  async runFullEndpointTest() {
    console.log('🔍 Starting comprehensive endpoint test...');
    console.log('📍 Base URL:', this.baseURL);
    console.log('');

    const endpointsToTest = [
      // Basic connectivity
      { endpoint: '/', name: 'Root API' },
      { endpoint: '/api/', name: 'API Root' },
      
      // Authentication endpoints
      { endpoint: '/auth/profile/', name: 'User Profile', requiresAuth: true },
      { endpoint: '/auth/login/', name: 'Login', method: 'POST' },
      { endpoint: '/auth/logout/', name: 'Logout', method: 'POST', requiresAuth: true },
      { endpoint: '/auth/register/', name: 'Register', method: 'POST' },
      
      // Payment endpoints
      { endpoint: '/payments/', name: 'Payments List' },
      { endpoint: '/payments/mobile-payment/', name: 'Mobile Payment', method: 'POST' },
      { endpoint: '/payments/create-payment/', name: 'Create Payment', method: 'POST' },
      { endpoint: '/payments/confirm-payment/', name: 'Confirm Payment', method: 'POST' },
      
      // Other endpoints
      { endpoint: '/map/data/', name: 'Map Data' },
      { endpoint: '/example/', name: 'Example Endpoint' },
    ];

    const results = [];
    
    for (const test of endpointsToTest) {
      const options = {};
      
      // Add auth token for endpoints that require it
      if (test.requiresAuth) {
        try {
          const { getAccessToken } = await import('./authService');
          const token = await getAccessToken();
          if (token) {
            options.headers = { 'Authorization': `Bearer ${token}` };
          }
        } catch (e) {
          // Auth service might not be available
        }
      }
      
      const result = await this.testEndpoint(
        test.endpoint, 
        test.method || 'GET',
        options
      );
      
      result.name = test.name;
      results.push(result);
      
      // Log individual result
      console.log(`${result.result} ${result.name} (${test.endpoint})`);
      if (result.status) {
        console.log(`   Status: ${result.status} ${result.statusText}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log('');
    }

    // Summary
    const available = results.filter(r => r.available).length;
    const total = results.length;
    const working = results.filter(r => r.success).length;

    console.log('📊 SUMMARY:');
    console.log(`✅ Available endpoints: ${available}/${total}`);
    console.log(`🟢 Working endpoints: ${working}/${total}`);
    console.log(`❌ Missing endpoints: ${total - available}/${total}`);
    console.log('');

    // List missing payment endpoints specifically
    const paymentEndpoints = results.filter(r => r.endpoint.includes('payment'));
    const missingPayments = paymentEndpoints.filter(r => !r.available);
    
    if (missingPayments.length > 0) {
      console.log('💳 Missing Payment Endpoints:');
      missingPayments.forEach(r => {
        console.log(`   ❌ ${r.name} (${r.endpoint})`);
      });
      console.log('   ℹ️ Payment features will be limited until these are implemented');
      console.log('');
    }

    return {
      results,
      summary: {
        total,
        available,
        working,
        missing: total - available,
        paymentEndpoints: paymentEndpoints.length,
        missingPayments: missingPayments.length,
      }
    };
  }

  /**
   * Quick payment service test
   * @returns {Promise<Object>} Payment service test result
   */
  async testPaymentService() {
    console.log('💳 Testing Payment Service endpoints...');
    
    const paymentTests = [
      '/payments/',
      '/payments/mobile-payment/',
      '/payments/create-payment/',
      '/payments/confirm-payment/',
    ];

    const results = [];
    for (const endpoint of paymentTests) {
      const result = await this.testEndpoint(endpoint, 'GET');
      results.push(result);
      console.log(`${result.result} ${endpoint}`);
    }

    const available = results.filter(r => r.available).length;
    const isPaymentServiceReady = available === paymentTests.length;

    console.log('');
    console.log(`Payment Service Status: ${isPaymentServiceReady ? '✅ READY' : '⚠️ PARTIAL/NOT READY'}`);
    console.log(`Available: ${available}/${paymentTests.length} endpoints`);

    return { isPaymentServiceReady, results, available, total: paymentTests.length };
  }
}

// Export for use in debug scripts
export default new EndpointTester();

// Export individual functions for direct use
export const testEndpoint = (endpoint, method, options) => 
  new EndpointTester().testEndpoint(endpoint, method, options);

export const runFullEndpointTest = () => 
  new EndpointTester().runFullEndpointTest();

export const testPaymentService = () => 
  new EndpointTester().testPaymentService();

/**
 * Usage Examples:
 * 
 * // Test all endpoints
 * import { runFullEndpointTest } from './services/debugNetworkEndpoints';
 * await runFullEndpointTest();
 * 
 * // Test specific endpoint
 * import { testEndpoint } from './services/debugNetworkEndpoints';
 * const result = await testEndpoint('/auth/profile/', 'GET');
 * 
 * // Test payment service only
 * import { testPaymentService } from './services/debugNetworkEndpoints';
 * const paymentStatus = await testPaymentService();
 */