/**
 * Test script for mobile notification system
 * Run this in your React Native app to test notifications
 */

import NotificationService from './src/services/notificationService';

export const testNotificationSystem = async () => {
  console.log('🔔 Testing Mobile Notification System');
  console.log('=' * 50);
  
  // Test user ID (replace with actual user ID)
  const testUserId = 'your-test-user-id-here';
  
  try {
    // Test 1: Send test notification
    console.log('\n1. Testing notification sending...');
    const sendResult = await NotificationService.testNotification(testUserId);
    console.log('Send result:', sendResult);
    
    // Test 2: Get notifications
    console.log('\n2. Testing notification retrieval...');
    const getResult = await NotificationService.getNotifications(testUserId);
    console.log('Get result:', getResult);
    
    // Test 3: Start polling
    console.log('\n3. Testing notification polling...');
    NotificationService.startPolling(testUserId, (notifications) => {
      console.log('📱 Received notifications:', notifications.length);
      notifications.forEach(notif => {
        console.log(`  - ${notif.title}: ${notif.message}`);
      });
    });
    
    // Test 4: Simulate booking notification
    console.log('\n4. Testing booking notification...');
    const bookingData = {
      id: 'test-booking-123',
      tourist_name: 'Test Tourist',
      customer_name: 'Test Tourist',
      package_name: 'City Tour',
      number_of_pax: 2
    };
    
    const driverNotifResult = await NotificationService.notifyDriversOfNewBooking(bookingData);
    console.log('Driver notification result:', driverNotifResult);
    
    // Test 5: Simulate acceptance notification
    console.log('\n5. Testing acceptance notification...');
    const touristNotifResult = await NotificationService.notifyTouristOfAcceptedBooking(
      testUserId,
      'Test Driver',
      bookingData
    );
    console.log('Tourist notification result:', touristNotifResult);
    
    console.log('\n✅ Mobile notification tests completed!');
    
    // Stop polling after 30 seconds
    setTimeout(() => {
      NotificationService.stopPolling();
      console.log('🛑 Stopped notification polling');
    }, 30000);
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
};

// Usage in your React Native component:
/*
import { testNotificationSystem } from './test_notifications';

// In your component
const runTests = () => {
  testNotificationSystem();
};
*/