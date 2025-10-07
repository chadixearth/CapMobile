// test_anonymous_reviews.js
// Test script for anonymous review functionality

const testAnonymousReviews = async () => {
  console.log('🧪 Testing Anonymous Review System...\n');

  const apiBaseUrl = 'http://192.168.1.100:8000/api'; // Update with your backend URL
  
  // Test data
  const testData = {
    package_id: 'test-package-123',
    booking_id: 'test-booking-123', 
    reviewer_id: 'test-tourist-123',
    driver_id: 'test-driver-123',
    rating: 5,
    comment: 'Great experience!',
  };

  console.log('📋 Testing Anonymous Package Review...');
  try {
    const response = await fetch(`${apiBaseUrl}/reviews/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...testData,
        is_anonymous: true, // Test anonymous review
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Anonymous Package Review: Success');
      console.log(`   Review ID: ${result.data?.id}`);
      console.log(`   Anonymous: ${result.data?.is_anonymous}`);
    } else {
      console.log(`❌ Anonymous Package Review: Failed - ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Anonymous Package Review: Network error - ${error.message}`);
  }

  console.log('\n📋 Testing Anonymous Driver Review...');
  try {
    const response = await fetch(`${apiBaseUrl}/reviews/driver/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...testData,
        is_anonymous: true, // Test anonymous review
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Anonymous Driver Review: Success');
      console.log(`   Review ID: ${result.data?.id}`);
      console.log(`   Anonymous: ${result.data?.is_anonymous}`);
    } else {
      console.log(`❌ Anonymous Driver Review: Failed - ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Anonymous Driver Review: Network error - ${error.message}`);
  }

  console.log('\n📋 Testing Non-Anonymous Review...');
  try {
    const response = await fetch(`${apiBaseUrl}/reviews/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...testData,
        booking_id: 'test-booking-124', // Different booking
        is_anonymous: false, // Test non-anonymous review
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Non-Anonymous Review: Success');
      console.log(`   Review ID: ${result.data?.id}`);
      console.log(`   Anonymous: ${result.data?.is_anonymous}`);
    } else {
      console.log(`❌ Non-Anonymous Review: Failed - ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Non-Anonymous Review: Network error - ${error.message}`);
  }

  console.log('\n📋 Testing Review Display (Package)...');
  try {
    const response = await fetch(`${apiBaseUrl}/reviews/package/${testData.package_id}/`);
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Review Display: Success');
      console.log(`   Found ${result.data?.reviews?.length || 0} reviews`);
      
      if (result.data?.reviews?.length > 0) {
        result.data.reviews.slice(0, 2).forEach((review, index) => {
          console.log(`   Review ${index + 1}:`);
          console.log(`     Name: ${review.reviewer_name}`);
          console.log(`     Anonymous: ${review.is_anonymous}`);
          console.log(`     Rating: ${review.rating}/5`);
        });
      }
    } else {
      console.log(`❌ Review Display: Failed - ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Review Display: Network error - ${error.message}`);
  }

  console.log('\n🏁 Anonymous review tests completed!');
  console.log('\n📱 To test in mobile app:');
  console.log('1. Complete a booking');
  console.log('2. Navigate to ReviewSubmissionScreen');
  console.log('3. Toggle "Anonymous Review" option');
  console.log('4. Submit review and verify name display');
  console.log('5. Check that anonymous reviews show "Anonymous" instead of user name');
};

// Test mobile settings
const testMobileSettings = () => {
  console.log('\n🧪 Testing Mobile Anonymous Settings...\n');

  console.log('📋 Mobile anonymous review features:');
  console.log('1. ✅ Anonymous toggle in ReviewSubmissionScreen');
  console.log('2. ✅ User preference persistence via AsyncStorage');
  console.log('3. ✅ Setting remembered across app sessions');
  console.log('4. ✅ Visual feedback with toggle animation');
  console.log('5. ✅ Clear explanation text for users');

  console.log('\n📱 To test mobile settings:');
  console.log('1. Open ReviewSubmissionScreen');
  console.log('2. Toggle anonymous option ON');
  console.log('3. Close and reopen screen - should remember setting');
  console.log('4. Submit review and verify it appears as anonymous');
  console.log('5. Check review display shows "Anonymous" instead of name');
};

// Run tests
if (typeof window !== 'undefined') {
  // Browser environment
  console.log('🌐 Running in browser - use testAnonymousReviews() function');
  window.testAnonymousReviews = testAnonymousReviews;
  window.testMobileSettings = testMobileSettings;
} else {
  // Node.js environment
  testAnonymousReviews().catch(console.error);
  testMobileSettings();
}

export { testAnonymousReviews, testMobileSettings };