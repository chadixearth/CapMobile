/**
 * Payment Debugging Utility
 * Use this to test and debug payment URL issues
 */

import paymentService from '../services/paymentService';

/**
 * Test payment creation and URL extraction
 * @param {string} bookingId - Test booking ID
 * @param {string} paymentMethod - Payment method to test
 */
export async function debugPaymentCreation(bookingId = 'test-booking-123', paymentMethod = 'gcash') {
  console.log('🔍 Debugging Payment Creation');
  console.log('=====================================');
  console.log(`Testing booking: ${bookingId}`);
  console.log(`Payment method: ${paymentMethod}`);
  console.log('');

  try {
    // Step 1: Test connection
    console.log('Step 1: Testing connection...');
    const connectionStatus = await paymentService.testConnection();
    console.log('Connection status:', connectionStatus);
    console.log('');

    // Step 2: Create payment
    console.log('Step 2: Creating payment...');
    const paymentResult = await paymentService.createMobilePayment(bookingId, paymentMethod);
    console.log('Payment result:', paymentResult);
    console.log('');

    if (paymentResult.success) {
      // Step 3: Extract payment URL
      console.log('Step 3: Extracting payment URL...');
      const paymentUrl = paymentResult.checkoutUrl || paymentResult.nextAction?.redirect?.url;
      console.log('Extracted payment URL:', paymentUrl);
      
      if (paymentUrl) {
        console.log('✅ SUCCESS: Payment URL found!');
        console.log('   URL:', paymentUrl);
        console.log('   WebView required:', paymentService.requiresWebViewRedirect(paymentMethod));
        console.log('   Next action type:', paymentResult.nextAction?.type);
        if (paymentResult.sourceId) {
          console.log('   Source ID:', paymentResult.sourceId);
        }
      } else if (paymentResult.nextAction?.type === 'client_side_payment') {
        console.log('✅ SUCCESS: Client-side payment setup!');
        console.log('   Payment Intent ID:', paymentResult.paymentIntentId);
        console.log('   Client Key:', paymentResult.clientKey);
        console.log('   Requires PayMongo SDK integration');
      } else {
        console.log('❌ ISSUE: No payment URL or client setup found');
        console.log('   Available fields in payment result:');
        Object.keys(paymentResult).forEach(key => {
          console.log(`   - ${key}:`, typeof paymentResult[key] === 'object' ? '[Object]' : paymentResult[key]);
        });
        
        // Show possible URL fields
        console.log('   Checking for possible URL fields:');
        const urlFields = ['checkoutUrl', 'redirectUrl', 'payment_url', 'url'];
        urlFields.forEach(field => {
          const value = paymentResult[field];
          console.log(`   - ${field}:`, value || 'Not found');
        });
        
        // Check nested objects
        if (paymentResult.nextAction) {
          console.log('   - nextAction.redirect.url:', paymentResult.nextAction?.redirect?.url || 'Not found');
          console.log('   - nextAction.type:', paymentResult.nextAction?.type || 'Not found');
        }
        if (paymentResult.data) {
          console.log('   - data.checkout_url:', paymentResult.data?.checkout_url || 'Not found');
        }
      }
    } else {
      console.log('❌ Payment creation failed:');
      console.log('   Error:', paymentResult.error);
      console.log('   Error Code:', paymentResult.errorCode);
    }
    
    return paymentResult;
    
  } catch (error) {
    console.log('🚨 Error during payment debugging:');
    console.log('   Message:', error.message);
    console.log('   Stack:', error.stack);
    return { success: false, error: error.message };
  }
}

/**
 * Test multiple payment methods
 */
export async function debugAllPaymentMethods(bookingId = 'test-booking-456') {
  console.log('🎯 Testing All Payment Methods');
  console.log('=====================================');
  
  const methods = ['gcash', 'grab_pay', 'paymaya', 'card'];
  const results = {};
  
  for (const method of methods) {
    console.log(`\n--- Testing ${method.toUpperCase()} ---`);
    const result = await debugPaymentCreation(bookingId, method);
    results[method] = result;
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 SUMMARY:');
  Object.entries(results).forEach(([method, result]) => {
    const status = result.success ? '✅' : '❌';
    const url = result.success ? (result.checkoutUrl || result.nextAction?.redirect?.url) : null;
    const hasClientSetup = result.success && result.nextAction?.type === 'client_side_payment';
    const statusText = url ? 'URL found' : hasClientSetup ? 'Client setup' : 'No URL/Setup';
    console.log(`${status} ${method}: ${statusText}`);
  });
  
  return results;
}

/**
 * Quick test for debugging in development
 */
export async function quickPaymentTest() {
  console.log('⚡ Quick Payment Test');
  console.log('==================');
  
  const result = await debugPaymentCreation();
  
  if (result.success) {
    const url = result.checkoutUrl || result.nextAction?.redirect?.url;
    const hasClientSetup = result.nextAction?.type === 'client_side_payment';
    
    if (url) {
      console.log('🎉 Payment URL generation is working!');
      return true;
    } else if (hasClientSetup) {
      console.log('🎉 Payment client setup is working!');
      return true;
    } else {
      console.log('⚠️  Payment creation works but no URL or client setup found');
      return false;
    }
  } else {
    console.log('💥 Payment creation failed');
    return false;
  }
}

/**
 * Usage Instructions:
 * 
 * // In any component or screen, import and use:
 * import { debugPaymentCreation, quickPaymentTest } from '../utils/paymentDebugger';
 * 
 * // Quick test
 * quickPaymentTest();
 * 
 * // Detailed debugging
 * debugPaymentCreation('your-booking-id', 'gcash');
 * 
 * // Test all methods
 * debugAllPaymentMethods('test-booking');
 */

export default {
  debugPaymentCreation,
  debugAllPaymentMethods,
  quickPaymentTest,
};