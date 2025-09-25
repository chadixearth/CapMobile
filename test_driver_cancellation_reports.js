/**
 * Test script for enhanced driver cancellation reporting
 * Run this with: node test_driver_cancellation_reports.js
 */

const API_BASE_URL = 'http://192.168.101.80:8000/api';

async function testDriverCancellation() {
  console.log('🧪 Testing Enhanced Driver Cancellation Reporting...\n');

  // Test data
  const testCancellation = {
    driver_id: 'test-driver-456',
    reason: 'Customer behavior issues'
  };

  const testBookingId = 'test-booking-123';

  try {
    console.log('📤 Submitting driver cancellation...');
    console.log('Booking ID:', testBookingId);
    console.log('Cancellation data:', JSON.stringify(testCancellation, null, 2));

    const response = await fetch(`${API_BASE_URL}/tour-booking/driver-cancel/${testBookingId}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCancellation)
    });

    const result = await response.json();
    
    console.log('\n📥 Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(result, null, 2));

    if (response.ok && result.success) {
      console.log('\n✅ Driver cancellation processed successfully!');
      
      // Test fetching cancellation reports
      console.log('\n📋 Fetching driver cancellation reports...');
      const reportsResponse = await fetch(`${API_BASE_URL}/reports/?type=driver_cancellation`);
      const reportsResult = await reportsResponse.json();
      
      console.log('Cancellation reports:', JSON.stringify(reportsResult, null, 2));
      
    } else {
      console.log('\n❌ Driver cancellation failed');
      console.log('Error:', result.error || 'Unknown error');
    }

  } catch (error) {
    console.log('\n💥 Network error:', error.message);
    console.log('Make sure the backend server is running at:', API_BASE_URL);
  }
}

// Run the test
testDriverCancellation();