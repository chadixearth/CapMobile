// Test script to verify driver cancellation API creates reports
const API_BASE_URL = 'http://192.168.101.80:8000/api';

async function testDriverCancellation() {
  try {
    console.log('Testing driver cancellation API...');
    
    // Test data - replace with actual booking ID and driver ID
    const testBookingId = 'test-booking-123';
    const testDriverId = 'test-driver-456';
    const testReason = 'Vehicle breakdown';
    
    const response = await fetch(`${API_BASE_URL}/tour-booking/driver-cancel/${testBookingId}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        driver_id: testDriverId,
        reason: testReason,
      }),
    });
    
    const result = await response.json();
    console.log('API Response:', result);
    
    if (result.success) {
      console.log('✅ Driver cancellation successful');
      console.log('Message:', result.message);
      
      // Now check if report was created
      const reportsResponse = await fetch(`${API_BASE_URL}/reports/?type=driver_cancellation&limit=10`);
      const reportsResult = await reportsResponse.json();
      
      console.log('Recent reports:', reportsResult);
      
      if (reportsResult.success && reportsResult.data.length > 0) {
        console.log('✅ Reports found in database');
        const latestReport = reportsResult.data[0];
        console.log('Latest report:', {
          id: latestReport.id,
          title: latestReport.title,
          description: latestReport.description,
          report_type: latestReport.report_type,
          status: latestReport.status,
          created_at: latestReport.created_at
        });
      } else {
        console.log('❌ No reports found in database');
      }
    } else {
      console.log('❌ Driver cancellation failed:', result.error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testDriverCancellation();