# Anonymous Reviews Implementation

## Overview
This implementation adds anonymous review functionality for tourists, allowing them to choose whether their name appears when giving ratings and feedback after completing trips.

## Features Implemented

### 1. User Settings Service (`src/services/userSettings.js`)
- **Local storage** for user preferences using AsyncStorage
- **Anonymous review setting** management
- **Default settings** with anonymous reviews disabled by default
- **Persistent storage** that survives app restarts

### 2. Privacy Settings in Account Details
**File**: `src/screens/main/AccountDetailsScreen.js`
- **Tourist-only section** for privacy settings
- **Toggle switch** for anonymous reviews preference
- **Visual indicators** showing current setting
- **Immediate setting updates** when toggled

### 3. Enhanced Review Services
**File**: `src/services/reviews.js`
- **Updated createPackageReview()** to accept `is_anonymous` parameter
- **Updated createDriverReview()** to accept `is_anonymous` parameter
- **Backward compatibility** maintained for existing code

### 4. Review Submission Screen
**File**: `src/screens/main/ReviewSubmissionScreen.js`
- **Anonymous toggle** prominently displayed at top
- **User preference loading** from settings
- **Per-review override** option
- **Visual feedback** for anonymous state
- **Dual review support** (package + driver)

### 5. Booking History with Review Prompts
**File**: `src/screens/main/BookingHistoryScreen.js`
- **Completed bookings** display with review status
- **Review prompts** for unreviewed trips
- **Anonymous setting reminder** before review submission
- **Review completion tracking** (package + driver)
- **Direct navigation** to review submission

### 6. Navigation Integration
**File**: `src/navigation/RootNavigator.js`
- **BookingHistory** screen added to navigation stack
- **ReviewSubmission** screen added to navigation stack
- **Proper routing** from menu and other screens

## Backend Compatibility

The backend already supports anonymous reviews:

### Database Schema
```sql
-- package_reviews table
ALTER TABLE package_reviews 
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;

-- driver_reviews table  
ALTER TABLE driver_reviews 
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
```

### API Endpoints
- **POST /api/reviews/** - Package review creation with `is_anonymous` field
- **POST /api/reviews/driver/** - Driver review creation with `is_anonymous` field
- **GET /api/reviews/package/{id}/** - Returns reviews with proper anonymous display
- **GET /api/reviews/driver/{id}/** - Returns reviews with proper anonymous display

### Anonymous Display Logic
When `is_anonymous: true`:
- Review shows as "Anonymous" instead of user name
- Email is hidden in API responses
- User identity is protected while maintaining review integrity

## User Flow

### Setting Anonymous Preference
1. Tourist opens **Account Details** from menu
2. Scrolls to **Privacy Settings** section (tourist-only)
3. Toggles **Anonymous Reviews** switch
4. Setting is **immediately saved** to local storage

### Leaving a Review
1. Tourist completes a trip
2. Booking appears in **My Bookings** with review prompt
3. Tourist taps **"Leave Review"** button
4. System shows **anonymous setting confirmation**
5. Tourist can **change setting** or **continue**
6. **Review Submission** screen opens with anonymous toggle
7. Tourist can **override setting** for this specific review
8. Submits review with chosen anonymous preference

### Review Display
- **Anonymous reviews** show "Anonymous" as reviewer name
- **Named reviews** show actual user name
- **Rating and content** remain unchanged
- **Review authenticity** is maintained

## Technical Details

### Local Storage Structure
```javascript
{
  anonymousReviews: false,  // Default setting
  notifications: true,
  locationSharing: true,
  lastUpdated: "2024-01-15T10:30:00Z"
}
```

### API Request Format
```javascript
// Package Review
{
  package_id: "123",
  booking_id: "456", 
  reviewer_id: "789",
  rating: 5,
  comment: "Great experience!",
  is_anonymous: true  // New field
}

// Driver Review  
{
  driver_id: "123",
  booking_id: "456",
  reviewer_id: "789", 
  rating: 5,
  comment: "Excellent driver!",
  is_anonymous: true  // New field
}
```

### API Response Format
```javascript
{
  id: "review-123",
  rating: 5,
  comment: "Great experience!",
  reviewer_name: "Anonymous",  // When is_anonymous: true
  reviewer_email: "",          // Hidden when anonymous
  created_at: "2024-01-15T10:30:00Z",
  is_anonymous: true
}
```

## Security & Privacy

### Data Protection
- **User identity** is protected when anonymous option is selected
- **Review content** and **ratings** remain unchanged
- **No personal information** is exposed in anonymous reviews
- **Setting is user-controlled** and can be changed anytime

### Backend Security
- **is_anonymous flag** is properly validated
- **Display logic** respects anonymous preference
- **Database constraints** ensure data integrity
- **API responses** filter sensitive information

## Testing

Run the test script to verify implementation:
```bash
node test_anonymous_reviews.js
```

The test covers:
- User settings service functionality
- Review service parameter support
- Backend API compatibility
- UI component integration
- Complete user flow validation

## Files Modified/Created

### New Files
- `src/services/userSettings.js` - User preference management
- `src/screens/main/BookingHistoryScreen.js` - Booking history with review prompts
- `src/screens/main/ReviewSubmissionScreen.js` - Review submission with anonymous option
- `test_anonymous_reviews.js` - Implementation test script

### Modified Files
- `src/services/reviews.js` - Added anonymous parameter support
- `src/screens/main/AccountDetailsScreen.js` - Added privacy settings section
- `src/navigation/RootNavigator.js` - Added new screen routes

### Backend Files (Already Implemented)
- `api/reviews.py` - Anonymous review support
- `sql/add_anonymous_review_field.sql` - Database schema updates

## Usage Instructions

### For Tourists
1. **Set Default Preference**: Go to Account Details → Privacy Settings → Toggle "Anonymous Reviews"
2. **Review After Trip**: Go to My Bookings → Find completed trip → Tap "Leave Review"
3. **Choose Per Review**: In review screen, toggle anonymous option as desired
4. **Submit Review**: Complete rating and comments, then submit

### For Developers
1. **Import Settings Service**: `import { getUserSettings, updateAnonymousReviewSetting } from '../services/userSettings'`
2. **Check User Preference**: `const setting = await getAnonymousReviewSetting()`
3. **Submit Anonymous Review**: Include `is_anonymous: true` in review data
4. **Handle Display**: Backend automatically handles anonymous display logic

## Future Enhancements

### Potential Improvements
- **Granular privacy controls** (separate settings for package vs driver reviews)
- **Anonymous review statistics** in user profile
- **Bulk privacy updates** for existing reviews
- **Privacy policy integration** with anonymous settings
- **Admin controls** for anonymous review policies

### Analytics Considerations
- **Anonymous review rates** tracking
- **User preference analytics** (aggregated, not individual)
- **Review quality metrics** comparing anonymous vs named reviews
- **Privacy setting adoption** monitoring

## Conclusion

This implementation provides a comprehensive anonymous review system that:
- **Respects user privacy** while maintaining review authenticity
- **Integrates seamlessly** with existing review functionality  
- **Provides intuitive controls** for tourists to manage their privacy
- **Maintains backward compatibility** with existing code
- **Follows security best practices** for data protection

The feature is ready for production use and provides tourists with the privacy control they need when sharing feedback about their travel experiences.