// test_breakeven_notifications.js
// Test script for breakeven notification system

const testBreakevenNotifications = async () => {
  console.log('🧪 Testing Breakeven Notification System...\n');

  // Test data
  const testDriverId = 'test-driver-uuid-123';
  const apiBaseUrl = 'http://192.168.1.100:8000/api'; // Update with your backend URL

  // Test scenarios
  const scenarios = [
    {
      name: 'Breakeven Achievement',
      currentData: {
        success: true,
        data: {
          expenses: 500,
          revenue_period: 500,
          total_bookings: 5,
          bookings_needed: 5
        }
      },
      previousData: {
        expenses: 500,
        revenue: 400,
        profit: -100
      }
    },
    {
      name: 'Profit Achievement',
      currentData: {
        success: true,
        data: {
          expenses: 500,
          revenue_period: 700,
          total_bookings: 7,
          bookings_needed: 5
        }
      },
      previousData: {
        expenses: 500,
        revenue: 500,
        profit: 0
      }
    },
    {
      name: 'Profit Milestone (₱500)',
      currentData: {
        success: true,
        data: {
          expenses: 500,
          revenue_period: 1000,
          total_bookings: 10,
          bookings_needed: 5
        }
      },
      previousData: {
        expenses: 500,
        revenue: 800,
        profit: 300
      }
    },
    {
      name: 'Deficit Warning',
      currentData: {
        success: true,
        data: {
          expenses: 500,
          revenue_period: 250,
          total_bookings: 3,
          bookings_needed: 8
        }
      },
      previousData: {
        expenses: 500,
        revenue: 300,
        profit: -200
      }
    }
  ];

  // Test each scenario
  for (const scenario of scenarios) {
    console.log(`📋 Testing: ${scenario.name}`);
    
    try {
      const response = await fetch(`${apiBaseUrl}/notifications/breakeven/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driver_id: testDriverId,
          current_data: scenario.currentData,
          previous_data: scenario.previousData
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ ${scenario.name}: Success`);
        console.log(`   Notifications sent: ${result.notifications_sent?.join(', ') || 'none'}`);
        console.log(`   Current status: Breakeven=${result.current_status?.breakeven_hit}, Profitable=${result.current_status?.profitable}`);
      } else {
        console.log(`❌ ${scenario.name}: Failed - ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ ${scenario.name}: Network error - ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
  }

  // Test getting recent notifications
  console.log('📋 Testing: Get Recent Notifications');
  try {
    const response = await fetch(`${apiBaseUrl}/notifications/breakeven/?driver_id=${testDriverId}`);
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Get Recent Notifications: Success`);
      console.log(`   Found ${result.data?.notification_count || 0} breakeven notifications`);
      
      if (result.data?.recent_notifications?.length > 0) {
        console.log('   Recent notifications:');
        result.data.recent_notifications.slice(0, 3).forEach((notif, index) => {
          console.log(`     ${index + 1}. ${notif.title}`);
          console.log(`        ${notif.message.substring(0, 80)}...`);
        });
      }
    } else {
      console.log(`❌ Get Recent Notifications: Failed - ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Get Recent Notifications: Network error - ${error.message}`);
  }

  console.log('\n🏁 Breakeven notification tests completed!');
  console.log('\n📱 To test in mobile app:');
  console.log('1. Open DriverBreakevenScreen');
  console.log('2. Add expenses to trigger breakeven calculations');
  console.log('3. Check notification bell for new breakeven notifications');
  console.log('4. Verify local notifications appear when milestones are reached');
};

// Test mobile notification manager
const testMobileNotificationManager = () => {
  console.log('\n🧪 Testing Mobile Breakeven Notification Manager...\n');

  // Mock data for testing
  const mockDriverId = 'test-driver-mobile-123';
  
  const testScenarios = [
    {
      name: 'First time breakeven',
      current: { expenses: 300, revenue_period: 300, total_bookings: 3, bookings_needed: 3 },
      previous: null
    },
    {
      name: 'Profit achievement',
      current: { expenses: 300, revenue_period: 450, total_bookings: 5, bookings_needed: 3 },
      previous: { expenses: 300, revenue: 300, profit: 0 }
    },
    {
      name: 'Milestone ₱500',
      current: { expenses: 300, revenue_period: 800, total_bookings: 8, bookings_needed: 3 },
      previous: { expenses: 300, revenue: 600, profit: 300 }
    }
  ];

  console.log('📋 Mobile notification scenarios to test:');
  testScenarios.forEach((scenario, index) => {
    console.log(`${index + 1}. ${scenario.name}`);
    console.log(`   Current: ₱${scenario.current.revenue_period} revenue, ₱${scenario.current.expenses} expenses`);
    console.log(`   Expected: ${scenario.current.revenue_period >= scenario.current.expenses ? 'Breakeven/Profit notification' : 'No notification'}`);
  });

  console.log('\n📱 To test mobile notifications:');
  console.log('1. Import BreakevenNotificationManager in your screen');
  console.log('2. Call checkBreakevenMilestones() with test data');
  console.log('3. Check device notifications and app notification bell');
  console.log('4. Verify notifications appear in NotificationScreen');
};

// Run tests
if (typeof window !== 'undefined') {
  // Browser environment
  console.log('🌐 Running in browser - use testBreakevenNotifications() function');
  window.testBreakevenNotifications = testBreakevenNotifications;
  window.testMobileNotificationManager = testMobileNotificationManager;
} else {
  // Node.js environment
  testBreakevenNotifications().catch(console.error);
  testMobileNotificationManager();
}

export { testBreakevenNotifications, testMobileNotificationManager };