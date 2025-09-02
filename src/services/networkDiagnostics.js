/**
 * Quick Network Test Script
 * Run this to test your backend endpoints and diagnose the 404 errors
 * 
 * Usage:
 * 1. Import this in any component
 * 2. Call runNetworkDiagnostics() 
 * 3. Check console output for results
 */

import { runFullEndpointTest, testPaymentService } from './debugNetworkEndpoints';

/**
 * Run comprehensive network diagnostics
 */
export async function runNetworkDiagnostics() {
  console.log('🚀 Starting Network Diagnostics...');
  console.log('=====================================');
  
  try {
    // Test all endpoints
    const fullTest = await runFullEndpointTest();
    
    // Test payment service specifically  
    console.log('');
    const paymentTest = await testPaymentService();
    
    // Provide recommendations
    console.log('');
    console.log('🔧 RECOMMENDATIONS:');
    
    if (paymentTest.isPaymentServiceReady) {
      console.log('✅ Payment service is ready - you can proceed with payment integration');
    } else {
      console.log('⚠️ Payment service needs attention:');
      if (paymentTest.available === 0) {
        console.log('   - No payment endpoints are available');
        console.log('   - Check if payment app is installed in Django backend');
        console.log('   - Verify payment URLs are included in Django urls.py');
      } else {
        console.log(`   - Only ${paymentTest.available}/${paymentTest.total} payment endpoints available`);
        console.log('   - Some payment features may not work properly');
      }
    }
    
    // Check authentication
    const authEndpoints = fullTest.results.filter(r => r.endpoint.includes('auth'));
    const workingAuth = authEndpoints.filter(r => r.success || (r.status >= 400 && r.status < 500));
    
    if (workingAuth.length > 0) {
      console.log('✅ Authentication endpoints are responding');
    } else {
      console.log('❌ Authentication endpoints not working - check Django auth setup');
    }
    
    // Network connectivity
    const networkErrors = fullTest.results.filter(r => r.result === '🔌 NETWORK ERROR');
    if (networkErrors.length > 0) {
      console.log('🔌 Network Issues Detected:');
      console.log('   - Check if Django backend is running');
      console.log('   - Verify network configuration in networkConfig.js');
      console.log('   - Ensure device is on same network as backend');
    }
    
    return {
      success: true,
      paymentReady: paymentTest.isPaymentServiceReady,
      authWorking: workingAuth.length > 0,
      networkHealthy: networkErrors.length === 0,
      summary: fullTest.summary,
    };
    
  } catch (error) {
    console.error('❌ Network diagnostics failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Quick payment-only test
 */
export async function quickPaymentTest() {
  console.log('💳 Quick Payment Test...');
  try {
    const result = await testPaymentService();
    
    if (result.isPaymentServiceReady) {
      console.log('✅ Payment service is working!');
    } else {
      console.log('⚠️ Payment service issues detected');
      console.log('Check the detailed logs above for specific endpoints');
    }
    
    return result.isPaymentServiceReady;
  } catch (error) {
    console.error('❌ Payment test failed:', error);
    return false;
  }
}

// For immediate testing - uncomment the line below to run diagnostics on import
// runNetworkDiagnostics();

export default {
  runNetworkDiagnostics,
  quickPaymentTest,
};