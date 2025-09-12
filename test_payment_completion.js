/**
 * Test script to verify payment completion flow
 * Run this to test if payment completion properly updates booking status
 */

const testPaymentCompletion = async () => {
  const API_BASE_URL = 'http://localhost:8000'; // Adjust as needed
  
  // Test data - replace with actual booking ID
  const testBookingId = 'your-test-booking-id';
  
  try {
    console.log('Testing payment completion for booking:', testBookingId);
    
    const response = await fetch(`${API_BASE_URL}/api/payment/complete/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        booking_id: testBookingId,
        payment_status: 'paid',
        payment_reference: 'TEST_PAYMENT_' + Date.now(),
      }),
    });
    
    if (!response.ok) {
      console.error('Payment completion failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('Payment completion result:', result);
    
    if (result.success) {
      console.log('✅ Payment completion successful!');
      console.log('Updated booking status:', result.data?.status);
      console.log('Payment status:', result.data?.payment_status);
    } else {
      console.log('❌ Payment completion failed:', result.error);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
};

// Uncomment to run the test
// testPaymentCompletion();

module.exports = { testPaymentCompletion };