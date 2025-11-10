# Ride Hailing Driver Review Implementation

## Overview
This document describes the implementation of driver reviews for ride hailing bookings in the mobile app.

## What Was Implemented

### 1. Backend Support (Already Exists)
The backend already has full support for driver reviews through the `/api/reviews/driver/` endpoint:
- Creates driver reviews for any booking type
- Validates booking completion
- Prevents duplicate reviews
- Supports anonymous reviews

### 2. Mobile App Changes

#### A. Review Service (`src/services/reviews.js`)
Added new function:
```javascript
createRideHailingDriverReview({ driver_id, ride_booking_id, reviewer_id, rating, comment, is_anonymous })
```
- Submits driver reviews specifically for ride hailing bookings
- Uses the same backend endpoint but marks booking_type as 'ride_hailing'

#### B. Ride Hailing Service (`src/services/rideHailingService.js`)
Updated:
- `completeRideBooking()` now invalidates reviews cache to trigger refresh
- Added `getRideBookingDetails()` to fetch ride details for review screen

#### C. Review Submission Screen (`src/screens/main/ReviewSubmissionScreen.js`)
Enhanced to support ride hailing:
- Accepts `bookingType` parameter ('tour' or 'ride_hailing')
- Accepts `rideBooking` parameter for ride hailing bookings
- Shows only driver review for ride hailing (no package review)
- Uses appropriate review submission function based on booking type

#### D. Review Prompt Component (`src/components/RideReviewPrompt.js`)
New component created:
- Modal that appears after ride completion
- Shows success message with driver name
- "Rate Driver" button navigates to review screen
- "Maybe Later" button dismisses the prompt

## How to Use

### For Tourists (After Ride Completion)

1. **Automatic Prompt**: When a ride is completed, a review prompt will appear
2. **Rate Driver**: Tap "Rate Driver" to open the review screen
3. **Submit Review**: Rate the driver (1-5 stars) and optionally add a comment
4. **Anonymous Option**: Toggle anonymous review if desired

### Integration Points

#### In Ride Completion Flow:
```javascript
import RideReviewPrompt from '../components/RideReviewPrompt';
import { getRideBookingDetails } from '../services/rideHailingService';

// After ride completion
const [showReviewPrompt, setShowReviewPrompt] = useState(false);
const [completedRide, setCompletedRide] = useState(null);

// When ride status changes to 'completed'
useEffect(() => {
  if (rideStatus === 'completed' && !hasReviewed) {
    setCompletedRide(rideData);
    setShowReviewPrompt(true);
  }
}, [rideStatus]);

// In render
<RideReviewPrompt
  visible={showReviewPrompt}
  onClose={() => setShowReviewPrompt(false)}
  driverName={completedRide?.driver_name}
  onReview={() => {
    setShowReviewPrompt(false);
    navigation.navigate('ReviewSubmission', {
      bookingType: 'ride_hailing',
      rideBooking: completedRide,
      driver: {
        id: completedRide.driver_id,
        name: completedRide.driver_name
      }
    });
  }}
/>
```

## Implementation Steps for Screens

### 1. Update TouristHomeScreen or Terminals Screen
Add review prompt after ride completion:

```javascript
// Add state
const [showReviewPrompt, setShowReviewPrompt] = useState(false);
const [completedRide, setCompletedRide] = useState(null);

// Monitor ride status
useEffect(() => {
  const checkRideStatus = async () => {
    if (activeRide && activeRide.status === 'completed') {
      // Check if already reviewed
      const { checkExistingReviews } = await import('../services/reviews');
      const reviewCheck = await checkExistingReviews({
        booking_id: activeRide.id,
        reviewer_id: user.id
      });
      
      if (!reviewCheck.data?.hasDriverReview) {
        setCompletedRide(activeRide);
        setShowReviewPrompt(true);
      }
    }
  };
  
  checkRideStatus();
}, [activeRide]);

// Add component
<RideReviewPrompt
  visible={showReviewPrompt}
  onClose={() => setShowReviewPrompt(false)}
  driverName={completedRide?.driver_name}
  onReview={() => {
    setShowReviewPrompt(false);
    navigation.navigate('ReviewSubmission', {
      bookingType: 'ride_hailing',
      rideBooking: completedRide,
      driver: {
        id: completedRide.driver_id,
        name: completedRide.driver_name
      }
    });
  }}
/>
```

### 2. Update DriverHomeScreen or DriverBookScreen
No changes needed - drivers don't review tourists for ride hailing (only for tour packages).

## Testing Checklist

- [ ] Complete a ride hailing booking
- [ ] Verify review prompt appears after completion
- [ ] Tap "Rate Driver" and verify navigation to review screen
- [ ] Submit a review with rating and comment
- [ ] Verify review is saved in backend
- [ ] Verify duplicate review prevention works
- [ ] Test anonymous review option
- [ ] Verify "Maybe Later" dismisses prompt
- [ ] Verify prompt doesn't show if already reviewed

## Backend Endpoints Used

### Create Driver Review
```
POST /api/reviews/driver/
Body: {
  driver_id: string,
  booking_id: string,
  reviewer_id: string,
  rating: number (1-5),
  comment: string (optional),
  is_anonymous: boolean (optional),
  booking_type: 'ride_hailing'
}
```

### Check Existing Reviews
```
GET /api/reviews/check-existing/{booking_id}/?reviewer_id={reviewer_id}
Response: {
  success: true,
  data: {
    has_package_review: boolean,
    has_driver_review: boolean
  }
}
```

### Get Driver Reviews
```
GET /api/reviews/driver/{driver_id}/?limit=20
Response: {
  success: true,
  data: {
    reviews: [...],
    average_rating: number,
    review_count: number
  }
}
```

## Database Schema

Reviews are stored in the `driver_reviews` table:
- `id`: UUID primary key
- `driver_id`: UUID (references users table)
- `booking_id`: UUID (references ride_hailing_bookings or bookings table)
- `reviewer_id`: UUID (references users table)
- `rating`: Integer (1-5)
- `comment`: Text
- `is_anonymous`: Boolean
- `is_published`: Boolean
- `created_at`: Timestamp

## Future Enhancements

1. **Review Reminders**: Send push notification if user hasn't reviewed after 24 hours
2. **Review Incentives**: Offer small rewards for leaving reviews
3. **Review Statistics**: Show driver's average rating in ride request
4. **Review Filters**: Filter drivers by minimum rating
5. **Review Responses**: Allow drivers to respond to reviews
6. **Review Moderation**: Admin panel to moderate inappropriate reviews

## Notes

- Reviews can only be submitted for completed rides
- One review per booking per user
- Anonymous reviews hide the reviewer's name
- Reviews are immediately visible to drivers
- Backend validates booking ownership and completion status
