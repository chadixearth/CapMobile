/**
 * Comprehensive test for payment completion fix
 */

const API_BASE_URL = 'http://192.168.101.80:8000';
const BOOKING_ID = '03502004-c8d8-428b-9287-41214467e5b1';

const testPaymentFlow = async () => {
  console.log('🧪 Starting comprehensive payment test...\n');
  
  try {
    // Step 1: Check current booking status
    console.log('📋 Step 1: Checking current booking status...');
    const debugResponse = await fetch(`${API_BASE_URL}/api/debug/booking/${BOOKING_ID}/`);
    
    if (!debugResponse.ok) {
      console.error('❌ Debug endpoint failed:', debugResponse.status);
      return;
    }
    
    const debugResult = await debugResponse.json();
    console.log('Current booking status:', debugResult.debug_info);
    console.log('');
    
    // Step 2: Test payment completion endpoint availability
    console.log('🔗 Step 2: Testing payment completion endpoint...');
    const getResponse = await fetch(`${API_BASE_URL}/api/payment/complete/`);
    const getResult = await getResponse.json();
    console.log('Endpoint test:', getResult);
    console.log('');
    
    // Step 3: Simulate payment completion
    console.log('💳 Step 3: Simulating payment completion...');
    const paymentResponse = await fetch(`${API_BASE_URL}/api/payment/complete/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        booking_id: BOOKING_ID,
        payment_status: 'paid',
        payment_reference: 'TEST_PAYMENT_' + Date.now(),
      }),
    });
    
    console.log('Payment response status:', paymentResponse.status);
    
    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      console.error('❌ Payment completion failed:', errorText);
      return;
    }
    
    const paymentResult = await paymentResponse.json();
    console.log('Payment completion result:', paymentResult);
    console.log('');
    
    // Step 4: Verify the status was updated
    console.log('✅ Step 4: Verifying status update...');
    const verifyResponse = await fetch(`${API_BASE_URL}/api/debug/booking/${BOOKING_ID}/`);
    const verifyResult = await verifyResponse.json();
    console.log('Updated booking status:', verifyResult.debug_info);
    
    // Check if the status changed correctly
    const oldStatus = debugResult.debug_info.status;
    const newStatus = verifyResult.debug_info.status;
    const oldPaymentStatus = debugResult.debug_info.payment_status;
    const newPaymentStatus = verifyResult.debug_info.payment_status;
    
    console.log('\n📊 RESULTS:');
    console.log(`Status: ${oldStatus} → ${newStatus}`);
    console.log(`Payment Status: ${oldPaymentStatus} → ${newPaymentStatus}`);
    
    if (newStatus === 'paid' && newPaymentStatus === 'paid') {
      console.log('🎉 SUCCESS! Payment completion is working correctly!');
      console.log('✅ Driver should now see "Start Trip" button');
      console.log('✅ Tourist should see "Payment Complete" status');
    } else {
      console.log('❌ FAILED! Status not updated correctly');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
};

// Run the test
testPaymentFlow();