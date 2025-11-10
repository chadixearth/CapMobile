# Quick Setup Guide: Ride Hailing Reviews

## What's Already Done ✅

1. ✅ Backend API endpoints for driver reviews
2. ✅ Mobile review service functions
3. ✅ Review submission screen updated
4. ✅ Review prompt modal component created

## What You Need to Do 🔧

### Step 1: Add Review Prompt to Ride Tracking Screen

Find where you display active rides (likely in `TouristHomeScreen.js` or `TerminalsScreen.js`) and add:

```javascript
// At the top of the file
import RideReviewPrompt from '../components/RideReviewPrompt';
import { checkExistingReviews } from '../services/reviews';

// Add state variables
const [showReviewPrompt, setShowReviewPrompt] = useState(false);
const [completedRide, setCompletedRide] = useState(null);

// Add this useEffect to monitor ride completion
useEffect(() => {
  const handleRideCompletion = async () => {
    // Check if there's a completed ride
    if (activeRide && activeRide.status === 'completed') {
      // Check if user already reviewed this ride
      const reviewCheck = await checkExistingReviews({
        booking_id: activeRide.id,
        reviewer_id: user.id
      });
      
      // Show prompt only if not reviewed yet
      if (reviewCheck.success && !reviewCheck.data?.hasDriverReview) {
        setCompletedRide(activeRide);
        setShowReviewPrompt(true);
      }
    }
  };
  
  handleRideCompletion();
}, [activeRide, user]);

// Add this component in your JSX (before closing View/ScrollView)
<RideReviewPrompt
  visible={showReviewPrompt}
  onClose={() => setShowReviewPrompt(false)}
  driverName={completedRide?.driver_name || 'your driver'}
  onReview={() => {
    setShowReviewPrompt(false);
    navigation.navigate('ReviewSubmission', {
      bookingType: 'ride_hailing',
      rideBooking: completedRide,
      driver: {
        id: completedRide?.driver_id,
        name: completedRide?.driver_name
      }
    });
  }}
/>
```

### Step 2: Test the Flow

1. **Start a ride hailing booking**
   - Go to ride hailing screen
   - Request a ride
   
2. **Accept as driver** (use driver account)
   - Accept the ride request
   - Start the ride
   - Complete the ride

3. **Check tourist app**
   - Review prompt should appear automatically
   - Tap "Rate Driver"
   - Submit a review

4. **Verify review was saved**
   - Check driver's profile to see the review
   - Try to review again - should show "already reviewed" error

## Files Modified

### New Files Created:
- `src/components/RideReviewPrompt.js` - Review prompt modal
- `RIDE_HAILING_REVIEW_IMPLEMENTATION.md` - Full documentation
- `QUICK_REVIEW_SETUP.md` - This file

### Modified Files:
- `src/services/reviews.js` - Added `createRideHailingDriverReview()`
- `src/services/rideHailingService.js` - Added review invalidation and `getRideBookingDetails()`
- `src/screens/main/ReviewSubmissionScreen.js` - Added ride hailing support

## Common Issues & Solutions

### Issue: Review prompt doesn't appear
**Solution**: Check that:
- Ride status is exactly 'completed'
- User hasn't already reviewed this ride
- `activeRide` object has `driver_id` and `driver_name`

### Issue: "Booking not found" error
**Solution**: Make sure you're passing the correct `booking_id` (use `rideBooking.id` not `booking.id`)

### Issue: Review screen shows package review
**Solution**: Ensure `bookingType: 'ride_hailing'` is passed in navigation params

### Issue: Can't find where rides are displayed
**Solution**: Search for:
- `ride_hailing` or `rideHailing` in screen files
- `getMyActiveRides` function calls
- `RideStatusCard` component usage

## Quick Test Commands

```javascript
// Test review creation
import { createRideHailingDriverReview } from './src/services/reviews';

const testReview = await createRideHailingDriverReview({
  driver_id: 'driver-uuid-here',
  ride_booking_id: 'ride-booking-uuid-here',
  reviewer_id: 'tourist-uuid-here',
  rating: 5,
  comment: 'Great driver!',
  is_anonymous: false
});

console.log('Review result:', testReview);
```

## Next Steps

1. ✅ Add review prompt to ride tracking screen (Step 1 above)
2. Test the complete flow
3. Optional: Add review statistics to driver profile
4. Optional: Show driver ratings when requesting rides
5. Optional: Add review reminders after 24 hours

## Need Help?

Check the full documentation in `RIDE_HAILING_REVIEW_IMPLEMENTATION.md` for:
- Detailed API documentation
- Database schema
- Advanced features
- Troubleshooting guide
