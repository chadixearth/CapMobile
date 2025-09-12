/**
 * Debug script to test profile update API
 * Run this with: node debug_profile_api.js
 */

const API_BASE_URL = 'http://192.168.1.9:8000/api';

async function testProfileUpdateAPI() {
  console.log('=== Profile Update API Debug ===\n');
  
  // Test data
  const testData = {
    user_id: 'test-user-123',
    profile_data: {
      first_name: 'John',
      middle_name: 'Michael',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890'
    }
  };
  
  console.log('Testing API endpoint:', `${API_BASE_URL}/auth/profile/update/`);
  console.log('Request data:', JSON.stringify(testData, null, 2));
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/profile/update/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    console.log('\nResponse status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseData = await response.json();
    console.log('Response data:', JSON.stringify(responseData, null, 2));
    
    if (response.ok && responseData.success) {
      console.log('\n✅ Profile update API is working!');
    } else {
      console.log('\n❌ Profile update failed:', responseData.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('\n❌ Network error:', error.message);
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
      console.log('\nTroubleshooting:');
      console.log('1. Make sure Django server is running: python manage.py runserver');
      console.log('2. Check if the IP address is correct: 192.168.1.9');
      console.log('3. Verify both devices are on the same network');
      console.log('4. Try accessing http://192.168.1.9:8000/api/debug/ in browser');
    }
  }
}

// Test basic connectivity first
async function testBasicConnectivity() {
  console.log('Testing basic connectivity...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/debug/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Debug endpoint status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Debug endpoint response:', data);
      console.log('✅ Basic connectivity works\n');
      return true;
    } else {
      console.log('❌ Debug endpoint failed\n');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Basic connectivity failed:', error.message);
    return false;
  }
}

// Run tests
async function runTests() {
  const basicOk = await testBasicConnectivity();
  
  if (basicOk) {
    await testProfileUpdateAPI();
  } else {
    console.log('Skipping profile API test due to connectivity issues');
  }
}

runTests().catch(console.error);