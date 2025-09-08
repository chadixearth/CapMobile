/**
 * Test the complete booking notification flow
 * 1. Tourist creates booking -> Drivers get notified
 * 2. Driver accepts booking -> Tourist gets notified
 */

import { createBooking } from './src/services/tourpackage/requestBooking';
import { driverAcceptBooking } from './src/services/tourpackage/acceptBooking';
import NotificationService from './src/services/notificationService';

export const testBookingNotificationFlow = async () => {
  console.log('🔔 Testing Complete Booking Notification Flow');
  console.log('=' * 50);
  
  try {
    // Step 1: Create a test booking (as tourist)
    console.log('\n1. Creating test booking...');
    const testBookingData = {
      package_id: 'test-package-123',
      customer_id: 'test-tourist-456',
      customer_name: 'Test Tourist',
      package_name: 'City Tour Package',
      booking_date: new Date().toISOString().split('T')[0],
      pickup_time: '09:00:00',
      number_of_pax: 2,
      total_amount: 1500,
      special_requests: 'Test booking for notification flow',
      contact_number: '09123456789',
      pickup_address: 'Test Address, Cebu City'
    };
    
    const bookingResult = await createBooking(testBookingData);
    console.log('Booking created:', bookingResult);
    
    if (bookingResult && bookingResult.success) {
      console.log('✅ Booking created successfully!');
      console.log('📱 Drivers should receive notifications now...');
      
      // Wait a moment for notifications to be sent
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Step 2: Simulate driver accepting the booking
      console.log('\n2. Simulating driver acceptance...');
      const testDriverData = {
        driver_id: 'test-driver-789',
        driver_name: 'Test Driver'
      };
      
      const acceptResult = await driverAcceptBooking(bookingResult.data.id, testDriverData);
      console.log('Accept result:', acceptResult);
      
      if (acceptResult && acceptResult.success) {
        console.log('✅ Booking accepted successfully!');
        console.log('📱 Tourist should receive acceptance notification now...');
      } else {
        console.log('❌ Failed to accept booking:', acceptResult?.error);
      }
    } else {
      console.log('❌ Failed to create booking:', bookingResult?.error);
    }
    
    console.log('\n' + '=' * 50);
    console.log('🎉 Booking notification flow test completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
};

// Test individual notification components
export const testNotificationComponents = async () => {
  console.log('🔧 Testing Individual Notification Components');
  console.log('=' * 50);
  
  try {
    // Test 1: Send test notification to drivers
    console.log('\n1. Testing driver notification...');
    const driverNotifResult = await NotificationService.notifyDriversOfNewBooking({
      id: 'test-booking-123',
      tourist_name: 'Test Tourist',
      customer_name: 'Test Tourist',
      package_name: 'Test City Tour',
      number_of_pax: 2
    });
    console.log('Driver notification result:', driverNotifResult);
    
    // Test 2: Send test notification to tourist
    console.log('\n2. Testing tourist notification...');
    const touristNotifResult = await NotificationService.notifyTouristOfAcceptedBooking(
      'test-tourist-456',
      'Test Driver',
      { id: 'test-booking-123' }
    );
    console.log('Tourist notification result:', touristNotifResult);
    
    // Test 3: Test notification retrieval
    console.log('\n3. Testing notification retrieval...');
    const getResult = await NotificationService.getNotifications('test-user-123');
    console.log('Get notifications result:', getResult);
    
    console.log('\n✅ Component tests completed!');
    
  } catch (error) {
    console.error('❌ Component test error:', error);
  }
};

// Usage instructions
console.log(`
📱 MOBILE TESTING INSTRUCTIONS:

1. **Test Backend First:**
   - Run: python test_notification_system.py
   - Ensure it shows active drivers and tourists

2. **Test Mobile Components:**
   - Import this file in your React Native app
   - Call testNotificationComponents() to test individual parts
   - Call testBookingNotificationFlow() to test the complete flow

3. **Manual End-to-End Test:**
   - Open app as Tourist
   - Create a real booking
   - Check if drivers receive notifications
   - Open app as Driver
   - Accept the booking
   - Check if tourist receives acceptance notification

4. **Check Logs:**
   - Monitor console for notification delivery logs
   - Check notification polling in real-time
   - Verify API calls are successful
`);