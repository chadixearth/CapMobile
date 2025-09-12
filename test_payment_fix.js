/**
 * Test script to verify payment completion fix
 */

const testPaymentCompletion = async () => {
  const API_BASE_URL = 'http://192.168.3.23:8000'; // From the logs
  const BOOKING_ID = '03502004-c8d8-428b-9287-41214467e5b1'; // From the logs
  
  try {
    console.log('🧪 Testing payment completion API...');
    
    // First test if the endpoint is accessible
    console.log('1. Testing GET endpoint...');
    const getResponse = await fetch(`${API_BASE_URL}/api/payment/complete/`);
    const getResult = await getResponse.json();
    console.log('GET result:', getResult);
    
    if (!getResult.success) {
      console.error('❌ GET test failed');
      return;
    }
    
    // Now test the actual payment completion
    console.log('2. Testing payment completion...');
    const response = await fetch(`${API_BASE_URL}/api/payment/complete/`, {
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
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Payment completion failed:', response.status, errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Payment completion result:', result);
    
    if (result.success) {
      console.log('✅ SUCCESS! Booking status updated to:', result.data?.status);
      console.log('✅ Payment status:', result.data?.payment_status);
    } else {
      console.log('❌ Payment completion failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
};

// Run the test
testPaymentCompletion();