/**
 * Test script for admin cancellation review
 * Run this with: node test_admin_cancellation_review.js
 */

const API_BASE_URL = 'http://10.93.130.23:8000/api';

async function testAdminReview() {
  console.log('🧪 Testing Admin Cancellation Review...\n');

  // Test data
  const adminReview = {
    report_id: 'test-report-123',
    decision: 'unjustified', // or 'justified'
    admin_notes: 'Customer complaint was valid, driver should not have cancelled',
    admin_id: 'admin-456'
  };

  try {
    console.log('📤 Submitting admin review...');
    console.log('Review data:', JSON.stringify(adminReview, null, 2));

    const response = await fetch(`${API_BASE_URL}/reports/review_driver_cancellation/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(adminReview)
    });

    const result = await response.json();
    
    console.log('\n📥 Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(result, null, 2));

    if (response.ok && result.success) {
      console.log('\n✅ Admin review processed successfully!');
      
      if (adminReview.decision === 'unjustified') {
        console.log('📊 Driver metrics will be updated');
        if (result.driver_suspended) {
          console.log('⚠️ Driver may be suspended due to cancellation pattern');
        }
      } else {
        console.log('✅ No impact on driver metrics (justified cancellation)');
      }
      
    } else {
      console.log('\n❌ Admin review failed');
      console.log('Error:', result.error || 'Unknown error');
    }

  } catch (error) {
    console.log('\n💥 Network error:', error.message);
    console.log('Make sure the backend server is running at:', API_BASE_URL);
  }
}

// Test both scenarios
async function runTests() {
  console.log('=== Testing Unjustified Cancellation ===');
  await testAdminReview();
  
  console.log('\n=== Testing Justified Cancellation ===');
  // Test justified cancellation
  const justifiedReview = {
    report_id: 'test-report-124',
    decision: 'justified',
    admin_notes: 'Customer was indeed problematic, cancellation was reasonable',
    admin_id: 'admin-456'
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/reports/review_driver_cancellation/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(justifiedReview)
    });
    
    const result = await response.json();
    console.log('Justified result:', result.message);
  } catch (error) {
    console.log('Error testing justified:', error.message);
  }
}

runTests();