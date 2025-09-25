/**
 * Test script for driver location tracking
 */

import { updateDriverLocation, getDriverLocation } from './src/services/rideHailingService';

// Test driver location update
async function testDriverLocationUpdate() {
  console.log('Testing driver location update...');
  
  const testUserId = 'test-driver-123';
  const testLat = 10.295;
  const testLng = 123.89;
  
  try {
    // Test updating location
    const updateResult = await updateDriverLocation(testUserId, testLat, testLng, 25, 180);
    console.log('Update result:', updateResult);
    
    // Test getting location
    const getResult = await getDriverLocation(testUserId);
    console.log('Get result:', getResult);
    
    if (updateResult.success && getResult.success) {
      console.log('✅ Driver location tracking test passed!');
    } else {
      console.log('❌ Driver location tracking test failed');
    }
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Test tourist tracking driver
async function testTouristTracking() {
  console.log('Testing tourist tracking driver...');
  
  const driverId = 'test-driver-123';
  
  try {
    const result = await getDriverLocation(driverId);
    console.log('Tourist tracking result:', result);
    
    if (result.success && result.data) {
      console.log('✅ Tourist can track driver location!');
      console.log('Driver at:', result.data.latitude, result.data.longitude);
    } else {
      console.log('❌ Tourist cannot track driver location');
    }
  } catch (error) {
    console.error('Tourist tracking error:', error);
  }
}

export { testDriverLocationUpdate, testTouristTracking };

console.log('Driver Tracking Test Module Loaded');
console.log('Run testDriverLocationUpdate() and testTouristTracking() to test');