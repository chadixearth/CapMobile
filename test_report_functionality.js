/**
 * Test script for trip report functionality
 * Run this with: node test_report_functionality.js
 */

const API_BASE_URL = 'http://10.93.130.23:8000/api';

async function testTripReport() {
  console.log('🧪 Testing Trip Report Functionality...\n');

  // Test data
  const testReport = {
    booking_id: 'test-booking-123',
    driver_id: 'test-driver-456',
    reason: 'Tourist was rude or disrespectful',
    description: 'Tourist was using inappropriate language and refused to follow safety guidelines.'
  };

  try {
    console.log('📤 Submitting trip report...');
    console.log('Report data:', JSON.stringify(testReport, null, 2));

    const response = await fetch(`${API_BASE_URL}/reports/trip_report/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testReport)
    });

    const result = await response.json();
    
    console.log('\n📥 Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(result, null, 2));

    if (response.ok && result.success) {
      console.log('\n✅ Trip report submitted successfully!');
      console.log('Report ID:', result.data?.id);
      
      // Test fetching reports
      console.log('\n📋 Fetching all reports...');
      const listResponse = await fetch(`${API_BASE_URL}/reports/?type=trip_issue`);
      const listResult = await listResponse.json();
      
      console.log('Reports list:', JSON.stringify(listResult, null, 2));
      
    } else {
      console.log('\n❌ Trip report submission failed');
      console.log('Error:', result.error || 'Unknown error');
    }

  } catch (error) {
    console.log('\n💥 Network error:', error.message);
    console.log('Make sure the backend server is running at:', API_BASE_URL);
  }
}

// Run the test
testTripReport();